package com.quicktest.modules.session.service;

import com.quicktest.core.service.GeminiRotationService;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.logging.AuditLog;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.CandidateSubmissionItemDto;
import com.quicktest.modules.session.dto.ExamGradingQuestionsResponse;
import com.quicktest.modules.session.dto.ManualBatchGradeRequest;
import com.quicktest.modules.session.dto.ManualBatchGradeResponse;
import com.quicktest.modules.session.dto.ManualGradeItemRequest;
import com.quicktest.modules.session.dto.QuestionGradingSummaryResponse;
import com.quicktest.modules.session.dto.QuestionSubmissionsDetailResponse;
import com.quicktest.modules.session.dto.TriggerAiGradingRequest;
import com.quicktest.modules.session.dto.TriggerAiGradingResponse;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.redis.core.StringRedisTemplate;
import com.quicktest.core.service.AiMetricsRedisService;
import java.time.Duration;

import com.quicktest.core.service.GeminiGradingService;
import com.quicktest.modules.assessment.ai.dto.TeacherAiTaskDto;
import com.quicktest.modules.assessment.ai.service.TeacherAiTaskService;
import com.quicktest.modules.session.dto.AiBatchGradingResultDto;
import com.quicktest.modules.session.dto.AiSingleGradeDto;

/**
 * Implementation of QuestionGradingService providing question-centric grading
 * and delegating batch AI evaluation to QuestionGradingAsyncWorker for background execution.
 */
@Slf4j
@Service
@SuppressWarnings("null")
public class QuestionGradingServiceImpl implements QuestionGradingService {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final CandidateAnswerRepository candidateAnswerRepository;
    private final QuestionGradingAsyncWorker asyncWorker;
    private final GeminiRotationService geminiRotationService;
    private final GeminiGradingService geminiGradingService;
    private final StringRedisTemplate stringRedisTemplate;
    private final AiMetricsRedisService aiMetricsRedisService;
    private final TeacherAiTaskService teacherAiTaskService;

    public QuestionGradingServiceImpl(
            ExamRepository examRepository,
            QuestionRepository questionRepository,
            CandidateAnswerRepository candidateAnswerRepository,
            QuestionGradingAsyncWorker asyncWorker,
            GeminiRotationService geminiRotationService,
            GeminiGradingService geminiGradingService,
            StringRedisTemplate stringRedisTemplate,
            AiMetricsRedisService aiMetricsRedisService,
            TeacherAiTaskService teacherAiTaskService) {
        this.examRepository = examRepository;
        this.questionRepository = questionRepository;
        this.candidateAnswerRepository = candidateAnswerRepository;
        this.asyncWorker = asyncWorker;
        this.geminiRotationService = geminiRotationService;
        this.geminiGradingService = geminiGradingService;
        this.stringRedisTemplate = stringRedisTemplate;
        this.aiMetricsRedisService = aiMetricsRedisService;
        this.teacherAiTaskService = teacherAiTaskService;
    }


    @Override
    @Transactional
    public ExamGradingQuestionsResponse getQuestionsForGrading(UUID examId, User teacher) {
        log.info("Teacher {} fetching essay questions for grading in exam ID: {}", teacher.getId(), examId);

        Exam exam = examRepository.findByIdWithCreatedBy(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));
        verifyExamOwnership(exam, teacher);

        // Self-heal: auto-resolve any legacy empty pending essay answers for this exam
        autoResolveEmptyPendingAnswersForExam(examId);

        // Fetch ONLY essay questions directly in SQL
        List<Question> essayQuestions = questionRepository
                .findByExamIdAndQuestionTypeOrderByOrderIndexAsc(examId, QuestionType.ESSAY_TEXT);

        if (essayQuestions.isEmpty()) {
            return ExamGradingQuestionsResponse.builder()
                    .examId(exam.getId())
                    .examTitle(exam.getTitle())
                    .examStatus(exam.getStatus())
                    .totalEssayQuestions(0)
                    .questions(java.util.Collections.emptyList())
                    .build();
        }

