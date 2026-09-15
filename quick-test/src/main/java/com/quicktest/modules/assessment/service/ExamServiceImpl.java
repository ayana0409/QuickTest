package com.quicktest.modules.assessment.service;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.assessment.dto.ExamCreateRequest;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.dto.ExamSummaryResponse;
import com.quicktest.modules.assessment.dto.ExamUpdateRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.core.service.MediaDeleteProducer;
import com.quicktest.modules.iam.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;


import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service implementation managing exam authoring, access codes, lifecycle
 * transitions,
 * and teacher ownership checks.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ExamServiceImpl implements ExamService {

    private static final String ALPHANUMERIC_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final AnswerOptionRepository answerOptionRepository;
    private final MediaDeleteProducer mediaDeleteProducer;

    @Override
    @Transactional
    public ExamDetailResponse createExam(ExamCreateRequest request, User teacher) {
        log.info("Creating new exam '{}' for teacher ID: {}", request.getTitle(), teacher.getId());

        // 1. Validate start and end time constraints
        validateTimeWindow(request.getStartTime(), request.getEndTime());

        // 2. Resolve access code (custom provided or securely generated)
        String accessCode = resolveAccessCode(request.getAccessCode());

        // 3. Build and persist domain entity
        Exam exam = Exam.builder()
                .title(request.getTitle().trim())
                .accessCode(accessCode)
                .description(request.getDescription() != null ? request.getDescription().trim() : null)
                .status(ExamStatus.DRAFT)
                .durationMinutes(request.getDurationMinutes())
                .maxAttempts(request.getMaxAttempts() != null ? request.getMaxAttempts() : 1)
                .shuffleQuestions(request.getShuffleQuestions() != null ? request.getShuffleQuestions() : true)
                .shuffleOptions(request.getShuffleOptions() != null ? request.getShuffleOptions() : true)
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .createdBy(teacher)
                .questions(new ArrayList<>())
                .build();

        Exam savedExam = examRepository.save(exam);
        log.info("Exam created successfully with ID: {} and accessCode: {}", savedExam.getId(),
                savedExam.getAccessCode());

        return ExamDetailResponse.fromEntity(savedExam);
    }

    @Override
    @Transactional
    public ExamDetailResponse updateExam(UUID examId, ExamUpdateRequest request, User teacher) {
        log.info("Updating exam ID: {} by teacher ID: {}", examId, teacher.getId());

        Exam exam = findExamWithCreatorOrThrow(examId);
        verifyOwnership(exam, teacher);

        // Disallow modifications when exam is closed or archived
        if (exam.getStatus() == ExamStatus.CLOSED || exam.getStatus() == ExamStatus.ARCHIVED) {
            throw new AppException("Cannot update an exam with status " + exam.getStatus());
        }

        // Validate time window
        validateTimeWindow(request.getStartTime(), request.getEndTime());

        // Update fields
        exam.setTitle(request.getTitle().trim());
        exam.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        exam.setDurationMinutes(request.getDurationMinutes());
        if (request.getMaxAttempts() != null) {
            exam.setMaxAttempts(request.getMaxAttempts());
        }
        if (request.getShuffleQuestions() != null) {
            exam.setShuffleQuestions(request.getShuffleQuestions());
        }
        if (request.getShuffleOptions() != null) {
            exam.setShuffleOptions(request.getShuffleOptions());
        }
        exam.setStartTime(request.getStartTime());
        exam.setEndTime(request.getEndTime());

        Exam updatedExam = examRepository.save(exam);
        log.info("Exam ID: {} successfully updated", examId);

        List<QuestionResponse> questions = fetchQuestionsWithOptions(examId);
        return ExamDetailResponse.fromEntityWithQuestions(updatedExam, questions);
    }

    @Override
    @Transactional
    public void deleteExam(UUID examId, User teacher) {
        log.info("Attempting to delete exam ID: {} by teacher ID: {}", examId, teacher.getId());

        Exam exam = findExamWithCreatorOrThrow(examId);
        verifyOwnership(exam, teacher);

        // Only DRAFT exams can be deleted
        if (exam.getStatus() != ExamStatus.DRAFT) {
            throw new AppException(
                    "Cannot delete an exam that has been " + exam.getStatus() + ". Only DRAFT exams can be deleted.");
        }

        // 1. Gather all media identifiers (questions & answer options) in fast lightweight queries
        List<String> mediaIdentifiers = new ArrayList<>();
        mediaIdentifiers.addAll(questionRepository.findImageIdentifiersByExamId(examId));
        mediaIdentifiers.addAll(answerOptionRepository.findImageIdentifiersByExamId(examId));

        // 2. Fast bulk deletion in DB: AnswerOptions -> Questions -> Exam
        answerOptionRepository.deleteByExamId(examId);
        questionRepository.deleteByExamId(examId);
        examRepository.deleteExamById(examId);

        log.info("Exam ID: {} and all associated entities successfully deleted", examId);

        // 3. Offload media deletions to RabbitMQ strictly AFTER transaction commits
        if (!mediaIdentifiers.isEmpty()) {
            if (TransactionSynchronizationManager.isActualTransactionActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        log.info("Exam deletion transaction committed. Offloading {} media items to RabbitMQ for examId={}",
                                mediaIdentifiers.size(), examId);
                        mediaDeleteProducer.sendDeleteBatches(examId, mediaIdentifiers, "EXAM_DELETION");
                    }
                });
            } else {
                mediaDeleteProducer.sendDeleteBatches(examId, mediaIdentifiers, "EXAM_DELETION");
            }
        }
    }


    @Override
    @Transactional(readOnly = true)
    public Page<ExamSummaryResponse> getTeacherExams(User teacher, Pageable pageable) {
        return examRepository.findSummariesByTeacherId(teacher.getId(), pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public ExamDetailResponse getExamDetail(UUID examId, User teacher) {
        Exam exam = findExamWithCreatorOrThrow(examId);
        verifyOwnership(exam, teacher);

        List<QuestionResponse> questions = fetchQuestionsWithOptions(examId);
        return ExamDetailResponse.fromEntityWithQuestions(exam, questions);
    }

    @Override
    @Transactional
    public ExamDetailResponse publishExam(UUID examId, User teacher) {
        log.info("Publishing exam ID: {} by teacher ID: {}", examId, teacher.getId());

        Exam exam = findExamWithCreatorOrThrow(examId);
        verifyOwnership(exam, teacher);

        if (exam.getStatus() == ExamStatus.PUBLISHED) {
            throw new AppException("Exam is already published");
        }
        if (exam.getStatus() == ExamStatus.CLOSED || exam.getStatus() == ExamStatus.ARCHIVED) {
            throw new AppException("Cannot publish an exam that is " + exam.getStatus());
        }

        // Business rule: Must contain at least one question
        long questionCount = questionRepository.countByExamId(examId);
        if (questionCount == 0) {
            throw new AppException(
                    "Cannot publish an exam without any questions. Please add at least one question first.");
        }

        exam.setStatus(ExamStatus.PUBLISHED);
        Exam publishedExam = examRepository.save(exam);
        log.info("Exam ID: {} published successfully", examId);

        List<QuestionResponse> questions = fetchQuestionsWithOptions(examId);
        return ExamDetailResponse.fromEntityWithQuestions(publishedExam, questions);
    }

    @Override
    @Transactional
    public ExamDetailResponse closeExam(UUID examId, User teacher) {
        log.info("Closing exam ID: {} by teacher ID: {}", examId, teacher.getId());

        Exam exam = findExamWithCreatorOrThrow(examId);
        verifyOwnership(exam, teacher);

        if (exam.getStatus() == ExamStatus.CLOSED) {
            throw new AppException("Exam is already closed");
        }

        exam.setStatus(ExamStatus.CLOSED);
        Exam closedExam = examRepository.save(exam);
        log.info("Exam ID: {} closed successfully", examId);

        List<QuestionResponse> questions = fetchQuestionsWithOptions(examId);
        return ExamDetailResponse.fromEntityWithQuestions(closedExam, questions);
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    private Exam findExamWithCreatorOrThrow(UUID examId) {
        return examRepository.findByIdWithCreatedBy(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));
    }

    private void verifyOwnership(Exam exam, User teacher) {
        if (!exam.getCreatedBy().getId().equals(teacher.getId())) {
            throw new AccessDeniedException("You do not have permission to modify this exam");
        }
    }

    private void validateTimeWindow(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime != null && endTime != null && endTime.isBefore(startTime)) {
            throw new AppException("Exam end time must be after start time");
        }
    }

    private String resolveAccessCode(String customCode) {
        if (customCode != null && !customCode.trim().isEmpty()) {
            String sanitizedCode = customCode.trim().toUpperCase();
            if (examRepository.existsByAccessCode(sanitizedCode)) {
                throw new AppException("Access code '" + sanitizedCode + "' is already in use");
            }
            return sanitizedCode;
        }
        return generateUniqueAccessCode();
    }

    /**
     * Generate unique random alphanumeric access code (6-8 chars) using
     * SecureRandom.
     */
    private String generateUniqueAccessCode() {
        // Attempt 6-character code generation
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = generateRandomCode(6);
            if (!examRepository.existsByAccessCode(code)) {
                return code;
            }
        }
        // Fallback to 8-character code generation on collisions
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = generateRandomCode(8);
            if (!examRepository.existsByAccessCode(code)) {
                return code;
            }
        }
        throw new AppException("Failed to generate a unique access code. Please specify a custom code.",
                HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private String generateRandomCode(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            int index = SECURE_RANDOM.nextInt(ALPHANUMERIC_CHARS.length());
            sb.append(ALPHANUMERIC_CHARS.charAt(index));
        }
        return sb.toString();
    }

    /**
     * Load questions along with options in a single SQL query via
     * QuestionRepository.
     */
    private List<QuestionResponse> fetchQuestionsWithOptions(UUID examId) {
        List<Question> questions = questionRepository.findByExamIdWithOptions(examId);
        return questions.stream()
                .map(QuestionResponse::fromEntity)
                .collect(Collectors.toList());
    }
}
