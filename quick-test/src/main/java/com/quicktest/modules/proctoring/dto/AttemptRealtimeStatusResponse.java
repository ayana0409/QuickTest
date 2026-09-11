package com.quicktest.modules.proctoring.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Detailed real-time proctoring status of a candidate attempt.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptRealtimeStatusResponse {

    private UUID attemptId;
    private UUID examId;
    private String candidateName;
    private String candidateIdentifier;
    private AttemptStatus status;
    private Integer violationCount;
    private Boolean isDisqualified;
    private Boolean isOnline;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime lastHeartbeat;

    private Map<ViolationType, Long> violationBreakdown;
    private List<ViolationLogResponse> recentViolations;
}
