package com.quicktest.modules.assessment.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Data Transfer Object providing comprehensive details of an Exam,
 * including all configured questions and their options.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamDetailResponse {

    private UUID id;
    private String title;
    private String accessCode;
    private String description;
    private ExamStatus status;
    private Integer durationMinutes;
    private Integer maxAttempts;
    private Boolean shuffleQuestions;
    private Boolean shuffleOptions;
    private Boolean isProctoringEnabled;
    private Integer maxViolations;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    private UUID createdByTeacherId;
    private String createdByTeacherName;

    private Integer totalQuestions;
    private Double totalPoints;

    private List<QuestionResponse> questions;

    /**
     * Map Exam entity and its associated questions into ExamDetailResponse DTO.
     */
    public static ExamDetailResponse fromEntity(Exam exam) {
        if (exam == null) {
            return null;
        }

        List<QuestionResponse> questionResponses = exam.getQuestions() != null
                ? exam.getQuestions().stream()
                        .map(QuestionResponse::fromEntity)
                        .collect(Collectors.toList())
                : Collections.emptyList();

        double totalPoints = questionResponses.stream()
                .mapToDouble(q -> q.getPoints() != null ? q.getPoints() : 0.0)
                .sum();

        return ExamDetailResponse.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .accessCode(exam.getAccessCode())
                .description(exam.getDescription())
                .status(exam.getStatus())
                .durationMinutes(exam.getDurationMinutes())
                .maxAttempts(exam.getMaxAttempts())
                .shuffleQuestions(exam.getShuffleQuestions())
                .shuffleOptions(exam.getShuffleOptions())
                .isProctoringEnabled(exam.getIsProctoringEnabled())
                .maxViolations(exam.getMaxViolations())
                .startTime(exam.getStartTime())
                .endTime(exam.getEndTime())
                .createdAt(exam.getCreatedAt())
                .createdByTeacherId(exam.getCreatedBy() != null ? exam.getCreatedBy().getId() : null)
                .createdByTeacherName(exam.getCreatedBy() != null ? exam.getCreatedBy().getFullName() : null)
                .totalQuestions(questionResponses.size())
                .totalPoints(totalPoints)
                .questions(questionResponses)
                .build();
    }

    /**
     * Map Exam entity with a separately fetched question list into ExamDetailResponse DTO.
     */
    public static ExamDetailResponse fromEntityWithQuestions(Exam exam, List<QuestionResponse> questionResponses) {
        if (exam == null) {
            return null;
        }

        List<QuestionResponse> safeQuestions = questionResponses != null ? questionResponses : Collections.emptyList();
        double totalPoints = safeQuestions.stream()
                .mapToDouble(q -> q.getPoints() != null ? q.getPoints() : 0.0)
                .sum();

        return ExamDetailResponse.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .accessCode(exam.getAccessCode())
                .description(exam.getDescription())
                .status(exam.getStatus())
                .durationMinutes(exam.getDurationMinutes())
                .maxAttempts(exam.getMaxAttempts())
                .shuffleQuestions(exam.getShuffleQuestions())
                .shuffleOptions(exam.getShuffleOptions())
                .isProctoringEnabled(exam.getIsProctoringEnabled())
                .maxViolations(exam.getMaxViolations())
                .startTime(exam.getStartTime())
                .endTime(exam.getEndTime())
                .createdAt(exam.getCreatedAt())
                .createdByTeacherId(exam.getCreatedBy() != null ? exam.getCreatedBy().getId() : null)
                .createdByTeacherName(exam.getCreatedBy() != null ? exam.getCreatedBy().getFullName() : null)
                .totalQuestions(safeQuestions.size())
                .totalPoints(totalPoints)
                .questions(safeQuestions)
                .build();
    }
}
