package com.quicktest.core.service;

import com.quicktest.modules.assessment.dto.MediaBatchDeleteMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class MediaDeleteConsumerTest {

    @Mock
    private CloudinaryStorageService cloudinaryStorageService;

    @InjectMocks
    private MediaDeleteConsumer mediaDeleteConsumer;

    @Test
    @DisplayName("processMediaDeleteBatch should delegate batch deletion to CloudinaryStorageService")
    void shouldDeleteAllMediaInBatchViaBatchCall() {
        List<String> images = List.of("img1", "img2", "img3");
        MediaBatchDeleteMessage message = MediaBatchDeleteMessage.builder()
                .examId(UUID.randomUUID())
                .publicIdsOrUrls(images)
                .source("EXAM_DELETION")
                .build();

        doNothing().when(cloudinaryStorageService).deleteMediaBatch(images);

        mediaDeleteConsumer.processMediaDeleteBatch(message);

        verify(cloudinaryStorageService, times(1)).deleteMediaBatch(images);
    }

    @Test
    @DisplayName("processMediaDeleteBatch should gracefully catch exceptions during batch deletion")
    void shouldNotPropagateExceptionWhenBatchDeleteFails() {
        List<String> images = List.of("img1", "img2");
        MediaBatchDeleteMessage message = MediaBatchDeleteMessage.builder()
                .examId(UUID.randomUUID())
                .publicIdsOrUrls(images)
                .source("EXAM_DELETION")
                .build();

        doThrow(new RuntimeException("Cloudinary API unavailable"))
                .when(cloudinaryStorageService).deleteMediaBatch(images);

        assertDoesNotThrow(() -> mediaDeleteConsumer.processMediaDeleteBatch(message));
        verify(cloudinaryStorageService, times(1)).deleteMediaBatch(images);
    }

    @Test
    @DisplayName("processMediaDeleteBatch should handle null or empty messages gracefully")
    void shouldHandleNullOrEmptyGracefully() {
        mediaDeleteConsumer.processMediaDeleteBatch(null);
        mediaDeleteConsumer.processMediaDeleteBatch(new MediaBatchDeleteMessage());

        verifyNoInteractions(cloudinaryStorageService);
    }
}
