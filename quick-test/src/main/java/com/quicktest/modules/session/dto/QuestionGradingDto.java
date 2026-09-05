package com.quicktest.modules.session.dto;

import com.quicktest.modules.assessment.entity.QuestionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Set;
import java.util.UUID;

/**
 * Cached grading reference for an exam question stored in Redis to eliminate DB queries during grading.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionGradingDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private UUID questionId;
    private QuestionType questionType;
    private Double points;

    // Set of IDs of correct options (for SINGLE_CHOICE and MULTIPLE_CHOICE)
    private Set<UUID> correctOptionIds;

    // Standard answer or formula for NUMERIC
    private String sampleAnswer;
    private Double numericTolerance;

    // Rubric for ESSAY_TEXT
    private String gradingRubric;
}
