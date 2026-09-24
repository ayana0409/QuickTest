package com.quicktest.modules.admin;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.admin.dto.AiModerationJobMessage;
import com.quicktest.modules.admin.service.AiModerationProducer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AiModerationProducerTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private AiModerationProducer producer;

    @Test
    @DisplayName("sendModerationJob: publishes message to AI moderation exchange with routing key")
    void sendModerationJob_PublishesToRabbitMQ() {
        AiModerationJobMessage message = AiModerationJobMessage.builder()
                .jobId(UUID.randomUUID())
                .triggeredAt(LocalDateTime.now())
                .build();

        producer.sendModerationJob(message);

        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.AI_MODERATION_EXCHANGE),
                eq(RabbitMQConfig.AI_MODERATION_ROUTING_KEY),
                eq(message)
        );
    }
}
