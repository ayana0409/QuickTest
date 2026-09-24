package com.quicktest.modules.assessment.dto;

import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Response DTO for listing a question from the teacher's question bank.
 * Includes exam metadata so teachers can identify where each question came from.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionBankItemResponse {

    // Question fields
    private UUID id;
    private Integer orderIndex;
    private String content;
    private String imageUrl;
    private QuestionType questionType;
    private Double points;
    private String sampleAnswer;
    private Double numericTolerance;
    private String gradingRubric;
    private Boolean isSafe;
    private List<AnswerOptionResponse> options;

    // Exam metadata - lets teacher know which exam this question belongs to
    private UUID examId;
    private String examTitle;
    private String examAccessCode;

    /**
     * Map a Question entity (with its options and exam eagerly loaded) to this DTO.
     */
    public static QuestionBankItemResponse fromEntity(Question question) {
        if (question == null) {
            return null;
        }

        List<AnswerOptionResponse> optionResponses = question.getOptions() != null
                ? question.getOptions().stream()
                        .map(AnswerOptionResponse::fromEntity)
                        .collect(Collectors.toList())
                : Collections.emptyList();

        return QuestionBankItemResponse.builder()
                .id(question.getId())
                .orderIndex(question.getOrderIndex())
                .content(question.getContent())
                .imageUrl(question.getImageUrl())
                .questionType(question.getQuestionType())
                .points(question.getPoints())
                .sampleAnswer(question.getSampleAnswer())
                .numericTolerance(question.getNumericTolerance())
                .gradingRubric(question.getGradingRubric())
                .isSafe(question.getIsSafe())
                .options(optionResponses)
                .examId(question.getExam().getId())
                .examTitle(question.getExam().getTitle())
                .examAccessCode(question.getExam().getAccessCode())
                .build();
    }
}
