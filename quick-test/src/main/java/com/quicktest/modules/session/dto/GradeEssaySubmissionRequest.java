package com.quicktest.modules.session.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Request payload to submit manual essay grades for an exam attempt.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GradeEssaySubmissionRequest {

    @NotNull(message = "Exam attempt ID is required")
    private UUID attemptId;

    @NotEmpty(message = "At least one essay grade item must be provided")
    @Valid
    private List<GradeEssayItemRequest> grades;
}
