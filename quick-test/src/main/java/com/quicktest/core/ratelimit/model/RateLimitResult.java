package com.quicktest.core.ratelimit.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data transfer model representing the evaluation outcome of a rate limit check.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitResult {

    /**
     * True if the request is permitted within current quotas, false if blocked.
     */
    private boolean allowed;

    /**
     * Configured capacity limit for the sliding window.
     */
    private long limit;

    /**
     * Remaining tokens or requests allowed in the current time window.
     */
    private long remaining;

    /**
     * Sliding window duration or remaining seconds until full reset.
     */
    private long resetSeconds;

    /**
     * Required wait duration in seconds before next retry when blocked (0 if allowed).
     */
    private long retryAfterSeconds;
}
