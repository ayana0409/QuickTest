package com.quicktest.modules.session.dto;

import com.quicktest.modules.admin.dto.RecentViolationResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Aggregated dashboard response for authenticated students.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentDashboardResponse {

    // Metrics Overview
    private int totalExamsAttempted;
    private int openExamsCount;
    private int activeSessionsCount;
    private int completedAttemptsCount;
    private int totalAttemptsCount;
    private int submittedAttemptsCount;
    private int inProgressAttemptsCount;
    private int awaitingGradingCount;
    private int disqualifiedAttemptsCount;
    private Double averageScore;
    private Double bestScore;

    // Proctoring & Violation Metrics
    private int totalViolations;
    private int attemptsWithViolations;
    private Map<String, Long> violationByTypes;
    private List<RecentViolationResponse> recentViolations;

    // 7-day student activity trend
    private List<DailyActivityPoint> dailyActivities;

    // Exam collections
    private List<StudentExamCardDto> myExams;         // Exams previously taken by this student
    private List<StudentExamCardDto> exploreExams;    // Random 10 non-private published exams for exploration

    /**
     * Daily attempt and proctoring alert point for the student 7-day trend chart.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyActivityPoint {
        private String date;
        private String label;
        private int attemptsCount;
        private int submittedCount;
        private int violationsCount;
    }
}
