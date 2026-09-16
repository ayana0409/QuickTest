package com.quicktest.modules.session.service;

import com.quicktest.modules.session.dto.AttemptMetadataDto;
import com.quicktest.modules.session.dto.QuestionGradingDto;
import com.quicktest.modules.session.dto.SaveAnswerRequest;
import com.quicktest.modules.session.dto.SubmitResultResponse;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service managing Redis caching, atomic submission locking, and temporary exam draft state.
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

    /**
     * Atomic lock (SETNX) to prevent double submissions from rapid client clicks.
     *
     * @return true if lock was successfully acquired, false if already locked/in-progress.
     */
    boolean acquireSubmissionLock(UUID attemptId, long ttlSeconds);

    /**
     * Release atomic submission lock.
     */
    void releaseSubmissionLock(UUID attemptId);

    /**
     * Check if an attempt currently has an active submission lock (being submitted or graded).
     */
    boolean isSubmissionLocked(UUID attemptId);

    /**
     * Cache master exam answer keys for fast RAM-based grading without DB queries.
     */
    void cacheExamGradingKey(UUID examId, List<QuestionGradingDto> questions, long ttlMinutes);

    /**
     * Retrieve cached master answer keys for an exam. Returns null on cache miss.
     */
    List<QuestionGradingDto> getExamGradingKey(UUID examId);

    /**
     * Cache finalized submission result in Redis to serve instant client polling.
     */
    void cacheSubmissionResult(UUID attemptId, SubmitResultResponse result, long ttlMinutes);

    /**
     * Retrieve cached submission result. Returns null on cache miss.
     */
    SubmitResultResponse getCachedSubmissionResult(UUID attemptId);

    /**
     * Cache lightweight attempt metadata for sub-millisecond validation.
     */
    void cacheAttemptMetadata(UUID attemptId, AttemptMetadataDto metadata, long ttlMinutes);

    /**
     * Retrieve cached attempt metadata. Returns null on cache miss.
     */
    AttemptMetadataDto getAttemptMetadata(UUID attemptId);
}
