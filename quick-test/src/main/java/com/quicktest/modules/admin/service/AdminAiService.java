package com.quicktest.modules.admin.service;

import com.quicktest.modules.admin.dto.*;

import java.util.List;
import java.util.UUID;

/**
 * Service managing AI configuration keys, models, system metrics, and rotation pool.
 */
public interface AdminAiService {

    /**
     * Retrieves overall AI system status, rotation slots metrics from Redis, and active background jobs.
     */
    AiSystemStatusResponse getSystemStatus();

    /**
     * Retrieves all configured AI API keys with their model definitions.
     */
    List<AiKeyResponse> getAllKeys();

    /**
     * Retrieves a single AI API key by its unique ID.
     */
    AiKeyResponse getKeyById(UUID id);

    /**
     * Registers a new AI API key along with its model configurations into Database, then reloads pool.
     */
    AiKeyResponse createKey(AiKeyCreateRequest request);

    /**
     * Updates an existing AI API key and its model configurations, then reloads pool.
     */
    AiKeyResponse updateKey(UUID id, AiKeyUpdateRequest request);

    /**
     * Deletes an AI API key from Database, then reloads pool.
     */
    void deleteKey(UUID id);

    /**
     * Toggles the active/inactive state of an AI API key.
     */
    AiKeyResponse toggleKeyActive(UUID id);

    /**
     * Toggles the active/inactive state of a specific AI Model.
     */
    AiModelResponse toggleModelActive(UUID modelId);

    /**
     * Explicitly triggers an immediate rotation pool reload from Database or fallback environment.
     */
    void reloadPool();

    /**
     * Cancels an active or stalled background grading job and releases its Redis exam lock.
     */
    void cancelJob(String jobId);

    /**
     * Clears all active or stalled background jobs and releases all associated exam locks.
     */
    void clearAllJobs();
}
