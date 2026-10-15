package com.quicktest.core.service;

import com.quicktest.config.GeminiPoolProperties;
import com.quicktest.config.GeminiProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.admin.entity.AiApiKey;
import com.quicktest.modules.admin.entity.AiModelConfigEntity;
import com.quicktest.modules.admin.repository.AiApiKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GeminiRotationServiceTest {

    private AiApiKeyRepository aiApiKeyRepository;
    private AiMetricsRedisService aiMetricsRedisService;

    @BeforeEach
    void setUp() {
        aiApiKeyRepository = mock(AiApiKeyRepository.class);
        aiMetricsRedisService = mock(AiMetricsRedisService.class);
    }

    @Test
    @DisplayName("GeminiModelSlot: Should allow requests up to RPM limit then throttle")
    void testSlot_RpmThrottle() {
        GeminiModelSlot slot = new GeminiModelSlot("MOCK_GEMINI_KEY_12345", "gemini-2.0-flash-lite", 3, 100000);

        assertTrue(slot.tryAcquire(100));
        assertEquals(1, slot.getRequestCount().get());

        assertTrue(slot.tryAcquire(100));
        assertEquals(2, slot.getRequestCount().get());

        assertTrue(slot.tryAcquire(100));
        assertEquals(3, slot.getRequestCount().get());

        // 4th request exceeds RPM limit of 3
        assertFalse(slot.tryAcquire(100));
        assertTrue(slot.getExhausted().get());
    }

    @Test
    @DisplayName("GeminiModelSlot: Should mask API key safely")
    void testSlot_MaskKey() {
        GeminiModelSlot slot = new GeminiModelSlot("MOCK_SECRET_KEY_FOR_TESTING_PURPOSES_XYZ123", "gemini-2.0-flash", 15, 1000000);
        String masked = slot.getMaskedKey();

        assertTrue(masked.startsWith("MOCK"));
        assertTrue(masked.endsWith("Z123"));
        assertTrue(masked.contains("..."));
        assertFalse(masked.contains("SECRET_KEY_FOR_TESTING_PURPOSES"));
    }

    @Test
    @DisplayName("GeminiModelSlot: Cooldown expiration should allow acquisition again")
    void testSlot_CooldownExpiration() {
        GeminiModelSlot slot = new GeminiModelSlot("MOCK_GEMINI_KEY_12345", "gemini-2.0-flash-lite", 15, 100000);

        slot.markExhausted(50); // 50ms cooldown
        assertTrue(slot.getExhausted().get());
        assertFalse(slot.tryAcquire(100));

        // Wait for cooldown to expire
        try {
            Thread.sleep(60);
        } catch (InterruptedException ignored) {}

        // Should now acquire successfully
        assertTrue(slot.tryAcquire(100));
        assertFalse(slot.getExhausted().get());
    }

    @Test
    @DisplayName("GeminiRotationService: Should initialize slots from Database when available")
    void testRotationService_InitSlots() {
        GeminiPoolProperties poolProps = new GeminiPoolProperties();
        GeminiProperties legacyProps = new GeminiProperties();

        AiApiKey key1 = AiApiKey.builder()
                .id(UUID.randomUUID())
                .name("Database Key 1")
                .apiKey("KEY_1_VALID_TEST_1234")
                .isActive(true)
                .build();
        key1.addModel(AiModelConfigEntity.builder().modelName("gemini-3.5-flash-lite").rpm(15).tpm(250000).isActive(true).build());
        key1.addModel(AiModelConfigEntity.builder().modelName("gemini-3.1-flash-lite").rpm(15).tpm(1000000).isActive(true).build());

        when(aiApiKeyRepository.findAllActiveWithModels()).thenReturn(List.of(key1));

        GeminiRotationServiceImpl service = new GeminiRotationServiceImpl(poolProps, legacyProps, aiApiKeyRepository, aiMetricsRedisService);
        service.initSlots();

        assertEquals(2, service.getTotalSlotCount());
        assertTrue(service.hasAvailableSlots());
        assertEquals("DATABASE", service.getConfigSource());
        assertEquals("gemini-3.5-flash-lite", service.getSlots().get(0).getModelName());
        assertEquals("gemini-3.1-flash-lite", service.getSlots().get(1).getModelName());
    }

    @Test
    @DisplayName("GeminiRotationService: Should fallback to legacy properties if database is empty")
    void testRotationService_FallbackToLegacy() {
        GeminiPoolProperties poolProps = new GeminiPoolProperties();
        when(aiApiKeyRepository.findAllActiveWithModels()).thenReturn(List.of()); // Empty DB

        GeminiProperties legacyProps = new GeminiProperties();
        legacyProps.setApiKey("LEGACY_KEY_VALID_9999");
        legacyProps.setModel("gemini-2.5-flash-lite");

        GeminiRotationServiceImpl service = new GeminiRotationServiceImpl(poolProps, legacyProps, aiApiKeyRepository, aiMetricsRedisService);
        service.initSlots();

        assertEquals(1, service.getTotalSlotCount());
        assertTrue(service.hasAvailableSlots());
        assertEquals("ENV_FALLBACK", service.getConfigSource());
        assertEquals("gemini-2.5-flash-lite", service.getSlots().get(0).getModelName());
    }

    @Test
    @DisplayName("GeminiRotationService: Should throw AppException if no valid keys exist anywhere")
    void testRotationService_NoKeysThrowsException() {
        GeminiPoolProperties poolProps = new GeminiPoolProperties();
        when(aiApiKeyRepository.findAllActiveWithModels()).thenReturn(List.of());

        GeminiProperties legacyProps = new GeminiProperties();
        legacyProps.setApiKey("");

        GeminiRotationServiceImpl service = new GeminiRotationServiceImpl(poolProps, legacyProps, aiApiKeyRepository, aiMetricsRedisService);
        service.initSlots();

        assertFalse(service.hasAvailableSlots());
        assertThrows(AppException.class, () ->
                service.executeWithRotation("Test prompt", 0.2, 1000));
    }

    @Test
    @DisplayName("GeminiModelSlot: Should calculate remaining TPM and verify capacity accurately")
    void testSlot_RemainingTpmAndCapacity() {
        GeminiModelSlot slot = new GeminiModelSlot("MOCK_GEMINI_KEY_12345", "gemini-2.0-flash-lite", 15, 100000);

        assertEquals(100000, slot.getRemainingTpmInWindow());
        assertTrue(slot.hasCapacity(5000));
        assertTrue(slot.hasCapacity(100000));
        assertFalse(slot.hasCapacity(100001));

        // Consume 98,000 tokens
        slot.recordUsage(98000);
        assertEquals(2000, slot.getRemainingTpmInWindow());
        assertFalse(slot.hasCapacity(5000));
        assertTrue(slot.hasCapacity(2000));
    }

    @Test
    @DisplayName("GeminiRotationService: Should compute optimal batch token budget and max candidate count")
    void testRotationService_DynamicBatchBudgets() {
        GeminiPoolProperties poolProps = new GeminiPoolProperties();
        GeminiProperties legacyProps = new GeminiProperties();
        legacyProps.setApiKey("LEGACY_KEY_VALID_9999");
        legacyProps.setModel("gemini-2.5-flash-lite");

        when(aiApiKeyRepository.findAllActiveWithModels()).thenReturn(List.of());

        GeminiRotationServiceImpl service = new GeminiRotationServiceImpl(poolProps, legacyProps, aiApiKeyRepository, aiMetricsRedisService);
        service.initSlots();

        assertEquals(25, service.getMaxBatchCandidateCount());
        // Fresh slot with 1,000,000 TPM -> capped at DEFAULT_TARGET_BATCH_BUDGET (30,000)
        assertEquals(30000, service.getOptimalBatchTokenBudget());

        // Simulate slot consuming tokens so remaining < 30,000
        GeminiModelSlot activeSlot = service.getSlots().get(0);
        activeSlot.recordUsage(990000); // 1,000,000 - 990,000 = 10,000 left
        assertEquals(10000, service.getOptimalBatchTokenBudget());

        // When nearly exhausted (< 2,500 left)
        activeSlot.recordUsage(9000); // remaining = 1,000
        // Floors to MIN_BATCH_BUDGET (2,500) to allow single small essay attempt
        assertEquals(2500, service.getOptimalBatchTokenBudget());
    }
}
