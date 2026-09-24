package com.quicktest.core.service;

import com.quicktest.modules.admin.dto.AiModerationResultDto;
import com.quicktest.modules.assessment.entity.Question;

import java.util.List;

/**
 * Service interface for AI-powered question content moderation via Google Gemini.
 * Only text-only questions (no images) are eligible for AI moderation.
 */
public interface AiModerationService {

    /**
     * Send a batch of text-only questions to Gemini for content safety analysis.
     * Returns per-question safety verdicts.
     *
     * @param questions list of text-only questions to moderate
     * @return AiModerationResultDto with safety verdicts keyed by question ID
     */
    AiModerationResultDto moderateBatch(List<Question> questions);
}
