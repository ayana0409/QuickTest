package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * RabbitMQ message payload for triggering asynchronous AI content moderation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiModerationJobMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * Unique ID of the moderation job request.
     */
    private UUID jobId;

    /**
     * Timestamp when the job was triggered.
     */
    private LocalDateTime triggeredAt;

    /**
     * Optional ID of the admin user who initiated the job.
     */
    private UUID triggeredBy;
}
