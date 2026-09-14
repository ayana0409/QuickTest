package com.quicktest.modules.session.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request payload to trigger background AI grading for an essay question or entire exam.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TriggerAiGradingRequest {

    /**
     * Target exam ID. Required if scope is ENTIRE_EXAM, optional if questionId is provided.
     */
    private UUID examId;


    /**
     * Target question ID. Required if scope is SINGLE_QUESTION, optional if ENTIRE_EXAM.
     */
    private UUID questionId;

    /**
     * Scope of AI grading: "SINGLE_QUESTION" or "ENTIRE_EXAM".
     */
    @Builder.Default
    private String scope = "SINGLE_QUESTION";

    /**
     * Batch size of answers sent to AI in one prompt (default 5, range 1 - 20).
     */
    @Min(value = 1, message = "Batch size must be at least 1")
    @Max(value = 20, message = "Batch size cannot exceed 20")
    @Builder.Default
    private Integer batchSize = 5;
}
