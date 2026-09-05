package com.quicktest.modules.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Result DTO returned upon final exam submission.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitResultResponse {

    private UUID attemptId;
    private String examTitle;
    private AttemptStatus status;

    // Total score is populated immediately if all questions are auto-graded
    private Double totalScore;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime submitTime;

    private String message;
}
