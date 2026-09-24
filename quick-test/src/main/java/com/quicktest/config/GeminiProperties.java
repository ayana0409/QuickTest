package com.quicktest.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration properties for Google Gemini AI integration.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "gemini")
public class GeminiProperties {

    /**
     * API Key for Google Gemini (Google AI Studio).
     */
    private String apiKey = "";

    /**
     * Model name (e.g., gemini-1.5-flash, gemini-2.0-flash).
     */
    private String model = "gemini-1.5-flash";

    /**
     * Base URL for Google Gemini REST API.
     */
    private String baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

    /**
     * Default batch size of candidate answers sent in a single AI grading prompt.
     */
    private int batchSize = 5;

    /**
     * Batch size for AI-based content moderation (text-only questions).
     * Controls how many questions are sent per single Gemini prompt.
     */
    private int moderationBatchSize = 30;

    /**
     * Maximum input tokens per minute to respect Gemini API rate limits.
     * Default 50,000 tokens/minute as per user configuration.
     */
    private int maxInputTokensPerMinute = 50000;

    /**
     * Maximum response tokens per prompt.
     */
    private int maxTokens = 4000;

    /**
     * Connection and read timeout in seconds.
     */
    private int timeoutSeconds = 60;
}
