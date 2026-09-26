package com.quicktest.core.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.assessment.dto.MediaUploadResponse;
import com.quicktest.modules.assessment.dto.MediaUploadTaskMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * RabbitMQ consumer handling background asynchronous Cloudinary media uploads.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class CloudinaryUploadConsumer {

    private static final Duration TTL = Duration.ofHours(24);

    private final CloudinaryStorageService cloudinaryStorageService;
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * Consumes individual media upload tasks from the media upload queue.
     *
     * @param message task metadata containing file bytes and target folder
     */
    @com.quicktest.core.logging.AuditLog(module = "WORKER_MEDIA_UPLOAD", action = "UPLOAD_IMAGE")
    @RabbitListener(queues = RabbitMQConfig.MEDIA_UPLOAD_QUEUE)
    public void processMediaUpload(MediaUploadTaskMessage message) {
        String batchId = message.getBatchId();
        String filename = message.getOriginalFilename();

        try {
            MediaUploadResponse response = cloudinaryStorageService.uploadFromBytes(
                    message.getFileData(),
                    filename,
                    message.getContentType(),
                    message.getTargetFolder()
            );

            // Store uploaded URL mapping in Redis Hash
            String urlsKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":urls";
            redisTemplate.opsForHash().put(urlsKey, filename, response.getUrl());
            redisTemplate.expire(urlsKey, TTL);

            // Increment completed count
            String completedKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":completed";
            Long completed = redisTemplate.opsForValue().increment(completedKey);

            // Check if all files in the batch have been processed
            String totalKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":total";
            Object totalObj = redisTemplate.opsForValue().get(totalKey);
            int total = totalObj != null ? Integer.parseInt(totalObj.toString()) : 0;

            if (completed != null && completed >= total) {
                String statusKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":status";
                redisTemplate.opsForValue().set(statusKey, "COMPLETED", TTL);
                log.info("Batch upload completed successfully: batchId={}, totalFiles={}", batchId, total);
            }
        } catch (Exception e) {
            log.error("Failed to process media upload for batchId={}, file={}: {}", batchId, filename, e.getMessage(), e);

            String statusKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":status";
            String errorKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":error";
            redisTemplate.opsForValue().set(statusKey, "FAILED", TTL);
            redisTemplate.opsForValue().set(errorKey, "Upload failed for " + filename + ": " + e.getMessage(), TTL);
        }
    }
}
