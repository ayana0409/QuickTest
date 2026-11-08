package com.quicktest.modules.admin.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.modules.admin.dto.*;
import com.quicktest.modules.admin.service.AdminProctoringMediaService;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller for administrative proctoring media management,
 * analytics overview, and background batch housekeeping.
 */
@RestController
@RequestMapping({"/api/admin/proctoring-media", "/api/v1/admin/proctoring-media"})
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminProctoringMediaController {

    private final AdminProctoringMediaService adminProctoringMediaService;

    /**
     * Search and list proctoring evidence images with pagination.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminProctoringMediaResponse>>> searchMedia(
            @RequestParam(required = false) String violationType,
            @RequestParam(required = false) UUID examId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 24) Pageable pageable) {

        LocalDateTime start = parseDateTime(startDate);
        LocalDateTime end = parseDateTime(endDate);

        Page<AdminProctoringMediaResponse> page = adminProctoringMediaService.searchMedia(
                violationType, examId, start, end, search, pageable);

        return ResponseEntity.ok(ApiResponse.success(PageResponse.from(page), "Proctoring media retrieved successfully"));
    }

    /**
     * Retrieve analytical overview metrics for KPI cards.
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminProctoringMediaStatsResponse>> getStats() {
        AdminProctoringMediaStatsResponse stats = adminProctoringMediaService.getStats();
        return ResponseEntity.ok(ApiResponse.success(stats, "Proctoring media stats retrieved successfully"));
    }

    /**
     * Estimate the number of images that will be cleaned up based on specified criteria.
     */
    @GetMapping("/cleanup/preview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCleanupPreview(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(required = false) String violationType,
            @RequestParam(required = false) UUID examId,
            @RequestParam(defaultValue = "true") boolean onlyFinishedExams) {

        long count = adminProctoringMediaService.countCleanupPreview(days, violationType, examId, onlyFinishedExams);
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("matchingCount", count, "days", days),
                "Cleanup preview count calculated"));
    }

    /**
     * Trigger asynchronous background batch deletion of evidence images matching retention criteria.
     */
    @PostMapping("/cleanup")
    public ResponseEntity<ApiResponse<ProctoringMediaCleanupStatusResponse>> triggerBatchCleanup(
            @RequestBody(required = false) ProctoringMediaCleanupRequest request) {

        ProctoringMediaCleanupStatusResponse status = adminProctoringMediaService.triggerBatchCleanup(request);
        return ResponseEntity.ok(ApiResponse.success(status, "Proctoring media cleanup initiated in background"));
    }

    /**
     * Retrieve current background batch cleanup progress and metrics.
     */
    @GetMapping("/cleanup/status")
    public ResponseEntity<ApiResponse<ProctoringMediaCleanupStatusResponse>> getCleanupStatus() {
        ProctoringMediaCleanupStatusResponse status = adminProctoringMediaService.getCleanupStatus();
        return ResponseEntity.ok(ApiResponse.success(status, "Cleanup status retrieved successfully"));
    }

    /**
     * Delete selected evidence images by IDs in a single query update and batch Cloudinary call.
     */
    @DeleteMapping("/batch")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteSelectedMedia(
            @RequestBody AdminBatchDeleteMediaRequest request) {

        List<UUID> ids = (request != null) ? request.getIds() : Collections.emptyList();
        long deletedCount = adminProctoringMediaService.deleteSelectedMedia(ids);
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("deletedCount", deletedCount),
                String.format("Đã xóa thành công %d ảnh giám sát", deletedCount)));
    }

    /**
     * Delete a single evidence image by ID.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteSingleMedia(@PathVariable UUID id) {
        long deletedCount = adminProctoringMediaService.deleteSelectedMedia(List.of(id));
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("deletedCount", deletedCount),
                "Ảnh giám sát đã được xóa thành công"));
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
}
