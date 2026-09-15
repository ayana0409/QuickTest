package com.quicktest.modules.session.dto;

import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Summary DTO of an exam attempt tailored for teacher grading and management dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptSummaryResponse {

    private UUID attemptId;
    private UUID examId;
    private String candidateName;
    private String candidateIdentifier;
    private AttemptStatus status;
    private Double totalScore;
    private LocalDateTime startTime;
    private LocalDateTime submitTime;
    private long totalQuestions;
    private long pendingEssayCount;
    private boolean hasPendingEssay;
    private Integer violationCount;
}
