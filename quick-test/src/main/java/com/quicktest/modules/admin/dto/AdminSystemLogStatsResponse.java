package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Analytical metrics DTO for administrative log dashboard cards.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSystemLogStatsResponse {

    private long totalLogs;
    private long successCount;
    private long failureCount;
    private double errorRate;
    private long infoCount;
    private long warnCount;
    private long errorCount;
    private double averageExecutionTimeMs;
    private Map<String, Long> moduleCounts;
}
