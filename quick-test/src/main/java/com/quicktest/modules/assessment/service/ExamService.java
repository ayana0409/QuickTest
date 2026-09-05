package com.quicktest.modules.assessment.service;

import com.quicktest.modules.assessment.dto.ExamCreateRequest;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.dto.ExamSummaryResponse;
import com.quicktest.modules.assessment.dto.ExamUpdateRequest;
import com.quicktest.modules.iam.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

/**
 * Service interface for exam authoring and lifecycle management by teachers.
 */
public interface ExamService {

    /**
     * Create a new exam in DRAFT status. Automatically generates a unique access code if omitted.
     */
    ExamDetailResponse createExam(ExamCreateRequest request, User teacher);

    /**
     * Update configuration details of an existing exam owned by the teacher.
     */
    ExamDetailResponse updateExam(UUID examId, ExamUpdateRequest request, User teacher);

    /**
     * Delete an exam. Only DRAFT exams owned by the teacher can be deleted.
     */
    void deleteExam(UUID examId, User teacher);

    /**
     * Retrieve paginated summary list of exams created by the teacher.
     */
    Page<ExamSummaryResponse> getTeacherExams(User teacher, Pageable pageable);

    /**
     * Retrieve complete exam details including all questions and options.
     */
    ExamDetailResponse getExamDetail(UUID examId, User teacher);

    /**
     * Publish an exam, transitioning status from DRAFT to PUBLISHED.
     * Requires at least one question in the exam.
     */
    ExamDetailResponse publishExam(UUID examId, User teacher);

    /**
     * Close an exam, preventing further candidate submissions.
     */
    ExamDetailResponse closeExam(UUID examId, User teacher);
}
