package com.quicktest.modules.session.dto;

import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.GradingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Detailed attempt review response for the student to inspect their scores,
 * per-question performance, correct answers, and proctoring telemetry.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentAttemptDetailResponse {

    private UUID attemptId;
    private UUID examId;
    private String examTitle;
    private String accessCode;
    private AttemptStatus status;
    private Double awardedScore;
    private Double maxScore;
    private LocalDateTime startTime;
    private LocalDateTime submitTime;
    private Long durationSeconds;
    private Integer violationCount;
    private Boolean showResultsToStudents;

    @Builder.Default
    private List<ViolationItemDto> violations = new ArrayList<>();

    @Builder.Default
    private List<QuestionDetailDto> questions = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ViolationItemDto {
        private UUID id;
        private ViolationType violationType;
        private String description;
        private LocalDateTime timestamp;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionDto {
        private UUID id;
        private String content;
        private String imageUrl;
        private Integer orderIndex;
        private Boolean isCorrect;
        private Boolean isSelected;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionDetailDto {
        private UUID questionId;
        private Integer orderIndex;
        private String content;
        private String imageUrl;
        private QuestionType questionType;
        private Double points;
        private Double awardedScore;
        private GradingStatus gradingStatus;
        private String textAnswer;
        private String sampleAnswer;
        private String teacherFeedback;
        @Builder.Default
        private List<UUID> selectedOptionIds = new ArrayList<>();
        @Builder.Default
        private List<OptionDto> options = new ArrayList<>();
    }
}
