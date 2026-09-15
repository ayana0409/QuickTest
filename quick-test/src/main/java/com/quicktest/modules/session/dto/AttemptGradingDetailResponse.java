package com.quicktest.modules.session.dto;

import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Comprehensive grading detail response for a single exam attempt.
 * Supplies the teacher with candidate responses, rubric guidelines, and objective scoring context.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptGradingDetailResponse {

    private UUID attemptId;
    private UUID examId;
    private String examTitle;
    private String candidateName;
    private String candidateIdentifier;
    private AttemptStatus status;
    private Double currentTotalScore;
    private Double autoGradedScore;
    private Double maxTotalPoints;
    private LocalDateTime startTime;
    private LocalDateTime submitTime;
    private Integer violationCount;

    @Builder.Default
    private List<EssayGradingItemDto> essayQuestions = new ArrayList<>();

    @Builder.Default
    private List<AutoGradedItemDto> autoGradedQuestions = new ArrayList<>();
}
