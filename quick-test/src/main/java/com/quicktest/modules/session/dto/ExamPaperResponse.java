package com.quicktest.modules.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Exam paper payload delivered to candidates upon starting or resuming an exam session.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamPaperResponse {

    private UUID attemptId;
    private UUID examId;
    private String examTitle;
    private String examDescription;
    private Integer durationMinutes;
    private Integer totalQuestions;
    private Boolean isProctoringEnabled;
    private Integer maxViolations;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime expireAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime serverTime;

    private Long remainingSeconds;

    private String candidateName;
    private String candidateIdentifier;

    private List<QuestionInPaperDto> questions;
}