        List<UUID> questionIds = essayQuestions.stream()
                .map(Question::getId)
                .toList();

        // Single batch aggregation query: [questionId, totalCount, pendingCount, gradedCount]
        List<Object[]> countRows = candidateAnswerRepository.getGradingCountsByQuestionIds(questionIds);

        // Map counts by questionId: Map<UUID, long[]{total, pending, graded}>
        Map<UUID, long[]> countMap = new java.util.HashMap<>(countRows.size());
        for (Object[] row : countRows) {
            UUID qId = (UUID) row[0];
            long total = row[1] != null ? ((Number) row[1]).longValue() : 0L;
            long pending = row[2] != null ? ((Number) row[2]).longValue() : 0L;
            long graded = row[3] != null ? ((Number) row[3]).longValue() : 0L;
            countMap.put(qId, new long[]{total, pending, graded});
        }

        List<QuestionGradingSummaryResponse> summaries = new ArrayList<>(essayQuestions.size());
        for (Question q : essayQuestions) {
            long[] counts = countMap.getOrDefault(q.getId(), new long[]{0L, 0L, 0L});

            summaries.add(QuestionGradingSummaryResponse.builder()
                    .questionId(q.getId())
                    .orderIndex(q.getOrderIndex())
                    .content(q.getContent())
                    .imageUrl(q.getImageUrl())
                    .maxPoints(q.getPoints() != null ? q.getPoints() : 0.0)
                    .totalSubmissions(counts[0])
                    .pendingCount(counts[1])
                    .gradedCount(counts[2])
                    .build());
        }

