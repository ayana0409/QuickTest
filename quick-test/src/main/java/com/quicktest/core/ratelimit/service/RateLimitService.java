package com.quicktest.core.ratelimit.service;

import com.quicktest.core.ratelimit.model.RateLimitResult;

/**
 * Service interface defining contract for distributed rate limit operations.
 */
public interface RateLimitService {

    /**
     * Attempt to acquire quota for the given key in a sliding time window.
     *
     * @param key           Unique rate limit key (e.g., namespace + IP / UserID)
     * @param limit         Maximum allowable requests within the window
     * @param windowSeconds Duration of the sliding time window in seconds
     * @return RateLimitResult containing evaluation metrics (allowed, remaining, retry-after)
     */
    RateLimitResult tryAcquire(String key, int limit, int windowSeconds);

    /**
     * Manually reset quota for a specific key.
     *
     * @param key Target rate limit key
     */
    void reset(String key);
}
