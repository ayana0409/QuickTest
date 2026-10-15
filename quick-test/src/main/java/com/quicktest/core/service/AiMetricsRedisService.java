package com.quicktest.core.service;

import com.quicktest.modules.admin.dto.AiBackgroundJobDto;
import com.quicktest.modules.admin.dto.AiSlotMetricDto;

import java.util.List;
import java.util.UUID;

/**
 * Service for caching and tracking real-time AI slot metrics and background jobs in Redis.
 */
public interface AiMetricsRedisService {

    /**
     * Persists or updates metric snapshot for a slot in Redis.
     */
    void saveSlotMetric(AiSlotMetricDto metric);

    /**
     * Retrieves metric snapshot for a specific slot.
     */
    AiSlotMetricDto getSlotMetric(int slotIndex);

    /**
     * Retrieves metric snapshots for all configured slots.
     */
    List<AiSlotMetricDto> getAllSlotMetrics();

    /**
     * Increments success counter for a slot in Redis.
     */
    void recordSlotSuccess(int slotIndex);

    /**
     * Records failure, error message, and cooldown seconds for a slot.
     */
    void recordSlotFailure(int slotIndex, String errorMessage, long cooldownRemainingSeconds);

    /**
     * Clears all slot metrics from Redis (used when pool is reloaded).
     */
    void clearAllSlotMetrics();

    // --- Background Worker Tracking ---

    /**
     * Registers a new background AI grading or moderation job in Redis with default status "PROCESSING".
     */
    default void registerActiveJob(String jobId, String type, UUID examId, String examTitle, int totalQuestions, int totalAnswers) {
        registerActiveJob(jobId, type, examId, examTitle, totalQuestions, totalAnswers, "PROCESSING");
    }

    /**
     * Registers a new background AI grading or moderation job in Redis with explicit status ("PROCESSING" or "QUEUED").
     */
    void registerActiveJob(String jobId, String type, UUID examId, String examTitle, int totalQuestions, int totalAnswers, String status);

    /**
     * Updates the status ("PROCESSING" or "QUEUED") and running thread name for an active job.
     */
    void updateJobStatus(String jobId, String status, String threadName);

    /**
     * Updates the number of processed candidate answers for an active job.
     */
    void updateJobProgress(String jobId, int processedAnswers);

    /**
     * Removes a completed or failed background job from Redis.
     */
    void removeActiveJob(String jobId);

    /**
     * Retrieves all currently active background jobs from Redis.
     */
    List<AiBackgroundJobDto> getActiveJobs();

    /**
     * Returns the count of currently active background jobs.
     */
    int getActiveJobsCount();
}
