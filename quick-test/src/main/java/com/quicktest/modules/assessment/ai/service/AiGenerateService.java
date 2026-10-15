package com.quicktest.modules.assessment.ai.service;

import com.quicktest.modules.assessment.ai.dto.AiCommitQuestionsRequest;
import com.quicktest.modules.assessment.ai.dto.AiGenerateJobResponse;
import com.quicktest.modules.assessment.ai.dto.AiGenerateQuizRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.iam.entity.User;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * Service orchestrating AI-driven quiz generation from documents and bulk commitment to exams.
 */
public interface AiGenerateService {

    /**
     * Accepts a document upload, validates single-worker-per-user concurrency,
     * extracts text, and enqueues generation on the shared single-thread AI queue.
     */
    AiGenerateJobResponse submitQuizGenerationJob(
            MultipartFile file,
            AiGenerateQuizRequest request,
            User teacher);

    /**
     * Polls the current execution status and generated questions for a background job.
     */
    AiGenerateJobResponse getJobStatus(String jobId, User teacher);

    /**
     * Cancels an enqueued or stalled quiz generation job and frees the user's lock.
     */
    void cancelQuizGenerationJob(String jobId, User teacher);

    /**
     * Commits approved questions from the AI preview into an existing Exam.
     */
    List<QuestionResponse> commitQuestionsToExam(
            UUID examId,
            AiCommitQuestionsRequest request,
            User teacher);
}
