package com.quicktest.modules.session.dto;

import com.quicktest.modules.session.entity.GradingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Detailed DTO for a candidate's essay response in the question-centric grading view.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateSubmissionItemDto {

    private UUID candidateAnswerId;
    private UUID attemptId;
    private String candidateName;
    private String studentIdentifier;
    private LocalDateTime submittedAt;
    private String textAnswer;
    private Double awardedScore;
    private String teacherFeedback;
    private GradingStatus gradingStatus;
}
