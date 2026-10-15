package com.quicktest.core.service;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Represents an individual runtime slot for a specific Gemini API key and model pair.
 * Maintains sliding-window request and token counters, rate-limit enforcement,
 * and exhaustion/cooldown state upon HTTP 429 errors.
 */
@Slf4j
@Getter
public class GeminiModelSlot {

    private final int slotIndex;
    private final String keyId;
    private final String keyName;
    private final String apiKey;
    private final String modelName;
    private final int rpmLimit;
    private final int tpmLimit;

    private final AtomicInteger requestCount = new AtomicInteger(0);
    private final AtomicLong tokenCount = new AtomicLong(0);
    private final AtomicLong windowStart = new AtomicLong(System.currentTimeMillis());
    private final AtomicBoolean exhausted = new AtomicBoolean(false);
    private final AtomicLong exhaustedUntil = new AtomicLong(0);

    public GeminiModelSlot(int slotIndex, String keyId, String keyName, String apiKey, String modelName, int rpmLimit, int tpmLimit) {
        this.slotIndex = slotIndex;
        this.keyId = keyId;
        this.keyName = keyName != null ? keyName : "Slot #" + slotIndex;
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.rpmLimit = rpmLimit > 0 ? rpmLimit : 15;
        this.tpmLimit = tpmLimit > 0 ? tpmLimit : 1000000;
    }

    public GeminiModelSlot(String apiKey, String modelName, int rpmLimit, int tpmLimit) {
        this(0, null, "Default Key", apiKey, modelName, rpmLimit, tpmLimit);
    }

    /**
     * Checks if this slot has capacity for an upcoming request within the current 60s sliding window.
     * If capacity is available, increments the counters and returns true.
     *
     * @param estimatedTokens Estimated tokens for the request (prompt + response).
     * @return true if acquired successfully, false if exhausted or rate-limited.
     */
    public synchronized boolean tryAcquire(int estimatedTokens) {
        long now = System.currentTimeMillis();

        // Check if 60-second sliding window has elapsed -> reset counters
        if (now - windowStart.get() >= 60_000) {
            requestCount.set(0);
            tokenCount.set(0);
            windowStart.set(now);
            if (exhausted.get() && now >= exhaustedUntil.get()) {
                exhausted.set(false);
            }
        }

        // Check if still in cooldown from a 429 or proactive rate limit
        if (exhausted.get()) {
            if (now < exhaustedUntil.get()) {
                return false;
            } else {
                exhausted.set(false);
            }
        }

        // Proactive RPM check
        if (rpmLimit > 0 && requestCount.get() >= rpmLimit) {
            log.debug("[GeminiSlot] Slot [{}:{}] reached RPM limit ({}/{}). Cooldown triggered.",
                    getMaskedKey(), modelName, requestCount.get(), rpmLimit);
            markExhausted(62_000);
            return false;
        }

        // Proactive TPM check (only throttle if we have already made at least one request)
        if (tpmLimit > 0 && (tokenCount.get() + estimatedTokens) > tpmLimit && requestCount.get() > 0) {
            log.debug("[GeminiSlot] Slot [{}:{}] would exceed TPM limit (current: {}, adding: {}, limit: {}).",
                    getMaskedKey(), modelName, tokenCount.get(), estimatedTokens, tpmLimit);
            markExhausted(62_000);
            return false;
        }

        requestCount.incrementAndGet();
        tokenCount.addAndGet(Math.max(estimatedTokens, 0));
        return true;
    }

    /**
     * Records additional token usage (e.g. actual response tokens).
     */
    public void recordUsage(int tokens) {
        if (tokens > 0) {
            tokenCount.addAndGet(tokens);
        }
    }

    /**
     * Returns the remaining tokens available in the current 60s window.
     * Automatically accounts for sliding window reset.
     */
    public synchronized long getRemainingTpmInWindow() {
        long now = System.currentTimeMillis();
        if (now - windowStart.get() >= 60_000) {
            return tpmLimit;
        }
        return Math.max(0, tpmLimit - tokenCount.get());
    }

    /**
     * Checks if this slot has capacity for the given estimated token count
     * without yet acquiring or incrementing counters.
     */
    public synchronized boolean hasCapacity(int estimatedTokens) {
        long now = System.currentTimeMillis();
        if (now - windowStart.get() >= 60_000) {
            return tpmLimit >= estimatedTokens;
        }
        if (exhausted.get() && now < exhaustedUntil.get()) {
            return false;
        }
        if (rpmLimit > 0 && requestCount.get() >= rpmLimit) {
            return false;
        }
        return (tokenCount.get() + estimatedTokens) <= tpmLimit;
    }

    /**
     * Marks this slot as exhausted with the default cooldown of 62 seconds
     * (slightly over 60s to safely clear Google Gemini server-side quota windows).
     */
    public void markExhausted() {
        markExhausted(62_000);
    }

    /**
     * Marks this slot as exhausted until the specified cooldown period passes.
     *
     * @param cooldownMs Cooldown duration in milliseconds.
     */
    public void markExhausted(long cooldownMs) {
        exhausted.set(true);
        exhaustedUntil.set(System.currentTimeMillis() + cooldownMs);
    }

    /**
     * Calculates the remaining cooldown seconds if this slot is exhausted.
     */
     public long getRemainingCooldownSeconds() {
         if (!exhausted.get()) {
             return 0;
         }
         long diff = exhaustedUntil.get() - System.currentTimeMillis();
         return diff > 0 ? (diff / 1000) : 0;
     }

    /**
     * Returns a masked representation of the API key for safe logging.
     */
    public String getMaskedKey() {
        if (apiKey == null || apiKey.length() < 8) {
            return "***";
        }
        return apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length() - 4);
    }

    @Override
    public String toString() {
        return String.format("GeminiModelSlot[key=%s, model=%s, rpm=%d, tpm=%d, reqCount=%d, exhausted=%b]",
                getMaskedKey(), modelName, rpmLimit, tpmLimit, requestCount.get(), exhausted.get());
    }
}
