package com.quicktest.modules.session.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Individual grade item submitted by the teacher.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualGradeItemRequest {

    @NotNull(message = "Candidate answer ID is required")
    private UUID candidateAnswerId;

    @NotNull(message = "Awarded score is required")
    @DecimalMin(value = "0.0", message = "Awarded score cannot be negative")
    private Double awardedScore;

    private String teacherFeedback;
}
