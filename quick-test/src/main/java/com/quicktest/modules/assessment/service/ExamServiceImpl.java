package com.quicktest.modules.assessment.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.assessment.dto.ExamCloneTaskMessage;
import com.quicktest.modules.assessment.dto.ExamCloneTaskMessage.ImageCloneItem;
import com.quicktest.modules.assessment.dto.ExamCreateRequest;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.dto.ExamDuplicateRequest;
import com.quicktest.modules.assessment.dto.ExamRepublishRequest;
import com.quicktest.modules.assessment.dto.ExamSummaryResponse;
import com.quicktest.modules.assessment.dto.ExamUpdateRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.core.service.MediaDeleteProducer;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.service.ExamSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
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
    private final ExamSessionService examSessionService;
    private final RabbitTemplate rabbitTemplate;

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
                .isProctoringEnabled(Boolean.TRUE.equals(request.getIsProctoringEnabled()))
                .maxViolations(request.getMaxViolations() != null ? request.getMaxViolations() : 5)
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

        // Disallow modifications only when exam is archived
        if (exam.getStatus() == ExamStatus.ARCHIVED) {
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
        if (request.getIsProctoringEnabled() != null) {
            exam.setIsProctoringEnabled(request.getIsProctoringEnabled());
        }
        if (request.getMaxViolations() != null) {
            exam.setMaxViolations(request.getMaxViolations());
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
    public Page<ExamSummaryResponse> getTeacherExams(User teacher, String search, ExamStatus status, Pageable pageable) {
        String pattern = (search != null && !search.trim().isBlank())
                ? "%" + search.trim().toLowerCase() + "%"
                : null;
        return examRepository.findSummariesByTeacherId(teacher.getId(), status, pattern, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ExamSummaryResponse> getTeacherExams(User teacher, Pageable pageable) {
        return getTeacherExams(teacher, null, null, pageable);
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
        if (exam.getStatus() == ExamStatus.ARCHIVED) {
            throw new AppException("Cannot publish an archived exam");
        }

        // Business rule: Must contain at least one question
        long questionCount = questionRepository.countByExamId(examId);
        if (questionCount == 0) {
            throw new AppException(
                    "Cannot publish an exam without any questions. Please add at least one question first.");
        }

        if (exam.getEndTime() != null && exam.getEndTime().isBefore(LocalDateTime.now())) {
            throw new AppException("Thời gian kết thúc của đề thi đã qua (" + exam.getEndTime()
                    + "). Vui lòng cập nhật thời gian kết thúc trước khi mở lại đề thi.");
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

        // Automatically collect and submit all active in-progress attempts for this closed exam
        examSessionService.autoSubmitActiveAttemptsForExam(examId, "Exam closed by teacher");

        List<QuestionResponse> questions = fetchQuestionsWithOptions(examId);
        return ExamDetailResponse.fromEntityWithQuestions(closedExam, questions);
    }

    @Override
    @Transactional
    public ExamDetailResponse republishExam(UUID examId, ExamRepublishRequest request, User teacher) {
        log.info("Republishing exam ID: {} by teacher ID: {}", examId, teacher.getId());

        Exam exam = findExamWithCreatorOrThrow(examId);
        verifyOwnership(exam, teacher);

        if (exam.getStatus() == ExamStatus.PUBLISHED) {
            throw new AppException("Exam is already published");
        }
        if (exam.getStatus() == ExamStatus.ARCHIVED) {
            throw new AppException("Cannot republish an archived exam");
        }

        // Business rule: Must contain at least one question
        long questionCount = questionRepository.countByExamId(examId);
        if (questionCount == 0) {
            throw new AppException(
                    "Cannot publish an exam without any questions. Please add at least one question first.");
        }

        // Update optional schedule parameters
        if (request != null) {
            if (request.getStartTime() != null) {
                exam.setStartTime(request.getStartTime());
            }
            if (request.getEndTime() != null) {
                exam.setEndTime(request.getEndTime());
            }
            if (request.getDurationMinutes() != null) {
                exam.setDurationMinutes(request.getDurationMinutes());
            }
            if (request.getMaxAttempts() != null) {
                exam.setMaxAttempts(request.getMaxAttempts());
            }
        }

        validateTimeWindow(exam.getStartTime(), exam.getEndTime());

        if (exam.getEndTime() != null && exam.getEndTime().isBefore(LocalDateTime.now())) {
            throw new AppException("Thời gian kết thúc của đề thi phải sau thời điểm hiện tại (" + LocalDateTime.now() + ")");
        }

        exam.setStatus(ExamStatus.PUBLISHED);
        Exam republishedExam = examRepository.save(exam);
        log.info("Exam ID: {} successfully republished", examId);

        List<QuestionResponse> questions = fetchQuestionsWithOptions(examId);
        return ExamDetailResponse.fromEntityWithQuestions(republishedExam, questions);
    }

    @Override
    @Transactional
    public ExamDetailResponse duplicateExam(UUID examId, ExamDuplicateRequest request, User teacher) {
        log.info("Duplicating exam ID: {} by teacher ID: {}", examId, teacher.getId());

        Exam sourceExam = findExamWithCreatorOrThrow(examId);
        verifyOwnership(sourceExam, teacher);

        // 1. Determine title and generate new unique access code
        String newTitle = (request != null && request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle().trim()
                : "[Bản sao] " + sourceExam.getTitle();

        String newAccessCode = resolveAccessCode(null);

        // 2. Fetch all source questions with options
        List<Question> sourceQuestions = questionRepository.findByExamIdWithOptions(examId);

        // 3. Count images across questions and options
        boolean hasImages = false;
        for (Question sq : sourceQuestions) {
            if (sq.getImageUrl() != null && !sq.getImageUrl().isBlank()) {
                hasImages = true;
                break;
            }
            if (sq.getOptions() != null) {
                for (AnswerOption so : sq.getOptions()) {
                    if (so.getImageUrl() != null && !so.getImageUrl().isBlank()) {
                        hasImages = true;
                        break;
                    }
                }
                if (hasImages) break;
            }
        }

        // 4. Create new Exam entity (CLONING if has images, DRAFT if no images)
        Exam newExam = Exam.builder()
                .title(newTitle)
                .accessCode(newAccessCode)
                .description(sourceExam.getDescription())
                .status(hasImages ? ExamStatus.CLONING : ExamStatus.DRAFT)
                .durationMinutes(sourceExam.getDurationMinutes())
                .maxAttempts(sourceExam.getMaxAttempts())
                .shuffleQuestions(sourceExam.getShuffleQuestions())
                .shuffleOptions(sourceExam.getShuffleOptions())
                .isProctoringEnabled(sourceExam.getIsProctoringEnabled())
                .maxViolations(sourceExam.getMaxViolations())
                .startTime(null)
                .endTime(null)
                .createdBy(teacher)
                .questions(new ArrayList<>())
                .build();

        Exam savedNewExam = examRepository.save(newExam);

        // 5. Duplicate questions and options
        List<Question> newQuestions = new ArrayList<>();
        List<ImageCloneItem> actualTaskItems = new ArrayList<>();

        for (Question sq : sourceQuestions) {
            Question newQuestion = Question.builder()
                    .orderIndex(sq.getOrderIndex())
                    .content(sq.getContent())
                    .imageUrl(sq.getImageUrl())
                    .imagePublicId(sq.getImagePublicId())
                    .questionType(sq.getQuestionType())
                    .points(sq.getPoints())
                    .sampleAnswer(sq.getSampleAnswer())
                    .numericTolerance(sq.getNumericTolerance())
                    .gradingRubric(sq.getGradingRubric())
                    .exam(savedNewExam)
                    .options(new ArrayList<>())
                    .build();

            Question savedNewQuestion = questionRepository.save(newQuestion);

            if (sq.getImageUrl() != null && !sq.getImageUrl().isBlank()) {
                actualTaskItems.add(ImageCloneItem.builder()
                        .questionId(savedNewQuestion.getId())
                        .optionId(null)
                        .sourceUrl(sq.getImageUrl())
                        .sourcePublicId(sq.getImagePublicId())
                        .targetFolder("questions")
                        .build());
            }

            if (sq.getOptions() != null) {
                for (AnswerOption so : sq.getOptions()) {
                    AnswerOption newOption = AnswerOption.builder()
                            .orderIndex(so.getOrderIndex())
                            .content(so.getContent())
                            .imageUrl(so.getImageUrl())
                            .imagePublicId(so.getImagePublicId())
                            .isCorrect(so.getIsCorrect())
                            .question(savedNewQuestion)
                            .build();

                    AnswerOption savedNewOption = answerOptionRepository.save(newOption);

                    if (so.getImageUrl() != null && !so.getImageUrl().isBlank()) {
                        actualTaskItems.add(ImageCloneItem.builder()
                                .questionId(savedNewQuestion.getId())
                                .optionId(savedNewOption.getId())
                                .sourceUrl(so.getImageUrl())
                                .sourcePublicId(so.getImagePublicId())
                                .targetFolder("options")
                                .build());
                    }
                    newQuestion.getOptions().add(savedNewOption);
                }
            }
            newQuestions.add(savedNewQuestion);
        }

        savedNewExam.setQuestions(newQuestions);

        // 6. If hasImages, publish background task to RabbitMQ after commit
        if (hasImages) {
            UUID clonedExamId = savedNewExam.getId();
            UUID teacherId = teacher.getId();
            ExamCloneTaskMessage message = ExamCloneTaskMessage.builder()
                    .newExamId(clonedExamId)
                    .teacherId(teacherId)
                    .items(actualTaskItems)
                    .build();

            if (TransactionSynchronizationManager.isActualTransactionActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        log.info("Publishing exam clone task message to RabbitMQ for new exam ID: {} with {} images",
                                clonedExamId, actualTaskItems.size());
                        rabbitTemplate.convertAndSend(RabbitMQConfig.EXAM_CLONE_EXCHANGE,
                                RabbitMQConfig.EXAM_CLONE_ROUTING_KEY, message);
                    }
                });
            } else {
                rabbitTemplate.convertAndSend(RabbitMQConfig.EXAM_CLONE_EXCHANGE,
                        RabbitMQConfig.EXAM_CLONE_ROUTING_KEY, message);
            }
        } else {
            log.info("Exam ID: {} duplicated successfully as DRAFT without images. New exam ID: {}",
                    examId, savedNewExam.getId());
        }

        List<QuestionResponse> questionResponses = newQuestions.stream()
                .map(QuestionResponse::fromEntity)
                .collect(Collectors.toList());

        return ExamDetailResponse.fromEntityWithQuestions(savedNewExam, questionResponses);
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
