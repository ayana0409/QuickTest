package com.quicktest.modules.admin.service;

import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.service.AiMetricsRedisService;
import com.quicktest.core.service.GeminiRotationService;
import com.quicktest.modules.admin.dto.*;
import com.quicktest.modules.admin.entity.AiApiKey;
import com.quicktest.modules.admin.entity.AiModelConfigEntity;
import com.quicktest.modules.admin.repository.AiApiKeyRepository;
import com.quicktest.modules.admin.repository.AiModelConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Production implementation of {@link AdminAiService}.
 * Orchestrates CRUD operations for AI API keys and models, triggers dynamic slot pool reloads,
 * and compiles comprehensive real-time system metrics from Redis.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AdminAiServiceImpl implements AdminAiService {

    private final AiApiKeyRepository aiApiKeyRepository;
    private final AiModelConfigRepository aiModelConfigRepository;
    private final GeminiRotationService geminiRotationService;
    private final AiMetricsRedisService aiMetricsRedisService;
    private final StringRedisTemplate stringRedisTemplate;

    private volatile String lastReloadedAt = Instant.now().toString();

    @Override
    public AiSystemStatusResponse getSystemStatus() {
        List<AiSlotMetricDto> slotMetrics = aiMetricsRedisService.getAllSlotMetrics();
        List<AiBackgroundJobDto> activeJobs = aiMetricsRedisService.getActiveJobs();

        int totalSlots = geminiRotationService.getTotalSlotCount();
        int availableSlots = geminiRotationService.getActiveSlotsCount();
        int exhaustedSlots = Math.max(0, totalSlots - availableSlots);
        int totalCapacityRpm = slotMetrics.stream().mapToInt(AiSlotMetricDto::getRpmMax).sum();

        return AiSystemStatusResponse.builder()
                .configSource(geminiRotationService.getConfigSource())
                .totalConfiguredKeys(geminiRotationService.getTotalKeysCount())
                .totalSlots(totalSlots)
                .availableSlots(availableSlots)
                .exhaustedSlots(exhaustedSlots)
                .totalCapacityRpm(totalCapacityRpm)
                .activeBackgroundJobsCount(activeJobs.size())
                .slots(slotMetrics)
                .activeBackgroundJobs(activeJobs)
                .lastReloadedAt(this.lastReloadedAt)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AiKeyResponse> getAllKeys() {
        return aiApiKeyRepository.findAllByOrderByOrderIndexAsc().stream()
                .map(this::mapToKeyResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public AiKeyResponse getKeyById(UUID id) {
        AiApiKey key = aiApiKeyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("AiApiKey", "id", id));
        return mapToKeyResponse(key);
    }

    @Override
    @Transactional
    public AiKeyResponse createKey(AiKeyCreateRequest request) {
        AiApiKey keyEntity = AiApiKey.builder()
                .name(request.getName().trim())
                .apiKey(request.getApiKey().trim())
                .provider(request.getProvider() != null ? request.getProvider().trim() : "GEMINI")
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .orderIndex(request.getOrderIndex() != null ? request.getOrderIndex() : 0)
                .build();

        if (request.getModels() != null) {
            for (AiModelCreateRequest modelReq : request.getModels()) {
                AiModelConfigEntity model = AiModelConfigEntity.builder()
                        .modelName(modelReq.getModelName().trim())
                        .rpm(modelReq.getRpm() != null ? modelReq.getRpm() : 15)
                        .tpm(modelReq.getTpm() != null ? modelReq.getTpm() : 1000000)
                        .isActive(modelReq.getIsActive() != null ? modelReq.getIsActive() : true)
                        .orderIndex(modelReq.getOrderIndex() != null ? modelReq.getOrderIndex() : 0)
                        .build();
                keyEntity.addModel(model);
            }
        }

        AiApiKey saved = aiApiKeyRepository.save(keyEntity);
        reloadPool();
        log.info("[AdminAiService] Created new AI key: '{}' with {} models.", saved.getName(), saved.getModels().size());
        return mapToKeyResponse(saved);
    }

    @Override
    @Transactional
    public AiKeyResponse updateKey(UUID id, AiKeyUpdateRequest request) {
        AiApiKey key = aiApiKeyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("AiApiKey", "id", id));

        if (request.getName() != null && !request.getName().isBlank()) {
            key.setName(request.getName().trim());
        }
        if (request.getApiKey() != null && !request.getApiKey().isBlank()) {
            key.setApiKey(request.getApiKey().trim());
        }
        if (request.getIsActive() != null) {
            key.setIsActive(request.getIsActive());
        }
        if (request.getOrderIndex() != null) {
            key.setOrderIndex(request.getOrderIndex());
        }

        if (request.getModels() != null) {
            // Replace existing models list
            key.getModels().clear();
            for (AiModelCreateRequest modelReq : request.getModels()) {
                AiModelConfigEntity model = AiModelConfigEntity.builder()
                        .modelName(modelReq.getModelName().trim())
                        .rpm(modelReq.getRpm() != null ? modelReq.getRpm() : 15)
                        .tpm(modelReq.getTpm() != null ? modelReq.getTpm() : 1000000)
                        .isActive(modelReq.getIsActive() != null ? modelReq.getIsActive() : true)
                        .orderIndex(modelReq.getOrderIndex() != null ? modelReq.getOrderIndex() : 0)
                        .build();
                key.addModel(model);
            }
        }

        AiApiKey updated = aiApiKeyRepository.save(key);
        reloadPool();
        log.info("[AdminAiService] Updated AI key: '{}'. Models: {}", updated.getName(), updated.getModels().size());
        return mapToKeyResponse(updated);
    }

    @Override
    @Transactional
    public void deleteKey(UUID id) {
        AiApiKey key = aiApiKeyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("AiApiKey", "id", id));

        aiApiKeyRepository.delete(key);
        reloadPool();
        log.info("[AdminAiService] Deleted AI key: '{}' (ID: {})", key.getName(), id);
    }

    @Override
    @Transactional
    public AiKeyResponse toggleKeyActive(UUID id) {
        AiApiKey key = aiApiKeyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("AiApiKey", "id", id));

        key.setIsActive(!Boolean.TRUE.equals(key.getIsActive()));
        AiApiKey saved = aiApiKeyRepository.save(key);
        reloadPool();
        log.info("[AdminAiService] Toggled AI key '{}' active state to: {}", saved.getName(), saved.getIsActive());
        return mapToKeyResponse(saved);
    }

    @Override
    @Transactional
    public AiModelResponse toggleModelActive(UUID modelId) {
        AiModelConfigEntity model = aiModelConfigRepository.findById(modelId)
                .orElseThrow(() -> new ResourceNotFoundException("AiModelConfigEntity", "id", modelId));

        model.setIsActive(!Boolean.TRUE.equals(model.getIsActive()));
        AiModelConfigEntity saved = aiModelConfigRepository.save(model);
        reloadPool();
        log.info("[AdminAiService] Toggled AI model '{}' active state to: {}", saved.getModelName(), saved.getIsActive());
        return mapToModelResponse(saved);
    }

    @Override
    public void reloadPool() {
        geminiRotationService.reloadSlots();
        this.lastReloadedAt = Instant.now().toString();
    }

    @Override
    public void cancelJob(String jobId) {
        if (jobId == null || jobId.isBlank()) return;
        List<AiBackgroundJobDto> jobs = aiMetricsRedisService.getActiveJobs();
        for (AiBackgroundJobDto job : jobs) {
            if (jobId.equalsIgnoreCase(job.getJobId())) {
                if (job.getExamId() != null && !job.getExamId().isBlank()) {
                    stringRedisTemplate.delete("ai:grading:lock:exam:" + job.getExamId());
                    log.info("[AdminAi] Released Redis lock for exam ID: {}", job.getExamId());
                }
                break;
            }
        }
        aiMetricsRedisService.removeActiveJob(jobId);
        log.info("[AdminAi] Cancelled/removed background job ID: {}", jobId);
    }

    @Override
    public void clearAllJobs() {
        List<AiBackgroundJobDto> jobs = aiMetricsRedisService.getActiveJobs();
        for (AiBackgroundJobDto job : jobs) {
            if (job.getExamId() != null && !job.getExamId().isBlank()) {
                stringRedisTemplate.delete("ai:grading:lock:exam:" + job.getExamId());
            }
            aiMetricsRedisService.removeActiveJob(job.getJobId());
        }
        log.info("[AdminAi] Cleared all ({}) background jobs and released corresponding Redis locks.", jobs.size());
    }

    /**
     * Automatically cleans up stale or orphaned background grading jobs and releases any
     * leftover Redis exam locks when the Spring Boot server boots up.
     * Prevents aborted JVM sessions from blocking future grading attempts.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void cleanupOrphanJobsOnStartup() {
        try {
            List<AiBackgroundJobDto> orphanJobs = aiMetricsRedisService.getActiveJobs();
            if (!orphanJobs.isEmpty()) {
                log.info("[AI STARTUP CLEANUP] Detected {} orphan AI background job(s) from previous server run. Cleaning up...",
                        orphanJobs.size());
                clearAllJobs();
                log.info("[AI STARTUP CLEANUP] Successfully cleared orphan background jobs and released exam locks.");
            }
        } catch (Exception e) {
            log.warn("[AI STARTUP CLEANUP] Failed to cleanup orphan background jobs on startup: {}", e.getMessage());
        }
    }

    private AiKeyResponse mapToKeyResponse(AiApiKey entity) {
        List<AiModelResponse> modelResponses = new ArrayList<>();
        if (entity.getModels() != null) {
            for (AiModelConfigEntity m : entity.getModels()) {
                modelResponses.add(mapToModelResponse(m));
            }
        }

        return AiKeyResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .maskedKey(maskApiKey(entity.getApiKey()))
                .provider(entity.getProvider())
                .isActive(entity.getIsActive())
                .orderIndex(entity.getOrderIndex())
                .models(modelResponses)
                .createdAt(entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null)
                .updatedAt(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null)
                .build();
    }

    private AiModelResponse mapToModelResponse(AiModelConfigEntity entity) {
        return AiModelResponse.builder()
                .id(entity.getId())
                .modelName(entity.getModelName())
                .rpm(entity.getRpm())
                .tpm(entity.getTpm())
                .isActive(entity.getIsActive())
                .orderIndex(entity.getOrderIndex())
                .build();
    }

    private String maskApiKey(String rawKey) {
        if (rawKey == null || rawKey.length() < 8) {
            return "***";
        }
        return rawKey.substring(0, 4) + "..." + rawKey.substring(rawKey.length() - 4);
    }
}
