package com.quicktest.modules.session.service;

import com.quicktest.modules.session.dto.SaveAnswerRequest;

import java.util.Map;
import java.util.UUID;

/**
 * Service managing temporary candidate answers cached in Redis Hashes.
 */
public interface RedisExamSessionService {

    /**
     * Cache or update a single draft answer in Redis Hash with TTL.
     */
    void saveDraftAnswer(UUID attemptId, UUID questionId, SaveAnswerRequest request, long ttlMinutes);

    /**
     * Retrieve all draft answers cached in Redis for an attempt.
     */
    Map<UUID, SaveAnswerRequest> getDraftAnswers(UUID attemptId);

    /**
     * Remove the entire draft answer hash from Redis after final submission.
     */
    void clearDraftAnswers(UUID attemptId);
}
