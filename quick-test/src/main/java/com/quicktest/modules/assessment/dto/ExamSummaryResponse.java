package com.quicktest.modules.assessment.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
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
public class ExamSummaryResponse {

    private UUID id;
    private String title;
    private String accessCode;
    private ExamStatus status;
    private Integer durationMinutes;
    private Integer maxAttempts;
    private Boolean isProctoringEnabled;
    private Boolean isCameraProctoringEnabled;
    private Boolean showResultsToStudents;
    private Integer maxViolations;
    private Long totalQuestions;
    private Double totalPoints;
    private Boolean isPrivate;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    private Long totalEssayQuestions;

    /**
     * Primary all-arguments constructor matching all 17 fields including totalEssayQuestions.
     */
    public ExamSummaryResponse(
            UUID id,
            String title,
            String accessCode,
            ExamStatus status,
            Integer durationMinutes,
            Integer maxAttempts,
            Boolean isProctoringEnabled,
            Boolean isCameraProctoringEnabled,
            Boolean showResultsToStudents,
            Integer maxViolations,
            Long totalQuestions,
            Double totalPoints,
            Boolean isPrivate,
            LocalDateTime startTime,
            LocalDateTime endTime,
            LocalDateTime createdAt,
            Long totalEssayQuestions) {
        this.id = id;
        this.title = title;
        this.accessCode = accessCode;
        this.status = status;
        this.durationMinutes = durationMinutes;
        this.maxAttempts = maxAttempts;
        this.isProctoringEnabled = isProctoringEnabled;
        this.isCameraProctoringEnabled = isCameraProctoringEnabled;
        this.showResultsToStudents = showResultsToStudents;
        this.maxViolations = maxViolations;
        this.totalQuestions = totalQuestions;
        this.totalPoints = totalPoints;
        this.isPrivate = isPrivate;
        this.startTime = startTime;
        this.endTime = endTime;
        this.createdAt = createdAt;
        this.totalEssayQuestions = totalEssayQuestions != null ? totalEssayQuestions : 0L;
    }

    /**
     * Backward-compatible 16-field constructor.
     */
    public ExamSummaryResponse(
            UUID id,
            String title,
            String accessCode,
            ExamStatus status,
            Integer durationMinutes,
            Integer maxAttempts,
            Boolean isProctoringEnabled,
            Boolean isCameraProctoringEnabled,
            Boolean showResultsToStudents,
            Integer maxViolations,
            Long totalQuestions,
            Double totalPoints,
            Boolean isPrivate,
            LocalDateTime startTime,
            LocalDateTime endTime,
            LocalDateTime createdAt) {
        this(id, title, accessCode, status, durationMinutes, maxAttempts, isProctoringEnabled, isCameraProctoringEnabled, showResultsToStudents, maxViolations, totalQuestions, totalPoints, isPrivate, startTime, endTime, createdAt, 0L);
    }

    /**
     * JPQL Constructor expression without isCameraProctoringEnabled (defaults isCameraProctoringEnabled to false).
     */
    public ExamSummaryResponse(
            UUID id,
            String title,
            String accessCode,
            ExamStatus status,
            Integer durationMinutes,
            Integer maxAttempts,
            Boolean isProctoringEnabled,
            Boolean showResultsToStudents,
            Integer maxViolations,
            Long totalQuestions,
            Double totalPoints,
            Boolean isPrivate,
            LocalDateTime startTime,
            LocalDateTime endTime,
            LocalDateTime createdAt) {
        this(id, title, accessCode, status, durationMinutes, maxAttempts, isProctoringEnabled, false, showResultsToStudents, maxViolations, totalQuestions, totalPoints, isPrivate != null ? isPrivate : true, startTime, endTime, createdAt);
    }

    /**
     * Backward-compatible Constructor expression without isPrivate (defaults isPrivate to true).
     */
    public ExamSummaryResponse(
            UUID id,
            String title,
            String accessCode,
            ExamStatus status,
            Integer durationMinutes,
            Integer maxAttempts,
            Boolean isProctoringEnabled,
            Boolean showResultsToStudents,
            Integer maxViolations,
            Long totalQuestions,
            Double totalPoints,
            LocalDateTime startTime,
            LocalDateTime endTime,
            LocalDateTime createdAt) {
        this(id, title, accessCode, status, durationMinutes, maxAttempts, isProctoringEnabled, false, showResultsToStudents, maxViolations, totalQuestions, totalPoints, true, startTime, endTime, createdAt);
    }

    /**
     * Backward-compatible JPQL Constructor expression without showResultsToStudents and without isPrivate.
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
        this(id, title, accessCode, status, durationMinutes, maxAttempts, isProctoringEnabled, false, true, maxViolations, totalQuestions, totalPoints, true, startTime, endTime, createdAt);
    }

    /**
     * Factory method creating DTO directly from an Exam entity.
     */
    public static ExamSummaryResponse fromEntity(Exam exam, long totalQuestions, double totalPoints) {
        if (exam == null) {
            return null;
        }
        long essayCount = 0L;
        if (exam.getQuestions() != null) {
            essayCount = exam.getQuestions().stream()
                    .filter(q -> q != null && q.getQuestionType() == com.quicktest.modules.assessment.entity.QuestionType.ESSAY_TEXT)
                    .count();
        }
        return ExamSummaryResponse.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .accessCode(exam.getAccessCode())
                .status(exam.getStatus())
                .durationMinutes(exam.getDurationMinutes())
                .maxAttempts(exam.getMaxAttempts())
                .isProctoringEnabled(exam.getIsProctoringEnabled())
                .isCameraProctoringEnabled(exam.getIsCameraProctoringEnabled())
                .showResultsToStudents(exam.getShowResultsToStudents())
                .maxViolations(exam.getMaxViolations())
                .totalQuestions(totalQuestions)
                .totalPoints(totalPoints)
                .totalEssayQuestions(essayCount)
                .isPrivate(exam.getIsPrivate() != null ? exam.getIsPrivate() : true)
                .startTime(exam.getStartTime())
                .endTime(exam.getEndTime())
                .createdAt(exam.getCreatedAt())
                .build();
    }
}
