package com.quicktest.modules.session.entity;

/**
 * Grading status for individual candidate answers.
 */
public enum GradingStatus {
    AUTO_GRADED,       // Auto-graded (for single choice, multiple choice, and numeric questions)
    PENDING_MANUAL,    // Pending manual review by teacher (for essay questions)
    GRADED,            // Teacher completed manual grading
    PENDING_AI         // Future extension: pending AI semantic analysis and grading
}
