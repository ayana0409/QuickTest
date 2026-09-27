package com.quicktest.core.ratelimit.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Exception thrown when a client exceeds permitted request frequency (HTTP 429).
 */
@Getter
public class RateLimitExceededException extends RuntimeException {

    private final HttpStatus status = HttpStatus.TOO_MANY_REQUESTS;
    private final long limit;
    private final long remaining;
    private final long resetSeconds;
    private final long retryAfterSeconds;

    public RateLimitExceededException(String message, long limit, long remaining, long resetSeconds, long retryAfterSeconds) {
        super(message);
        this.limit = limit;
        this.remaining = remaining;
        this.resetSeconds = resetSeconds;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public RateLimitExceededException(long limit, long resetSeconds, long retryAfterSeconds) {
        this(
                String.format("Too many requests. Quota exceeded (%d req/%ds). Please retry after %d seconds.",
                        limit, resetSeconds, retryAfterSeconds),
                limit,
                0,
                resetSeconds,
                retryAfterSeconds
        );
    }
}
