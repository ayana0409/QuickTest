package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

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
    private Double averageScore;

    // Exam collections
    private List<StudentExamCardDto> myExams;         // Exams previously taken by this student
    private List<StudentExamCardDto> availableExams;  // Other open published exams not yet taken
}
