package com.quicktest.modules.proctoring.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Summary DTO of candidate attempt status for the proctoring dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptMonitorResponse {

    private UUID attemptId;
    private UUID examId;
    private UUID userId;
    private String candidateName;
    private String candidateIdentifier;
    private AttemptStatus status;
    private Integer violationCount;
    private Boolean isDisqualified;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime expireAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime submitTime;

    private Boolean isOnline;
}
