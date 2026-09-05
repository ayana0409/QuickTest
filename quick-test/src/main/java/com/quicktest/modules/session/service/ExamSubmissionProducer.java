package com.quicktest.modules.session.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.session.dto.SubmissionMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

/**
 * Message producer publishing candidate exam submissions into RabbitMQ queue
 * for high-speed non-blocking ingestion (< 5ms).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamSubmissionProducer {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Dispatch submission message to RabbitMQ direct exchange.
     */
    public void sendSubmissionMessage(SubmissionMessage message) {
        log.info("Dispatching submission message to RabbitMQ: attemptId={}, examId={}",
                message.getAttemptId(), message.getExamId());

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.SUBMISSION_EXCHANGE,
                RabbitMQConfig.SUBMISSION_ROUTING_KEY,
                message
        );

        log.debug("Successfully published submission message for attemptId: {}", message.getAttemptId());
    }
}
