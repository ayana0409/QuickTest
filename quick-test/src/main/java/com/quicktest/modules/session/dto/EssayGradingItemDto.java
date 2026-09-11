package com.quicktest.modules.session.dto;

import com.quicktest.modules.session.entity.GradingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Details of an essay question to be manually graded by teacher.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EssayGradingItemDto {

    private UUID candidateAnswerId;
    private UUID questionId;
    private Integer orderIndex;
    private String content;
    private Double points;
    private String textAnswer;
    private String sampleAnswer;
    private String gradingRubric;
    private Double awardedScore;
    private GradingStatus gradingStatus;
    private String teacherFeedback;
}
