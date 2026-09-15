package com.quicktest.modules.session.service;

import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.entity.GradingStatus;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

/**
 * Service handling question-centric essay grading workflows and asynchronous AI evaluation.
 */
public interface QuestionGradingService {

    /**
     * Retrieve all essay questions of an exam along with grading progress statistics.
     */
    List<QuestionGradingSummaryResponse> getQuestionsForGrading(UUID examId, User teacher);

    /**
     * Retrieve paginated candidate submissions for a specific essay question with rubric details.
     */
    QuestionSubmissionsDetailResponse getQuestionSubmissions(
            UUID questionId, GradingStatus filterStatus, Pageable pageable, User teacher);

    /**
     * Manually assign and save scores/feedback for candidate submissions of a question.
     */
    ManualBatchGradeResponse saveManualGrades(UUID questionId, ManualBatchGradeRequest request, User teacher);

    /**
     * Trigger asynchronous AI-powered batch grading using Google Gemini.
     */
    TriggerAiGradingResponse triggerAiGrading(TriggerAiGradingRequest request, User teacher);

    /**
     * Evaluate and grade a single candidate answer using Google Gemini AI immediately.
     */
    AiSingleGradeDto gradeSingleAnswerWithAi(UUID candidateAnswerId, User teacher);
}

