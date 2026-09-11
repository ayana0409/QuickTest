package com.quicktest.modules.assessment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Status and result details of an asynchronous batch media upload.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchUploadStatusResponse {

    private String batchId;

    /**
     * Batch status: PROCESSING, COMPLETED, FAILED.
     */
    private String status;

    private Integer totalFiles;

    private Integer completedFiles;

    /**
     * Map of originalFilename -> Cloudinary secure URL.
     */
    private Map<String, String> fileUrlMap;

    /**
     * Optional error message if batch failed.
     */
    private String errorMessage;
}
