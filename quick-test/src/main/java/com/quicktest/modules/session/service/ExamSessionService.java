package com.quicktest.modules.session.service;

import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.*;
import jakarta.servlet.http.HttpServletRequest;

import java.util.UUID;

/**
 * Service interface governing candidate exam sessions (start, resume, auto-save, submit).
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
     * Conclude and submit the exam attempt, transferring Redis drafts to PostgreSQL with auto-grading.
     */
    SubmitResultResponse submitExam(UUID attemptId, SubmitExamRequest request, User currentUser, String guestIdentifier);
}
