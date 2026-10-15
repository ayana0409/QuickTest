package com.quicktest.core.service;

import java.util.List;

/**
 * Service orchestrating Google Gemini API calls with automatic rotation
 * across configured API keys and models when encountering rate limits (HTTP 429).
 */
public interface GeminiRotationService {

    /**
     * Executes content generation against Gemini with automatic rotation across models and keys.
     *
     * @param prompt The prompt to send
     * @param temperature Sampling temperature
     * @param maxOutputTokens Max tokens in response
     * @return The raw JSON response string from Gemini
     */
    String executeWithRotation(String prompt, double temperature, int maxOutputTokens);

    /**
     * Overloaded method with default temperature 0.2.
     *
     * @param prompt The prompt to send
     * @param maxOutputTokens Max tokens in response
     * @return The raw JSON response string from Gemini
     */
    default String executeWithRotation(String prompt, int maxOutputTokens) {
        return executeWithRotation(prompt, 0.2, maxOutputTokens);
    }

    /**
     * Returns true if there is at least one active slot configured in the rotation pool.
     */
    boolean hasAvailableSlots();

    /**
     * Returns the total number of configured slots.
     */
    int getTotalSlotCount();

    /**
     * Returns the total number of unique active keys in the pool.
     */
    int getTotalKeysCount();

    /**
     * Returns the number of currently active slots not in cooldown.
     */
    int getActiveSlotsCount();

    /**
     * Returns the source of the current pool configuration ("DATABASE" or "ENV_FALLBACK").
     */
    String getConfigSource();

    /**
     * Reloads slots dynamically from the database or environment fallback.
     */
    void reloadSlots();

    /**
     * Returns an unmodifiable snapshot list of current slots for diagnostics.
     */
    List<GeminiModelSlot> getSlots();

    /**
     * Calculates the optimal token budget for the next grading batch.
     * Evaluates active slots in the pool to provide a budget that maximizes throughput
     * while staying safely within the remaining TPM limit of available models.
     */
    int getOptimalBatchTokenBudget();

    /**
     * Returns the maximum safe candidate count per batch to prevent exceeding Gemini's max output tokens (8192).
     */
    int getMaxBatchCandidateCount();

    /**
     * Explicitly advances the rotation pointer to the next configured slot.
     * Useful for multi-pass tasks to balance token and rate limit loads across different keys/models.
     */
    void advanceToNextSlot();
}
