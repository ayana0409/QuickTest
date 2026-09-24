package com.quicktest.modules.admin.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.admin.dto.AiModerationJobMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

/**
 * RabbitMQ consumer that processes AI content moderation jobs.
 * Enforces a strict single-worker concurrency limit (concurrency = "1")
 * so that at most one worker moderates questions at any given time.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiModerationConsumer {

    private final AiModerationAsyncWorker aiModerationAsyncWorker;

    /**
     * Consumes AI moderation tasks from the queue sequentially.
     * Concurrency is strictly 1 to ensure at most one worker executes at any moment.
     *
     * @param message moderation task message
     */
    @RabbitListener(queues = RabbitMQConfig.AI_MODERATION_QUEUE, concurrency = "1")
    public void processModerationJob(AiModerationJobMessage message) {
        log.info("[AI Moderation Consumer] Received moderation task: jobId={}, triggeredAt={}",
                message != null ? message.getJobId() : null,
                message != null ? message.getTriggeredAt() : null);

        try {
            aiModerationAsyncWorker.runModerationJob();
        } catch (Exception e) {
            log.error("[AI Moderation Consumer] Error during AI content moderation: {}", e.getMessage(), e);
        }
    }
}
