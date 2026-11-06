package com.quicktest.modules.proctoring.dto;

import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Comprehensive violation history response returned to teacher and proctor dashboards.
 * Source indicates whether telemetry data was retrieved live from Redis ("REDIS_LIVE")
 * or finalized from PostgreSQL ("POSTGRESQL_FINAL").
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ViolationDetailResponse {

    private UUID attemptId;

    /**
     * Data source origin: "REDIS_LIVE" or "POSTGRESQL_FINAL"
     */
    private String source;

    private Integer violationCount;

    private AttemptStatus status;

    @Builder.Default
    private List<ViolationItemRedisDto> violations = new ArrayList<>();
}

