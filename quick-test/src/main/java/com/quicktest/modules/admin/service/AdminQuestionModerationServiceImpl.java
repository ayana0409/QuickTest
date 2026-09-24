package com.quicktest.modules.admin.service;

import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.service.MediaDeleteProducer;
import com.quicktest.modules.admin.dto.AdminModerationStatsResponse;
import com.quicktest.modules.admin.dto.AdminQuestionModerationResponse;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
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

    @Override
    @Transactional(readOnly = true)
    public Page<AdminQuestionModerationResponse> getModerationQuestions(
            Boolean isSafe,
            Boolean hasImage,
            QuestionType questionType,
            String search,
            Pageable pageable) {

        log.info("Admin fetching moderation questions: isSafe={}, hasImage={}, type={}, search='{}'",
                isSafe, hasImage, questionType, search);

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
    public AdminModerationStatsResponse getModerationStats() {
        log.info("Calculating aggregate moderation statistics");

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
    public AdminQuestionModerationResponse updateSafetyFlag(UUID questionId, boolean isSafe, User adminUser) {
        log.info("Admin ID: {} updating safety flag for question ID: {} to {}",
                adminUser.getId(), questionId, isSafe);

        Question question = questionRepository.findByIdWithOptionsAndExam(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", "id", questionId));

        question.setIsSafe(isSafe);
        question.setReviewedAt(isSafe ? LocalDateTime.now() : null);
        question.setReviewedBy(isSafe ? adminUser.getId() : null);

        Question saved = questionRepository.save(question);
        long attemptsCount = candidateAnswerRepository.countByQuestionId(questionId);
        String reviewerName = isSafe ? (adminUser.getFullName() != null ? adminUser.getFullName() : adminUser.getUsername()) : null;

        log.info("Question ID: {} safety flag successfully set to: {}", questionId, isSafe);
        return AdminQuestionModerationResponse.fromEntity(saved, reviewerName, attemptsCount);
    }

    @Override
    @Transactional
    public void deleteQuestionByAdmin(UUID questionId, User adminUser) {
        log.warn("Admin ID: {} deleting question ID: {} for content violation",
                adminUser.getId(), questionId);

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

        log.info("Question ID: {} and all associated candidate answers deleted from DB by Admin", questionId);

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
}
