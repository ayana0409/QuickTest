package com.quicktest.modules.session.service;

import com.quicktest.core.exception.GeminiAllSlotsExhaustedException;
import com.quicktest.core.service.AiMetricsRedisService;
import com.quicktest.core.service.GeminiGradingService;
import com.quicktest.core.service.GeminiRotationService;
import com.quicktest.core.util.GeminiTokenEstimator;
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
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
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
 * Commits evaluations batch-by-batch to database immediately without holding long transactions.
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
    private final GeminiRotationService geminiRotationService;
    private final AiMetricsRedisService aiMetricsRedisService;
    private final TransactionTemplate transactionTemplate;
    private final StringRedisTemplate stringRedisTemplate;

    public QuestionGradingAsyncWorker(
            QuestionRepository questionRepository,
            CandidateAnswerRepository candidateAnswerRepository,
            ExamAttemptRepository examAttemptRepository,
            RedisExamSessionService redisExamSessionService,
            GeminiGradingService geminiGradingService,
            GeminiRotationService geminiRotationService,
            AiMetricsRedisService aiMetricsRedisService,
            PlatformTransactionManager transactionManager,
            StringRedisTemplate stringRedisTemplate) {
        this.questionRepository = questionRepository;
        this.candidateAnswerRepository = candidateAnswerRepository;
        this.examAttemptRepository = examAttemptRepository;
        this.redisExamSessionService = redisExamSessionService;
        this.geminiGradingService = geminiGradingService;
        this.geminiRotationService = geminiRotationService;
        this.aiMetricsRedisService = aiMetricsRedisService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.stringRedisTemplate = stringRedisTemplate;
    }

    /**
     * Executes AI evaluation for questions and candidate answers sequentially in the background.
     * Uses dedicated single-thread 'aiGradingExecutor' to focus 100% API quota on one exam at a time.
     * Additional requests are automatically queued (FIFO) in the executor's blocking queue.
     */
    @Async("aiGradingExecutor")
    public void executeAiGradingAsync(String jobId, UUID examId, Map<UUID, List<UUID>> questionToAnswerIdsMap, int batchSize) {
        // Transition job status from QUEUED to PROCESSING in Redis metrics dashboard
        aiMetricsRedisService.updateJobStatus(jobId, "PROCESSING", Thread.currentThread().getName());
        log.info("[BACKGROUND WORKER] Started processing AI grading job [{}] for exam [{}] on thread [{}]",
                jobId, examId, Thread.currentThread().getName());

        int totalQuestions = questionToAnswerIdsMap.size();
        int totalAnswers = questionToAnswerIdsMap.values().stream().mapToInt(List::size).sum();

        try {

            Set<UUID> affectedAttemptIds = new HashSet<>();
            int processedAnswersTotal = 0;
            for (Map.Entry<UUID, List<UUID>> entry : questionToAnswerIdsMap.entrySet()) {
                UUID questionId = entry.getKey();
                List<UUID> answerIds = entry.getValue();

                Question question = questionRepository.findByIdWithOptionsAndExam(questionId).orElse(null);
                if (question == null) continue;

                // Fetch all candidate answers for this question
                List<CandidateAnswer> allAnswers = candidateAnswerRepository.findAllById(answerIds);
                if (allAnswers.isEmpty()) continue;

                int cursor = 0;
                while (cursor < allAnswers.size()) {
                    // Dynamic Token-Aware Batch Packing: evaluate active slot budget and pack submissions greedily
                    int tokenBudget = geminiRotationService.getOptimalBatchTokenBudget();
                    int maxCandidatesAllowed = geminiRotationService.getMaxBatchCandidateCount();
                    // Respect explicit small batch size if teacher requested a low batch limit <= 20
                    int maxBatchLimit = (batchSize > 0 && batchSize < maxCandidatesAllowed) ? batchSize : maxCandidatesAllowed;

                    int basePromptTokens = GeminiTokenEstimator.estimateQuestionBaseTokens(question);
                    List<CandidateAnswer> batchAnswers = new ArrayList<>();
                    List<UUID> batchIds = new ArrayList<>();
                    int accumulatedTokens = basePromptTokens;

                    while (cursor < allAnswers.size() && batchAnswers.size() < maxBatchLimit) {
                        CandidateAnswer nextCandidate = allAnswers.get(cursor);
                        int candidateTokens = GeminiTokenEstimator.estimateSubmissionTokens(nextCandidate)
                                + GeminiTokenEstimator.ESTIMATED_OUTPUT_TOKENS_PER_ANSWER;

                        // If adding this candidate exceeds budget AND we already have at least 1 candidate, finalize this batch
                        if (!batchAnswers.isEmpty() && (accumulatedTokens + candidateTokens) > tokenBudget) {
                            break;
                        }

                        batchAnswers.add(nextCandidate);
                        batchIds.add(nextCandidate.getId());
                        accumulatedTokens += candidateTokens;
                        cursor++;
                    }

                    // Safety guard: ensure at least one submission moves forward
                    if (batchAnswers.isEmpty() && cursor < allAnswers.size()) {
                        CandidateAnswer singleAns = allAnswers.get(cursor++);
                        batchAnswers.add(singleAns);
                        batchIds.add(singleAns.getId());
                    }

                    log.info("[BACKGROUND WORKER] Dispatched dynamic batch: {} submission(s) (~{} estimated tokens, budget: {}) for question {}",
                            batchAnswers.size(), accumulatedTokens, tokenBudget, questionId);

                    AiBatchGradingResultDto resultDto = null;

                    try {
                        // Call Gemini AI outside DB transaction
                        resultDto = geminiGradingService.gradeBatch(question, batchAnswers);

                    } catch (GeminiAllSlotsExhaustedException ex) {
                        log.warn("[BACKGROUND WORKER] All Gemini slots exhausted for question ID {}: {}. Sleeping 62s before retrying this batch...",
                                questionId, ex.getMessage());
                        try {
                            Thread.sleep(62_000);
                            // Retry this batch once after cooldown
                            resultDto = geminiGradingService.gradeBatch(question, batchAnswers);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            log.warn("[BACKGROUND WORKER] Sleep interrupted during rate limit cooldown for question ID {}. Stopping worker.", questionId);
                            break;
                        } catch (Exception retryEx) {
                            log.error("[BACKGROUND WORKER] Retry after 62s cooldown also failed for question ID {}: {}. Retaining remaining answers as PENDING_MANUAL.",
                                    questionId, retryEx.getMessage(), retryEx);
                            break;
                        }

                    } catch (Exception e) {
                        log.error("[BACKGROUND WORKER] AI grading stopped due to Google Gemini service error for question ID {}: {}. Retaining remaining answers as PENDING_MANUAL.",
                                questionId, e.getMessage(), e);
                        // Stop on unrecoverable error
                        break;
                    }

                    // If evaluations received, persist and commit this batch to DB immediately!
                    if (resultDto != null && resultDto.getResults() != null && !resultDto.getResults().isEmpty()) {
                        final AiBatchGradingResultDto finalResultDto = resultDto;
                        Set<UUID> batchAttemptIds = new HashSet<>();

                        transactionTemplate.executeWithoutResult(status -> {
                            List<CandidateAnswer> freshAnswers = candidateAnswerRepository.findAllById(batchIds);
                            List<CandidateAnswer> targetAnswers = (freshAnswers != null && !freshAnswers.isEmpty()) ? freshAnswers : batchAnswers;
                            processBatchResults(finalResultDto, targetAnswers, batchAttemptIds);
                            candidateAnswerRepository.saveAllAndFlush(targetAnswers);
                        });

                        affectedAttemptIds.addAll(batchAttemptIds);
                        processedAnswersTotal += batchAnswers.size();
                        aiMetricsRedisService.updateJobProgress(jobId, processedAnswersTotal);

                        log.info("[BACKGROUND WORKER] COMMITTED dynamic AI batch to DB for question {}: {} answers graded and saved (Progress: {}/{}).",
                                questionId, batchAnswers.size(), processedAnswersTotal, totalAnswers);

                        // Immediately update attempt scores and sync with Redis
                        transactionTemplate.executeWithoutResult(status -> {
                            finalizeAffectedAttempts(batchAttemptIds);
                        });
                    }
                }
            }

            // Final sync pass for all affected attempts
            if (!affectedAttemptIds.isEmpty()) {
                transactionTemplate.executeWithoutResult(status -> {
                    int finalizedCount = finalizeAffectedAttempts(affectedAttemptIds);
                    log.info("[BACKGROUND WORKER] Completed async AI grading. Finalized {} exam attempt(s).", finalizedCount);
                });
            }
        } catch (Exception e) {
            log.error("[BACKGROUND WORKER] Fatal error in async AI grading job {}: {}", jobId, e.getMessage(), e);
        } finally {
            aiMetricsRedisService.removeActiveJob(jobId);
            if (examId != null) {
                stringRedisTemplate.delete("ai:grading:lock:exam:" + examId);
                log.info("[BACKGROUND WORKER] AI grading job [{}] completed. Released Redis lock for exam ID {}", jobId, examId);
            }
        }
    }

    /**
     * Maps evaluation scores and feedback from Gemini to candidate answers and saves updates.
     */
    private void processBatchResults(AiBatchGradingResultDto resultDto,
                                    List<CandidateAnswer> batchAnswers,
                                    Set<UUID> affectedAttemptIds) {
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
