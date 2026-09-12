package com.quicktest.core.service;

import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.session.dto.AiBatchGradingResultDto;
import com.quicktest.modules.session.entity.CandidateAnswer;

import java.util.List;

/**
 * Service for evaluating candidate essay answers in batches using Google Gemini AI.
 */
public interface GeminiGradingService {

    /**
     * Grades a batch of candidate answers for a specific essay question.
     *
     * @param question     The essay question containing rubric, points, and sample answer.
     * @param batchAnswers The list of candidate answers to grade in this batch.
     * @return Batch grading result containing awarded scores and feedback for each candidate.
     */
    AiBatchGradingResultDto gradeBatch(Question question, List<CandidateAnswer> batchAnswers);
}
