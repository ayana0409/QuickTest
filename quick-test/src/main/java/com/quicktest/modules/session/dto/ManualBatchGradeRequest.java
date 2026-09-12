package com.quicktest.modules.session.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Batch request payload for manual grading of one or more candidate answers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualBatchGradeRequest {

    @NotEmpty(message = "Grade items list must not be empty")
    @Valid
    @Builder.Default
    private List<ManualGradeItemRequest> items = new ArrayList<>();
}
