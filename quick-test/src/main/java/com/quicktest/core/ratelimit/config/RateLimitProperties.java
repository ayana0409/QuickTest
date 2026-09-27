package com.quicktest.core.ratelimit.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Configuration properties for rate limiting mechanisms across QuickTest.
 * Fully configurable from application.properties / application.yml or environment variables.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitProperties {

    /**
     * Master switch to enable or disable all rate limiting features.
     */
    private boolean enabled = true;

    /**
     * Global rate limit fallback applied to any request that does not match specific endpoint rules.
     */
    private GlobalConfig global = new GlobalConfig();

    /**
     * Endpoint-specific rate limiting rules configured purely via application.properties.
     */
    private Map<String, EndpointRule> endpoints = new LinkedHashMap<>();

    @Getter
    @Setter
    public static class GlobalConfig {
        /**
         * Enable global IP-based rate limiting fallback.
         */
        private boolean enabled = true;

        /**
         * Allowed requests per time window per IP.
         */
        private int limit = 120;

        /**
         * Time window duration in seconds.
         */
        private int periodSeconds = 60;
    }

    @Getter
    @Setter
    public static class EndpointRule {
        /**
         * Ant-style path pattern (e.g. "/api/auth/login", "/api/session/*\/save", "/api/teacher/media/**").
         */
        private String path;

        /**
         * HTTP method constraint ("POST", "PUT", "GET", or null/blank for any method).
         */
        private String method;

        /**
         * Maximum allowed requests in the time window.
         */
        private int limit = 60;

        /**
         * Time window duration in seconds.
         */
        private int periodSeconds = 60;

        /**
         * Key identifier strategy: "IP" (default) or "USER_OR_IP".
         */
        private String keyType = "IP";

        /**
         * Optional Redis key prefix/namespace. Defaults to the map key if blank.
         */
        private String prefix;
    }
}
