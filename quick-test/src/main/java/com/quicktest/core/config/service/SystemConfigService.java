package com.quicktest.core.config.service;

import com.quicktest.core.config.dto.SystemConfigDto;

import java.util.List;

/**
 * Service managing externalized system configurations with 3-tier hierarchy:
 * Redis Cache -> Database -> Environment (application.properties / ENV).
 */
public interface SystemConfigService {

    /**
     * Retrieve configuration string with 3-tier fallback.
     */
    String getValue(String key, String defaultValue);

    /**
     * Retrieve integer configuration with 3-tier fallback.
     */
    int getInteger(String key, int defaultValue);

    /**
     * Retrieve boolean configuration with 3-tier fallback.
     */
    boolean getBoolean(String key, boolean defaultValue);

    /**
     * Retrieve long configuration with 3-tier fallback.
     */
    long getLong(String key, long defaultValue);

    /**
     * Retrieve double configuration with 3-tier fallback.
     */
    double getDouble(String key, double defaultValue);

    /**
     * Fetch all registered and stored system configurations with runtime status.
     */
    List<SystemConfigDto> getAllConfigs();

    /**
     * Fetch a specific configuration by key.
     */
    SystemConfigDto getConfig(String key);

    /**
     * Update or override a configuration value in Database and update Redis cache.
     */
    SystemConfigDto updateConfig(String key, String newValue, String updatedBy);

    /**
     * Reset a configuration back to Environment default by evicting from DB and Redis.
     */
    void resetConfigToDefault(String key);

    /**
     * Flush and reload all Database configurations into Redis cache.
     */
    void refreshRedisCache();
}
