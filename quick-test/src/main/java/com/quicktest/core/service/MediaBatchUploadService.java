package com.quicktest.core.service;

import com.quicktest.modules.assessment.dto.BatchUploadStatusResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Service for asynchronous background batch media uploads via RabbitMQ and Redis.
 */
public interface MediaBatchUploadService {

    /**
     * Initializes asynchronous batch upload for up to 30 files.
     *
     * @param files      list of multipart image files
     * @param folderType target folder alias ("questions", "options")
     * @return unique batch identifier
     */
    String initBatchUpload(List<MultipartFile> files, String folderType);

    /**
     * Retrieves current progress and uploaded URL mapping of an ongoing or completed batch.
     *
     * @param batchId batch identifier
     * @return batch upload status details
     */
    BatchUploadStatusResponse getBatchStatus(String batchId);
}
