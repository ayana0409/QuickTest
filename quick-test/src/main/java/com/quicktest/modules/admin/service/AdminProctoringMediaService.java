package com.quicktest.modules.admin.service;

import com.quicktest.modules.admin.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Service interface for administrative management, searching, statistics,
 * and asynchronous batch cleanup of proctoring evidence images.
 */
public interface AdminProctoringMediaService {

    /**
     * Search and list proctoring evidence images with multi-criteria filters and pagination.
     */
    Page<AdminProctoringMediaResponse> searchMedia(
            String violationType,
            UUID examId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Pageable pageable);

    /**
     * Retrieve analytical overview metrics for the proctoring media KPI cards.
     */
    AdminProctoringMediaStatsResponse getStats();

    /**
     * Estimate the number of images that match the conditional cleanup criteria.
     */
    long countCleanupPreview(int days, String violationType, UUID examId, boolean onlyFinishedExams);

    /**
     * Trigger asynchronous background batch cleanup of evidence images matching retention criteria.
     * Executes exactly 1 update query per batch chunk and removes media resources on Cloudinary in batches.
     */
    ProctoringMediaCleanupStatusResponse triggerBatchCleanup(ProctoringMediaCleanupRequest request);

    /**
     * Retrieve current background cleanup task progress and state.
     */
    ProctoringMediaCleanupStatusResponse getCleanupStatus();

    /**
     * Delete a specific set of evidence images by IDs in a single update query and batch Cloudinary call.
     */
    long deleteSelectedMedia(List<UUID> ids);
}

