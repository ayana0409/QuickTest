package com.quicktest.core.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.modules.admin.dto.AiBackgroundJobDto;
import com.quicktest.modules.admin.dto.AiSlotMetricDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * Production implementation of {@link AiMetricsRedisService} using {@link StringRedisTemplate}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AiMetricsRedisServiceImpl implements AiMetricsRedisService {

    private static final String REDIS_KEY_SLOT_PREFIX = "ai:metrics:slot:";
    private static final String REDIS_KEY_SLOTS_SET = "ai:metrics:slots_set";
    private static final String REDIS_KEY_ACTIVE_JOBS = "ai:background:active_jobs";
    private static final Duration METRIC_TTL = Duration.ofHours(24);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void saveSlotMetric(AiSlotMetricDto metric) {
        if (metric == null) return;
        try {
            String key = REDIS_KEY_SLOT_PREFIX + metric.getSlotIndex();
            String json = objectMapper.writeValueAsString(metric);
            redisTemplate.opsForValue().set(key, json, METRIC_TTL);
            redisTemplate.opsForSet().add(REDIS_KEY_SLOTS_SET, String.valueOf(metric.getSlotIndex()));
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to save slot metric for slot {}: {}", metric.getSlotIndex(), e.getMessage());
        }
    }

    @Override
    public AiSlotMetricDto getSlotMetric(int slotIndex) {
        try {
            String key = REDIS_KEY_SLOT_PREFIX + slotIndex;
            String json = redisTemplate.opsForValue().get(key);
            if (json != null && !json.isBlank()) {
                return objectMapper.readValue(json, AiSlotMetricDto.class);
            }
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to read slot metric for slot {}: {}", slotIndex, e.getMessage());
        }
        return null;
    }

    @Override
    public List<AiSlotMetricDto> getAllSlotMetrics() {
        List<AiSlotMetricDto> list = new ArrayList<>();
        try {
            Set<String> indices = redisTemplate.opsForSet().members(REDIS_KEY_SLOTS_SET);
            if (indices != null) {
                List<String> sortedIndices = new ArrayList<>(indices);
                sortedIndices.sort(Comparator.comparingInt(Integer::parseInt));
                for (String idxStr : sortedIndices) {
                    AiSlotMetricDto dto = getSlotMetric(Integer.parseInt(idxStr));
                    if (dto != null) {
                        list.add(dto);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to fetch all slot metrics: {}", e.getMessage());
        }
        return list;
    }

    @Override
    public void recordSlotSuccess(int slotIndex) {
        try {
            AiSlotMetricDto dto = getSlotMetric(slotIndex);
            if (dto != null) {
                dto.setTotalRequests(dto.getTotalRequests() + 1);
                dto.setSuccessCount(dto.getSuccessCount() + 1);
                dto.setLastUsedAt(Instant.now().toString());
                dto.setExhausted(false);
                dto.setCooldownRemainingSeconds(0);
                saveSlotMetric(dto);
            }
        } catch (Exception e) {
            log.debug("[AiMetricsRedis] Failed to record success for slot {}: {}", slotIndex, e.getMessage());
        }
    }

    @Override
    public void recordSlotFailure(int slotIndex, String errorMessage, long cooldownRemainingSeconds) {
        try {
            AiSlotMetricDto dto = getSlotMetric(slotIndex);
            if (dto != null) {
                dto.setTotalRequests(dto.getTotalRequests() + 1);
                dto.setFailureCount(dto.getFailureCount() + 1);
                dto.setLastError(errorMessage);
                dto.setLastUsedAt(Instant.now().toString());
                dto.setExhausted(cooldownRemainingSeconds > 0);
                dto.setCooldownRemainingSeconds(Math.max(0, cooldownRemainingSeconds));
                saveSlotMetric(dto);
            }
        } catch (Exception e) {
            log.debug("[AiMetricsRedis] Failed to record failure for slot {}: {}", slotIndex, e.getMessage());
        }
    }

    @Override
    public void clearAllSlotMetrics() {
        try {
            Set<String> indices = redisTemplate.opsForSet().members(REDIS_KEY_SLOTS_SET);
            if (indices != null) {
                for (String idx : indices) {
                    redisTemplate.delete(REDIS_KEY_SLOT_PREFIX + idx);
                }
            }
            redisTemplate.delete(REDIS_KEY_SLOTS_SET);
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to clear slot metrics: {}", e.getMessage());
        }
    }

    // --- Background Worker Tracking ---

    @Override
    public void registerActiveJob(String jobId, String type, UUID examId, String examTitle, int totalQuestions, int totalAnswers, String status) {
        try {
            AiBackgroundJobDto job = AiBackgroundJobDto.builder()
                    .jobId(jobId)
                    .type(type)
                    .examId(examId != null ? examId.toString() : "")
                    .examTitle(examTitle != null ? examTitle : "")
                    .totalQuestions(totalQuestions)
                    .totalAnswers(totalAnswers)
                    .processedAnswers(0)
                    .startedAt(Instant.now().toString())
                    .threadName(Thread.currentThread().getName())
                    .status(status != null ? status : "PROCESSING")
                    .build();

            String json = objectMapper.writeValueAsString(job);
            redisTemplate.opsForHash().put(REDIS_KEY_ACTIVE_JOBS, jobId, json);
            redisTemplate.expire(REDIS_KEY_ACTIVE_JOBS, 24, TimeUnit.HOURS);
            log.info("[AiMetricsRedis] Registered background job [{}] ({}) for exam '{}'", jobId, status, examTitle);
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to register background job {}: {}", jobId, e.getMessage());
        }
    }

    @Override
    public void updateJobStatus(String jobId, String status, String threadName) {
        try {
            Object obj = redisTemplate.opsForHash().get(REDIS_KEY_ACTIVE_JOBS, jobId);
            if (obj != null) {
                AiBackgroundJobDto job = objectMapper.readValue(obj.toString(), AiBackgroundJobDto.class);
                if (status != null) {
                    job.setStatus(status);
                }
                if (threadName != null) {
                    job.setThreadName(threadName);
                }
                redisTemplate.opsForHash().put(REDIS_KEY_ACTIVE_JOBS, jobId, objectMapper.writeValueAsString(job));
                log.info("[AiMetricsRedis] Updated background job [{}] status to: {} on [{}]", jobId, status, threadName);
            }
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to update status for job {}: {}", jobId, e.getMessage());
        }
    }

    @Override
    public void updateJobProgress(String jobId, int processedAnswers) {
        try {
            Object obj = redisTemplate.opsForHash().get(REDIS_KEY_ACTIVE_JOBS, jobId);
            if (obj != null) {
                AiBackgroundJobDto job = objectMapper.readValue(obj.toString(), AiBackgroundJobDto.class);
                job.setProcessedAnswers(processedAnswers);
                redisTemplate.opsForHash().put(REDIS_KEY_ACTIVE_JOBS, jobId, objectMapper.writeValueAsString(job));
            }
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to update progress for job {}: {}", jobId, e.getMessage());
        }
    }

    @Override
    public void removeActiveJob(String jobId) {
        try {
            redisTemplate.opsForHash().delete(REDIS_KEY_ACTIVE_JOBS, jobId);
            log.info("[AiMetricsRedis] Removed completed background job [{}]", jobId);
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to remove background job {}: {}", jobId, e.getMessage());
        }
    }

    @Override
    public List<AiBackgroundJobDto> getActiveJobs() {
        List<AiBackgroundJobDto> jobs = new ArrayList<>();
        try {
            Map<Object, Object> map = redisTemplate.opsForHash().entries(REDIS_KEY_ACTIVE_JOBS);
            for (Object value : map.values()) {
                if (value != null) {
                    jobs.add(objectMapper.readValue(value.toString(), AiBackgroundJobDto.class));
                }
            }
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to fetch active background jobs: {}", e.getMessage());
        }
        return jobs;
    }

    @Override
    public int getActiveJobsCount() {
        try {
            Long size = redisTemplate.opsForHash().size(REDIS_KEY_ACTIVE_JOBS);
            return size != null ? size.intValue() : 0;
        } catch (Exception e) {
            log.warn("[AiMetricsRedis] Failed to get active background jobs count: {}", e.getMessage());
            return 0;
        }
    }
}
