package com.quicktest.modules.proctoring.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Telemetry heartbeat message dispatched periodically from candidate client.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HeartbeatMessage {

    @NotNull(message = "Attempt ID is required")
    private UUID attemptId;

    private String clientTimestamp;
}
