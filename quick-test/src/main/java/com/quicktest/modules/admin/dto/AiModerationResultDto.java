package com.quicktest.modules.admin.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Wraps the AI moderation response containing a list of individual question safety results.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiModerationResultDto {

    /** List of moderation verdicts returned by Gemini per question. */
    private List<AiQuestionVerdict> results;

    /**
     * Individual safety verdict for a single question.
     * Format returned by Gemini: { "questionId": "<UUID>", "safe": true/false }
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiQuestionVerdict {

        /** UUID of the question being reviewed. */
        @JsonProperty("questionId")
        private String questionId;

        /**
         * True if the AI considers the question and its answers safe/appropriate.
         * False means unsafe/inappropriate content detected.
         */
        @JsonProperty("safe")
        private Boolean safe;
    }
}
