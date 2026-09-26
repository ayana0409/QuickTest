package com.quicktest.modules.admin.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.logging.SystemLogService;
import com.quicktest.modules.admin.dto.AdminSystemLogDetailResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogMetadataResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogStatsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller providing administrative system log management, Full-Text
 * Search,
 * analytics metrics, and retention housekeeping endpoints.
 * Requires ROLE_ADMIN authority.
 */
@RestController
@RequestMapping({ "/api/admin/logs", "/api/v1/admin/logs" })
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminSystemLogController {

    private final SystemLogService systemLogService;

    /**
     * Search and list system logs using PostgreSQL Full-Text Search and
     * multi-criteria filters
     * with high-performance 2-step pagination.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminSystemLogResponse>>> searchLogs(
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20) Pageable pageable) {

        LocalDateTime start = parseDateTime(startDate);
        LocalDateTime end = parseDateTime(endDate);

        Page<AdminSystemLogResponse> logs = systemLogService.searchLogs(
                level, status, module, action, actorId, start, end, search, pageable);
        return ResponseEntity.ok(ApiResponse.success(PageResponse.from(logs), "System logs retrieved successfully"));
    }

    private LocalDateTime parseDateTime(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            if (text.endsWith("Z")) {
                return LocalDateTime.ofInstant(Instant.parse(text), ZoneId.systemDefault());
            }
            if (text.length() == 16) {
                return LocalDateTime.parse(text + ":00");
            }
            return LocalDateTime.parse(text);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Retrieve analytical metrics across log severities, statuses, and modules for
     * dashboard cards.
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminSystemLogStatsResponse>> getStats() {
        AdminSystemLogStatsResponse stats = systemLogService.getLogStats();
        return ResponseEntity.ok(ApiResponse.success(stats, "System log stats retrieved successfully"));
    }

    /**
     * Fetch distinct log modules and actions for dynamic filter dropdowns.
     */
    @GetMapping("/metadata")
    public ResponseEntity<ApiResponse<AdminSystemLogMetadataResponse>> getMetadata() {
        AdminSystemLogMetadataResponse metadata = systemLogService.getLogMetadata();
        return ResponseEntity.ok(ApiResponse.success(metadata, "System log metadata retrieved successfully"));
    }

    /**
     * Fetch complete audit log details including serialized payload and stack trace
     * by log ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AdminSystemLogDetailResponse>> getLogDetail(@PathVariable("id") UUID id) {
        AdminSystemLogDetailResponse detail = systemLogService.getLogDetail(id);
        return ResponseEntity.ok(ApiResponse.success(detail, "System log detail retrieved successfully"));
    }

    /**
     * Housekeeping endpoint to delete logs older than the specified retention
     * window in days.
     */
    @DeleteMapping("/cleanup")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cleanupOldLogs(
            @RequestParam(defaultValue = "30") int days) {
        long deletedCount = systemLogService.cleanupOldLogs(days);
        return ResponseEntity.ok(ApiResponse.success(
                Map.of(
                        "deletedCount", deletedCount,
                        "retentionDaysKept", Math.max(days, 1)),
                "Log cleanup executed successfully"));
    }
}
