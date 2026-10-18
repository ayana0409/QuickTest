package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO representing the execution status and progress metrics of
 * background batch log deletion task.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemLogCleanupStatusResponse {

    /**
     * True if a cleanup background worker is currently active.
     */
    private boolean isRunning;

    /**
     * Total number of system log records deleted so far in this run.
     */
    private long totalDeleted;

    /**
     * Estimated number of old logs remaining before cleanup started.
     */
    private long estimatedRemaining;

    /**
     * Days of logs to preserve (retention cutoff).
     */
    private int retentionDaysKept;

    /**
     * Number of log records deleted per transaction chunk.
     */
    private int batchSize;

    /**
     * Timestamp cutoff: logs created before this point are deleted.
     */
    private LocalDateTime cutoff;

    /**
     * Timestamp when the background cleanup task started.
     */
    private LocalDateTime startedAt;

    /**
     * Timestamp when the background cleanup task finished.
     */
    private LocalDateTime finishedAt;

    /**
     * Current execution state: IDLE, RUNNING, COMPLETED, FAILED.
     */
    private String status;

    /**
     * Human-readable status or error message.
     */
    private String message;
}
