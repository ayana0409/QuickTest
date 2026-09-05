package com.quicktest.modules.session.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.modules.session.dto.SaveAnswerRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Implementation of RedisExamSessionService storing candidate responses in Redis Hash structures.
 * Key format: exam:attempt:{attemptId}:answers
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class RedisExamSessionServiceImpl implements RedisExamSessionService {

    private static final String KEY_PREFIX = "exam:attempt:";
    private static final String KEY_SUFFIX = ":answers";

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void saveDraftAnswer(UUID attemptId, UUID questionId, SaveAnswerRequest request, long ttlMinutes) {
        String redisKey = buildKey(attemptId);
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
        String redisKey = buildKey(attemptId);
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
        String redisKey = buildKey(attemptId);
        redisTemplate.delete(redisKey);
        log.info("Cleared Redis draft answers for attemptId: {}", attemptId);
    }

    private String buildKey(UUID attemptId) {
        return KEY_PREFIX + attemptId.toString() + KEY_SUFFIX;
    }
}
