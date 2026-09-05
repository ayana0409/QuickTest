package com.quicktest.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ infrastructure configuration for high-throughput asynchronous exam submissions.
 * Defines exchange, primary submission queue, and dead-letter queue (DLQ).
 */
@Configuration
@SuppressWarnings("null")
public class RabbitMQConfig {

    public static final String SUBMISSION_EXCHANGE = "exam.submission.exchange";
    public static final String SUBMISSION_QUEUE = "exam.submission.queue";
    public static final String SUBMISSION_ROUTING_KEY = "exam.submission.routing-key";

    public static final String SUBMISSION_DLX = "exam.submission.dlx";
    public static final String SUBMISSION_DLQ = "exam.submission.dlq";
    public static final String SUBMISSION_DLQ_ROUTING_KEY = "exam.submission.dlq.routing-key";

    /**
     * Primary durable queue for exam submissions with Dead Letter Exchange (DLX) routing.
     */
    @Bean
    public Queue submissionQueue() {
        return QueueBuilder.durable(SUBMISSION_QUEUE)
                .withArgument("x-dead-letter-exchange", SUBMISSION_DLX)
                .withArgument("x-dead-letter-routing-key", SUBMISSION_DLQ_ROUTING_KEY)
                .build();
    }

    /**
     * Direct exchange routing incoming submissions.
     */
    @Bean
    public DirectExchange submissionExchange() {
        return new DirectExchange(SUBMISSION_EXCHANGE);
    }

    /**
     * Binding primary queue to direct submission exchange.
     */
    @Bean
    public Binding submissionBinding(Queue submissionQueue, DirectExchange submissionExchange) {
        return BindingBuilder.bind(submissionQueue).to(submissionExchange).with(SUBMISSION_ROUTING_KEY);
    }

    /**
     * Dead letter queue to store failed submissions for operator inspection without data loss.
     */
    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(SUBMISSION_DLQ).build();
    }

    /**
     * Dead letter exchange.
     */
    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(SUBMISSION_DLX);
    }

    /**
     * Binding DLQ to DLX.
     */
    @Bean
    public Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with(SUBMISSION_DLQ_ROUTING_KEY);
    }

    /**
     * JSON Message converter supporting Java 8 date/time types.
     */
    @Bean
    public MessageConverter jackson2JsonMessageConverter() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    /**
     * Customized RabbitTemplate configured with JSON serialization.
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }
}
