package com.quicktest.modules.session.dto;

import com.quicktest.modules.assessment.entity.ExamStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Combined response DTO for the exam essay grading overview page.
 * Bundles exam metadata with aggregated essay question statistics,
 * avoiding extraneous getExamDetail queries from frontend clients.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamGradingQuestionsResponse {

    private UUID examId;
    private String examTitle;
    private ExamStatus examStatus;
    private Integer totalEssayQuestions;
    private List<QuestionGradingSummaryResponse> questions;
}
