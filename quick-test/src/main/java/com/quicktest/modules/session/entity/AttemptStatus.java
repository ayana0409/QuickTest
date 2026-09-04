package com.quicktest.modules.session.entity;

/**
 * Status of an exam attempt.
 */
public enum AttemptStatus {
    IN_PROGRESS,                  // Candidate is currently taking the exam
    SUBMITTED,                    // Exam submitted and all questions graded
    AWAITING_MANUAL_GRADING,      // Exam submitted, awaiting teacher manual grading for essay questions
    DISQUALIFIED                  // Disqualified due to rules violation
}
