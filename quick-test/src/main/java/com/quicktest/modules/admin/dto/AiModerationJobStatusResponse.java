package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO representing the current status of an AI content moderation batch job.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiModerationJobStatusResponse {

    /** Whether a moderation job is currently running in the background. */
    private boolean running;

    /** Total questions processed in the latest/current job run. */
    private int processedCount;

    /** Total questions marked safe by AI in this run. */
    private int safeCount;

    /** Total questions marked unsafe by AI in this run. */
    private int unsafeCount;

    /** ID of the last question processed (cursor for next run). Null if no prior run. */
    private String lastProcessedId;

    /** Human-readable status message. */
    private String message;
}
