package com.quicktest.modules.session.service;

import com.quicktest.core.service.GeminiGradingService;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.session.dto.AiBatchGradingResultDto;
import com.quicktest.modules.session.dto.AiSingleGradeDto;
import com.quicktest.modules.session.dto.SubmitResultResponse;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Dedicated asynchronous worker for AI-powered essay grading.
 * Separated into an independent Spring component to ensure Spring AOP proxying
 * correctly offloads execution to background thread pools (@Async).
 */
@Slf4j
@Component
@SuppressWarnings("null")
public class QuestionGradingAsyncWorker {

    private final QuestionRepository questionRepository;
    private final CandidateAnswerRepository candidateAnswerRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final RedisExamSessionService redisExamSessionService;
    private final GeminiGradingService geminiGradingService;

    public QuestionGradingAsyncWorker(
            QuestionRepository questionRepository,
            CandidateAnswerRepository candidateAnswerRepository,
            ExamAttemptRepository examAttemptRepository,
            RedisExamSessionService redisExamSessionService,
            GeminiGradingService geminiGradingService) {
        this.questionRepository = questionRepository;
        this.candidateAnswerRepository = candidateAnswerRepository;
        this.examAttemptRepository = examAttemptRepository;
        this.redisExamSessionService = redisExamSessionService;
        this.geminiGradingService = geminiGradingService;
    }

    /**
     * Executes AI evaluation for questions and candidate answers in the background.
     * Guaranteed to run asynchronously on a dedicated Spring thread pool.
     */
    @Async
    @Transactional
    public void executeAiGradingAsync(Map<UUID, List<UUID>> questionToAnswerIdsMap, int batchSize) {
        log.info("[BACKGROUND WORKER] Starting async AI grading for {} questions with batchSize={} on thread [{}]",
                questionToAnswerIdsMap.size(), batchSize, Thread.currentThread().getName());

        Set<UUID> affectedAttemptIds = new HashSet<>();

        for (Map.Entry<UUID, List<UUID>> entry : questionToAnswerIdsMap.entrySet()) {
            UUID questionId = entry.getKey();
            List<UUID> answerIds = entry.getValue();

            Question question = questionRepository.findById(questionId).orElse(null);
            if (question == null) continue;

            // Chunk candidate answers into batches of configured size
            for (int i = 0; i < answerIds.size(); i += batchSize) {
                int end = Math.min(i + batchSize, answerIds.size());
                List<UUID> batchIds = answerIds.subList(i, end);

                List<CandidateAnswer> batchAnswers = candidateAnswerRepository.findAllById(batchIds);
                if (batchAnswers.isEmpty()) continue;

                try {
                    AiBatchGradingResultDto resultDto = geminiGradingService.gradeBatch(question, batchAnswers);

                    Map<String, AiSingleGradeDto> resultMap = new HashMap<>();
                    if (resultDto.getResults() != null) {
                        for (AiSingleGradeDto item : resultDto.getResults()) {
                            if (item.getCandidateAnswerId() != null) {
                                resultMap.put(item.getCandidateAnswerId().toLowerCase(), item);
                            }
                        }
                    }

                    for (CandidateAnswer ans : batchAnswers) {
                        AiSingleGradeDto singleRes = resultMap.get(ans.getId().toString().toLowerCase());
                        if (singleRes == null) {
                            log.warn("[BACKGROUND WORKER] Candidate answer ID {} was not evaluated by Gemini. Retaining PENDING_MANUAL.", ans.getId());
                            continue;
                        }
                        double awarded = singleRes.getAwardedScore() != null ? singleRes.getAwardedScore() : 0.0;
                        String feedback = singleRes.getFeedback() != null ? singleRes.getFeedback() : "AI Evaluated response.";

                        ans.setAwardedScore(awarded);
                        ans.setTeacherFeedback(feedback);
                        ans.setAiGradingExplanation(feedback);
                        ans.setGradingStatus(GradingStatus.GRADED);
                        candidateAnswerRepository.save(ans);

                        affectedAttemptIds.add(ans.getExamAttempt().getId());
                    }

                    log.info("[BACKGROUND WORKER] Processed AI batch for question {}: {} answers graded.", questionId, batchAnswers.size());

                } catch (Exception e) {
                    log.error("[BACKGROUND WORKER] AI grading stopped due to Google Gemini service error for question ID {}: {}. Retaining remaining answers as PENDING_MANUAL.",
                            questionId, e.getMessage(), e);
                    // In production: Stop immediately upon API/connection failure. Do not proceed or invent scores.
                    break;
                }
            }
        }

        // Finalize all attempts that now have all essay answers graded
        int finalizedCount = finalizeAffectedAttempts(affectedAttemptIds);
        log.info("[BACKGROUND WORKER] Completed async AI grading. Finalized {} exam attempt(s).", finalizedCount);
    }

    /**
     * Synchronizes affected exam attempts: calculates total score and transitions status
     * to SUBMITTED if no pending essay questions remain.
     */
    @Transactional
    public int finalizeAffectedAttempts(Set<UUID> attemptIds) {
        int finalizedCount = 0;

        for (UUID attemptId : attemptIds) {
            ExamAttempt attempt = examAttemptRepository.findById(attemptId).orElse(null);
            if (attempt == null) continue;

            long remainingPending = candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(
                    attemptId, GradingStatus.PENDING_MANUAL);
            Double totalScore = candidateAnswerRepository.sumAwardedScoreByAttemptId(attemptId);

            if (remainingPending == 0) {
                attempt.setStatus(AttemptStatus.SUBMITTED);
                attempt.setTotalScore(totalScore != null ? Math.round(totalScore * 100.0) / 100.0 : 0.0);
                finalizedCount++;
                log.info("Attempt ID {} finalized with status SUBMITTED, totalScore={}", attemptId, attempt.getTotalScore());
            } else {
                attempt.setStatus(AttemptStatus.AWAITING_MANUAL_GRADING);
                attempt.setTotalScore(null);
            }

            examAttemptRepository.save(attempt);

            // Update Redis cache for real-time student result view
            try {
                SubmitResultResponse cachedResult = SubmitResultResponse.builder()
                        .attemptId(attempt.getId())
                        .examTitle(attempt.getExam().getTitle())
                        .status(attempt.getStatus())
                        .totalScore(attempt.getTotalScore())
                        .submitTime(attempt.getSubmitTime())
                        .message(remainingPending == 0
                                ? "Exam submitted and graded successfully."
                                : "Exam submitted successfully. Essay questions are awaiting manual grading by the teacher.")
                        .build();
                redisExamSessionService.cacheSubmissionResult(attempt.getId(), cachedResult, 86400L);
            } catch (Exception e) {
                log.warn("Could not synchronize attempt {} to Redis cache: {}", attemptId, e.getMessage());
            }
        }

        return finalizedCount;
    }
}
