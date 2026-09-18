package com.quicktest.modules.session.service;

import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.iam.entity.User;

import java.util.UUID;

/**
 * Service for exporting exam attempts and grading session data to various formats (e.g. Excel).
 */
public interface ExamExportService {

    /**
     * Export all exam attempts for a specific exam matching optional status and search filters
     * into a beautifully formatted Excel (.xlsx) file.
     *
     * @param examId         the UUID of the exam
     * @param status         optional AttemptStatus filter (null for all)
     * @param search         optional candidate search term (name, email, identifier)
     * @param currentTeacher the authenticated teacher requesting the export
     * @return byte array containing the .xlsx workbook
     */
    byte[] exportExamAttemptsToExcel(UUID examId, AttemptStatus status, String search, User currentTeacher);

    /**
     * Export a detailed breakdown of a single exam attempt to an Excel (.xlsx) file,
     * including full candidate profile, exam overview, score per question, options chosen,
     * standard correct answers, and teacher feedback.
     *
     * @param attemptId      the UUID of the exam attempt
     * @param currentTeacher the authenticated teacher requesting the export
     * @return byte array containing the .xlsx workbook
     */
    byte[] exportSingleAttemptToExcel(UUID attemptId, User currentTeacher);
}
