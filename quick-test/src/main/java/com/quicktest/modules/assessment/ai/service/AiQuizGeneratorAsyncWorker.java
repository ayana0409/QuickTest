package com.quicktest.modules.assessment.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.service.AiMetricsRedisService;
import com.quicktest.modules.assessment.ai.dto.AiGenerateJobResponse;
import com.quicktest.modules.assessment.ai.dto.AiGenerateQuizRequest;
import com.quicktest.modules.assessment.ai.dto.AiGeneratedQuestionDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Asynchronous background worker for AI Document-to-Quiz generation.
 * Executes on the shared, single-thread 'aiGradingExecutor' to guarantee that
 * at most ONE heavy AI workload (grading or quiz generation) runs at any given time.
 * Automatically manages user-level locks (ai:lock:user:{userId}) with 8-hour safety TTL.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AiQuizGeneratorAsyncWorker {

    public static final String REDIS_QUIZ_JOB_PREFIX = "ai:quiz_gen:job:";
    public static final String REDIS_USER_LOCK_PREFIX = "ai:lock:user:";
    private static final Duration JOB_CACHE_TTL = Duration.ofHours(24);

    private final AiQuizGeneratorService aiQuizGeneratorService;
    private final AiMetricsRedisService aiMetricsRedisService;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Executes the quiz generation asynchronously in the single-thread queue.
     *
     * @param jobId        Unique ID identifying this background job.
     * @param userId       ID of the requesting teacher.
     * @param documentText Extracted and sanitized text content.
     * @param fileName     Original file name.
     * @param request      Quiz specifications and requirements.
     */
    @Async("aiGradingExecutor")
    public void executeQuizGenerationAsync(
            String jobId,
            UUID userId,
            String documentText,
            String fileName,
            AiGenerateQuizRequest request) {

        log.info("[AI QUIZ WORKER] Started job [{}] on thread [{}] for user [{}] (file: {})",
                jobId, Thread.currentThread().getName(), userId, fileName);

        String userLockKey = REDIS_USER_LOCK_PREFIX + userId;
        String jobRedisKey = REDIS_QUIZ_JOB_PREFIX + jobId;

        try {
            // Update status to PROCESSING
            updateJobStatus(jobId, fileName, "PROCESSING", 35,
                    "AI đang phân tích cấu trúc bài học và soạn thảo câu hỏi...", null, null);
            aiMetricsRedisService.updateJobStatus(jobId, "PROCESSING", Thread.currentThread().getName());

            // Execute AI prompt generation via Gemini Rotation Pool
            List<AiGeneratedQuestionDto> questions = aiQuizGeneratorService.generateQuestions(documentText, request);

            // Save COMPLETED state with questions payload into Redis
            updateJobStatus(jobId, fileName, "COMPLETED", 100,
                    String.format("Đã soạn thành công %d câu hỏi từ tài liệu.", questions.size()),
                    questions, null);

            log.info("[AI QUIZ WORKER] Job [{}] COMPLETED successfully with {} questions for user [{}]",
                    jobId, questions.size(), userId);

        } catch (Exception e) {
            log.error("[AI QUIZ WORKER] Job [{}] FAILED: {}", jobId, e.getMessage(), e);
            updateJobStatus(jobId, fileName, "FAILED", 0,
                    "Soạn đề thi thất bại: " + e.getMessage(), null, e.getMessage());

        } finally {
            // Guarantee release of the per-user concurrency lock so the teacher can trigger another AI task
            Boolean deleted = stringRedisTemplate.delete(userLockKey);
            log.info("[AI QUIZ WORKER] Released per-user AI lock [{}] (result: {}) for job [{}]",
                    userLockKey, deleted, jobId);

            // Remove from global active jobs tracking
            aiMetricsRedisService.removeActiveJob(jobId);
        }
    }

    /**
     * Helper to write the current job state snapshot to Redis.
     */
    public void updateJobStatus(
            String jobId,
            String fileName,
            String status,
            int progressPercent,
            String currentStep,
            List<AiGeneratedQuestionDto> questions,
            String errorMessage) {

        try {
            String jobRedisKey = REDIS_QUIZ_JOB_PREFIX + jobId;
            AiGenerateJobResponse response = AiGenerateJobResponse.builder()
                    .jobId(jobId)
                    .status(status)
                    .progressPercent(progressPercent)
                    .currentStep(currentStep)
                    .sourceFileName(fileName)
                    .totalQuestionsGenerated(questions != null ? questions.size() : 0)
                    .errorMessage(errorMessage)
                    .createdAt(Instant.now().toString())
                    .completedAt("COMPLETED".equals(status) || "FAILED".equals(status) ? Instant.now().toString() : null)
                    .questions(questions)
                    .build();

            String json = objectMapper.writeValueAsString(response);
            stringRedisTemplate.opsForValue().set(jobRedisKey, json, JOB_CACHE_TTL);

        } catch (Exception e) {
            log.warn("[AI QUIZ WORKER] Failed to persist job snapshot in Redis for job {}: {}", jobId, e.getMessage());
        }
    }
}
