package com.quicktest.core.service;

import com.quicktest.config.CloudinaryProperties;
import com.quicktest.config.RabbitMQConfig;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.dto.BatchUploadStatusResponse;
import com.quicktest.modules.assessment.dto.MediaUploadTaskMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Implementation of MediaBatchUploadService managing batch initialization,
 * RabbitMQ task publishing, and Redis status coordination.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class MediaBatchUploadServiceImpl implements MediaBatchUploadService {

    public static final String BATCH_KEY_PREFIX = "media:batch:";
    private static final Duration BATCH_TTL = Duration.ofHours(24);
    private static final int MAX_BATCH_SIZE = 30;

    private final RedisTemplate<String, Object> redisTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final CloudinaryProperties cloudinaryProperties;

    @Override
    public String initBatchUpload(List<MultipartFile> files, String folderType) {
        if (files == null || files.isEmpty()) {
            throw new AppException("No files provided for batch upload", HttpStatus.BAD_REQUEST);
        }

        if (files.size() > MAX_BATCH_SIZE) {
            throw new AppException("Batch upload limit is " + MAX_BATCH_SIZE + " files per request", HttpStatus.BAD_REQUEST);
        }

        // Validate all files before accepting batch
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                throw new AppException("One or more files in the batch are empty", HttpStatus.BAD_REQUEST);
            }
            validateFile(file.getOriginalFilename(), file.getSize());
        }

        String batchId = UUID.randomUUID().toString();
        String targetFolder = resolveFolder(folderType);

        // Initialize batch state in Redis
        redisTemplate.opsForValue().set(BATCH_KEY_PREFIX + batchId + ":status", "PROCESSING", BATCH_TTL);
        redisTemplate.opsForValue().set(BATCH_KEY_PREFIX + batchId + ":total", files.size(), BATCH_TTL);
        redisTemplate.opsForValue().set(BATCH_KEY_PREFIX + batchId + ":completed", 0, BATCH_TTL);

        log.info("Initialized media batch upload: batchId={}, fileCount={}, targetFolder={}",
                batchId, files.size(), targetFolder);

        // Publish each file as an async task to RabbitMQ
        for (int i = 0; i < files.size(); i++) {
            MultipartFile file = files.get(i);
            try {
                MediaUploadTaskMessage message = MediaUploadTaskMessage.builder()
                        .batchId(batchId)
                        .targetFolder(targetFolder)
                        .originalFilename(file.getOriginalFilename())
                        .fileData(file.getBytes())
                        .contentType(file.getContentType())
                        .fileIndex(i)
                        .build();

                rabbitTemplate.convertAndSend(
                        RabbitMQConfig.MEDIA_UPLOAD_EXCHANGE,
                        RabbitMQConfig.MEDIA_UPLOAD_ROUTING_KEY,
                        message
                );
            } catch (IOException e) {
                log.error("Failed to read file data for batch task: batchId={}, file={}",
                        batchId, file.getOriginalFilename(), e);
                redisTemplate.opsForValue().set(BATCH_KEY_PREFIX + batchId + ":status", "FAILED", BATCH_TTL);
                redisTemplate.opsForValue().set(BATCH_KEY_PREFIX + batchId + ":error",
                        "Failed to read file: " + file.getOriginalFilename(), BATCH_TTL);
                throw new AppException("Failed to read file content: " + file.getOriginalFilename(),
                        HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }

        return batchId;
    }

    @Override
    public BatchUploadStatusResponse getBatchStatus(String batchId) {
        Object statusObj = redisTemplate.opsForValue().get(BATCH_KEY_PREFIX + batchId + ":status");
        if (statusObj == null) {
            throw new AppException("Batch upload task not found for ID: " + batchId, HttpStatus.NOT_FOUND);
        }

        String status = statusObj.toString();
        Object totalObj = redisTemplate.opsForValue().get(BATCH_KEY_PREFIX + batchId + ":total");
        Object completedObj = redisTemplate.opsForValue().get(BATCH_KEY_PREFIX + batchId + ":completed");
        Object errorObj = redisTemplate.opsForValue().get(BATCH_KEY_PREFIX + batchId + ":error");

        int total = totalObj != null ? Integer.parseInt(totalObj.toString()) : 0;
        int completed = completedObj != null ? Integer.parseInt(completedObj.toString()) : 0;

        Map<Object, Object> rawMap = redisTemplate.opsForHash().entries(BATCH_KEY_PREFIX + batchId + ":urls");
        Map<String, String> fileUrlMap = new HashMap<>();
        if (rawMap != null) {
            for (Map.Entry<Object, Object> entry : rawMap.entrySet()) {
                fileUrlMap.put(entry.getKey().toString(), entry.getValue().toString());
            }
        }

        return BatchUploadStatusResponse.builder()
                .batchId(batchId)
                .status(status)
                .totalFiles(total)
                .completedFiles(completed)
                .fileUrlMap(fileUrlMap)
                .errorMessage(errorObj != null ? errorObj.toString() : null)
                .build();
    }

    /**
     * Validates file size and format against configured properties.
     */
    private void validateFile(String filename, long size) {
        long maxSizeBytes = cloudinaryProperties.getUpload().getMaxFileSizeBytes();
        if (size > maxSizeBytes) {
            throw new AppException(
                    String.format("File size exceeds maximum limit of %dMB", maxSizeBytes / (1024 * 1024)),
                    HttpStatus.BAD_REQUEST
            );
        }

        if (filename == null || !filename.contains(".")) {
            throw new AppException("Invalid file format. Allowed: jpg, png, webp, gif", HttpStatus.BAD_REQUEST);
        }

        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        List<String> allowedFormats = cloudinaryProperties.getUpload().getAllowedFormatList();

        if (!allowedFormats.contains(extension)) {
            throw new AppException("Invalid file format. Allowed: jpg, png, webp, gif", HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Resolves target Cloudinary folder name from alias.
     */
    private String resolveFolder(String folderType) {
        if ("options".equalsIgnoreCase(folderType)) {
            return cloudinaryProperties.getStorage().getOptionFolder();
        }
        return cloudinaryProperties.getStorage().getQuestionFolder();
    }
}
