package com.quicktest.core.ratelimit.annotation;

import java.lang.annotation.*;

/**
 * Declarative annotation to enforce rate limiting on Spring MVC Controller methods.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RateLimit {

    /**
     * Maximum requests allowed within the sliding window.
     */
    int limit() default 60;

    /**
     * Sliding window duration in seconds.
     */
    int windowSeconds() default 60;

    /**
     * Key resolution strategy.
     */
    RateLimitKeyType keyType() default RateLimitKeyType.IP;

    /**
     * Namespace prefix for the rate limit key in Redis (e.g., "login", "register", "submit").
     */
    String prefix() default "";

    /**
     * Parameter name to extract when keyType is PARAM.
     */
    String keyParam() default "";

    /**
     * SpEL expression to evaluate when keyType is SPEL (e.g. "#attemptId" or "#request.email").
     */
    String keySpel() default "";
}
