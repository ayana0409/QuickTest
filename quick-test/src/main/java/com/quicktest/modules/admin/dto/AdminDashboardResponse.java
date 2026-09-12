package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

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

    // Exam Lifecycle Metrics
    private long totalExams;
    private long draftExams;
    private long publishedExams;
    private long closedExams;
    private long archivedExams;

    // Exam Attempt & Session Metrics
    private long totalAttempts;
    private long inProgressAttempts;
    private long submittedAttempts;
    private long awaitingGradingAttempts;
    private long disqualifiedAttempts;

    // Proctoring & Violation Metrics
    private long totalViolations;
    private List<RecentViolationResponse> recentViolations;
}
