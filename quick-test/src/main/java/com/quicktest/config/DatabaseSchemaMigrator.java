package com.quicktest.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures PostgreSQL check constraints created by Hibernate ddl-auto=update
 * stay synchronized when new enum values (e.g. WINDOW_BLUR, MULTI_SCREEN_DETECTED) are added.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseSchemaMigrator implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute("ALTER TABLE violation_logs DROP CONSTRAINT IF EXISTS violation_logs_violation_type_check");
            jdbcTemplate.execute("ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_camera_proctoring_enabled BOOLEAN DEFAULT FALSE");
            jdbcTemplate.execute("ALTER TABLE violation_logs ADD COLUMN IF NOT EXISTS evidence_url TEXT");
            log.info("Synchronized database schema for proctoring and camera proctoring.");

            // Create system_configs table if absent
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS system_configs (" +
                "  id UUID PRIMARY KEY, " +
                "  config_key VARCHAR(128) NOT NULL UNIQUE, " +
                "  config_value TEXT NOT NULL, " +
                "  value_type VARCHAR(32) NOT NULL DEFAULT 'STRING', " +
                "  category VARCHAR(64) NOT NULL DEFAULT 'SYSTEM_GENERAL', " +
                "  label VARCHAR(255) NOT NULL, " +
                "  description TEXT, " +
                "  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE, " +
                "  updated_by VARCHAR(100), " +
                "  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(), " +
                "  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()" +
                ")"
            );
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_system_configs_key ON system_configs(config_key)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_system_configs_category ON system_configs(category)");
            log.info("Synchronized database schema for dynamic system_configs.");
        } catch (Exception ex) {
            log.debug("Skipped schema migration check: {}", ex.getMessage());
        }
    }
}

