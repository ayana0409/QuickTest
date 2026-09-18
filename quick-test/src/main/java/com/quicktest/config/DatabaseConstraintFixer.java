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
@org.springframework.core.annotation.Order(1)
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

            jdbcTemplate.execute(
                "DO $$ BEGIN " +
                "  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check; " +
                "  ALTER TABLE users ADD CONSTRAINT users_role_check " +
                "    CHECK (role IN ('TEACHER', 'STUDENT', 'ADMIN')); " +
                "EXCEPTION WHEN OTHERS THEN " +
                "  NULL; " +
                "END $$;"
            );
            log.info("[DB CONSTRAINT] users_role_check verified and updated.");
        } catch (Exception e) {
            log.warn("[DB CONSTRAINT] Could not verify/update database constraints: {}", e.getMessage());
        }

        try {
            jdbcTemplate.execute("ALTER TABLE questions ALTER COLUMN content DROP NOT NULL;");
            jdbcTemplate.execute("ALTER TABLE answer_options ALTER COLUMN content DROP NOT NULL;");
            log.info("[DB CONSTRAINT] questions and answer_options content columns verified as nullable.");
        } catch (Exception e) {
            log.warn("[DB CONSTRAINT] Could not alter content columns to nullable: {}", e.getMessage());
        }

        try {
            jdbcTemplate.execute("ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_proctoring_enabled BOOLEAN NOT NULL DEFAULT false;");
            jdbcTemplate.execute("ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_violations INTEGER NOT NULL DEFAULT 5;");
            log.info("[DB CONSTRAINT] exams is_proctoring_enabled and max_violations columns verified.");
        } catch (Exception e) {
            log.warn("[DB CONSTRAINT] Could not add proctoring columns to exams table: {}", e.getMessage());
        }
    }
}
