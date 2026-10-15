package com.quicktest.config;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuration for a Gemini API key and its allowed model definitions.
 * Enables multiple models to be configured per API key.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GeminiKeyConfig {

    /**
     * Google Gemini API key.
     */
    private String apiKey = "";

    /**
     * List of Gemini models configured for this API key.
     */
    private List<GeminiModelConfig> models = new ArrayList<>();
}
