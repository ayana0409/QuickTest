package com.quicktest.modules.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.admin.dto.RecentViolationResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Aggregated analytics and operational overview response for the teacher dashboard.
 * Uses mutable collections and public static sub-classes with no-arg constructors
 * for Redis Jackson polymorphic serialization compatibility.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherDashboardResponse {

    // Teacher Exam Lifecycle Metrics
    private long totalExams;
    private long draftExams;
    private long publishedExams;
    private long closedExams;

    // Question Type Breakdown Across Teacher Exams
    private long totalQuestions;
    private long singleChoiceQuestions;
    private long multipleChoiceQuestions;
    private long numericQuestions;
    private long essayQuestions;

    // Candidate Attempt & Grading Workload Metrics
    private long totalAttempts;
    private long inProgressAttempts;
    private long submittedAttempts;
    private long awaitingGradingAttempts;
    private long disqualifiedAttempts;
    private long pendingManualAnswers;
    private double averageScore;

    // Proctoring Alert Counter
    private long totalViolations;

    // 7-Day Time-Series, Priority Action Exams, and Recent Violations
    private List<DailyActivityPoint> dailyActivities;
    private List<TeacherExamOverviewItem> priorityExams;
    private List<RecentViolationResponse> recentViolations;

    /**
     * Aggregated daily activity point across the teacher's exams over the past 7 days.
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

    /**
     * Summary row for an exam requiring teacher attention (pending manual grading, active sessions, or recent draft).
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeacherExamOverviewItem {
        private UUID id;
        private String title;
        private String accessCode;
        private String status;
        private int durationMinutes;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime createdAt;

        private long totalAttempts;
        private long inProgressCount;
        private long submittedCount;
        private long pendingGradingCount;
        private double averageScore;
    }
}

