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
        } catch (Exception ex) {
            log.debug("Skipped schema migration check: {}", ex.getMessage());
        }
    }
}

