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

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class MediaDeleteConsumerTest {

    @Mock
    private CloudinaryStorageService cloudinaryStorageService;

    @InjectMocks
    private MediaDeleteConsumer mediaDeleteConsumer;

    @Test
    @DisplayName("processMediaDeleteBatch should delete all media in the batch even if one item throws exception")
    void shouldDeleteAllMediaInBatchEvenIfExceptionOccurs() {
        MediaBatchDeleteMessage message = MediaBatchDeleteMessage.builder()
                .examId(UUID.randomUUID())
                .publicIdsOrUrls(List.of("img1", "img2_error", "img3"))
                .source("EXAM_DELETION")
                .build();

        doNothing().when(cloudinaryStorageService).deleteMedia("img1");
        doThrow(new RuntimeException("Cloudinary timeout")).when(cloudinaryStorageService).deleteMedia("img2_error");
        doNothing().when(cloudinaryStorageService).deleteMedia("img3");

        mediaDeleteConsumer.processMediaDeleteBatch(message);

        verify(cloudinaryStorageService).deleteMedia("img1");
        verify(cloudinaryStorageService).deleteMedia("img2_error");
        verify(cloudinaryStorageService).deleteMedia("img3");
    }

    @Test
    @DisplayName("processMediaDeleteBatch should handle null or empty messages gracefully")
    void shouldHandleNullOrEmptyGracefully() {
        mediaDeleteConsumer.processMediaDeleteBatch(null);
        mediaDeleteConsumer.processMediaDeleteBatch(new MediaBatchDeleteMessage());

        verifyNoInteractions(cloudinaryStorageService);
    }
}
