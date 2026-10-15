package com.quicktest.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuration properties for multi-key and multi-model Gemini rotation pool.
 * Binds properties under the 'gemini' prefix in application.properties / environment.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "gemini")
public class GeminiPoolProperties {

    /**
     * List of configured API keys with their respective models.
     */
    private List<GeminiKeyConfig> keys = new ArrayList<>();

    /**
     * Base URL for Google Gemini REST API.
     */
    private String baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

    /**
     * Default batch size of candidate answers sent in a single AI grading prompt.
     */
    private int batchSize = 5;

    /**
     * Batch size for AI-based content moderation.
     */
    private int moderationBatchSize = 30;

    /**
     * Maximum response tokens per prompt.
     */
    private int maxTokens = 4000;

    /**
     * Connection and read timeout in seconds.
     */
    private int timeoutSeconds = 60;
}
