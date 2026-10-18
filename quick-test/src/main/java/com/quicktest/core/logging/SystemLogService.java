package com.quicktest.core.logging;

import com.quicktest.modules.admin.dto.AdminSystemLogDetailResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogMetadataResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogStatsResponse;
import com.quicktest.modules.admin.dto.SystemLogCleanupStatusResponse;

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
     * Safely serialize an object, parameter array, or payload into a masked,
     * size-constrained JSON string.
     *
     * @param object object to serialize
     * @return serialized JSON or fallback string
     */
    String safeSerialize(Object object);

    /**
     * Search and filter system log entries with 2-step pagination and PostgreSQL
     * Full-Text Search.
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
     * Fetch complete audit log details including serialized payload and stack
     * trace.
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
     * Delete log records older than a specified number of days (synchronous
     * fallback).
     */
    long cleanupOldLogs(int daysToKeep);

    /**
     * Trigger asynchronous batch deletion of old logs running in background to
     * minimize JVM heap memory
     * and avoid long database locks on low-resource environments (e.g., Core i3 /
     * 512MB RAM).
     *
     * @param daysToKeep retention window in days (logs older than this will be
     *                   deleted)
     * @param batchSize  number of records deleted per transaction chunk (default:
     *                   500)
     * @return current execution status response
     */
    SystemLogCleanupStatusResponse triggerBatchCleanup(int daysToKeep, int batchSize);

    /**
     * Retrieve current background cleanup task progress and state.
     *
     * @return current cleanup status
     */
    SystemLogCleanupStatusResponse getCleanupStatus();
}
