package com.quicktest.modules.assessment.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data Transfer Object providing a concise summary of an Exam for listing and pagination.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamSummaryResponse {

    private UUID id;
    private String title;
    private String accessCode;
    private ExamStatus status;
    private Integer durationMinutes;
    private Integer maxAttempts;
    private Boolean isProctoringEnabled;
    private Boolean showResultsToStudents;
    private Integer maxViolations;
    private Long totalQuestions;
    private Double totalPoints;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;


    /**
     * Backward-compatible JPQL Constructor expression without showResultsToStudents.
     */
    public ExamSummaryResponse(
            UUID id,
            String title,
            String accessCode,
            ExamStatus status,
            Integer durationMinutes,
            Integer maxAttempts,
            Boolean isProctoringEnabled,
            Integer maxViolations,
            Long totalQuestions,
            Double totalPoints,
            LocalDateTime startTime,
            LocalDateTime endTime,
            LocalDateTime createdAt) {
        this(id, title, accessCode, status, durationMinutes, maxAttempts, isProctoringEnabled, true, maxViolations, totalQuestions, totalPoints, startTime, endTime, createdAt);
    }

    /**
     * Factory method creating DTO directly from an Exam entity.
     */
    public static ExamSummaryResponse fromEntity(Exam exam, long totalQuestions, double totalPoints) {
        return ExamSummaryResponse.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .accessCode(exam.getAccessCode())
                .status(exam.getStatus())
                .durationMinutes(exam.getDurationMinutes())
                .maxAttempts(exam.getMaxAttempts())
                .isProctoringEnabled(exam.getIsProctoringEnabled())
                .showResultsToStudents(exam.getShowResultsToStudents())
                .maxViolations(exam.getMaxViolations())
                .totalQuestions(totalQuestions)
                .totalPoints(totalPoints)
                .startTime(exam.getStartTime())
                .endTime(exam.getEndTime())
                .createdAt(exam.getCreatedAt())
                .build();
    }
}
