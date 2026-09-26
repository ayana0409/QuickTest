package com.quicktest.core.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.assessment.dto.MediaBatchDeleteMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

/**
 * RabbitMQ consumer that receives batches of media IDs and deletes them asynchronously from Cloudinary.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MediaDeleteConsumer {

    private final CloudinaryStorageService cloudinaryStorageService;

    /**
     * Consumes media deletion batches from RabbitMQ and processes each item asynchronously.
     *
     * @param message batch message containing list of public IDs or URLs
     */
    @com.quicktest.core.logging.AuditLog(module = "WORKER_MEDIA_DELETE", action = "DELETE_MEDIA_BATCH")
    @RabbitListener(queues = RabbitMQConfig.MEDIA_DELETE_QUEUE)
    public void processMediaDeleteBatch(MediaBatchDeleteMessage message) {
        if (message == null || message.getPublicIdsOrUrls() == null || message.getPublicIdsOrUrls().isEmpty()) {
            return;
        }

        // Batch delete all images in this message in a SINGLE Cloudinary API call
        try {
            cloudinaryStorageService.deleteMediaBatch(message.getPublicIdsOrUrls());
        } catch (Exception e) {
            log.warn("Failed to process media delete batch asynchronously for examId={}: {}",
                    message.getExamId(), e.getMessage());
        }
    }
}

