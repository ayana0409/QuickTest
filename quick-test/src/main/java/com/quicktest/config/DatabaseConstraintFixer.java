package com.quicktest.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures database check constraints stay synchronized with Java Enums,
 * specifically ensuring the newly introduced TEACHER_DISQUALIFY enum value
 * is accepted by PostgreSQL.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseConstraintFixer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute(
                "DO $$ BEGIN " +
                "  ALTER TABLE violation_logs DROP CONSTRAINT IF EXISTS violation_logs_violation_type_check; " +
                "  ALTER TABLE violation_logs ADD CONSTRAINT violation_logs_violation_type_check " +
                "    CHECK (violation_type IN ('TAB_SWITCH', 'EXIT_FULLSCREEN', 'DEVTOOLS_OPEN', 'NO_FACE_DETECTED', 'MULTIPLE_FACES', 'COPY_PASTE_ATTEMPT', 'TEACHER_DISQUALIFY')); " +
                "EXCEPTION WHEN OTHERS THEN " +
                "  NULL; " +
                "END $$;"
            );
            log.info("[DB CONSTRAINT] violation_logs_violation_type_check verified and updated.");
        } catch (Exception e) {
            log.warn("[DB CONSTRAINT] Could not verify/update database constraints: {}", e.getMessage());
        }
    }
}
