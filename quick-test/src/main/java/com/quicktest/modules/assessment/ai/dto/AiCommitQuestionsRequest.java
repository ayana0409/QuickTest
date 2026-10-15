package com.quicktest.modules.assessment.ai.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request payload to bulk-insert finalized questions into an existing exam.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiCommitQuestionsRequest {

    @NotEmpty(message = "Questions list cannot be empty")
    private List<AiGeneratedQuestionDto> questions;
}
