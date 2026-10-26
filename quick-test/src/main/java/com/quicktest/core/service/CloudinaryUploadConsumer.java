package com.quicktest.core.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.assessment.dto.MediaUploadResponse;
import com.quicktest.modules.assessment.dto.MediaUploadTaskMessage;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;

/**
 * RabbitMQ consumer handling background asynchronous Cloudinary media uploads
 * for batch uploads and exam question media.
 */
@Slf4j
@Service
@org.springframework.context.annotation.Lazy(false)
@RequiredArgsConstructor
@SuppressWarnings("null")
public class CloudinaryUploadConsumer {

    private static final Duration TTL = Duration.ofHours(24);

    private final CloudinaryStorageService cloudinaryStorageService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final QuestionRepository questionRepository;
    private final AnswerOptionRepository answerOptionRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Consumes individual media upload tasks from the media upload queue.
     *
     * @param message task metadata containing file bytes, target folder, and entity IDs
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

            // 1. Asynchronous question / option media update
            if (message.getOptionId() != null) {
                answerOptionRepository.findById(message.getOptionId()).ifPresent(opt -> {
                    opt.setImageUrl(response.getUrl());
                    opt.setImagePublicId(response.getPublicId());
                    answerOptionRepository.save(opt);
                    log.info("Background upload updated option ID {} with image: {}", opt.getId(), response.getUrl());
                });
            } else if (message.getQuestionId() != null) {
                questionRepository.findById(message.getQuestionId()).ifPresent(q -> {
                    q.setImageUrl(response.getUrl());
                    q.setImagePublicId(response.getPublicId());
                    questionRepository.save(q);
                    log.info("Background upload updated question ID {} with image: {}", q.getId(), response.getUrl());
                });
            }

            // 2. Real-time WebSocket notification for live exam editor canvas
            if (messagingTemplate != null && message.getExamId() != null) {
                try {
                    String topic = "/topic/exams/" + message.getExamId() + "/questions";
                    messagingTemplate.convertAndSend(topic, Map.of(
                            "type", "QUESTION_MEDIA_UPLOADED",
                            "examId", message.getExamId().toString(),
                            "questionId", message.getQuestionId() != null ? message.getQuestionId().toString() : "",
                            "optionId", message.getOptionId() != null ? message.getOptionId().toString() : "",
                            "url", response.getUrl(),
                            "publicId", response.getPublicId()
                    ));
                    log.debug("Dispatched live question image update to WebSocket topic: {}", topic);
                } catch (Exception wsEx) {
                    log.warn("Failed to dispatch WebSocket question image update: {}", wsEx.getMessage());
                }
            }

            // 3. Batch upload status tracking in Redis (if initiated via batch upload API)
            if (batchId != null) {
                String urlsKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":urls";
                redisTemplate.opsForHash().put(urlsKey, filename, response.getUrl());
                redisTemplate.expire(urlsKey, TTL);

                String completedKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":completed";
                Long completed = redisTemplate.opsForValue().increment(completedKey);

                String totalKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":total";
                Object totalObj = redisTemplate.opsForValue().get(totalKey);
                int total = totalObj != null ? Integer.parseInt(totalObj.toString()) : 0;

                if (completed != null && completed >= total) {
                    String statusKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":status";
                    redisTemplate.opsForValue().set(statusKey, "COMPLETED", TTL);
                    log.info("Batch upload completed successfully: batchId={}, totalFiles={}", batchId, total);
                }
            }
        } catch (Exception e) {
            log.error("Failed to process media upload for batchId={}, file={}: {}", batchId, filename, e.getMessage(), e);

            if (batchId != null) {
                String statusKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":status";
                String errorKey = MediaBatchUploadServiceImpl.BATCH_KEY_PREFIX + batchId + ":error";
                redisTemplate.opsForValue().set(statusKey, "FAILED", TTL);
                redisTemplate.opsForValue().set(errorKey, "Upload failed for " + filename + ": " + e.getMessage(), TTL);
            }
        }
    }
}
