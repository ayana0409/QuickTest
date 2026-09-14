package com.quicktest.core.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.assessment.dto.MediaBatchDeleteMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class MediaDeleteProducerTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private MediaDeleteProducer mediaDeleteProducer;

    @Test
    @DisplayName("sendDeleteBatches should split 12 items into 3 batches of (5, 5, 2)")
    void shouldSplitIntoBatchesCorrectly() {
        UUID examId = UUID.randomUUID();
        List<String> ids = List.of(
                "id1", "id2", "id3", "id4", "id5",
                "id6", "id7", "id8", "id9", "id10",
                "id11", "id12"
        );

        mediaDeleteProducer.sendDeleteBatches(examId, ids, "EXAM_DELETION");

        ArgumentCaptor<MediaBatchDeleteMessage> messageCaptor = ArgumentCaptor.forClass(MediaBatchDeleteMessage.class);

        verify(rabbitTemplate, times(3)).convertAndSend(
                eq(RabbitMQConfig.MEDIA_DELETE_EXCHANGE),
                eq(RabbitMQConfig.MEDIA_DELETE_ROUTING_KEY),
                messageCaptor.capture()
        );

        List<MediaBatchDeleteMessage> sentMessages = messageCaptor.getAllValues();
        assertEquals(3, sentMessages.size());

        // First batch: 5 items
        assertEquals(5, sentMessages.get(0).getPublicIdsOrUrls().size());
        assertEquals("id1", sentMessages.get(0).getPublicIdsOrUrls().get(0));
        assertEquals("id5", sentMessages.get(0).getPublicIdsOrUrls().get(4));

        // Second batch: 5 items
        assertEquals(5, sentMessages.get(1).getPublicIdsOrUrls().size());
        assertEquals("id6", sentMessages.get(1).getPublicIdsOrUrls().get(0));
        assertEquals("id10", sentMessages.get(1).getPublicIdsOrUrls().get(4));

        // Third batch: 2 items
        assertEquals(2, sentMessages.get(2).getPublicIdsOrUrls().size());
        assertEquals("id11", sentMessages.get(2).getPublicIdsOrUrls().get(0));
        assertEquals("id12", sentMessages.get(2).getPublicIdsOrUrls().get(1));
    }

    @Test
    @DisplayName("sendDeleteBatches should ignore empty or blank items and remove duplicates")
    void shouldFilterBlanksAndDuplicates() {
        UUID examId = UUID.randomUUID();
        List<String> ids = List.of("id1", "  ", "", "id1", "id2");

        mediaDeleteProducer.sendDeleteBatches(examId, ids, "EXAM_DELETION");

        ArgumentCaptor<MediaBatchDeleteMessage> messageCaptor = ArgumentCaptor.forClass(MediaBatchDeleteMessage.class);

        verify(rabbitTemplate, times(1)).convertAndSend(
                eq(RabbitMQConfig.MEDIA_DELETE_EXCHANGE),
                eq(RabbitMQConfig.MEDIA_DELETE_ROUTING_KEY),
                messageCaptor.capture()
        );

        List<String> sentBatch = messageCaptor.getValue().getPublicIdsOrUrls();
        assertEquals(2, sentBatch.size());
        assertTrue(sentBatch.contains("id1"));
        assertTrue(sentBatch.contains("id2"));
    }

    @Test
    @DisplayName("sendDeleteBatches should do nothing when list is null or empty")
    void shouldDoNothingWhenEmpty() {
        mediaDeleteProducer.sendDeleteBatches(UUID.randomUUID(), null, "EXAM_DELETION");
        mediaDeleteProducer.sendDeleteBatches(UUID.randomUUID(), List.of(), "EXAM_DELETION");

        verifyNoInteractions(rabbitTemplate);
    }
}
