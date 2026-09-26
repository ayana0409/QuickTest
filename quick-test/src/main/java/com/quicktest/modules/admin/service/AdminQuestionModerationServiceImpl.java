package com.quicktest.modules.admin.service;

import com.quicktest.config.CacheConfig;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.logging.AuditLog;
import com.quicktest.core.service.MediaDeleteProducer;
import com.quicktest.modules.admin.dto.AdminModerationStatsResponse;
import com.quicktest.modules.admin.dto.AdminQuestionModerationResponse;
import com.quicktest.modules.admin.dto.AiModerationJobMessage;
import com.quicktest.modules.admin.dto.AiModerationJobStatusResponse;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation for administering question content moderation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AdminQuestionModerationServiceImpl implements AdminQuestionModerationService {

    private final QuestionRepository questionRepository;
    private final AnswerOptionRepository answerOptionRepository;
    private final CandidateAnswerRepository candidateAnswerRepository;
    private final UserRepository userRepository;
    private final MediaDeleteProducer mediaDeleteProducer;
    private final AiModerationAsyncWorker aiModerationAsyncWorker;
    private final AiModerationProducer aiModerationProducer;

    @Override
    @Transactional(readOnly = true)
    // Cache paginated moderation list: FTS + 3 batch queries per page (IDs, questions+options, candidateAnswers)
    @Cacheable(
            value = CacheConfig.CACHE_ADMIN_MODERATION_QUESTIONS,
            key = "(#isSafe != null ? #isSafe : 'null') + ':' + (#hasImage != null ? #hasImage : 'null') + ':' + (#questionType != null ? #questionType.name() : 'ALL') + ':' + (#search != null ? #search.trim() : '') + ':' + #pageable.pageNumber + ':' + #pageable.pageSize"
    )
    public Page<AdminQuestionModerationResponse> getModerationQuestions(
            Boolean isSafe,
            Boolean hasImage,
            QuestionType questionType,
            String search,
            Pageable pageable) {

        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String codePattern = cleanSearch != null ? cleanSearch + "%" : null;
        String likePattern = cleanSearch != null ? "%" + cleanSearch.toLowerCase() + "%" : null;
        String qTypeStr = questionType != null ? questionType.name() : null;

        // Step 1: High performance ID pagination using Postgres Fulltext Search & GIN indexes
        Page<String> idPage = questionRepository.findModerationQuestionIds(
                isSafe, hasImage, qTypeStr, cleanSearch, codePattern, likePattern, pageable);

        if (idPage.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, idPage.getTotalElements());
        }

        List<UUID> questionIds = idPage.getContent().stream()
                .map(UUID::fromString)
                .toList();

        // Step 2: Batch fetch full Question entities with options and parent exam (avoids N+1)
        List<Question> questions = questionRepository.findAllByIdInWithOptionsAndExam(questionIds);
        Map<UUID, Question> questionMap = questions.stream()
                .collect(Collectors.toMap(Question::getId, q -> q));

        // Preserve page order from ID search
        List<Question> orderedQuestions = questionIds.stream()
                .map(questionMap::get)
                .filter(Objects::nonNull)
                .toList();

        // Step 3: Batch count candidate submissions per question
        Map<UUID, Long> attemptCounts = new HashMap<>();
        List<Object[]> rawCounts = candidateAnswerRepository.countAttemptsByQuestionIds(questionIds);
        for (Object[] row : rawCounts) {
            UUID qId = (UUID) row[0];
            Long count = ((Number) row[1]).longValue();
            attemptCounts.put(qId, count);
        }

        // Step 4: Batch fetch reviewer names
        Set<UUID> reviewerIds = orderedQuestions.stream()
                .map(Question::getReviewedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<UUID, String> reviewerNames = new HashMap<>();
        if (!reviewerIds.isEmpty()) {
            List<User> reviewers = userRepository.findAllById(reviewerIds);
            for (User u : reviewers) {
                reviewerNames.put(u.getId(), u.getFullName() != null ? u.getFullName() : u.getUsername());
            }
        }

        List<AdminQuestionModerationResponse> responses = orderedQuestions.stream()
                .map(q -> {
                    String reviewerName = q.getReviewedBy() != null ? reviewerNames.get(q.getReviewedBy()) : null;
                    long attempts = attemptCounts.getOrDefault(q.getId(), 0L);
                    return AdminQuestionModerationResponse.fromEntity(q, reviewerName, attempts);
                })
                .toList();

        return new PageImpl<>(responses, pageable, idPage.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    // Cache moderation stats: 4 COUNT queries on question table, changes only after flag update or delete
    @Cacheable(value = CacheConfig.CACHE_ADMIN_MODERATION_STATS, key = "'global'")
    public AdminModerationStatsResponse getModerationStats() {
        long total = questionRepository.count();
        long withImages = questionRepository.countQuestionsWithImages();
        long safe = questionRepository.countByIsSafe(true);
        long unreviewed = questionRepository.countByIsSafe(false);

        return AdminModerationStatsResponse.builder()
                .totalQuestions(total)
                .questionsWithImages(withImages)
                .safeQuestions(safe)
                .unreviewedQuestions(unreviewed)
                .build();
    }

    @Override
    @Transactional
    // Evict both caches: isSafe flag changes affect stats counts and list filters
    @Caching(evict = {
            @CacheEvict(value = CacheConfig.CACHE_ADMIN_MODERATION_STATS, key = "'global'"),
            @CacheEvict(value = CacheConfig.CACHE_ADMIN_MODERATION_QUESTIONS, allEntries = true)
    })
    @AuditLog(module = "MODERATION", action = "UPDATE_SAFETY_FLAG")
    public AdminQuestionModerationResponse updateSafetyFlag(UUID questionId, boolean isSafe, User adminUser) {
        Question question = questionRepository.findByIdWithOptionsAndExam(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", "id", questionId));

        question.setIsSafe(isSafe);
        question.setReviewedAt(isSafe ? LocalDateTime.now() : null);
        question.setReviewedBy(isSafe ? adminUser.getId() : null);

        Question saved = questionRepository.save(question);
        long attemptsCount = candidateAnswerRepository.countByQuestionId(questionId);
        String reviewerName = isSafe ? (adminUser.getFullName() != null ? adminUser.getFullName() : adminUser.getUsername()) : null;

        return AdminQuestionModerationResponse.fromEntity(saved, reviewerName, attemptsCount);
    }

    @Override
    @Transactional
    // Evict both caches: total question count changes and deleted question must disappear from list
    @Caching(evict = {
            @CacheEvict(value = CacheConfig.CACHE_ADMIN_MODERATION_STATS, key = "'global'"),
            @CacheEvict(value = CacheConfig.CACHE_ADMIN_MODERATION_QUESTIONS, allEntries = true)
    })
    @AuditLog(module = "MODERATION", action = "DELETE_QUESTION")
    public void deleteQuestionByAdmin(UUID questionId, User adminUser) {
        Question question = questionRepository.findByIdWithOptionsAndExam(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", "id", questionId));

        // 1. Collect all media identifiers (question image + option images)
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

        // 2. Cascade cleanup candidate answers to ensure zero foreign key constraint violations
        candidateAnswerRepository.deleteSelectedOptionsByQuestionId(questionId);
        candidateAnswerRepository.deleteByQuestionId(questionId);

        // 3. Delete answer options
        answerOptionRepository.deleteByQuestionId(questionId);

        // 4. Delete question itself
        questionRepository.deleteQuestionById(questionId);

        // 5. Schedule Cloudinary media purge asynchronously strictly after transaction commit
        if (!mediaToDelete.isEmpty()) {
            scheduleMediaDeletionAfterCommit(question.getExam().getId(), mediaToDelete, "ADMIN_QUESTION_MODERATION_DELETION");
        }
    }

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
            mediaDeleteProducer.sendDeleteBatches(examId, cleanMedia, source);
        }
    }

    @Override
    @AuditLog(module = "MODERATION", action = "TRIGGER_AI_MODERATION")
    public AiModerationJobStatusResponse triggerAiModeration() {
        // Prevent double-triggering: check if job is already running
        if (aiModerationAsyncWorker.isJobRunning()) {
            return AiModerationJobStatusResponse.builder()
                    .running(true)
                    .lastProcessedId(aiModerationAsyncWorker.getLastProcessedId())
                    .message("AI moderation job is already running. Please wait for it to finish.")
                    .build();
        }

        AiModerationJobMessage message = AiModerationJobMessage.builder()
                .jobId(UUID.randomUUID())
                .triggeredAt(LocalDateTime.now())
                .build();
        aiModerationProducer.sendModerationJob(message);

        return AiModerationJobStatusResponse.builder()
                .running(true)
                .processedCount(0)
                .safeCount(0)
                .unsafeCount(0)
                .lastProcessedId(aiModerationAsyncWorker.getLastProcessedId())
                .message("AI content moderation job has been queued successfully.")
                .build();
    }

    @Override
    public AiModerationJobStatusResponse getAiModerationJobStatus() {
        boolean running = aiModerationAsyncWorker.isJobRunning();
        String lastId = aiModerationAsyncWorker.getLastProcessedId();
        int processed = aiModerationAsyncWorker.getProcessedCount();
        int safe = aiModerationAsyncWorker.getSafeCount();
        int unsafe = aiModerationAsyncWorker.getUnsafeCount();

        String message = running
                ? "AI moderation job is currently running."
                : (lastId != null
                        ? "Job is idle. Last processed question ID: " + lastId
                        : "No moderation job has been run yet, or cursor has been reset.");

        return AiModerationJobStatusResponse.builder()
                .running(running)
                .processedCount(processed)
                .safeCount(safe)
                .unsafeCount(unsafe)
                .lastProcessedId(lastId)
                .message(message)
                .build();
    }

    @Override
    @AuditLog(module = "MODERATION", action = "RESET_AI_CURSOR")
    public void resetAiModerationCursor() {
        if (aiModerationAsyncWorker.isJobRunning()) {
            throw new AppException(
                    "Cannot reset cursor while a moderation job is running. Please wait for the job to finish.",
                    HttpStatus.CONFLICT);
        }
        aiModerationAsyncWorker.resetCursor();
    }
}
