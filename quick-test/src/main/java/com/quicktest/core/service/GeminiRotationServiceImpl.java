package com.quicktest.core.service;

import com.quicktest.config.GeminiPoolProperties;
import com.quicktest.config.GeminiProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.GeminiAllSlotsExhaustedException;
import com.quicktest.modules.admin.dto.AiSlotMetricDto;
import com.quicktest.modules.admin.entity.AiApiKey;
import com.quicktest.modules.admin.entity.AiModelConfigEntity;
import com.quicktest.modules.admin.repository.AiApiKeyRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Production implementation of {@link GeminiRotationService}.
 * Manages a pool of (apiKey, model) slots loaded dynamically from Database,
 * falling back to a single environment key (GEMINI_API_KEY) if DB is unconfigured.
 * Tracks live metrics in Redis and automatically rotates upon HTTP 429 rate limits.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class GeminiRotationServiceImpl implements GeminiRotationService {

    private final GeminiPoolProperties poolProperties;
    private final GeminiProperties legacyProperties;
    private final AiApiKeyRepository aiApiKeyRepository;
    private final AiMetricsRedisService aiMetricsRedisService;

    private final List<GeminiModelSlot> slots = new CopyOnWriteArrayList<>();
    private final AtomicInteger currentSlotIndex = new AtomicInteger(0);
    private volatile String configSource = "DATABASE";

    private RestClient restClient;

    @PostConstruct
    public void init() {
        int timeoutSec = poolProperties.getTimeoutSeconds() > 0 ? poolProperties.getTimeoutSeconds() : 60;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(timeoutSec));
        requestFactory.setReadTimeout(Duration.ofSeconds(timeoutSec));

        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();

        initSlots();
    }

    /**
     * Initializes slots from Database (priority 1) or falls back to single-key environment variable (priority 2).
     */
    public synchronized void initSlots() {
        slots.clear();
        int slotIndex = 0;

        try {
            // Priority 1: Read active API keys and their active models from Database
            List<AiApiKey> dbKeys = aiApiKeyRepository.findAllActiveWithModels();
            if (dbKeys != null && !dbKeys.isEmpty()) {
                for (AiApiKey keyEntity : dbKeys) {
                    if (Boolean.FALSE.equals(keyEntity.getIsActive())) {
                        continue;
                    }
                    String key = keyEntity.getApiKey() != null ? keyEntity.getApiKey().trim() : "";
                    if (!isValidKey(key)) {
                        continue;
                    }

                    if (keyEntity.getModels() != null) {
                        for (AiModelConfigEntity modelConfig : keyEntity.getModels()) {
                            if (Boolean.FALSE.equals(modelConfig.getIsActive())) {
                                continue;
                            }
                            String modelName = modelConfig.getModelName() != null ? modelConfig.getModelName().trim() : "";
                            if (!modelName.isEmpty()) {
                                slots.add(new GeminiModelSlot(
                                        slotIndex++,
                                        keyEntity.getId() != null ? keyEntity.getId().toString() : null,
                                        keyEntity.getName(),
                                        key,
                                        modelName,
                                        modelConfig.getRpm() != null ? modelConfig.getRpm() : 15,
                                        modelConfig.getTpm() != null ? modelConfig.getTpm() : 1000000
                                ));
                            }
                        }
                    }
                }
            }

            if (!slots.isEmpty()) {
                this.configSource = "DATABASE";
                log.info("[GeminiRotation] Successfully loaded {} active slot(s) from DATABASE.", slots.size());
            } else {
                log.info("[GeminiRotation] Database has no active AI keys or models. Checking ENV fallback.");
            }
        } catch (Exception e) {
            log.error("[GeminiRotation] Failed to query AI keys from database: {}. Falling back to ENV.", e.getMessage());
        }

        // Priority 2: Fallback to single environment key if database returned no slots
        if (slots.isEmpty()) {
            this.configSource = "ENV_FALLBACK";
            String legacyKey = legacyProperties.getApiKey() != null ? legacyProperties.getApiKey().trim() : "";
            if (isValidKey(legacyKey)) {
                String legacyModel = legacyProperties.getModel() != null ? legacyProperties.getModel().trim() : "gemini-2.0-flash-lite";
                log.warn("[GeminiRotation] Initialized single-key ENV fallback slot: model={}", legacyModel);
                slots.add(new GeminiModelSlot(
                        0,
                        null,
                        "Env Single Key",
                        legacyKey,
                        legacyModel,
                        15,
                        1000000
                ));
            } else {
                log.warn("[GeminiRotation] No valid Gemini API keys found in Database or Environment (GEMINI_API_KEY).");
            }
        }

        // Synchronize initial slot state with Redis
        syncInitialSlotsToRedis();
    }

    /**
     * Clears and resets slot metric entries in Redis.
     */
    private void syncInitialSlotsToRedis() {
        try {
            aiMetricsRedisService.clearAllSlotMetrics();
            for (GeminiModelSlot slot : slots) {
                AiSlotMetricDto metric = AiSlotMetricDto.builder()
                        .slotIndex(slot.getSlotIndex())
                        .keyId(slot.getKeyId())
                        .keyName(slot.getKeyName())
                        .maskedKey(slot.getMaskedKey())
                        .modelName(slot.getModelName())
                        .rpmCurrent(0)
                        .rpmMax(slot.getRpmLimit())
                        .tpmCurrent(0)
                        .tpmMax(slot.getTpmLimit())
                        .isExhausted(false)
                        .cooldownRemainingSeconds(0)
                        .totalRequests(0)
                        .successCount(0)
                        .failureCount(0)
                        .build();
                aiMetricsRedisService.saveSlotMetric(metric);
            }
        } catch (Exception e) {
            log.warn("[GeminiRotation] Could not sync initial slots to Redis: {}", e.getMessage());
        }
    }

    @Override
    public synchronized void reloadSlots() {
        log.info("[GeminiRotation] Admin triggered pool reload. Refreshing slots...");
        initSlots();
        currentSlotIndex.set(0);
        log.info("[GeminiRotation] Pool reload complete. Active slots: {}, Source: {}", slots.size(), configSource);
    }

    @Override
    public String getConfigSource() {
        return this.configSource;
    }

    @Override
    public boolean hasAvailableSlots() {
        if (slots.isEmpty()) {
            initSlots();
        }
        return !slots.isEmpty();
    }

    @Override
    public int getTotalSlotCount() {
        return slots.size();
    }

    @Override
    public int getTotalKeysCount() {
        Set<String> uniqueKeys = new HashSet<>();
        for (GeminiModelSlot slot : slots) {
            uniqueKeys.add(slot.getApiKey());
        }
        return uniqueKeys.size();
    }

    @Override
    public int getActiveSlotsCount() {
        int active = 0;
        for (GeminiModelSlot slot : slots) {
            if (!slot.getExhausted().get()) {
                active++;
            }
        }
        return active;
    }

    @Override
    public List<GeminiModelSlot> getSlots() {
        return Collections.unmodifiableList(slots);
    }

    @Override
    public String executeWithRotation(String prompt, double temperature, int maxOutputTokens) {
        if (slots.isEmpty()) {
            initSlots();
        }
        if (slots.isEmpty()) {
            throw new AppException(
                    "Google Gemini API key is not configured. Cannot perform AI operation. " +
                    "Please configure AI keys in Admin Dashboard or set 'GEMINI_API_KEY' in environment.",
                    HttpStatus.BAD_REQUEST);
        }

        int total = slots.size();
        int startIndex = currentSlotIndex.get();
        int estimatedTokens = (prompt.length() / 4) + maxOutputTokens;

        for (int i = 0; i < total; i++) {
            int idx = (startIndex + i) % total;
            GeminiModelSlot slot = slots.get(idx);

            // Attempt to acquire quota on this slot (proactive sliding window check)
            if (!slot.tryAcquire(estimatedTokens)) {
                log.debug("[GeminiRotation] Slot {} [{}:{}] is busy or exhausted. Skipping to next.",
                        idx, slot.getMaskedKey(), slot.getModelName());
                continue;
            }

            // Sync current in-flight counters to Redis
            updateSlotUsageInRedis(slot);

            try {
                String responseBody = callGeminiApi(slot, prompt, temperature, maxOutputTokens);
                currentSlotIndex.set(idx); // Sticky: stay on successful slot for subsequent calls

                // Record success in Redis
                aiMetricsRedisService.recordSlotSuccess(slot.getSlotIndex());
                updateSlotUsageInRedis(slot);

                log.info("[GeminiRotation] AI request succeeded on slot {} [{}:{}]",
                        idx, slot.getMaskedKey(), slot.getModelName());
                return responseBody;

            } catch (RestClientResponseException ex) {
                int status = ex.getStatusCode().value();
                String errorMsg = "HTTP " + status + ": " + ex.getStatusText();

                if (status == 429) {
                    // Rate limit reached for this specific model/key
                    slot.markExhausted();
                    log.warn("[GeminiRotation] Slot {} [{}:{}] hit HTTP 429 Rate Limit. Rotating to next slot.",
                            idx, slot.getMaskedKey(), slot.getModelName());
                    aiMetricsRedisService.recordSlotFailure(slot.getSlotIndex(), "HTTP 429 Rate Limit Exceeded", slot.getRemainingCooldownSeconds());
                } else if (status == 403) {
                    slot.markExhausted(3600_000); // 1 hour cooldown
                    log.warn("[GeminiRotation] Slot {} [{}:{}] returned 403 Forbidden. Disabling slot for 1h.",
                            idx, slot.getMaskedKey(), slot.getModelName());
                    aiMetricsRedisService.recordSlotFailure(slot.getSlotIndex(), "HTTP 403 Forbidden: Key Invalid/Expired", 3600);
                } else if (status == 404) {
                    slot.markExhausted(86400_000); // 24 hours cooldown
                    log.warn("[GeminiRotation] Slot {} [{}:{}] returned 404 Not Found (invalid/deprecated model).",
                            idx, slot.getMaskedKey(), slot.getModelName());
                    aiMetricsRedisService.recordSlotFailure(slot.getSlotIndex(), "HTTP 404 Not Found: Model Deprecated", 86400);
                } else if (status >= 500) {
                    slot.markExhausted(30_000); // 30s cooldown
                    log.warn("[GeminiRotation] Slot {} [{}:{}] returned HTTP {} (Google server overloaded).",
                            idx, slot.getMaskedKey(), slot.getModelName(), status);
                    aiMetricsRedisService.recordSlotFailure(slot.getSlotIndex(), "Google Server Overloaded (" + status + ")", 30);
                } else {
                    slot.markExhausted(3600_000);
                    log.warn("[GeminiRotation] Slot {} [{}:{}] returned HTTP {}: {}.",
                            idx, slot.getMaskedKey(), slot.getModelName(), status, ex.getResponseBodyAsString());
                    aiMetricsRedisService.recordSlotFailure(slot.getSlotIndex(), errorMsg, 3600);
                }

            } catch (Exception e) {
                log.warn("[GeminiRotation] Network or connection error on slot {} [{}:{}]: {}. Rotating to next slot.",
                        idx, slot.getMaskedKey(), slot.getModelName(), e.getMessage());
                slot.markExhausted(10_000); // 10s cooldown for transient connection issue
                aiMetricsRedisService.recordSlotFailure(slot.getSlotIndex(), "Network Error: " + e.getMessage(), 10);
            }
        }

        log.error("[GeminiRotation] All {} Gemini slot(s) in the rotation pool are currently exhausted or rate-limited.", total);
        throw new GeminiAllSlotsExhaustedException(
                "All " + total + " Gemini slots are currently rate-limited (HTTP 429) or exhausted. Please wait for cooldown.");
    }

    private void updateSlotUsageInRedis(GeminiModelSlot slot) {
        try {
            AiSlotMetricDto metric = aiMetricsRedisService.getSlotMetric(slot.getSlotIndex());
            if (metric != null) {
                metric.setRpmCurrent(slot.getRequestCount().get());
                metric.setTpmCurrent(slot.getTokenCount().get());
                metric.setExhausted(slot.getExhausted().get());
                metric.setCooldownRemainingSeconds(slot.getRemainingCooldownSeconds());
                aiMetricsRedisService.saveSlotMetric(metric);
            }
        } catch (Exception e) {
            log.debug("[GeminiRotation] Failed to sync usage to Redis for slot {}: {}", slot.getSlotIndex(), e.getMessage());
        }
    }

    /**
     * Executes the HTTP POST request to Google Gemini generateContent API for a given slot.
     */
    private String callGeminiApi(GeminiModelSlot slot, String prompt, double temperature, int maxOutputTokens) {
        String url = String.format("%s/%s:generateContent?key=%s",
                poolProperties.getBaseUrl(),
                slot.getModelName(),
                slot.getApiKey());

        Map<String, Object> requestPayload = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "temperature", temperature,
                        "maxOutputTokens", maxOutputTokens
                )
        );

        return restClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestPayload)
                .retrieve()
                .body(String.class);
    }

    /**
     * Validates whether a key string is non-empty and not a placeholder.
     */
    private boolean isValidKey(String key) {
        return key != null && !key.isBlank() && !key.equalsIgnoreCase("xxx") && !key.contains("YOUR_");
    }

    @Override
    public int getOptimalBatchTokenBudget() {
        if (slots.isEmpty()) {
            initSlots();
        }

        final int TARGET_IDEAL_BUDGET = 30_000;
        final int MIN_SAFE_BUDGET = 2_500;

        long maxAvailableSlotTokens = 0;
        for (GeminiModelSlot slot : slots) {
            if (!slot.getExhausted().get()) {
                long remaining = slot.getRemainingTpmInWindow();
                if (remaining > maxAvailableSlotTokens) {
                    maxAvailableSlotTokens = remaining;
                }
            }
        }

        if (maxAvailableSlotTokens <= 0) {
            return TARGET_IDEAL_BUDGET;
        }

        long budget = Math.min(TARGET_IDEAL_BUDGET, maxAvailableSlotTokens);
        return (int) Math.max(MIN_SAFE_BUDGET, budget);
    }

    @Override
    public int getMaxBatchCandidateCount() {
        // Capped at 25 submissions per batch to guarantee JSON feedback never exceeds Gemini's max output tokens (8192)
        return 25;
    }

    @Override
    public void advanceToNextSlot() {
        if (!slots.isEmpty()) {
            int next = (currentSlotIndex.incrementAndGet()) % slots.size();
            log.info("[GeminiRotation] Manually advanced sticky slot index to {}", next);
        }
    }
}
