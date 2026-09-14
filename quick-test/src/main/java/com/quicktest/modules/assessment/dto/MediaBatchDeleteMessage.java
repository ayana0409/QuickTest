package com.quicktest.modules.assessment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;
import java.util.UUID;

/**
 * RabbitMQ message payload for asynchronous media deletion in batches.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaBatchDeleteMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * Optional ID of the exam being cleaned up.
     */
    private UUID examId;

    /**
     * Batch of Cloudinary public IDs or secure image URLs to delete (recommended 3-7 items per batch).
     */
    private List<String> publicIdsOrUrls;

    /**
     * Source event triggering the deletion (e.g. "EXAM_DELETION", "QUESTION_DELETION").
     */
    private String source;
}
