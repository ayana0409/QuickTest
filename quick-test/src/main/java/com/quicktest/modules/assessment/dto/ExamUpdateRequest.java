package com.quicktest.modules.assessment.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object for updating an existing Exam configuration.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamUpdateRequest {

    @NotBlank(message = "Exam title must not be blank")
    @Size(max = 200, message = "Exam title must not exceed 200 characters")
    private String title;

    @Size(max = 5000, message = "Exam description must not exceed 5000 characters")
    private String description;

    @NotNull(message = "Exam duration in minutes is required")
    @Min(value = 1, message = "Exam duration must be at least 1 minute")
    private Integer durationMinutes;

    @Min(value = 1, message = "Maximum attempts must be at least 1")
    private Integer maxAttempts;

    private Boolean shuffleQuestions;

    private Boolean shuffleOptions;

    private Boolean isProctoringEnabled;

    private Boolean showResultsToStudents;

    @Min(value = 1, message = "Max violations must be at least 1")
    private Integer maxViolations;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;
}
