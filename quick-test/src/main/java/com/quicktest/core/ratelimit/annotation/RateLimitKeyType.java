package com.quicktest.core.ratelimit.annotation;

/**
 * Strategy defining how the rate limit identifier is generated for incoming requests.
 */
public enum RateLimitKeyType {

    /**
     * Resolves the client's public or proxy-forwarded IP address.
     */
    IP,

    /**
     * Resolves authenticated User ID (falls back to IP if unauthenticated).
     */
    USER_ID,

    /**
     * Combines User ID (or unauthenticated label) with Client IP for fine-grained limits.
     */
    COMBINED,

    /**
     * Resolves from method argument / path variable specified by keyParam name.
     */
    PARAM,

    /**
     * Evaluates dynamic Spring Expression Language (SpEL) defined in keySpel.
     */
    SPEL
}
