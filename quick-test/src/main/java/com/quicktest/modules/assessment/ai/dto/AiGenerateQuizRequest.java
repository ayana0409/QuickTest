package com.quicktest.modules.assessment.ai.dto;

import com.quicktest.modules.assessment.entity.QuestionType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Request payload for generating quiz questions from an uploaded document or raw text.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiGenerateQuizRequest {

    /**
     * Optional target exam ID if the questions are meant to be linked directly.
     */
    private UUID examId;

    /**
     * Desired number of questions to generate (1 - 40).
     */
    @Min(value = 1, message = "Total questions must be at least 1")
    @Max(value = 40, message = "Total questions cannot exceed 40 per batch")
    @Builder.Default
    private Integer totalQuestions = 10;

    /**
     * Target question types to include (e.g. SINGLE_CHOICE, MULTIPLE_CHOICE, ESSAY_TEXT, NUMERIC).
     */
    @Builder.Default
    private List<QuestionType> targetQuestionTypes = new ArrayList<>();

    /**
     * Difficulty level: BALANCED, EASY, MEDIUM, HARD.
     */
    @Builder.Default
    private String difficulty = "BALANCED";

    /**
     * Specific teacher prompt or focus instructions (e.g. "Focus on chapter 2").
     */
    private String additionalInstructions;

    /**
     * Target language for questions: 'vi' (Vietnamese) or 'en' (English).
     */
    @Builder.Default
    private String language = "vi";

    /**
     * Direct raw text payload if no physical file was uploaded.
     */
    private String rawText;
}