        return ExamGradingQuestionsResponse.builder()
                .examId(exam.getId())
                .examTitle(exam.getTitle())
                .examStatus(exam.getStatus())
                .totalEssayQuestions(summaries.size())
                .questions(summaries)
                .build();
    }

    @Override
    @Transactional
    public QuestionSubmissionsDetailResponse getQuestionSubmissions(
            UUID questionId, GradingStatus filterStatus, Pageable pageable, User teacher) {

        log.info("Teacher {} fetching submissions for question ID: {}, filter: {}",
                teacher.getId(), questionId, filterStatus);

        Question question = questionRepository.findByIdWithOptionsAndExam(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", "id", questionId));
        verifyExamOwnership(question.getExam(), teacher);

        if (question.getQuestionType() != QuestionType.ESSAY_TEXT) {
            throw new AppException("Only essay questions support submission grading view", HttpStatus.BAD_REQUEST);
        }

        // Self-heal: auto-resolve any legacy empty pending essay answers for this specific question
        autoResolveEmptyPendingAnswers(questionId);

        // Use un-sorted PageRequest because the JPQL query defines its own deterministic ORDER BY a.submitTime DESC NULLS LAST
        Pageable safePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());

        Page<CandidateAnswer> answerPage;
        if (filterStatus == GradingStatus.PENDING_MANUAL) {
            answerPage = candidateAnswerRepository.findPendingManualSubmissionsWithAttemptAndUser(
                    questionId, safePageable);
        } else if (filterStatus == GradingStatus.GRADED) {
            answerPage = candidateAnswerRepository.findByQuestionIdAndGradingStatusInWithAttemptAndUser(
                    questionId, List.of(GradingStatus.GRADED, GradingStatus.AUTO_GRADED), safePageable);
        } else if (filterStatus != null) {
            answerPage = candidateAnswerRepository.findByQuestionIdAndGradingStatusWithAttemptAndUser(
                    questionId, filterStatus, safePageable);
        } else {
            answerPage = candidateAnswerRepository.findByQuestionIdWithAttemptAndUser(questionId, safePageable);
        }

        Page<CandidateSubmissionItemDto> dtoPage = answerPage.map(ca -> {
            ExamAttempt attempt = ca.getExamAttempt();
            String candidateName;
            String studentIdentifier;

            if (attempt.getUser() != null) {
                candidateName = attempt.getUser().getFullName();
                studentIdentifier = attempt.getUser().getEmail();
            } else {
                candidateName = attempt.getGuestName() != null ? attempt.getGuestName() : "Guest Candidate";
                studentIdentifier = attempt.getGuestIdentifier() != null ? attempt.getGuestIdentifier() : "N/A";
            }

            return CandidateSubmissionItemDto.builder()
                    .candidateAnswerId(ca.getId())
                    .attemptId(attempt.getId())
                    .candidateName(candidateName)
                    .studentIdentifier(studentIdentifier)
                    .submittedAt(attempt.getSubmitTime())
                    .textAnswer(ca.getTextAnswer())
                    .awardedScore(ca.getAwardedScore())
                    .teacherFeedback(ca.getTeacherFeedback())
                    .gradingStatus(ca.getGradingStatus())
                    .build();
        });

        return QuestionSubmissionsDetailResponse.builder()
                .questionId(question.getId())
                .examId(question.getExam() != null ? question.getExam().getId() : null)
                .orderIndex(question.getOrderIndex())

                .content(question.getContent())
                .imageUrl(question.getImageUrl())
                .sampleAnswer(question.getSampleAnswer())
                .gradingRubric(question.getGradingRubric())
                .maxPoints(question.getPoints() != null ? question.getPoints() : 0.0)
                .submissions(PageResponse.from(dtoPage))
                .build();
    }

    @Override
    @Transactional
    @AuditLog(module = "GRADING", action = "SAVE_MANUAL_GRADES")
    public ManualBatchGradeResponse saveManualGrades(
            UUID questionId, ManualBatchGradeRequest request, User teacher) {

        Question question = questionRepository.findByIdWithOptionsAndExam(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", "id", questionId));
        verifyExamOwnership(question.getExam(), teacher);

        if (question.getQuestionType() != QuestionType.ESSAY_TEXT) {
            throw new AppException("Only essay questions can be manually graded", HttpStatus.BAD_REQUEST);
        }

        double maxPoints = question.getPoints() != null ? question.getPoints() : 0.0;
        Set<UUID> affectedAttemptIds = new HashSet<>();
        int gradedCount = 0;

        for (ManualGradeItemRequest item : request.getItems()) {
            CandidateAnswer ans = candidateAnswerRepository.findById(item.getCandidateAnswerId())
                    .orElseThrow(() -> new ResourceNotFoundException("CandidateAnswer", "id", item.getCandidateAnswerId()));

            if (!ans.getQuestion().getId().equals(questionId)) {
                throw new AppException(String.format("Answer ID %s does not belong to Question ID %s",
                        item.getCandidateAnswerId(), questionId), HttpStatus.BAD_REQUEST);
            }

            double awarded = item.getAwardedScore();
            if (awarded < 0.0 || awarded > maxPoints) {
                throw new IllegalArgumentException(String.format(
                        "Awarded score (%.2f) must be between 0.0 and %.2f for question '%s'",
                        awarded, maxPoints, question.getContent() != null ? question.getContent() : ""));
            }

            ans.setAwardedScore(awarded);
            ans.setTeacherFeedback(item.getTeacherFeedback() != null ? item.getTeacherFeedback().trim() : null);
            ans.setGradingStatus(GradingStatus.GRADED);
            candidateAnswerRepository.save(ans);

            affectedAttemptIds.add(ans.getExamAttempt().getId());
            gradedCount++;
        }

        int finalizedAttemptsCount = asyncWorker.finalizeAffectedAttempts(affectedAttemptIds);

        return ManualBatchGradeResponse.builder()
                .gradedCount(gradedCount)
                .finalizedAttemptsCount(finalizedAttemptsCount)
                .message(String.format("Successfully saved grades for %d submission(s). %d exam attempt(s) finalized.",
                        gradedCount, finalizedAttemptsCount))
                .build();
    }

    @Override
    @Transactional
    @AuditLog(module = "GRADING", action = "TRIGGER_AI_GRADING")
    public TriggerAiGradingResponse triggerAiGrading(TriggerAiGradingRequest request, User teacher) {
        // Fail-fast in production: Validate Gemini API key / rotation pool is configured before accepting async job
        if (!geminiRotationService.hasAvailableSlots()) {
            throw new AppException(
                    "Google Gemini API key is not configured. Cannot perform AI grading. " +
                    "Please configure 'gemini.keys' or 'gemini.api-key' in application.properties or set the GEMINI_KEY_1 environment variable.",
                    HttpStatus.BAD_REQUEST);
        }

        // If examId is omitted but questionId is provided, resolve examId from target question
        UUID resolvedExamId = request.getExamId();
        if (resolvedExamId == null) {
            if (request.getQuestionId() == null) {
                throw new AppException("Exam ID is required when questionId is not specified", HttpStatus.BAD_REQUEST);
            }
            Question targetQ = questionRepository.findByIdWithOptionsAndExam(request.getQuestionId())
                    .orElseThrow(() -> new ResourceNotFoundException("Question", "id", request.getQuestionId()));
            resolvedExamId = targetQ.getExam().getId();
            request.setExamId(resolvedExamId);
        }

        final UUID targetExamId = resolvedExamId;
        Exam exam = examRepository.findByIdWithCreatedBy(targetExamId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", targetExamId));
        verifyExamOwnership(exam, teacher);

        // Enforce: exactly ONE active AI task per user account at any time (shared between grading & quiz generation)
        String userLockKey = "ai:lock:user:" + teacher.getId();
        Boolean userAcquired = stringRedisTemplate.opsForValue().setIfAbsent(userLockKey, "LOCKED", Duration.ofHours(8));
        if (!Boolean.TRUE.equals(userAcquired)) {
            log.warn("[AI Grading] User {} attempted to spawn concurrent AI task while another AI job is active/queued.", teacher.getId());
            throw new AppException(
                    "Tài khoản của bạn hiện đang có một tác vụ AI (chấm bài hoặc soạn đề) đang được xử lý hoặc xếp hàng. " +
                    "Vui lòng chờ tác vụ hiện tại hoàn tất trước khi tạo thêm!",
                    HttpStatus.CONFLICT);
        }

        // Acquire Redis Distributed Lock to prevent duplicate concurrent grading requests on the same exam (8-hour TTL)
        String lockKey = "ai:grading:lock:exam:" + targetExamId;
        String lockOwner = (teacher.getUsername() != null && !teacher.getUsername().isBlank())
                ? teacher.getUsername() : teacher.getId().toString();
        Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(lockKey, lockOwner, Duration.ofHours(8));
        if (!Boolean.TRUE.equals(acquired)) {
            stringRedisTemplate.delete(userLockKey);
            log.warn("Duplicate AI grading rejected for exam ID: {} by teacher: {}", targetExamId, lockOwner);
            throw new AppException(
                    "Đề thi này đã có một tác vụ chấm AI đang xử lý hoặc đang xếp hàng. Vui lòng chờ hoàn tất!",
                    HttpStatus.CONFLICT);
        }

        try {
            int batchSize = (request.getBatchSize() != null && request.getBatchSize() >= 1 && request.getBatchSize() <= 50)
                    ? request.getBatchSize() : 25;

            Map<UUID, List<UUID>> questionToAnswerIdsMap = new LinkedHashMap<>();

            if ("ENTIRE_EXAM".equalsIgnoreCase(request.getScope())) {
                List<CandidateAnswer> allPending = candidateAnswerRepository.findPendingByExamId(
                        exam.getId(), GradingStatus.PENDING_MANUAL);

                for (CandidateAnswer ca : allPending) {
                    questionToAnswerIdsMap.computeIfAbsent(ca.getQuestion().getId(), k -> new ArrayList<>())
                            .add(ca.getId());
                }
            } else {
                // Scope: SINGLE_QUESTION
                if (request.getQuestionId() == null) {
                    throw new AppException("questionId is required when scope is SINGLE_QUESTION", HttpStatus.BAD_REQUEST);
                }

                Question question = questionRepository.findByIdWithOptionsAndExam(request.getQuestionId())
                        .orElseThrow(() -> new ResourceNotFoundException("Question", "id", request.getQuestionId()));
                verifyExamOwnership(question.getExam(), teacher);

                List<CandidateAnswer> pending = candidateAnswerRepository.findPendingByQuestionId(
                        request.getQuestionId(), GradingStatus.PENDING_MANUAL);

                if (!pending.isEmpty()) {
                    questionToAnswerIdsMap.put(question.getId(), pending.stream().map(CandidateAnswer::getId).toList());
                }
            }

            int totalSubmissions = questionToAnswerIdsMap.values().stream().mapToInt(List::size).sum();
            int totalQuestions = questionToAnswerIdsMap.keySet().size();

            if (totalSubmissions == 0) {
                // Release locks immediately if there are no pending submissions
                stringRedisTemplate.delete(lockKey);
                stringRedisTemplate.delete(userLockKey);
                return TriggerAiGradingResponse.builder()
                        .status("ACCEPTED")
                        .message("No pending essay submissions found to grade for this exam.")
                        .totalQuestionsScheduled(0)
                        .totalSubmissionsScheduled(0)
                        .build();
            }

            String jobId = UUID.randomUUID().toString();
            // Register as QUEUED in Redis metrics dashboard
            aiMetricsRedisService.registerActiveJob(
                    jobId, "AI_GRADING", targetExamId, exam.getTitle(), totalQuestions, totalSubmissions, "QUEUED");

            // Register task in Teacher Tasks monitoring index (accessible from /teacher/ai-tasks)
            teacherAiTaskService.createTask(TeacherAiTaskDto.builder()
                    .taskId(jobId)
                    .type("AI_GRADING")
                    .teacherId(teacher.getId())
                    .title("Chấm thi: " + exam.getTitle())
                    .targetExamId(targetExamId)
                    .targetExamTitle(exam.getTitle())
                    .status("QUEUED")
                    .progressPercent(0)
                    .currentStep(String.format("Xếp hàng chấm %d bài làm tự luận.", totalSubmissions))
                    .totalItems(totalSubmissions)
                    .processedItems(0)
                    .createdAt(java.time.Instant.now().toString())
                    .build());

            // Dispatch task to dedicated single-thread aiGradingExecutor queue
            asyncWorker.executeAiGradingAsync(jobId, targetExamId, teacher.getId(), questionToAnswerIdsMap, batchSize);

            return TriggerAiGradingResponse.builder()
                    .status("ACCEPTED")
                    .message(String.format("AI grading queued for %d essay question(s) with %d submission(s) using batch size %d.",
                            totalQuestions, totalSubmissions, batchSize))
                    .totalQuestionsScheduled(totalQuestions)
                    .totalSubmissionsScheduled(totalSubmissions)
                    .build();

        } catch (Exception e) {
            // Guarantee lock release if error occurs before background worker starts
            stringRedisTemplate.delete(lockKey);
            stringRedisTemplate.delete(userLockKey);
            throw e;
        }
    }

    @Override
    @Transactional
    public AiSingleGradeDto gradeSingleAnswerWithAi(UUID candidateAnswerId, User teacher) {
        log.info("Teacher {} requested AI grading for single candidate answer ID: {}", teacher.getId(), candidateAnswerId);

        CandidateAnswer answer = candidateAnswerRepository.findById(candidateAnswerId)
                .orElseThrow(() -> new ResourceNotFoundException("CandidateAnswer", "id", candidateAnswerId));

        Exam exam = examRepository.findByIdWithCreatedBy(answer.getExamAttempt().getExam().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", answer.getExamAttempt().getExam().getId()));
        verifyExamOwnership(exam, teacher);

        Question question = answer.getQuestion();
        if (question.getQuestionType() != QuestionType.ESSAY_TEXT) {
            throw new AppException("Only essay questions can be evaluated by AI", HttpStatus.BAD_REQUEST);
        }

        AiBatchGradingResultDto batchResult = geminiGradingService.gradeBatch(question, List.of(answer));
        if (batchResult == null || batchResult.getResults() == null || batchResult.getResults().isEmpty()) {
            throw new AppException("AI evaluation failed to produce a score", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        AiSingleGradeDto singleResult = batchResult.getResults().get(0);
        double awarded = singleResult.getAwardedScore() != null ? singleResult.getAwardedScore() : 0.0;
        String feedback = singleResult.getFeedback() != null ? singleResult.getFeedback() : "AI Evaluated response.";

        answer.setAwardedScore(awarded);
        answer.setTeacherFeedback(feedback);
        answer.setAiGradingExplanation(feedback);
        answer.setGradingStatus(GradingStatus.GRADED);
        candidateAnswerRepository.save(answer);

        asyncWorker.finalizeAffectedAttempts(Set.of(answer.getExamAttempt().getId()));

        return singleResult;
    }

    /**
     * Verifies that the authenticated teacher is the owner of the exam.
     */
    private void verifyExamOwnership(Exam exam, User teacher) {
        if (exam == null || exam.getCreatedBy() == null || !exam.getCreatedBy().getId().equals(teacher.getId())) {
            throw new AppException("You do not have permission to grade or access this exam", HttpStatus.FORBIDDEN);
        }
    }

    /**
     * Automatically resolves pending essay answers that candidates left empty for a specific question.
     * Transitions them to AUTO_GRADED with 0 score and finalizes attempts if no pending questions remain.
     */
    private void autoResolveEmptyPendingAnswers(UUID questionId) {
        try {
            List<CandidateAnswer> emptyAnswers = candidateAnswerRepository.findEmptyPendingByQuestionId(questionId);
            if (!emptyAnswers.isEmpty()) {
                Set<UUID> affectedAttemptIds = new HashSet<>();
                for (CandidateAnswer ca : emptyAnswers) {
                    ca.setAwardedScore(0.0);
                    ca.setGradingStatus(GradingStatus.AUTO_GRADED);
                    ca.setTeacherFeedback("Thí sinh không làm bài (để trống)");
                    if (ca.getExamAttempt() != null) {
                        affectedAttemptIds.add(ca.getExamAttempt().getId());
                    }
                }
                candidateAnswerRepository.saveAll(emptyAnswers);
                if (!affectedAttemptIds.isEmpty()) {
                    asyncWorker.finalizeAffectedAttempts(affectedAttemptIds);
                }
                log.info("Auto-resolved {} empty pending essay answers for question ID: {}", emptyAnswers.size(), questionId);
            }
        } catch (Exception ex) {
            log.warn("Failed to auto-resolve empty pending answers for question {}: {}", questionId, ex.getMessage());
        }
    }

    /**
     * Automatically resolves pending essay answers that candidates left empty across an entire exam.
     * Transitions them to AUTO_GRADED with 0 score and finalizes attempts if no pending questions remain.
     */
    private void autoResolveEmptyPendingAnswersForExam(UUID examId) {
        try {
            List<CandidateAnswer> emptyAnswers = candidateAnswerRepository.findEmptyPendingByExamId(examId);
            if (!emptyAnswers.isEmpty()) {
                Set<UUID> affectedAttemptIds = new HashSet<>();
                for (CandidateAnswer ca : emptyAnswers) {
                    ca.setAwardedScore(0.0);
                    ca.setGradingStatus(GradingStatus.AUTO_GRADED);
                    ca.setTeacherFeedback("Thí sinh không làm bài (để trống)");
                    if (ca.getExamAttempt() != null) {
                        affectedAttemptIds.add(ca.getExamAttempt().getId());
                    }
                }
                candidateAnswerRepository.saveAll(emptyAnswers);
                if (!affectedAttemptIds.isEmpty()) {
                    asyncWorker.finalizeAffectedAttempts(affectedAttemptIds);
                }
                log.info("Auto-resolved {} empty pending essay answers for exam ID: {}", emptyAnswers.size(), examId);
            }
        } catch (Exception ex) {
            log.warn("Failed to auto-resolve empty pending answers for exam {}: {}", examId, ex.getMessage());
        }
    }
}
