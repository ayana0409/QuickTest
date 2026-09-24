package com.quicktest.modules.admin.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.admin.dto.AiModerationJobMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

/**
 * RabbitMQ producer service responsible for enqueueing AI content moderation job requests.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiModerationProducer {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Publishes an AI content moderation task to RabbitMQ.
     *
     * @param message moderation job request metadata
     */
    public void sendModerationJob(AiModerationJobMessage message) {
        log.info("[AI Moderation Producer] Enqueueing AI moderation task: jobId={}, triggeredAt={}",
                message.getJobId(), message.getTriggeredAt());

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.AI_MODERATION_EXCHANGE,
                RabbitMQConfig.AI_MODERATION_ROUTING_KEY,
                message
        );
    }
}
