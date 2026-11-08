package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO representing progress of asynchronous background batch proctoring media cleanup.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProctoringMediaCleanupStatusResponse {

    private boolean isRunning;
    private long totalDeleted;
    private long estimatedRemaining;
    private int retentionDaysKept;
    private int batchSize;
    private LocalDateTime cutoff;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private String status; // IDLE, RUNNING, COMPLETED, FAILED
    private String message;
}

