package com.quicktest.modules.session.dto;

import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Summary card for an exam on the student dashboard,
 * including attempt quota, real-time status, active session, and best score.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentExamCardDto {

    private UUID examId;
    private String title;
    private String accessCode;
    private String description;
    private Integer durationMinutes;
    private Integer questionCount;
    private String teacherName;

    // Exam status
    private ExamStatus examRawStatus; // e.g., PUBLISHED, CLOSED
    private String examTimeStatus;    // "OPEN", "CLOSED", "UPCOMING"
    private Boolean isOpen;           // true if candidate can take test
    private LocalDateTime startTime;
    private LocalDateTime endTime;

    // Attempt quotas & progress
    private Integer maxAttempts;
    private Integer attemptsUsed;
    private Integer remainingAttempts;
    private Boolean canTakeExam;      // (isOpen && remainingAttempts > 0) || hasActiveSession

    // Active session of oneself (IN_PROGRESS)
    private Boolean hasActiveSession;
    private UUID activeAttemptId;
    private LocalDateTime activeAttemptStartTime;
    private LocalDateTime activeAttemptExpireAt;
    private Long activeAttemptRemainingSeconds;

    // Candidate historical performance for this exam
    private UUID latestAttemptId;
    private AttemptStatus latestAttemptStatus;
    private Double latestScore;
    private Double highestScore;
    private LocalDateTime latestSubmittedAt;
    private LocalDateTime lastAttemptedAt;
}
