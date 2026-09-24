package com.quicktest.modules.assessment.dto;

import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
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
 * Data Transfer Object for returning question details to teachers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionResponse {

    private UUID id;
    private Integer orderIndex;
    private String content;
    private String imageUrl;
    private String imagePublicId;
    private QuestionType questionType;
    private Double points;
    private String sampleAnswer;
    private Double numericTolerance;
    private String gradingRubric;
    private Boolean isSafe;
    private LocalDateTime reviewedAt;
    private UUID reviewedBy;
    private List<AnswerOptionResponse> options;

    /**
     * Map Question entity to QuestionResponse DTO.
     */
    public static QuestionResponse fromEntity(Question question) {
        if (question == null) {
            return null;
        }

        List<AnswerOptionResponse> optionResponses = question.getOptions() != null
                ? question.getOptions().stream()
                        .map(AnswerOptionResponse::fromEntity)
                        .collect(Collectors.toList())
                : Collections.emptyList();

        return QuestionResponse.builder()
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
                .isSafe(question.getIsSafe())
                .reviewedAt(question.getReviewedAt())
                .reviewedBy(question.getReviewedBy())
                .options(optionResponses)
                .build();
    }
}
