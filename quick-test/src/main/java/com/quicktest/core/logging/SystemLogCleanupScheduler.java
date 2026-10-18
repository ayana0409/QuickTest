package com.quicktest.core.logging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Background cron scheduler for automated periodic log retention housekeeping.
 * Executes during off-peak hours (default: 03:00 AM) using chunked batch deletion
 * to minimize JVM heap footprint and eliminate database table locking on low-resource environments.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "quicktest.logging.cleanup", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SystemLogCleanupScheduler {

    private final SystemLogService systemLogService;

    @Value("${quicktest.logging.cleanup.retention-days:30}")
    private int retentionDays;

    @Value("${quicktest.logging.cleanup.batch-size:500}")
    private int batchSize;

    /**
     * Nightly scheduled task running at 03:00 AM server time.
     * Triggers background chunked deletion through the logging thread pool.
     */
    @Scheduled(cron = "${quicktest.logging.cleanup.cron:0 0 3 * * ?}")
    public void runScheduledCleanup() {
        log.info("[SystemLogCleanupScheduler] Triggering nightly batch log cleanup (retentionDays={}, batchSize={})",
                retentionDays, batchSize);
        try {
            systemLogService.triggerBatchCleanup(retentionDays, batchSize);
        } catch (Exception ex) {
            log.error("[SystemLogCleanupScheduler] Failed to trigger scheduled log cleanup: {}", ex.getMessage(), ex);
        }
    }
}
