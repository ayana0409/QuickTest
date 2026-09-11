package com.quicktest.modules.session.dto;

import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Response returned after submitting manual essay grades.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GradingResultResponse {

    private UUID attemptId;
    private AttemptStatus status;
    private Double totalScore;
    private long remainingPendingEssays;
    private String message;
}
