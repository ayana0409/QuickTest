package com.quicktest.core.logging;

import com.quicktest.modules.admin.dto.AdminSystemLogDetailResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogMetadataResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogStatsResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service interface for persisting centralized audit and operational logs,
 * as well as searching and managing administrative log records.
 */
public interface SystemLogService {

    /**
     * Persist system log entry asynchronously without blocking the caller thread.
     *
     * @param systemLog log entity to persist
     */
    void logAsync(SystemLog systemLog);

    /**
     * Persist system log entry synchronously.
     *
     * @param systemLog log entity to persist
     */
    void logSync(SystemLog systemLog);

    /**
     * Safely serialize an object, parameter array, or payload into a masked, size-constrained JSON string.
     *
     * @param object object to serialize
     * @return serialized JSON or fallback string
     */
    String safeSerialize(Object object);

    /**
     * Search and filter system log entries with 2-step pagination and PostgreSQL Full-Text Search.
     */
    Page<AdminSystemLogResponse> searchLogs(
            String level,
            String status,
            String module,
            String action,
            UUID actorId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Pageable pageable);

    /**
     * Fetch complete audit log details including serialized payload and stack trace.
     */
    AdminSystemLogDetailResponse getLogDetail(UUID id);

    /**
     * Retrieve analytical metrics across log severities, statuses, and modules.
     */
    AdminSystemLogStatsResponse getLogStats();

    /**
     * Fetch distinct log modules and actions for dynamic filter controls.
     */
    AdminSystemLogMetadataResponse getLogMetadata();

    /**
     * Delete log records older than a specified number of days.
     */
    long cleanupOldLogs(int daysToKeep);
}

