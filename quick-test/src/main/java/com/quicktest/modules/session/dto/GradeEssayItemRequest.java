package com.quicktest.modules.session.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Payload for grading a single essay answer.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GradeEssayItemRequest {

    @NotNull(message = "Candidate answer ID is required")
    private UUID candidateAnswerId;

    @NotNull(message = "Awarded score is required")
    @DecimalMin(value = "0.0", message = "Awarded score must be non-negative")
    private Double awardedScore;

    private String teacherFeedback;
}
