package com.quicktest.modules.assessment.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.service.CloudinaryStorageService;
import com.quicktest.core.service.MediaBatchUploadService;
import com.quicktest.modules.assessment.dto.BatchUploadStatusResponse;
import com.quicktest.modules.assessment.dto.MediaUploadResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * REST controller providing synchronous and asynchronous media upload
 * capabilities for teachers.
 */
@Slf4j
@RestController
@RequestMapping("/api/teacher/media")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class TeacherMediaController {

    private final CloudinaryStorageService cloudinaryStorageService;
    private final MediaBatchUploadService mediaBatchUploadService;

    /**
     * Single synchronous image upload to Cloudinary.
     */
    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<MediaUploadResponse>> uploadSingle(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "folderType", defaultValue = "questions") String folderType) {
        log.info("Received single media upload request: file={}, folderType={}",
                file != null ? file.getOriginalFilename() : "null", folderType);
        if (file == null || file.isEmpty()) {
            throw new AppException("Uploaded file must not be empty", HttpStatus.BAD_REQUEST);
        }
        MediaUploadResponse response = cloudinaryStorageService.uploadSingle(file, folderType);
        return ResponseEntity.ok(ApiResponse.success(response, "Media uploaded successfully"));
    }

    /**
     * Asynchronous batch image upload via RabbitMQ and Redis.
     */
    @PostMapping("/batch-upload")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadBatch(
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "folderType", defaultValue = "questions") String folderType) {
        log.info("Received batch media upload request: count={}, folderType={}",
                files != null ? files.size() : 0, folderType);
        if (files == null || files.isEmpty()) {
            throw new AppException("No files provided for batch upload", HttpStatus.BAD_REQUEST);
        }
        String batchId = mediaBatchUploadService.initBatchUpload(files, folderType);
        return ResponseEntity
                .status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(Map.of("batchId", batchId), "Batch upload accepted and processing"));
    }

    /**
     * Check asynchronous batch upload progress and retrieve uploaded URLs.
     */
    @GetMapping("/batch/{batchId}/status")
    public ResponseEntity<ApiResponse<BatchUploadStatusResponse>> getBatchStatus(
            @PathVariable("batchId") String batchId) {
        BatchUploadStatusResponse response = mediaBatchUploadService.getBatchStatus(batchId);
        return ResponseEntity.ok(ApiResponse.success(response, "Batch status retrieved"));
    }
}
