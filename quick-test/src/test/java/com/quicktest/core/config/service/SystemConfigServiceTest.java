package com.quicktest.core.config.service;

import com.quicktest.core.config.dto.SystemConfigDto;
import com.quicktest.core.config.dto.SystemConfigSource;
import com.quicktest.core.config.entity.SystemConfig;
import com.quicktest.core.config.entity.SystemConfigCategory;
import com.quicktest.core.config.entity.SystemConfigValueType;
import com.quicktest.core.config.repository.SystemConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SystemConfigServiceTest {

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private SystemConfigRepository systemConfigRepository;

    @Mock
    private Environment environment;

    private SystemConfigServiceImpl systemConfigService;

    @BeforeEach
    void setUp() {
        lenient().when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        systemConfigService = new SystemConfigServiceImpl(stringRedisTemplate, systemConfigRepository, environment);
    }

    @Test
    @DisplayName("Level 1: Should return cached value from Redis when present")
    void shouldReturnCachedValueFromRedis() {
        when(valueOperations.get("sys:cfg:app.rate-limit.global.limit")).thenReturn("250");

        int limit = systemConfigService.getInteger("app.rate-limit.global.limit", 120);

        assertThat(limit).isEqualTo(250);
        verify(valueOperations).get("sys:cfg:app.rate-limit.global.limit");
        verifyNoInteractions(systemConfigRepository);
    }

    @Test
    @DisplayName("Level 2: Should read from Database and push to Redis on Redis cache miss")
    void shouldReadFromDatabaseAndPopulateRedisOnCacheMiss() {
        when(valueOperations.get("sys:cfg:gemini.batch-size")).thenReturn(null);

        SystemConfig dbEntity = SystemConfig.builder()
                .id(UUID.randomUUID())
                .configKey("gemini.batch-size")
                .configValue("10")
                .valueType(SystemConfigValueType.INTEGER)
                .category(SystemConfigCategory.GEMINI_AI)
                .label("Batch Size")
                .build();
        when(systemConfigRepository.findByConfigKey("gemini.batch-size")).thenReturn(Optional.of(dbEntity));

        int batchSize = systemConfigService.getInteger("gemini.batch-size", 5);

        assertThat(batchSize).isEqualTo(10);
        verify(valueOperations).set(eq("sys:cfg:gemini.batch-size"), eq("10"), any(Duration.class));
    }

    @Test
    @DisplayName("Level 3: Should fallback to Environment property when not found in DB")
    void shouldFallbackToEnvironmentWhenNotInDatabase() {
        when(valueOperations.get("sys:cfg:app.rate-limit.global.limit")).thenReturn(null);
        when(systemConfigRepository.findByConfigKey("app.rate-limit.global.limit")).thenReturn(Optional.empty());
        when(environment.getProperty("app.rate-limit.global.limit")).thenReturn("180");

        int limit = systemConfigService.getInteger("app.rate-limit.global.limit", 120);

        assertThat(limit).isEqualTo(180);
    }

    @Test
    @DisplayName("Level 3 Default: Should fallback to defaultValue when environment property is null")
    void shouldFallbackToDefaultWhenEnvNull() {
        when(valueOperations.get("sys:cfg:custom.key")).thenReturn(null);
        when(systemConfigRepository.findByConfigKey("custom.key")).thenReturn(Optional.empty());
        when(environment.getProperty("custom.key")).thenReturn(null);

        String val = systemConfigService.getValue("custom.key", "fallback-default");

        assertThat(val).isEqualTo("fallback-default");
    }

    @Test
    @DisplayName("Update: Should persist to DB and push to Redis immediately")
    void shouldUpdateDatabaseAndRedis() {
        when(systemConfigRepository.findByConfigKey("gemini.batch-size")).thenReturn(Optional.empty());
        when(systemConfigRepository.save(any(SystemConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        SystemConfigDto result = systemConfigService.updateConfig("gemini.batch-size", "15", "admin");

        assertThat(result.getValue()).isEqualTo("15");
        assertThat(result.getSource()).isEqualTo(SystemConfigSource.DATABASE);
        verify(systemConfigRepository).save(any(SystemConfig.class));
        verify(valueOperations).set(eq("sys:cfg:gemini.batch-size"), eq("15"), any(Duration.class));
    }

    @Test
    @DisplayName("Reset: Should delete from DB and evict from Redis")
    void shouldResetConfigToDefault() {
        systemConfigService.resetConfigToDefault("gemini.batch-size");

        verify(systemConfigRepository).deleteByConfigKey("gemini.batch-size");
        verify(stringRedisTemplate).delete("sys:cfg:gemini.batch-size");
    }
}
