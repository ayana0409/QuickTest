package com.quicktest.core.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.assessment.dto.MediaBatchDeleteMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service to publish media deletion batches to RabbitMQ.
 * Chunks media identifiers into small batches (3-7 items) to ensure fault tolerance.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MediaDeleteProducer {

    /**
     * Recommended batch size between 3 and 7 items to prevent large batch failure cascades.
     */
    private static final int BATCH_SIZE = 5;

    private final RabbitTemplate rabbitTemplate;

    /**
     * Splits media IDs or URLs into batches of 3-7 items (default 5) and pushes to RabbitMQ asynchronously.
     *
     * @param examId           exam ID associated with the media
     * @param mediaIdentifiers list of Cloudinary public IDs or secure URLs
     * @param source           contextual source string (e.g., "EXAM_DELETION")
     */
    public void sendDeleteBatches(UUID examId, List<String> mediaIdentifiers, String source) {
        if (mediaIdentifiers == null || mediaIdentifiers.isEmpty()) {
            return;
        }

        List<String> cleanList = mediaIdentifiers.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        if (cleanList.isEmpty()) {
            return;
        }

        int total = cleanList.size();
        log.info("Queueing media deletion for examId={}: total items={}, batchSize={}", examId, total, BATCH_SIZE);

        for (int i = 0; i < total; i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, total);
            List<String> batch = new ArrayList<>(cleanList.subList(i, end));

            MediaBatchDeleteMessage message = MediaBatchDeleteMessage.builder()
                    .examId(examId)
                    .publicIdsOrUrls(batch)
                    .source(source)
                    .build();

            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.MEDIA_DELETE_EXCHANGE,
                    RabbitMQConfig.MEDIA_DELETE_ROUTING_KEY,
                    message
            );
            log.debug("Published media delete batch [{} to {}] of total {} items for examId={}", i + 1, end, total, examId);
        }
    }
}
