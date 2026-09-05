package com.quicktest.modules.assessment.dto;

import com.quicktest.modules.assessment.entity.QuestionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Data Transfer Object for updating an existing question.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionUpdateRequest {

    private Integer orderIndex;

    @NotBlank(message = "Question content must not be blank")
    private String content;

    @NotNull(message = "Question type is required (SINGLE_CHOICE, MULTIPLE_CHOICE, NUMERIC, ESSAY_TEXT)")
    private QuestionType questionType;

    @NotNull(message = "Points value is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Points must be greater than 0")
    @Builder.Default
    private Double points = 1.0;

    private String sampleAnswer;

    private Double numericTolerance;

    private String gradingRubric;

    @Valid
    private List<AnswerOptionDto> options;
}
