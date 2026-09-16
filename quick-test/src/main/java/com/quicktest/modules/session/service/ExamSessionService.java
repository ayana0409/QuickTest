package com.quicktest.modules.session.service;

import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.*;
import jakarta.servlet.http.HttpServletRequest;

import java.util.UUID;

/**
 * Service interface governing candidate exam sessions (start, resume, auto-save, async submit, result polling).
 */
public interface ExamSessionService {

    /**
     * Start a new exam session for an authenticated student or guest.
     */
    ExamPaperResponse startExam(StartExamRequest request, User currentUser, HttpServletRequest servletRequest);

    /**
     * Auto-save a candidate's answer for a single question into Redis Hash.
     */
    void saveDraft(UUID attemptId, SaveAnswerRequest request, User currentUser, String guestIdentifier);

    /**
     * Resume an active exam session after page refresh or network interruption.
     */
    ResumeExamResponse resumeExam(UUID attemptId, User currentUser, String guestIdentifier);

    /**
     * Conclude and submit exam attempt asynchronously via RabbitMQ without blocking DB transactions.
     * Returns HTTP 202 Accepted payload (< 10ms).
     */
    SubmitAcceptedResponse submitExam(UUID attemptId, SubmitExamRequest request, User currentUser, String guestIdentifier);

    /**
     * Retrieve the finalized or in-progress grading result for a submitted exam attempt.
     */
    SubmitResultResponse getSubmissionResult(UUID attemptId, User currentUser, String guestIdentifier);

    /**
     * Automatically collect and submit all in-progress attempts for an exam (e.g. when closed or deadline reached).
     */
    void autoSubmitActiveAttemptsForExam(UUID examId, String reason);

    /**
     * Automatically collect and submit an individual expired attempt.
     */
    void autoSubmitExpiredAttempt(UUID attemptId, String reason);
}
