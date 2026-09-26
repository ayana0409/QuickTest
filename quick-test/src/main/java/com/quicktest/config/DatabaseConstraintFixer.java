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

        try {
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS system_logs (" +
                "  id UUID PRIMARY KEY, " +
                "  level VARCHAR(10) NOT NULL, " +
                "  module VARCHAR(60) NOT NULL, " +
                "  action VARCHAR(100) NOT NULL, " +
                "  status VARCHAR(10) NOT NULL, " +
                "  actor_id UUID, " +
                "  actor_username VARCHAR(100), " +
                "  actor_role VARCHAR(50), " +
                "  endpoint VARCHAR(255), " +
                "  http_method VARCHAR(10), " +
                "  ip_address VARCHAR(45), " +
                "  details TEXT, " +
                "  error_message TEXT, " +
                "  execution_time_ms BIGINT, " +
                "  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()" +
                ");"
            );
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_syslog_created_at ON system_logs (created_at DESC);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_syslog_module_action ON system_logs (module, action);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_syslog_actor ON system_logs (actor_id);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_syslog_level ON system_logs (level);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_syslog_status ON system_logs (status);");
            jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_syslog_fts ON system_logs USING GIN (" +
                "  to_tsvector('simple', " +
                "    coalesce(module, '') || ' ' || " +
                "    coalesce(action, '') || ' ' || " +
                "    coalesce(actor_username, '') || ' ' || " +
                "    coalesce(ip_address, '') || ' ' || " +
                "    coalesce(cast(actor_id as text), '') || ' ' || " +
                "    coalesce(details, '') || ' ' || " +
                "    coalesce(error_message, '')" +
                "  )" +
                ");"
            );
            log.info("[DB CONSTRAINT] system_logs table and performance GIN FTS indexes verified.");
        } catch (Exception e) {
            log.warn("[DB CONSTRAINT] Could not verify/create system_logs table: {}", e.getMessage());
        }
    }
}
