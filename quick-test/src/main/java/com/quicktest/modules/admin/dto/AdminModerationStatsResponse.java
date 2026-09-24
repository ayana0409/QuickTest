package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * KPI stats summary for Admin Content Moderation dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminModerationStatsResponse {

    private long totalQuestions;
    private long questionsWithImages;
    private long unreviewedQuestions;
    private long safeQuestions;
}
