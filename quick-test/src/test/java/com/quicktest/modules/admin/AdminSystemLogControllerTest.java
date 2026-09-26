package com.quicktest.modules.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quicktest.core.logging.LogLevel;
import com.quicktest.core.logging.LogStatus;
import com.quicktest.core.logging.SystemLogService;
import com.quicktest.modules.admin.controller.AdminSystemLogController;
import com.quicktest.modules.admin.dto.AdminSystemLogDetailResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogMetadataResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogStatsResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminSystemLogControllerTest {

    @Mock
    private SystemLogService systemLogService;

    @InjectMocks
    private AdminSystemLogController adminSystemLogController;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(adminSystemLogController)
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    @DisplayName("GET /api/admin/logs - Should return paginated logs successfully")
    void searchLogs_success() throws Exception {
        UUID logId = UUID.randomUUID();
        AdminSystemLogResponse logResponse = AdminSystemLogResponse.builder()
                .id(logId)
                .level(LogLevel.INFO)
                .module("ASSESSMENT")
                .action("CREATE_EXAM")
                .status(LogStatus.SUCCESS)
                .actorUsername("teacher1")
                .endpoint("/api/v1/exams")
                .httpMethod("POST")
                .ipAddress("127.0.0.1")
                .executionTimeMs(45L)
                .createdAt(LocalDateTime.now())
                .hasDetails(true)
                .build();

        Page<AdminSystemLogResponse> page = new PageImpl<>(List.of(logResponse), PageRequest.of(0, 20), 1);

        when(systemLogService.searchLogs(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(page);

        mockMvc.perform(get("/api/admin/logs")
                        .param("search", "exam")
                        .param("level", "INFO")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.content[0].id").value(logId.toString()))
                .andExpect(jsonPath("$.data.content[0].module").value("ASSESSMENT"))
                .andExpect(jsonPath("$.data.content[0].action").value("CREATE_EXAM"))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    @DisplayName("GET /api/admin/logs/{id} - Should return full detail of a specific log")
    void getLogDetail_success() throws Exception {
        UUID logId = UUID.randomUUID();
        AdminSystemLogDetailResponse detail = AdminSystemLogDetailResponse.builder()
                .id(logId)
                .level(LogLevel.ERROR)
                .module("PROCTORING")
                .action("ANOMALY_DETECTED")
                .status(LogStatus.FAILURE)
                .details("{\"suspicionScore\": 0.95}")
                .errorMessage("Multiple faces detected")
                .executionTimeMs(120L)
                .createdAt(LocalDateTime.now())
                .build();

        when(systemLogService.getLogDetail(eq(logId))).thenReturn(detail);

        mockMvc.perform(get("/api/admin/logs/{id}", logId)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.id").value(logId.toString()))
                .andExpect(jsonPath("$.data.details").value("{\"suspicionScore\": 0.95}"))
                .andExpect(jsonPath("$.data.errorMessage").value("Multiple faces detected"));
    }

    @Test
    @DisplayName("GET /api/admin/logs/stats - Should return analytical metrics")
    void getStats_success() throws Exception {
        AdminSystemLogStatsResponse stats = AdminSystemLogStatsResponse.builder()
                .totalLogs(100L)
                .successCount(95L)
                .failureCount(5L)
                .errorRate(5.0)
                .infoCount(80L)
                .warnCount(15L)
                .errorCount(5L)
                .averageExecutionTimeMs(65.4)
                .moduleCounts(Map.of("ASSESSMENT", 50L, "IAM", 50L))
                .build();

        when(systemLogService.getLogStats()).thenReturn(stats);

        mockMvc.perform(get("/api/admin/logs/stats")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.totalLogs").value(100))
                .andExpect(jsonPath("$.data.errorRate").value(5.0))
                .andExpect(jsonPath("$.data.moduleCounts.ASSESSMENT").value(50));
    }

    @Test
    @DisplayName("GET /api/admin/logs/metadata - Should return distinct modules and actions")
    void getMetadata_success() throws Exception {
        AdminSystemLogMetadataResponse metadata = AdminSystemLogMetadataResponse.builder()
                .modules(List.of("ASSESSMENT", "IAM", "PROCTORING"))
                .actions(List.of("CREATE_EXAM", "LOGIN", "SUBMIT_ATTEMPT"))
                .build();

        when(systemLogService.getLogMetadata()).thenReturn(metadata);

        mockMvc.perform(get("/api/admin/logs/metadata")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.modules[0]").value("ASSESSMENT"))
                .andExpect(jsonPath("$.data.actions[0]").value("CREATE_EXAM"));
    }

    @Test
    @DisplayName("DELETE /api/admin/logs/cleanup - Should trigger retention cleanup")
    void cleanupOldLogs_success() throws Exception {
        when(systemLogService.cleanupOldLogs(eq(45))).thenReturn(150L);

        mockMvc.perform(delete("/api/admin/logs/cleanup")
                        .param("days", "45")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.deletedCount").value(150))
                .andExpect(jsonPath("$.data.retentionDaysKept").value(45));

        verify(systemLogService).cleanupOldLogs(eq(45));
    }
}
