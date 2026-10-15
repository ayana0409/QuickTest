package com.quicktest.modules.assessment.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Status and result representation of a background document-to-exam generation job.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiGenerateJobResponse {

    private String jobId;
    private String status; // QUEUED, PROCESSING, COMPLETED, FAILED
    private Integer progressPercent;
    private String currentStep;
    private String sourceFileName;
    private Integer totalQuestionsGenerated;
    private String errorMessage;
    private String createdAt;
    private String completedAt;

    private List<AiGeneratedQuestionDto> questions;
}
