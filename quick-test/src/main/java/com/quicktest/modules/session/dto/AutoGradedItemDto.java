package com.quicktest.modules.session.dto;

import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.session.entity.GradingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Summary of an automatically graded question (single choice, multiple choice, numeric).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutoGradedItemDto {

    private UUID questionId;
    private Integer orderIndex;
    private String content;
    private QuestionType questionType;
    private Double points;
    private Double awardedScore;
    private GradingStatus gradingStatus;
}
