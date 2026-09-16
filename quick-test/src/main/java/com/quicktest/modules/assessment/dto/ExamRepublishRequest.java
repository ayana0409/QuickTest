package com.quicktest.modules.assessment.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object for republishing an existing closed exam with updated time window.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamRepublishRequest {

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime endTime;

    @Min(value = 1, message = "Exam duration must be at least 1 minute")
    private Integer durationMinutes;

    @Min(value = 1, message = "Maximum attempts must be at least 1")
    private Integer maxAttempts;
}
