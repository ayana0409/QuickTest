package com.quicktest.modules.session.dto;

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
 * Question DTO presented to candidates.
 * CRITICAL SECURITY: Does NOT contain sampleAnswer, numericTolerance, or gradingRubric.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionInPaperDto {

    private UUID id;
    private Integer orderIndex;
    private String content;
    private QuestionType questionType;
    private Double points;
    private List<OptionInPaperDto> options;

    public static QuestionInPaperDto fromEntity(Question question, List<OptionInPaperDto> options) {
        if (question == null) {
            return null;
        }
        return QuestionInPaperDto.builder()
                .id(question.getId())
                .orderIndex(question.getOrderIndex())
                .content(question.getContent())
                .questionType(question.getQuestionType())
                .points(question.getPoints())
                .options(options != null ? options : Collections.emptyList())
                .build();
    }
}
