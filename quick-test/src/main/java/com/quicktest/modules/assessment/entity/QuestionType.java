package com.quicktest.modules.assessment.entity;

/**
 * Supported question types in Quick Test.
 */
public enum QuestionType {
    SINGLE_CHOICE,    // Single correct choice (auto-graded)
    MULTIPLE_CHOICE,  // Multiple correct choices (auto-graded, supports partial scoring)
    NUMERIC,          // Numeric input (auto-graded with tolerance)
    ESSAY_TEXT        // Free-form essay/text (manual grading, future AI grading)
}
