package com.quicktest.modules.admin.dto;

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
 * DTO representing exam summary for administrator view across all teachers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminExamSummaryResponse {

    private UUID id;
    private String title;
    private String accessCode;
    private ExamStatus status;
    private Integer durationMinutes;
    private Integer maxAttempts;
    private int totalQuestions;
    private long totalAttempts;

    private UUID createdById;
    private String createdByName;
    private String createdByEmail;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    public static AdminExamSummaryResponse fromEntity(Exam exam, long totalAttempts, int totalQuestions) {
        if (exam == null) {
            return null;
        }
        return AdminExamSummaryResponse.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .accessCode(exam.getAccessCode())
                .status(exam.getStatus())
                .durationMinutes(exam.getDurationMinutes())
                .maxAttempts(exam.getMaxAttempts())
                .totalQuestions(totalQuestions)
                .totalAttempts(totalAttempts)
                .createdById(exam.getCreatedBy() != null ? exam.getCreatedBy().getId() : null)
                .createdByName(exam.getCreatedBy() != null ? exam.getCreatedBy().getFullName() : null)
                .createdByEmail(exam.getCreatedBy() != null ? exam.getCreatedBy().getEmail() : null)
                .startTime(exam.getStartTime())
                .endTime(exam.getEndTime())
                .createdAt(exam.getCreatedAt())
                .build();
    }

    public static AdminExamSummaryResponse fromEntity(Exam exam, long totalAttempts) {
        int questions = (exam != null && exam.getQuestions() != null) ? exam.getQuestions().size() : 0;
        return fromEntity(exam, totalAttempts, questions);
    }
}
