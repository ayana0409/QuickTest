package com.quicktest.modules.session.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.modules.session.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;

/**
 * Implementation of RedisExamSessionService storing candidate responses in Redis Hash structures,
 * managing atomic submission locks (SETNX), and caching master grading keys.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class RedisExamSessionServiceImpl implements RedisExamSessionService {

    private static final String KEY_PREFIX = "exam:attempt:";
    private static final String KEY_ANSWERS_SUFFIX = ":answers";
    private static final String KEY_SUBMITTING_SUFFIX = ":submitting";
    private static final String KEY_RESULT_SUFFIX = ":result";
    private static final String KEY_META_SUFFIX = ":meta";
    private static final String EXAM_KEY_PREFIX = "exam:";
    private static final String GRADING_KEY_SUFFIX = ":grading-key";

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void saveDraftAnswer(UUID attemptId, UUID questionId, SaveAnswerRequest request, long ttlMinutes) {
        String redisKey = buildAnswersKey(attemptId);
        try {
            String jsonPayload = objectMapper.writeValueAsString(request);
            redisTemplate.opsForHash().put(redisKey, questionId.toString(), jsonPayload);
            redisTemplate.expire(redisKey, Duration.ofMinutes(ttlMinutes));
            log.debug("Auto-saved draft answer to Redis hash: key={}, questionId={}", redisKey, questionId);
        } catch (JsonProcessingException ex) {
            log.error("Failed to serialize draft answer for attemptId: {}, questionId: {}", attemptId, questionId, ex);
        }
    }

    @Override
    public Map<UUID, SaveAnswerRequest> getDraftAnswers(UUID attemptId) {
        String redisKey = buildAnswersKey(attemptId);
        Map<Object, Object> rawEntries = redisTemplate.opsForHash().entries(redisKey);
        if (rawEntries == null || rawEntries.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<UUID, SaveAnswerRequest> result = new HashMap<>();
        for (Map.Entry<Object, Object> entry : rawEntries.entrySet()) {
            try {
                UUID qId = UUID.fromString(entry.getKey().toString());
                String jsonVal = entry.getValue().toString();
                SaveAnswerRequest answer = objectMapper.readValue(jsonVal, SaveAnswerRequest.class);
                result.put(qId, answer);
            } catch (Exception ex) {
                log.warn("Could not deserialize draft answer from Redis entry: key={}, value={}", entry.getKey(), entry.getValue(), ex);
            }
        }
        return result;
    }

    @Override
    public void clearDraftAnswers(UUID attemptId) {
        String redisKey = buildAnswersKey(attemptId);
        redisTemplate.delete(redisKey);
        log.info("Cleared Redis draft answers for attemptId: {}", attemptId);
    }

    @Override
    public boolean acquireSubmissionLock(UUID attemptId, long ttlSeconds) {
        String lockKey = buildLockKey(attemptId);
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, "LOCKED", Duration.ofSeconds(ttlSeconds));
        boolean success = Boolean.TRUE.equals(acquired);
        log.info("Acquiring submission lock for attemptId: {} -> {}", attemptId, success ? "GRANTED" : "DENIED (Duplicate)");
        return success;
    }

    @Override
    public void releaseSubmissionLock(UUID attemptId) {
        String lockKey = buildLockKey(attemptId);
        redisTemplate.delete(lockKey);
        log.info("Released submission lock for attemptId: {}", attemptId);
    }

    @Override
    public boolean isSubmissionLocked(UUID attemptId) {
        String lockKey = buildLockKey(attemptId);
        return Boolean.TRUE.equals(redisTemplate.hasKey(lockKey));
    }

    @Override
    public void cacheExamGradingKey(UUID examId, List<QuestionGradingDto> questions, long ttlMinutes) {
        String key = buildGradingKey(examId);
        try {
            String jsonPayload = objectMapper.writeValueAsString(questions);
            redisTemplate.opsForValue().set(key, jsonPayload, Duration.ofMinutes(ttlMinutes));
            log.info("Cached exam grading keys for examId: {} ({} questions)", examId, questions.size());
        } catch (JsonProcessingException ex) {
            log.error("Failed to cache exam grading keys for examId: {}", examId, ex);
        }
    }

    @Override
    public List<QuestionGradingDto> getExamGradingKey(UUID examId) {
        String key = buildGradingKey(examId);
        Object rawVal = redisTemplate.opsForValue().get(key);
        if (rawVal == null) {
            return null;
        }
        try {
            return objectMapper.readValue(rawVal.toString(), new TypeReference<List<QuestionGradingDto>>() {});
        } catch (Exception ex) {
            log.warn("Failed to deserialize cached exam grading key for examId: {}", examId, ex);
            return null;
        }
    }

    @Override
    public void cacheSubmissionResult(UUID attemptId, SubmitResultResponse result, long ttlMinutes) {
        String key = buildResultKey(attemptId);
        try {
            String jsonPayload = objectMapper.writeValueAsString(result);
            redisTemplate.opsForValue().set(key, jsonPayload, Duration.ofMinutes(ttlMinutes));
            log.info("Cached submission result for attemptId: {}", attemptId);
        } catch (JsonProcessingException ex) {
            log.error("Failed to cache submission result for attemptId: {}", attemptId, ex);
        }
    }

    @Override
    public SubmitResultResponse getCachedSubmissionResult(UUID attemptId) {
        String key = buildResultKey(attemptId);
        Object rawVal = redisTemplate.opsForValue().get(key);
        if (rawVal == null) {
            return null;
        }
        try {
            return objectMapper.readValue(rawVal.toString(), SubmitResultResponse.class);
        } catch (Exception ex) {
            log.warn("Failed to deserialize cached submission result for attemptId: {}", attemptId, ex);
            return null;
        }
    }

    @Override
    public void cacheAttemptMetadata(UUID attemptId, AttemptMetadataDto metadata, long ttlMinutes) {
        String key = buildMetaKey(attemptId);
        try {
            String jsonPayload = objectMapper.writeValueAsString(metadata);
            redisTemplate.opsForValue().set(key, jsonPayload, Duration.ofMinutes(ttlMinutes));
            log.debug("Cached attempt metadata for attemptId: {}", attemptId);
        } catch (JsonProcessingException ex) {
            log.error("Failed to cache attempt metadata for attemptId: {}", attemptId, ex);
        }
    }

    @Override
    public AttemptMetadataDto getAttemptMetadata(UUID attemptId) {
        String key = buildMetaKey(attemptId);
        Object rawVal = redisTemplate.opsForValue().get(key);
        if (rawVal == null) {
            return null;
        }
        try {
            return objectMapper.readValue(rawVal.toString(), AttemptMetadataDto.class);
        } catch (Exception ex) {
            log.warn("Failed to deserialize cached attempt metadata for attemptId: {}", attemptId, ex);
            return null;
        }
    }

    private String buildAnswersKey(UUID attemptId) {
        return KEY_PREFIX + attemptId + KEY_ANSWERS_SUFFIX;
    }

    private String buildLockKey(UUID attemptId) {
        return KEY_PREFIX + attemptId + KEY_SUBMITTING_SUFFIX;
    }

    private String buildResultKey(UUID attemptId) {
        return KEY_PREFIX + attemptId + KEY_RESULT_SUFFIX;
    }

    private String buildMetaKey(UUID attemptId) {
        return KEY_PREFIX + attemptId + KEY_META_SUFFIX;
    }

    private String buildGradingKey(UUID examId) {
        return EXAM_KEY_PREFIX + examId + GRADING_KEY_SUFFIX;
    }
}
