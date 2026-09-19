package com.quicktest.modules.assessment.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Request payload for importing one or more questions from the question bank
 * into a target exam. Each listed question is deep-copied (including images).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionImportRequest {

    @NotEmpty(message = "At least one question ID must be provided")
    private List<UUID> questionIds;
}
