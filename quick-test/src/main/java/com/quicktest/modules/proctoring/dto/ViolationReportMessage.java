package com.quicktest.modules.proctoring.dto;

import com.quicktest.modules.proctoring.entity.ViolationType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Incoming violation telemetry message payload reported from candidate client.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ViolationReportMessage {

    @NotNull(message = "Attempt ID is required")
    private UUID attemptId;

    @NotNull(message = "Violation type is required")
    private ViolationType violationType;

    private String description;

    private String clientTimestamp;
}
