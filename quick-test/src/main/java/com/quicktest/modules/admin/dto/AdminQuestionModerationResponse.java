package com.quicktest.modules.admin.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.iam.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * DTO for Admin Question Content Moderation dashboard.
 * Contains comprehensive question info, images, answer options, exam info, and teacher metadata.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminQuestionModerationResponse {

    private UUID id;
    private Integer orderIndex;
    private String content;
    private String imageUrl;
    private String imagePublicId;
    private QuestionType questionType;
    private Double points;

    // Type-specific fields
    private String sampleAnswer;
    private Double numericTolerance;
    private String gradingRubric;

    // Moderation status
    private Boolean isSafe;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime reviewedAt;
    private UUID reviewedBy;
    private String reviewedByName;

    // Helper flag indicating question or any answer option contains an image
    private Boolean hasImage;

    // Parent exam summary
    private ExamSummary exam;

    // Creator / Teacher summary
    private TeacherSummary teacher;

    // Answer options with potential images
    @Builder.Default
    private List<OptionSummary> options = new ArrayList<>();

    // Submissions counter (to inform admin about impact if deleted)
    private long attemptsCount;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExamSummary {
        private UUID id;
        private String title;
        private String accessCode;
        private ExamStatus status;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeacherSummary {
        private UUID id;
        private String fullName;
        private String email;
        private String username;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionSummary {
        private UUID id;
        private Integer orderIndex;
        private String content;
        private String imageUrl;
        private String imagePublicId;
        private Boolean isCorrect;
    }

    /**
     * Factory method mapping Question entity and metadata into DTO.
     */
    public static AdminQuestionModerationResponse fromEntity(
            Question question,
            String reviewerName,
            long attemptsCount) {

        if (question == null) {
            return null;
        }

        Exam exam = question.getExam();
        ExamSummary examSummary = null;
        TeacherSummary teacherSummary = null;

        if (exam != null) {
            examSummary = ExamSummary.builder()
                    .id(exam.getId())
                    .title(exam.getTitle())
                    .accessCode(exam.getAccessCode())
                    .status(exam.getStatus())
                    .build();

            User teacher = exam.getCreatedBy();
            if (teacher != null) {
                teacherSummary = TeacherSummary.builder()
                        .id(teacher.getId())
                        .fullName(teacher.getFullName())
                        .email(teacher.getEmail())
                        .username(teacher.getUsername())
                        .build();
            }
        }

        List<OptionSummary> optionList = new ArrayList<>();
        boolean anyOptionHasImage = false;

        if (question.getOptions() != null) {
            for (AnswerOption opt : question.getOptions()) {
                boolean optHasImage = opt.getImageUrl() != null && !opt.getImageUrl().isBlank();
                if (optHasImage) {
                    anyOptionHasImage = true;
                }

                optionList.add(OptionSummary.builder()
                        .id(opt.getId())
                        .orderIndex(opt.getOrderIndex())
                        .content(opt.getContent())
                        .imageUrl(opt.getImageUrl())
                        .imagePublicId(opt.getImagePublicId())
                        .isCorrect(opt.getIsCorrect())
                        .build());
            }
        }

        boolean questionHasImage = question.getImageUrl() != null && !question.getImageUrl().isBlank();
        boolean hasImage = questionHasImage || anyOptionHasImage;

        return AdminQuestionModerationResponse.builder()
                .id(question.getId())
                .orderIndex(question.getOrderIndex())
                .content(question.getContent())
                .imageUrl(question.getImageUrl())
                .imagePublicId(question.getImagePublicId())
                .questionType(question.getQuestionType())
                .points(question.getPoints())
                .sampleAnswer(question.getSampleAnswer())
                .numericTolerance(question.getNumericTolerance())
                .gradingRubric(question.getGradingRubric())
                .isSafe(Boolean.TRUE.equals(question.getIsSafe()))
                .reviewedAt(question.getReviewedAt())
                .reviewedBy(question.getReviewedBy())
                .reviewedByName(reviewerName)
                .hasImage(hasImage)
                .exam(examSummary)
                .teacher(teacherSummary)
                .options(optionList)
                .attemptsCount(attemptsCount)
                .build();
    }
}
