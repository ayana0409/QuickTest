package com.quicktest.config;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Configuration for an individual Gemini AI model under an API key.
 * Defines model name and model-specific rate limits (RPM and TPM).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GeminiModelConfig {

    /**
     * Gemini model name (e.g. gemini-2.0-flash-lite, gemini-2.0-flash, gemini-1.5-flash).
     */
    private String name;

    /**
     * Request per minute (RPM) limit for this model.
     * Free tier default is typically 15 RPM.
     */
    private int rpm = 15;

    /**
     * Token per minute (TPM) limit for this model.
     * Default 1,000,000 for standard Flash or 250,000 for Lite/8b.
     */
    private int tpm = 1000000;
}
