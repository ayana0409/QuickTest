package com.quicktest.modules.admin;

import com.quicktest.modules.admin.dto.AiModerationJobMessage;
import com.quicktest.modules.admin.service.AiModerationAsyncWorker;
import com.quicktest.modules.admin.service.AiModerationConsumer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AiModerationConsumerTest {

    @Mock
    private AiModerationAsyncWorker aiModerationAsyncWorker;

    @InjectMocks
    private AiModerationConsumer consumer;

    @Test
    @DisplayName("processModerationJob: calls runModerationJob on worker when message is received")
    void processModerationJob_CallsWorker() {
        AiModerationJobMessage message = AiModerationJobMessage.builder()
                .jobId(UUID.randomUUID())
                .triggeredAt(LocalDateTime.now())
                .build();

        consumer.processModerationJob(message);

        verify(aiModerationAsyncWorker).runModerationJob();
    }

    @Test
    @DisplayName("processModerationJob: handles exception gracefully without throwing")
    void processModerationJob_HandlesExceptionGracefully() {
        AiModerationJobMessage message = AiModerationJobMessage.builder()
                .jobId(UUID.randomUUID())
                .triggeredAt(LocalDateTime.now())
                .build();

        doThrow(new RuntimeException("Worker failed")).when(aiModerationAsyncWorker).runModerationJob();

        // Should not throw
        consumer.processModerationJob(message);

        verify(aiModerationAsyncWorker).runModerationJob();
    }
}
