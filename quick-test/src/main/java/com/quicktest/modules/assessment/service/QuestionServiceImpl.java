package com.quicktest.modules.assessment.service;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.service.CloudinaryStorageService;
import com.quicktest.core.service.MediaDeleteProducer;
import com.quicktest.modules.assessment.dto.AnswerOptionDto;
import com.quicktest.modules.assessment.dto.QuestionCreateRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.dto.QuestionUpdateRequest;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service implementation managing question authoring, validation rules,
 * option synchronization, and teacher ownership checks.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class QuestionServiceImpl implements QuestionService {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final AnswerOptionRepository answerOptionRepository;
    private final CloudinaryStorageService cloudinaryStorageService;
    private final MediaDeleteProducer mediaDeleteProducer;

    @Override
    @Transactional
    public QuestionResponse addQuestionToExam(UUID examId, QuestionCreateRequest request, User teacher) {
        log.info("Adding question to exam ID: {} by teacher ID: {}", examId, teacher.getId());

        Exam exam = examRepository.findByIdWithCreatedBy(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));

        verifyOwnership(exam, teacher);
        verifyExamIsDraft(exam);
        validateQuestionBusinessRules(
                request.getQuestionType(),
                request.getSampleAnswer(),
                request.getNumericTolerance(),
                request.getGradingRubric(),
                request.getOptions()
        );

        // Validate question must have either text content or an image URL
        boolean hasContent = request.getContent() != null && !request.getContent().trim().isEmpty();
        boolean hasImage = request.getImageUrl() != null && !request.getImageUrl().trim().isEmpty();
        if (!hasContent && !hasImage) {
            throw new AppException("Question must have either text content or an image URL");
        }

        // Resolve order index
        int nextOrderIndex = request.getOrderIndex() != null
                ? request.getOrderIndex()
                : (int) questionRepository.countByExamId(examId) + 1;

        Double numericTolerance = null;
        if (request.getQuestionType() == QuestionType.NUMERIC) {
            numericTolerance = request.getNumericTolerance() != null ? request.getNumericTolerance() : 0.0;
        }

        String sampleAnswer = request.getSampleAnswer() != null ? request.getSampleAnswer().trim() : null;
        if (request.getQuestionType() == QuestionType.NUMERIC && sampleAnswer != null) {
            sampleAnswer = sampleAnswer.replace(" ", "").replace(',', '.');
        }

        Question question = Question.builder()
                .exam(exam)
                .content(hasContent ? request.getContent().trim() : null)
                .imageUrl(hasImage ? request.getImageUrl().trim() : null)
                .imagePublicId(request.getImagePublicId() != null ? request.getImagePublicId().trim() : null)
                .questionType(request.getQuestionType())
                .points(request.getPoints())
                .orderIndex(nextOrderIndex)
                .sampleAnswer(sampleAnswer)
                .numericTolerance(numericTolerance)
                .gradingRubric(request.getGradingRubric() != null ? request.getGradingRubric().trim() : null)
                .options(new ArrayList<>())
                .build();

        // Populate options for choice-based questions
        if (isChoiceQuestion(request.getQuestionType()) && request.getOptions() != null) {
            int optionIndex = 1;
            for (AnswerOptionDto optionDto : request.getOptions()) {
                boolean hasOptContent = optionDto.getContent() != null && !optionDto.getContent().trim().isEmpty();
                boolean hasOptImage = optionDto.getImageUrl() != null && !optionDto.getImageUrl().trim().isEmpty();
                if (!hasOptContent && !hasOptImage) {
                    throw new AppException("Answer option must have either text content or an image URL");
                }
                AnswerOption option = AnswerOption.builder()
                        .question(question)
                        .content(hasOptContent ? optionDto.getContent().trim() : null)
                        .imageUrl(hasOptImage ? optionDto.getImageUrl().trim() : null)
                        .imagePublicId(optionDto.getImagePublicId() != null ? optionDto.getImagePublicId().trim() : null)
                        .isCorrect(Boolean.TRUE.equals(optionDto.getIsCorrect()))
                        .orderIndex(optionDto.getOrderIndex() != null ? optionDto.getOrderIndex() : optionIndex++)
                        .build();
                question.getOptions().add(option);
            }
        }

        Question savedQuestion = questionRepository.save(question);
        log.info("Question created successfully with ID: {} in exam ID: {}", savedQuestion.getId(), examId);

        return QuestionResponse.fromEntity(savedQuestion);
    }

    @Override
    @Transactional
    public QuestionResponse updateQuestion(UUID questionId, QuestionUpdateRequest request, User teacher) {
        log.info("Updating question ID: {} by teacher ID: {}", questionId, teacher.getId());

        Question question = questionRepository.findByIdWithOptionsAndExam(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", "id", questionId));

        verifyOwnership(question.getExam(), teacher);
        verifyExamIsDraft(question.getExam());
        validateQuestionBusinessRules(
                request.getQuestionType(),
                request.getSampleAnswer(),
                request.getNumericTolerance(),
                request.getGradingRubric(),
                request.getOptions()
        );

        boolean hasContent = request.getContent() != null && !request.getContent().trim().isEmpty();
        boolean hasImage = request.getImageUrl() != null && !request.getImageUrl().trim().isEmpty();
        if (!hasContent && !hasImage) {
            throw new AppException("Question must have either text content or an image URL");
        }

        // Track media identifiers to delete asynchronously via RabbitMQ
        List<String> mediaToDelete = new ArrayList<>();

        // Cleanup old question image if replaced or removed
        boolean imageChanged = false;
        if (question.getImagePublicId() != null) {
            imageChanged = request.getImagePublicId() == null
                    || !question.getImagePublicId().equals(request.getImagePublicId().trim());
        } else if (question.getImageUrl() != null) {
            imageChanged = request.getImageUrl() == null
                    || !question.getImageUrl().equals(request.getImageUrl().trim());
        }
        if (imageChanged) {
            if (question.getImagePublicId() != null && !question.getImagePublicId().isBlank()) {
                mediaToDelete.add(question.getImagePublicId());
            } else if (question.getImageUrl() != null && !question.getImageUrl().isBlank()) {
                mediaToDelete.add(question.getImageUrl());
            }
        }

        question.setContent(hasContent ? request.getContent().trim() : null);
        question.setImageUrl(hasImage ? request.getImageUrl().trim() : null);
        question.setImagePublicId(request.getImagePublicId() != null ? request.getImagePublicId().trim() : null);
        question.setQuestionType(request.getQuestionType());
        question.setPoints(request.getPoints());
        if (request.getOrderIndex() != null) {
            question.setOrderIndex(request.getOrderIndex());
        }

        // Configure type-specific attributes
        if (request.getQuestionType() == QuestionType.NUMERIC) {
            String sampleAnswer = request.getSampleAnswer() != null
                    ? request.getSampleAnswer().trim().replace(" ", "").replace(',', '.')
                    : null;
            question.setSampleAnswer(sampleAnswer);
            question.setNumericTolerance(request.getNumericTolerance() != null ? request.getNumericTolerance() : 0.0);
            question.setGradingRubric(null);
            // Bulk delete existing options in DB to avoid N+1 queries
            answerOptionRepository.deleteByQuestionId(questionId);
            question.getOptions().clear();
        } else if (request.getQuestionType() == QuestionType.ESSAY_TEXT) {
            question.setSampleAnswer(request.getSampleAnswer() != null ? request.getSampleAnswer().trim() : null);
            question.setNumericTolerance(null);
            question.setGradingRubric(request.getGradingRubric() != null ? request.getGradingRubric().trim() : null);
            // Bulk delete existing options in DB to avoid N+1 queries
            answerOptionRepository.deleteByQuestionId(questionId);
            question.getOptions().clear();
        } else {
            // Choice types
            question.setSampleAnswer(null);
            question.setNumericTolerance(null);
            question.setGradingRubric(null);

            // Cleanup old option images that are not retained in new options
            if (question.getOptions() != null) {
                for (AnswerOption oldOpt : question.getOptions()) {
                    boolean retained = false;
                    if (request.getOptions() != null) {
                        for (AnswerOptionDto newOpt : request.getOptions()) {
                            if (oldOpt.getImagePublicId() != null && oldOpt.getImagePublicId().equals(newOpt.getImagePublicId())) {
                                retained = true;
                                break;
                            }
                            if (oldOpt.getImageUrl() != null && oldOpt.getImageUrl().equals(newOpt.getImageUrl())) {
                                retained = true;
                                break;
                            }
                        }
                    }
                    if (!retained) {
                        if (oldOpt.getImagePublicId() != null && !oldOpt.getImagePublicId().isBlank()) {
                            mediaToDelete.add(oldOpt.getImagePublicId());
                        } else if (oldOpt.getImageUrl() != null && !oldOpt.getImageUrl().isBlank()) {
                            mediaToDelete.add(oldOpt.getImageUrl());
                        }
                    }
                }
            }

            // In-place synchronization of options collection to avoid N+1 deletes & re-inserts
            List<AnswerOption> existingOptions = question.getOptions();
            List<AnswerOptionDto> newOptionDtos = request.getOptions() != null ? request.getOptions() : new ArrayList<>();
            int minSize = Math.min(existingOptions.size(), newOptionDtos.size());

            // 1. Update existing options in-place (no deletes, no re-inserts)
            for (int i = 0; i < minSize; i++) {
                AnswerOptionDto optionDto = newOptionDtos.get(i);
                boolean hasOptContent = optionDto.getContent() != null && !optionDto.getContent().trim().isEmpty();
                boolean hasOptImage = optionDto.getImageUrl() != null && !optionDto.getImageUrl().trim().isEmpty();
                if (!hasOptContent && !hasOptImage) {
                    throw new AppException("Answer option must have either text content or an image URL");
                }
                AnswerOption existing = existingOptions.get(i);
                existing.setContent(hasOptContent ? optionDto.getContent().trim() : null);
                existing.setImageUrl(hasOptImage ? optionDto.getImageUrl().trim() : null);
                existing.setImagePublicId(optionDto.getImagePublicId() != null ? optionDto.getImagePublicId().trim() : null);
                existing.setIsCorrect(Boolean.TRUE.equals(optionDto.getIsCorrect()));
                existing.setOrderIndex(optionDto.getOrderIndex() != null ? optionDto.getOrderIndex() : (i + 1));
            }

            // 2. Add new options if newOptionDtos has more items
            if (newOptionDtos.size() > existingOptions.size()) {
                for (int i = minSize; i < newOptionDtos.size(); i++) {
                    AnswerOptionDto optionDto = newOptionDtos.get(i);
                    boolean hasOptContent = optionDto.getContent() != null && !optionDto.getContent().trim().isEmpty();
                    boolean hasOptImage = optionDto.getImageUrl() != null && !optionDto.getImageUrl().trim().isEmpty();
                    if (!hasOptContent && !hasOptImage) {
                        throw new AppException("Answer option must have either text content or an image URL");
                    }
                    AnswerOption option = AnswerOption.builder()
                            .question(question)
                            .content(hasOptContent ? optionDto.getContent().trim() : null)
                            .imageUrl(hasOptImage ? optionDto.getImageUrl().trim() : null)
                            .imagePublicId(optionDto.getImagePublicId() != null ? optionDto.getImagePublicId().trim() : null)
                            .isCorrect(Boolean.TRUE.equals(optionDto.getIsCorrect()))
                            .orderIndex(optionDto.getOrderIndex() != null ? optionDto.getOrderIndex() : (i + 1))
                            .build();
                    existingOptions.add(option);
                }
            } else if (existingOptions.size() > newOptionDtos.size()) {
                // 3. Remove excess options if newOptionDtos has fewer items
                existingOptions.subList(minSize, existingOptions.size()).clear();
            }
        }

        Question updatedQuestion = questionRepository.save(question);
        log.info("Question ID: {} successfully updated", questionId);

        // Schedule deletion of removed media strictly AFTER transaction commits
        if (!mediaToDelete.isEmpty()) {
            scheduleMediaDeletionAfterCommit(question.getExam().getId(), mediaToDelete, "QUESTION_UPDATE");
        }

        return QuestionResponse.fromEntity(updatedQuestion);
    }

    @Override
    @Transactional
    public void deleteQuestion(UUID questionId, User teacher) {
        log.info("Deleting question ID: {} by teacher ID: {}", questionId, teacher.getId());

        Question question = questionRepository.findByIdWithOptionsAndExam(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", "id", questionId));

        verifyOwnership(question.getExam(), teacher);
        verifyExamIsDraft(question.getExam());

        // Collect question image and option images to delete asynchronously via RabbitMQ
        List<String> mediaToDelete = new ArrayList<>();
        if (question.getImagePublicId() != null && !question.getImagePublicId().isBlank()) {
            mediaToDelete.add(question.getImagePublicId());
        } else if (question.getImageUrl() != null && !question.getImageUrl().isBlank()) {
            mediaToDelete.add(question.getImageUrl());
        }

        if (question.getOptions() != null) {
            for (AnswerOption opt : question.getOptions()) {
                if (opt.getImagePublicId() != null && !opt.getImagePublicId().isBlank()) {
                    mediaToDelete.add(opt.getImagePublicId());
                } else if (opt.getImageUrl() != null && !opt.getImageUrl().isBlank()) {
                    mediaToDelete.add(opt.getImageUrl());
                }
            }
        }

        // 1. Bulk delete all answer options in 1 SQL query to avoid N+1 Hibernate deletes
        answerOptionRepository.deleteByQuestionId(questionId);

        // 2. Bulk delete question itself in 1 SQL query
        questionRepository.deleteQuestionById(questionId);
        log.info("Question ID: {} and its answer options successfully deleted from database via bulk queries", questionId);

        // Schedule media deletion strictly AFTER transaction commit succeeds
        if (!mediaToDelete.isEmpty()) {
            scheduleMediaDeletionAfterCommit(question.getExam().getId(), mediaToDelete, "QUESTION_DELETION");
        }
    }

    @Override
    @Transactional
    public QuestionResponse updateQuestionImage(UUID questionId, org.springframework.web.multipart.MultipartFile file, User teacher) {
        log.info("Directly updating image for question ID: {} by teacher ID: {}", questionId, teacher.getId());

        Question question = questionRepository.findByIdWithOptionsAndExam(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", "id", questionId));

        verifyOwnership(question.getExam(), teacher);
        verifyExamIsDraft(question.getExam());

        // Upload new image to Cloudinary
        com.quicktest.modules.assessment.dto.MediaUploadResponse uploadRes =
                cloudinaryStorageService.uploadSingle(file, "questions");

        // Collect old image to delete asynchronously
        List<String> mediaToDelete = new ArrayList<>();
        if (question.getImagePublicId() != null && !question.getImagePublicId().isBlank()) {
            mediaToDelete.add(question.getImagePublicId());
        } else if (question.getImageUrl() != null && !question.getImageUrl().isBlank()) {
            mediaToDelete.add(question.getImageUrl());
        }

        question.setImageUrl(uploadRes.getUrl());
        question.setImagePublicId(uploadRes.getPublicId());

        Question saved = questionRepository.save(question);
        log.info("Question ID: {} image directly updated: newUrl={}", questionId, uploadRes.getUrl());

        // Schedule old media deletion strictly AFTER transaction commits
        if (!mediaToDelete.isEmpty()) {
            scheduleMediaDeletionAfterCommit(question.getExam().getId(), mediaToDelete, "QUESTION_IMAGE_UPDATE");
        }

        return QuestionResponse.fromEntity(saved);
    }

    /**
     * Schedule media deletion batches to RabbitMQ strictly AFTER the current database transaction commits.
     * If the transaction rolls back due to an error, this hook is never triggered, preventing data loss on Cloudinary.
     */
    private void scheduleMediaDeletionAfterCommit(UUID examId, List<String> mediaIdentifiers, String source) {
        if (mediaIdentifiers == null || mediaIdentifiers.isEmpty()) {
            return;
        }

        List<String> cleanMedia = mediaIdentifiers.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        if (cleanMedia.isEmpty()) {
            return;
        }

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    log.info("Transaction committed. Dispatching {} media identifiers to RabbitMQ deletion queue for examId={}, source={}",
                            cleanMedia.size(), examId, source);
                    mediaDeleteProducer.sendDeleteBatches(examId, cleanMedia, source);
                }
            });
        } else {
            log.info("No active transaction. Directly dispatching {} media identifiers to RabbitMQ deletion queue for examId={}, source={}",
                    cleanMedia.size(), examId, source);
            mediaDeleteProducer.sendDeleteBatches(examId, cleanMedia, source);
        }
    }

    // ==========================================
    // Business Validation & Helper Methods
    // ==========================================

    /**
     * Enforce strict business rules per question type.
     */
    public static void validateQuestionBusinessRules(
            QuestionType questionType,
            String sampleAnswer,
            Double numericTolerance,
            String gradingRubric,
            List<AnswerOptionDto> options) {

        if (questionType == null) {
            throw new AppException("Question type cannot be null");
        }

        switch (questionType) {
            case SINGLE_CHOICE -> {
                if (options == null || options.size() < 2) {
                    throw new AppException("Single choice question must have at least 2 answer options");
                }
                long correctCount = options.stream()
                        .filter(opt -> Boolean.TRUE.equals(opt.getIsCorrect()))
                        .count();
                if (correctCount != 1) {
                    throw new AppException("Single choice question must have exactly one correct answer option");
                }
            }
            case MULTIPLE_CHOICE -> {
                if (options == null || options.size() < 2) {
                    throw new AppException("Multiple choice question must have at least 2 answer options");
                }
                long correctCount = options.stream()
                        .filter(opt -> Boolean.TRUE.equals(opt.getIsCorrect()))
                        .count();
                if (correctCount < 1) {
                    throw new AppException("Multiple choice question must have at least one correct answer option");
                }
            }
            case NUMERIC -> {
                if (options != null && !options.isEmpty()) {
                    throw new AppException("Numeric question must not contain answer options");
                }
                if (sampleAnswer == null || sampleAnswer.trim().isEmpty()) {
                    throw new AppException("Numeric question requires a valid sample answer");
                }
                try {
                    // Support both dot '.' and comma ',' decimal separators
                    String normalizedSample = sampleAnswer.trim().replace(" ", "").replace(',', '.');
                    double parsed = Double.parseDouble(normalizedSample);
                    if (Double.isNaN(parsed) || Double.isInfinite(parsed)) {
                        throw new AppException("Sample answer for numeric question must be a finite number");
                    }
                } catch (NumberFormatException ex) {
                    throw new AppException("Sample answer for numeric question must be a valid number (e.g. 42 or 3.14 or 3,14)");
                }
                if (numericTolerance != null && numericTolerance < 0.0) {
                    throw new AppException("Numeric tolerance cannot be negative");
                }
            }
            case ESSAY_TEXT -> {
                if (options != null && !options.isEmpty()) {
                    throw new AppException("Essay question must not contain answer options");
                }
                if (gradingRubric == null || gradingRubric.trim().isEmpty()) {
                    throw new AppException("Essay question requires a grading rubric");
                }
            }

        }
    }

    private boolean isChoiceQuestion(QuestionType type) {
        return type == QuestionType.SINGLE_CHOICE || type == QuestionType.MULTIPLE_CHOICE;
    }

    private void verifyOwnership(Exam exam, User teacher) {
        if (!exam.getCreatedBy().getId().equals(teacher.getId())) {
            throw new AccessDeniedException("You do not have permission to modify this exam");
        }
    }

    private void verifyExamIsDraft(Exam exam) {
        if (exam.getStatus() != ExamStatus.DRAFT) {
            throw new AppException("Cannot modify questions for an exam with status " + exam.getStatus() + ". Only DRAFT exams can be modified.");
        }
    }
}
