package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * DTO providing comprehensive system analytics and health metrics for the administrator dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDashboardResponse {

    // User Governance Metrics
    private long totalUsers;
    private long totalTeachers;
    private long totalStudents;
    private long totalAdmins;
    private long activeUsers;
    private long inactiveUsers;
    private long newUsersLast7Days;

    // Exam Lifecycle Metrics
    private long totalExams;
    private long draftExams;
    private long publishedExams;
    private long closedExams;

    // Question Bank & Moderation Metrics
    private long totalQuestions;
    private long safeQuestions;
    private long unsafeQuestions;
    private long unreviewedQuestions;

    // Exam Attempt & Session Metrics
    private long totalAttempts;
    private long inProgressAttempts;
    private long submittedAttempts;
    private long awaitingGradingAttempts;
    private long disqualifiedAttempts;
    private double averageScore;

    // 7-day Time-Series Activity & Violation Breakdown
    private List<DailyActivityPoint> dailyActivities;
    private Map<String, Long> violationByTypes;

    // Proctoring & Violation Metrics
    private long totalViolations;
    private List<RecentViolationResponse> recentViolations;

    /**
     * Aggregated daily activity point used for dashboard time-series visualizations.
     * Kept public static with no-arg constructor for Redis Jackson polymorphic serialization.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyActivityPoint {
        private String date;
        private String label;
        private long attemptsCount;
        private long submittedCount;
        private long violationsCount;
    }
}
