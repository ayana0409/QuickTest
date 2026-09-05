package com.quicktest.modules.assessment.service;

import com.quicktest.modules.assessment.dto.QuestionCreateRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.dto.QuestionUpdateRequest;
import com.quicktest.modules.iam.entity.User;

import java.util.UUID;

/**
 * Service interface for authoring and managing questions within exams.
 */
public interface QuestionService {

    /**
     * Add a new validated question to an exam in DRAFT status owned by the teacher.
     */
    QuestionResponse addQuestionToExam(UUID examId, QuestionCreateRequest request, User teacher);

    /**
     * Update an existing question and synchronize its answer options.
     */
    QuestionResponse updateQuestion(UUID questionId, QuestionUpdateRequest request, User teacher);

    /**
     * Delete a question from an exam in DRAFT status.
     */
    void deleteQuestion(UUID questionId, User teacher);
}
