package com.quicktest.modules.assessment.dto;

import com.quicktest.modules.assessment.entity.ExamStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Publicly accessible summary card for open/explore exams displayed on the landing page.
 * Contains essential metadata allowing candidates to preview and take exams.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicExamCardResponse {

    private UUID id;
    private String title;
    private String accessCode;
    private String description;
    private ExamStatus status;
    private Integer durationMinutes;
    private Integer maxAttempts;
    private Long questionCount;
    private Double totalPoints;
    private String teacherName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String examTimeStatus; // "OPEN", "UPCOMING", "CLOSED"
    private Boolean isOpen;
    private LocalDateTime createdAt;
}
