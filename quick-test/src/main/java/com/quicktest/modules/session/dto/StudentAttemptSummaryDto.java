package com.quicktest.modules.session.dto;

import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data transfer object representing a candidate attempt summary for the student history view.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentAttemptSummaryDto {

    private UUID attemptId;
    private UUID examId;
    private String examTitle;
    private LocalDateTime startTime;
    private LocalDateTime submitTime;
    private AttemptStatus status;
    private Double awardedScore;
    private Double maxScore;
    private Long violationCount;

    public Double getMaxScore() {
        return (maxScore != null && maxScore > 0) ? maxScore : 10.0;
    }

    /**
     * Constructor for JPQL constructor expressions with computed violation count and default maxScore.
     */
    public StudentAttemptSummaryDto(
            UUID attemptId,
            UUID examId,
            String examTitle,
            LocalDateTime startTime,
            LocalDateTime submitTime,
            AttemptStatus status,
            Double awardedScore,
            Long violationCount) {
        this.attemptId = attemptId;
        this.examId = examId;
        this.examTitle = examTitle;
        this.startTime = startTime;
        this.submitTime = submitTime;
        this.status = status;
        this.awardedScore = awardedScore;
        this.maxScore = 10.0;
        this.violationCount = violationCount != null ? violationCount : 0L;
    }
}
