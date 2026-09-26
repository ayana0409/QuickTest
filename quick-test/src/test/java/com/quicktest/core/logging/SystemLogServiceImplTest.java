package com.quicktest.core.logging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class SystemLogServiceImplTest {

    @Mock
    private SystemLogRepository systemLogRepository;

    private SystemLogServiceImpl systemLogService;

    @BeforeEach
    void setUp() {
        systemLogService = new SystemLogServiceImpl(systemLogRepository, new ObjectMapper());
    }

    @Test
    @DisplayName("logAsync: should save system log entry to repository")
    void logAsync_Success() {
        SystemLog logEntry = SystemLog.builder()
                .id(UUID.randomUUID())
                .level(LogLevel.INFO)
                .status(LogStatus.SUCCESS)
                .module("EXAM")
                .action("CREATE_EXAM")
                .details("{\"key\":\"value\"}")
                .build();

        systemLogService.logAsync(logEntry);

        verify(systemLogRepository).save(logEntry);
    }

    @Test
    @DisplayName("logAsync: should truncate excessively long details to avoid DB overflow")
    void logAsync_TruncatesLargeDetails() {
        String hugeString = "A".repeat(15_000);
        SystemLog logEntry = SystemLog.builder()
                .level(LogLevel.ERROR)
                .status(LogStatus.FAILURE)
                .module("TEST")
                .action("HUGE_PAYLOAD")
                .details(hugeString)
                .build();

        systemLogService.logAsync(logEntry);

        ArgumentCaptor<SystemLog> captor = ArgumentCaptor.forClass(SystemLog.class);
        verify(systemLogRepository).save(captor.capture());

        SystemLog saved = captor.getValue();
        assertTrue(saved.getDetails().length() < 12_000);
        assertTrue(saved.getDetails().endsWith("... [TRUNCATED]"));
    }

    @Test
    @DisplayName("safeSerialize: masks sensitive keys like password and token")
    void safeSerialize_MasksSensitiveKeys() {
        Map<String, Object> payload = Map.of(
                "username", "testuser",
                "password", "secretPassword123",
                "accessToken", "jwt.token.here"
        );

        String serialized = systemLogService.safeSerialize(payload);

        assertNotNull(serialized);
        assertTrue(serialized.contains("testuser"));
        assertTrue(serialized.contains("***MASKED***"));
        assertFalse(serialized.contains("secretPassword123"));
        assertFalse(serialized.contains("jwt.token.here"));
    }

    @Test
    @DisplayName("safeSerialize: safely formats MultipartFile without dumping binary stream")
    void safeSerialize_MultipartFile() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test-image.png", "image/png", new byte[]{1, 2, 3, 4}
        );

        String serialized = systemLogService.safeSerialize(file);

        assertNotNull(serialized);
        assertTrue(serialized.contains("test-image.png"));
        assertTrue(serialized.contains("image/png"));
    }

    @Test
    @DisplayName("searchLogs: 2-step pagination should return mapped DTOs maintaining order")
    void searchLogs_Success() {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 10);

        org.springframework.data.domain.Page<String> idPage = new org.springframework.data.domain.PageImpl<>(
                List.of(id1.toString(), id2.toString()), pageable, 2);

        when(systemLogRepository.findLogIds(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(idPage);

        SystemLog log1 = SystemLog.builder()
                .id(id1)
                .level(LogLevel.INFO)
                .module("ASSESSMENT")
                .action("CREATE_EXAM")
                .status(LogStatus.SUCCESS)
                .build();
        SystemLog log2 = SystemLog.builder()
                .id(id2)
                .level(LogLevel.ERROR)
                .module("IAM")
                .action("LOGIN_FAILED")
                .status(LogStatus.FAILURE)
                .build();

        when(systemLogRepository.findAllByIdIn(anyList())).thenReturn(List.of(log2, log1));

        var result = systemLogService.searchLogs(
                "INFO", "SUCCESS", "ASSESSMENT", null, null, null, null, "exam", pageable);

        assertNotNull(result);
        assertEquals(2, result.getTotalElements());
        assertEquals(2, result.getContent().size());
        assertEquals(id1, result.getContent().get(0).getId());
        assertEquals(id2, result.getContent().get(1).getId());
    }

    @Test
    @DisplayName("getLogDetail: returns detail DTO or throws ResourceNotFoundException")
    void getLogDetail_SuccessAndNotFound() {
        UUID id = UUID.randomUUID();
        SystemLog logEntry = SystemLog.builder()
                .id(id)
                .level(LogLevel.WARN)
                .module("STORAGE")
                .action("FILE_UPLOAD")
                .status(LogStatus.SUCCESS)
                .details("{\"fileSize\": 1024}")
                .build();

        when(systemLogRepository.findById(id)).thenReturn(java.util.Optional.of(logEntry));

        var detail = systemLogService.getLogDetail(id);
        assertNotNull(detail);
        assertEquals(id, detail.getId());
        assertEquals("STORAGE", detail.getModule());

        UUID missingId = UUID.randomUUID();
        when(systemLogRepository.findById(missingId)).thenReturn(java.util.Optional.empty());
        assertThrows(com.quicktest.core.exception.ResourceNotFoundException.class, () ->
                systemLogService.getLogDetail(missingId));
    }

    @Test
    @DisplayName("getLogStats: calculates totals and error rates accurately")
    void getLogStats_Success() {
        when(systemLogRepository.count()).thenReturn(100L);
        when(systemLogRepository.countByStatus(LogStatus.SUCCESS)).thenReturn(80L);
        when(systemLogRepository.countByStatus(LogStatus.FAILURE)).thenReturn(20L);
        when(systemLogRepository.countByLevel(LogLevel.INFO)).thenReturn(70L);
        when(systemLogRepository.countByLevel(LogLevel.WARN)).thenReturn(10L);
        when(systemLogRepository.countByLevel(LogLevel.ERROR)).thenReturn(20L);
        when(systemLogRepository.getAverageExecutionTime()).thenReturn(85.5);
        when(systemLogRepository.countLogsByModule()).thenReturn(List.<Object[]>of(
                new Object[]{"ASSESSMENT", 60L},
                new Object[]{"IAM", 40L}
        ));

        var stats = systemLogService.getLogStats();
        assertNotNull(stats);
        assertEquals(100L, stats.getTotalLogs());
        assertEquals(80L, stats.getSuccessCount());
        assertEquals(20L, stats.getFailureCount());
        assertEquals(20.0, stats.getErrorRate());
        assertEquals(85.5, stats.getAverageExecutionTimeMs());
        assertEquals(60L, stats.getModuleCounts().get("ASSESSMENT"));
    }

    @Test
    @DisplayName("getLogMetadata: returns distinct modules and actions")
    void getLogMetadata_Success() {
        when(systemLogRepository.findDistinctModules()).thenReturn(List.of("ASSESSMENT", "IAM"));
        when(systemLogRepository.findDistinctActions()).thenReturn(List.of("LOGIN", "CREATE_EXAM"));

        var metadata = systemLogService.getLogMetadata();
        assertNotNull(metadata);
        assertEquals(2, metadata.getModules().size());
        assertEquals(2, metadata.getActions().size());
    }

    @Test
    @DisplayName("cleanupOldLogs: deletes logs before cutoff date")
    void cleanupOldLogs_Success() {
        when(systemLogRepository.deleteByCreatedAtBefore(any())).thenReturn(25L);

        long deleted = systemLogService.cleanupOldLogs(30);
        assertEquals(25L, deleted);
        verify(systemLogRepository).deleteByCreatedAtBefore(any());
    }
}

