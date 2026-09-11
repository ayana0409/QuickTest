package com.quicktest.modules.proctoring.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.proctoring.entity.ViolationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Real-time alert message dispatched to candidate via WebSocket when a violation occurs.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ViolationAlertMessage {

    private UUID attemptId;
    private ViolationType violationType;
    private Integer violationCount;
    private Integer maxAllowed;
    private Integer remainingAllowed;
    private Boolean disqualified;
    private String message;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
