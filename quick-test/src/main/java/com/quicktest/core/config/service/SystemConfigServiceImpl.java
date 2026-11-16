package com.quicktest.core.config.service;

import com.quicktest.core.config.dto.SystemConfigDto;
import com.quicktest.core.config.dto.SystemConfigSource;
import com.quicktest.core.config.entity.SystemConfig;
import com.quicktest.core.config.entity.SystemConfigCategory;
import com.quicktest.core.config.entity.SystemConfigValueType;
import com.quicktest.core.config.repository.SystemConfigRepository;
import com.quicktest.core.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementation of SystemConfigService providing 3-tier hierarchical resolution:
 * Redis Cache -> PostgreSQL Database -> Spring Environment.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemConfigServiceImpl implements SystemConfigService {

    private final StringRedisTemplate stringRedisTemplate;
    private final SystemConfigRepository systemConfigRepository;
    private final Environment environment;

    private static final String REDIS_KEY_PREFIX = "sys:cfg:";
    private static final Duration CACHE_TTL = Duration.ofHours(24);

    /**
     * Definition record for predefined system configs registered in application.properties.
     */
    public record ConfigMetadata(
            String key,
            String fallbackDefault,
            SystemConfigValueType valueType,
            SystemConfigCategory category,
            String label,
            String description
    ) {}

    private static final Map<String, ConfigMetadata> KNOWN_CONFIGS = new LinkedHashMap<>();

    static {
        registerConfig("app.rate-limit.enabled", "false",
                SystemConfigValueType.BOOLEAN, SystemConfigCategory.RATE_LIMIT,
                "Giới hạn lượt gửi yêu cầu",
                "Bảo vệ hệ thống khỏi tình trạng quá tải hoặc spam yêu cầu dồn dập.");

        registerConfig("app.rate-limit.global.enabled", "true",
                SystemConfigValueType.BOOLEAN, SystemConfigCategory.RATE_LIMIT,
                "Áp dụng giới hạn chung",
                "Tự động áp dụng giới hạn chung cho người dùng khi truy cập trang web.");

        registerConfig("app.rate-limit.global.limit", "120",
                SystemConfigValueType.INTEGER, SystemConfigCategory.RATE_LIMIT,
                "Số yêu cầu tối đa mỗi phút",
                "Số lượt yêu cầu tối đa một người dùng có thể gửi trong 1 phút (mặc định 120 lượt).");

        registerConfig("app.rate-limit.global.period-seconds", "60",
                SystemConfigValueType.INTEGER, SystemConfigCategory.RATE_LIMIT,
                "Chu kỳ làm mới lượt (giây)",
                "Thời gian chờ (giây) để làm mới lại số lượt yêu cầu được phép gửi.");

        registerConfig("gemini.batch-size", "5",
                SystemConfigValueType.INTEGER, SystemConfigCategory.GEMINI_AI,
                "Số bài AI chấm cùng lúc",
                "Gom nhóm các bài thi tự luận để AI chấm điểm trong một lượt, giúp xử lý nhanh và tiết kiệm.");

        registerConfig("gemini.moderation-batch-size", "30",
                SystemConfigValueType.INTEGER, SystemConfigCategory.GEMINI_AI,
                "Số câu hỏi duyệt cùng lúc",
                "Số lượng câu hỏi được AI kiểm tra nội dung an toàn trong mỗi đợt quét tự động.");

        registerConfig("gemini.timeout-seconds", "60",
                SystemConfigValueType.INTEGER, SystemConfigCategory.GEMINI_AI,
                "Thời gian chờ phản hồi AI (giây)",
                "Số giây tối đa hệ thống chờ AI trả lời trước khi thử lại.");
    }

    private static void registerConfig(String key, String fallbackDefault, SystemConfigValueType valueType,
                                       SystemConfigCategory category, String label, String description) {
        KNOWN_CONFIGS.put(key, new ConfigMetadata(key, fallbackDefault, valueType, category, label, description));
    }

    @Override
    public String getValue(String key, String defaultValue) {
        String redisKey = REDIS_KEY_PREFIX + key;

        // 1. Level 1: Redis Cache
        try {
            String cached = stringRedisTemplate.opsForValue().get(redisKey);
            if (cached != null) {
                return cached;
            }
        } catch (Exception e) {
            log.warn("[SystemConfig] Failed to read from Redis cache for key '{}': {}", key, e.getMessage());
        }

        // 2. Level 2: Database
        try {
            Optional<SystemConfig> dbRecord = systemConfigRepository.findByConfigKey(key);
            if (dbRecord.isPresent()) {
                String dbVal = dbRecord.get().getConfigValue();
                // Push to Redis Cache
                populateRedisCache(redisKey, dbVal);
                return dbVal;
            }
        } catch (Exception e) {
            log.warn("[SystemConfig] Failed to query Database for key '{}': {}", key, e.getMessage());
        }

        // 3. Level 3: Environment / application.properties / Default
        String envVal = environment.getProperty(key);
        if (envVal != null && !envVal.isBlank()) {
            return envVal;
        }

        return defaultValue;
    }

    @Override
    public int getInteger(String key, int defaultValue) {
        String val = getValue(key, String.valueOf(defaultValue));
        try {
            return Integer.parseInt(val.trim());
        } catch (Exception e) {
            log.warn("[SystemConfig] Invalid integer format for key '{}': '{}'. Falling back to default: {}", key, val, defaultValue);
            return defaultValue;
        }
    }

    @Override
    public boolean getBoolean(String key, boolean defaultValue) {
        String val = getValue(key, String.valueOf(defaultValue));
        if (val == null) {
            return defaultValue;
        }
        return "true".equalsIgnoreCase(val.trim()) || "1".equals(val.trim());
    }

    @Override
    public long getLong(String key, long defaultValue) {
        String val = getValue(key, String.valueOf(defaultValue));
        try {
            return Long.parseLong(val.trim());
        } catch (Exception e) {
            log.warn("[SystemConfig] Invalid long format for key '{}': '{}'. Falling back to default: {}", key, val, defaultValue);
            return defaultValue;
        }
    }

    @Override
    public double getDouble(String key, double defaultValue) {
        String val = getValue(key, String.valueOf(defaultValue));
        try {
            return Double.parseDouble(val.trim());
        } catch (Exception e) {
            log.warn("[SystemConfig] Invalid double format for key '{}': '{}'. Falling back to default: {}", key, val, defaultValue);
            return defaultValue;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<SystemConfigDto> getAllConfigs() {
        // Fetch all existing entries from Database
        List<SystemConfig> dbConfigs = systemConfigRepository.findAll();
        Map<String, SystemConfig> dbMap = new HashMap<>();
        for (SystemConfig cfg : dbConfigs) {
            dbMap.put(cfg.getConfigKey(), cfg);
        }

        List<SystemConfigDto> result = new ArrayList<>();
        Set<String> processedKeys = new HashSet<>();

        // 1. Add known predefined configs
        for (ConfigMetadata meta : KNOWN_CONFIGS.values()) {
            String key = meta.key();
            processedKeys.add(key);

            String envDefault = environment.getProperty(key, meta.fallbackDefault());
            SystemConfig dbEntity = dbMap.get(key);

            if (dbEntity != null) {
                result.add(SystemConfigDto.builder()
                        .key(key)
                        .value(dbEntity.getConfigValue())
                        .defaultValue(envDefault)
                        .valueType(dbEntity.getValueType())
                        .category(dbEntity.getCategory())
                        .label(dbEntity.getLabel())
                        .description(dbEntity.getDescription())
                        .source(SystemConfigSource.DATABASE)
                        .updatedAt(dbEntity.getUpdatedAt())
                        .updatedBy(dbEntity.getUpdatedBy())
                        .build());
            } else {
                result.add(SystemConfigDto.builder()
                        .key(key)
                        .value(envDefault)
                        .defaultValue(envDefault)
                        .valueType(meta.valueType())
                        .category(meta.category())
                        .label(meta.label())
                        .description(meta.description())
                        .source(SystemConfigSource.ENVIRONMENT)
                        .updatedAt(null)
                        .updatedBy(null)
                        .build());
            }
        }

        // 2. Add any additional dynamic configs present in Database but not in KNOWN_CONFIGS
        for (SystemConfig cfg : dbConfigs) {
            if (!processedKeys.contains(cfg.getConfigKey())) {
                String envDefault = environment.getProperty(cfg.getConfigKey(), "");
                result.add(SystemConfigDto.builder()
                        .key(cfg.getConfigKey())
                        .value(cfg.getConfigValue())
                        .defaultValue(envDefault)
                        .valueType(cfg.getValueType())
                        .category(cfg.getCategory())
                        .label(cfg.getLabel())
                        .description(cfg.getDescription())
                        .source(SystemConfigSource.DATABASE)
                        .updatedAt(cfg.getUpdatedAt())
                        .updatedBy(cfg.getUpdatedBy())
                        .build());
            }
        }

        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public SystemConfigDto getConfig(String key) {
        ConfigMetadata meta = KNOWN_CONFIGS.get(key);
        String envDefault = meta != null
                ? environment.getProperty(key, meta.fallbackDefault())
                : environment.getProperty(key, "");

        Optional<SystemConfig> dbEntity = systemConfigRepository.findByConfigKey(key);
        if (dbEntity.isPresent()) {
            SystemConfig cfg = dbEntity.get();
            return SystemConfigDto.builder()
                    .key(cfg.getConfigKey())
                    .value(cfg.getConfigValue())
                    .defaultValue(envDefault)
                    .valueType(cfg.getValueType())
                    .category(cfg.getCategory())
                    .label(cfg.getLabel())
                    .description(cfg.getDescription())
                    .source(SystemConfigSource.DATABASE)
                    .updatedAt(cfg.getUpdatedAt())
                    .updatedBy(cfg.getUpdatedBy())
                    .build();
        }

        if (meta != null) {
            return SystemConfigDto.builder()
                    .key(meta.key())
                    .value(envDefault)
                    .defaultValue(envDefault)
                    .valueType(meta.valueType())
                    .category(meta.category())
                    .label(meta.label())
                    .description(meta.description())
                    .source(SystemConfigSource.ENVIRONMENT)
                    .updatedAt(null)
                    .updatedBy(null)
                    .build();
        }

        throw new ResourceNotFoundException("Configuration key '" + key + "' not found.");
    }

    @Override
    @Transactional
    public SystemConfigDto updateConfig(String key, String newValue, String updatedBy) {
        String cleanValue = newValue != null ? newValue.trim() : "";
        ConfigMetadata meta = KNOWN_CONFIGS.get(key);
        String envDefault = meta != null
                ? environment.getProperty(key, meta.fallbackDefault())
                : environment.getProperty(key, "");

        SystemConfig entity = systemConfigRepository.findByConfigKey(key)
                .orElseGet(() -> {
                    SystemConfig newEntity = new SystemConfig();
                    newEntity.setConfigKey(key);
                    if (meta != null) {
                        newEntity.setValueType(meta.valueType());
                        newEntity.setCategory(meta.category());
                        newEntity.setLabel(meta.label());
                        newEntity.setDescription(meta.description());
                    } else {
                        newEntity.setValueType(SystemConfigValueType.STRING);
                        newEntity.setCategory(SystemConfigCategory.SYSTEM_GENERAL);
                        newEntity.setLabel(key);
                        newEntity.setDescription("Dynamic system configuration parameter");
                    }
                    return newEntity;
                });

        entity.setConfigValue(cleanValue);
        entity.setUpdatedBy(updatedBy != null ? updatedBy : "ADMIN");
        SystemConfig saved = systemConfigRepository.save(entity);

        // Update Redis Cache immediately
        String redisKey = REDIS_KEY_PREFIX + key;
        populateRedisCache(redisKey, cleanValue);

        log.info("[SystemConfig] Updated key '{}' to '{}' by user '{}'", key, cleanValue, updatedBy);

        return SystemConfigDto.builder()
                .key(saved.getConfigKey())
                .value(saved.getConfigValue())
                .defaultValue(envDefault)
                .valueType(saved.getValueType())
                .category(saved.getCategory())
                .label(saved.getLabel())
                .description(saved.getDescription())
                .source(SystemConfigSource.DATABASE)
                .updatedAt(saved.getUpdatedAt())
                .updatedBy(saved.getUpdatedBy())
                .build();
    }

    @Override
    @Transactional
    public void resetConfigToDefault(String key) {
        systemConfigRepository.deleteByConfigKey(key);

        // Evict from Redis Cache so next read falls back to environment
        String redisKey = REDIS_KEY_PREFIX + key;
        try {
            stringRedisTemplate.delete(redisKey);
        } catch (Exception e) {
            log.warn("[SystemConfig] Failed to evict Redis cache for key '{}': {}", key, e.getMessage());
        }

        log.info("[SystemConfig] Reset key '{}' to Environment default", key);
    }

    @Override
    public void refreshRedisCache() {
        log.info("[SystemConfig] Refreshing Redis system configuration cache...");
        try {
            // Find all sys:cfg:* keys and delete
            Set<String> keys = stringRedisTemplate.keys(REDIS_KEY_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                stringRedisTemplate.delete(keys);
            }

            // Populate all Database entries into Redis
            List<SystemConfig> all = systemConfigRepository.findAll();
            for (SystemConfig cfg : all) {
                populateRedisCache(REDIS_KEY_PREFIX + cfg.getConfigKey(), cfg.getConfigValue());
            }
            log.info("[SystemConfig] Successfully synchronized {} configurations into Redis cache.", all.size());
        } catch (Exception e) {
            log.error("[SystemConfig] Failed to refresh Redis cache: {}", e.getMessage(), e);
        }
    }

    private void populateRedisCache(String redisKey, String value) {
        try {
            stringRedisTemplate.opsForValue().set(redisKey, value, CACHE_TTL);
        } catch (Exception e) {
            log.warn("[SystemConfig] Failed to write key '{}' to Redis: {}", redisKey, e.getMessage());
        }
    }
}
