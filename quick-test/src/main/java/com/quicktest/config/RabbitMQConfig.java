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

    public static final String MEDIA_UPLOAD_EXCHANGE = "media.upload.exchange";
    public static final String MEDIA_UPLOAD_QUEUE = "media.upload.queue";
    public static final String MEDIA_UPLOAD_ROUTING_KEY = "media.upload.routing-key";

    public static final String MEDIA_DELETE_EXCHANGE = "media.delete.exchange";
    public static final String MEDIA_DELETE_QUEUE = "media.delete.queue";
    public static final String MEDIA_DELETE_ROUTING_KEY = "media.delete.routing-key";

    public static final String EXAM_CLONE_EXCHANGE = "exam.clone.exchange";
    public static final String EXAM_CLONE_QUEUE = "exam.clone.queue";
    public static final String EXAM_CLONE_ROUTING_KEY = "exam.clone.routing-key";

    public static final String AI_MODERATION_EXCHANGE = "ai.moderation.exchange";
    public static final String AI_MODERATION_QUEUE = "ai.moderation.queue";
    public static final String AI_MODERATION_ROUTING_KEY = "ai.moderation.routing-key";

    /**
     * Durable queue for asynchronous AI content moderation tasks.
     */
    @Bean
    public Queue aiModerationQueue() {
        return QueueBuilder.durable(AI_MODERATION_QUEUE).build();
    }

    /**
     * Direct exchange for AI content moderation tasks.
     */
    @Bean
    public DirectExchange aiModerationExchange() {
        return new DirectExchange(AI_MODERATION_EXCHANGE);
    }

    /**
     * Binding AI moderation queue to direct exchange.
     */
    @Bean
    public Binding aiModerationBinding(Queue aiModerationQueue, DirectExchange aiModerationExchange) {
        return BindingBuilder.bind(aiModerationQueue).to(aiModerationExchange).with(AI_MODERATION_ROUTING_KEY);
    }

    /**
     * Durable queue for asynchronous media batch upload tasks.
     */
    @Bean
    public Queue mediaUploadQueue() {
        return QueueBuilder.durable(MEDIA_UPLOAD_QUEUE).build();
    }

    /**
     * Direct exchange for media upload tasks.
     */
    @Bean
    public DirectExchange mediaUploadExchange() {
        return new DirectExchange(MEDIA_UPLOAD_EXCHANGE);
    }

    /**
     * Binding media upload queue to direct media exchange.
     */
    @Bean
    public Binding mediaUploadBinding(Queue mediaUploadQueue, DirectExchange mediaUploadExchange) {
        return BindingBuilder.bind(mediaUploadQueue).to(mediaUploadExchange).with(MEDIA_UPLOAD_ROUTING_KEY);
    }

    /**
     * Durable queue for asynchronous media batch deletion tasks.
     */
    @Bean
    public Queue mediaDeleteQueue() {
        return QueueBuilder.durable(MEDIA_DELETE_QUEUE).build();
    }

    /**
     * Direct exchange for media deletion tasks.
     */
    @Bean
    public DirectExchange mediaDeleteExchange() {
        return new DirectExchange(MEDIA_DELETE_EXCHANGE);
    }

    /**
     * Binding media delete queue to direct media delete exchange.
     */
    @Bean
    public Binding mediaDeleteBinding(Queue mediaDeleteQueue, DirectExchange mediaDeleteExchange) {
        return BindingBuilder.bind(mediaDeleteQueue).to(mediaDeleteExchange).with(MEDIA_DELETE_ROUTING_KEY);
    }

    /**
     * Durable queue for background exam cloning and image duplication tasks.
     */
    @Bean
    public Queue examCloneQueue() {
        return QueueBuilder.durable(EXAM_CLONE_QUEUE).build();
    }

    /**
     * Direct exchange for exam cloning tasks.
     */
    @Bean
    public DirectExchange examCloneExchange() {
        return new DirectExchange(EXAM_CLONE_EXCHANGE);
    }

    /**
     * Binding exam clone queue to direct clone exchange.
     */
    @Bean
    public Binding examCloneBinding(Queue examCloneQueue, DirectExchange examCloneExchange) {
        return BindingBuilder.bind(examCloneQueue).to(examCloneExchange).with(EXAM_CLONE_ROUTING_KEY);
    }

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
