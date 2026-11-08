package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Analytical metrics for the Admin Proctoring Media dashboard cards.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminProctoringMediaStatsResponse {

    private long totalMediaCount;
    private long singleSnapshotCount;
    private long burstAnimationCount;
    private long recent7DaysCount;
    private long olderThan30DaysCount;
    private long examsWithMediaCount;
}

