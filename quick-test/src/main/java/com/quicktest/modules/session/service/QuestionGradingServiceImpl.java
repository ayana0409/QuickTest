package com.quicktest.modules.session.service;

import com.quicktest.config.GeminiProperties;
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

import com.quicktest.core.service.GeminiGradingService;
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
    private final GeminiProperties geminiProperties;
    private final GeminiGradingService geminiGradingService;

    public QuestionGradingServiceImpl(
            ExamRepository examRepository,
            QuestionRepository questionRepository,
            CandidateAnswerRepository candidateAnswerRepository,
            QuestionGradingAsyncWorker asyncWorker,
            GeminiProperties geminiProperties,
            GeminiGradingService geminiGradingService) {
        this.examRepository = examRepository;
        this.questionRepository = questionRepository;
        this.candidateAnswerRepository = candidateAnswerRepository;
        this.asyncWorker = asyncWorker;
        this.geminiProperties = geminiProperties;
        this.geminiGradingService = geminiGradingService;
    }


    @Override
    @Transactional(readOnly = true)
    public List<QuestionGradingSummaryResponse> getQuestionsForGrading(UUID examId, User teacher) {
        log.info("Teacher {} fetching essay questions for grading in exam ID: {}", teacher.getId(), examId);

        Exam exam = examRepository.findByIdWithCreatedBy(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));
        verifyExamOwnership(exam, teacher);

        List<Question> questions = questionRepository.findByExamIdOrderByOrderIndexAsc(examId);

        List<QuestionGradingSummaryResponse> summaries = new ArrayList<>();
        for (Question q : questions) {
            if (q.getQuestionType() == QuestionType.ESSAY_TEXT) {
                long pendingCount = candidateAnswerRepository.countByQuestionIdAndGradingStatus(
                        q.getId(), GradingStatus.PENDING_MANUAL);
                long gradedCount = candidateAnswerRepository.countByQuestionIdAndGradingStatus(
                        q.getId(), GradingStatus.GRADED);
                long total = candidateAnswerRepository.countByQuestionId(q.getId());

                summaries.add(QuestionGradingSummaryResponse.builder()
                        .questionId(q.getId())
                        .orderIndex(q.getOrderIndex())
                        .content(q.getContent())
                        .imageUrl(q.getImageUrl())
                        .maxPoints(q.getPoints() != null ? q.getPoints() : 0.0)
                        .pendingCount(pendingCount)
                        .gradedCount(gradedCount)
                        .totalSubmissions(total)
                        .build());
            }
        }

        return summaries;
    }

    @Override
    @Transactional(readOnly = true)
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

        // Use un-sorted PageRequest because the JPQL query defines its own deterministic ORDER BY a.submitTime DESC NULLS LAST
        Pageable safePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());

        Page<CandidateAnswer> answerPage;
        if (filterStatus != null) {
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
        // Fail-fast in production: Validate Gemini API key is configured before accepting async job
        String apiKey = geminiProperties.getApiKey() != null ? geminiProperties.getApiKey().trim() : "";
        if (apiKey.isEmpty() || apiKey.equalsIgnoreCase("xxx") || apiKey.contains("YOUR_")) {
            throw new AppException(
                    "Google Gemini API key is not configured. Cannot perform AI grading. " +
                    "Please configure 'gemini.api-key' in application.properties or set the GEMINI_API_KEY environment variable.",
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



        int batchSize = (request.getBatchSize() != null && request.getBatchSize() >= 1 && request.getBatchSize() <= 20)
                ? request.getBatchSize() : 5;

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

        // Asynchronously execute AI grading in the background via QuestionGradingAsyncWorker (Spring @Async proxy)
        if (totalSubmissions > 0) {
            asyncWorker.executeAiGradingAsync(questionToAnswerIdsMap, batchSize);
        }

        return TriggerAiGradingResponse.builder()
                .status("ACCEPTED")
                .message(String.format("AI grading scheduled for %d essay question(s) with %d submission(s) using batch size %d.",
                        totalQuestions, totalSubmissions, batchSize))
                .totalQuestionsScheduled(totalQuestions)
                .totalSubmissionsScheduled(totalSubmissions)
                .build();
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
}
