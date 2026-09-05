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
    private Long totalQuestions;
    private Double totalPoints;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * JPQL Constructor expression used in ExamRepository projection.
     */
    public ExamSummaryResponse(
            UUID id,
            String title,
            String accessCode,
            ExamStatus status,
            Integer durationMinutes,
            Integer maxAttempts,
            Long totalQuestions,
            Double totalPoints,
            LocalDateTime startTime,
            LocalDateTime endTime,
            LocalDateTime createdAt) {
        this.id = id;
        this.title = title;
        this.accessCode = accessCode;
        this.status = status;
        this.durationMinutes = durationMinutes;
        this.maxAttempts = maxAttempts;
        this.totalQuestions = totalQuestions != null ? totalQuestions : 0L;
        this.totalPoints = totalPoints != null ? totalPoints : 0.0;
        this.startTime = startTime;
        this.endTime = endTime;
        this.createdAt = createdAt;
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
                .totalQuestions(totalQuestions)
                .totalPoints(totalPoints)
                .startTime(exam.getStartTime())
                .endTime(exam.getEndTime())
                .createdAt(exam.getCreatedAt())
                .build();
    }
}
