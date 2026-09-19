package com.quicktest.modules.assessment.service;

import com.quicktest.modules.assessment.dto.QuestionBankItemResponse;
import com.quicktest.modules.assessment.dto.QuestionCreateRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.dto.QuestionUpdateRequest;
import com.quicktest.modules.iam.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
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

    /**
     * Upload and update an image directly for a specific question.
     */
    QuestionResponse updateQuestionImage(UUID questionId, org.springframework.web.multipart.MultipartFile file, User teacher);

    /**
     * Return a paginated list of all questions from the teacher's exams (the question bank).
     * Optionally excludes a target exam and supports keyword filtering.
     *
     * @param teacher       the authenticated teacher
     * @param excludeExamId exam whose questions should be excluded (null = include all)
     * @param search        optional keyword to filter by question content or exam title
     * @param pageable      pagination and sorting
     */
    Page<QuestionBankItemResponse> getQuestionBank(User teacher, UUID excludeExamId, String search, Pageable pageable);

    /**
     * Import selected questions from the bank into a target exam by deep-copying
     * each question, its options, and all associated Cloudinary images.
     *
     * @param targetExamId destination exam that the questions are imported into
     * @param questionIds  source question IDs to copy
     * @param teacher      must own both the target exam and each source question's exam
     * @return list of newly created QuestionResponse DTOs
     */
    List<QuestionResponse> importQuestionsFromBank(UUID targetExamId, List<UUID> questionIds, User teacher);
}
