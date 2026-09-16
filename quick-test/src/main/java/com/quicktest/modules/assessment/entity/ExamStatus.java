package com.quicktest.modules.assessment.entity;

/**
 * Status lifecycle of an Exam.
 */
public enum ExamStatus {
    DRAFT,          // Draft stage, not open for examination
    PUBLISHED,      // Published and ready for examination
    CLOSED,         // Closed, no more attempts allowed
    ARCHIVED,       // Archived exam
    CLONING         // Background cloning and image duplication in progress
}
