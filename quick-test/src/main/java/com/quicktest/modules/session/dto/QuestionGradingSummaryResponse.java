package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Summary DTO for an essay question in the question-centric grading workflow.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionGradingSummaryResponse {

    private UUID questionId;
    private Integer orderIndex;
    private String content;
    private String imageUrl;
    private Double maxPoints;
    private Long pendingCount;
    private Long gradedCount;
    private Long totalSubmissions;
}
