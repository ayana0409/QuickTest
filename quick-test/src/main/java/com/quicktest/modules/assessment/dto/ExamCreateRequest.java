package com.quicktest.modules.assessment.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object for creating a new Exam.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamCreateRequest {

    @NotBlank(message = "Exam title must not be blank")
    @Size(max = 200, message = "Exam title must not exceed 200 characters")
    private String title;

    /**
     * Optional custom access code. If omitted or blank, the system automatically generates
     * a unique 6-8 character uppercase alphanumeric code.
     */
    @Pattern(regexp = "^[A-Za-z0-9]{4,30}$", message = "Access code must be between 4 and 30 alphanumeric characters")
    private String accessCode;

    @Size(max = 5000, message = "Exam description must not exceed 5000 characters")
    private String description;

    @NotNull(message = "Exam duration in minutes is required")
    @Min(value = 1, message = "Exam duration must be at least 1 minute")
    private Integer durationMinutes;

    @Builder.Default
    @Min(value = 1, message = "Maximum attempts must be at least 1")
    private Integer maxAttempts = 1;

    @Builder.Default
    private Boolean shuffleQuestions = true;

    @Builder.Default
    private Boolean shuffleOptions = true;

    @Builder.Default
    private Boolean isProctoringEnabled = false;

    @Builder.Default
    @Min(value = 1, message = "Max violations must be at least 1")
    private Integer maxViolations = 5;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;
}
