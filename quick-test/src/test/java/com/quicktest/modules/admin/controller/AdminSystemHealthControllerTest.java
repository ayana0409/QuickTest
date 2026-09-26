package com.quicktest.modules.admin.controller;

import com.quicktest.modules.admin.dto.SystemHealthResponse;
import com.quicktest.modules.admin.dto.SystemHealthResponse.Components;
import com.quicktest.modules.admin.dto.SystemHealthResponse.CpuMetrics;
import com.quicktest.modules.admin.dto.SystemHealthResponse.DatabaseHealth;
import com.quicktest.modules.admin.dto.SystemHealthResponse.DiskMetrics;
import com.quicktest.modules.admin.dto.SystemHealthResponse.QueueInfo;
import com.quicktest.modules.admin.dto.SystemHealthResponse.RabbitMqHealth;
import com.quicktest.modules.admin.dto.SystemHealthResponse.RamMetrics;
import com.quicktest.modules.admin.dto.SystemHealthResponse.RedisHealth;
import com.quicktest.modules.admin.dto.SystemHealthResponse.SystemMetrics;
import com.quicktest.modules.admin.service.AdminSystemHealthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminSystemHealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminSystemHealthService adminSystemHealthService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void testGetSystemHealthSuccess() throws Exception {
        SystemHealthResponse mockResponse = SystemHealthResponse.builder()
                .status("UP")
                .components(Components.builder()
                        .database(DatabaseHealth.builder().status("UP").latencyMs(10L).build())
                        .redis(RedisHealth.builder().status("UP").latencyMs(5L).usedMemoryHuman("100MB").totalKeys(50L).build())
                        .rabbitmq(RabbitMqHealth.builder().status("UP").latencyMs(15L)
                                .queues(List.of(QueueInfo.builder().name("exam.submission.queue").messageCount(0L).build()))
                                .build())
                        .build())
                .system(SystemMetrics.builder()
                        .cpu(CpuMetrics.builder().usagePercent(10.5).build())
                        .ram(RamMetrics.builder().total(16000L).used(8000L).usagePercent(50.0).build())
                        .disk(DiskMetrics.builder().total(500000L).free(250000L).usagePercent(50.0).build())
                        .build())
                .timestamp(Instant.now().toString())
                .build();

        given(adminSystemHealthService.getSystemHealth()).willReturn(mockResponse);

        mockMvc.perform(get("/api/v1/admin/system/health")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components.database.latencyMs").value(10))
                .andExpect(jsonPath("$.components.redis.usedMemoryHuman").value("100MB"))
                .andExpect(jsonPath("$.components.rabbitmq.queues[0].name").value("exam.submission.queue"))
                .andExpect(jsonPath("$.system.cpu.usagePercent").value(10.5))
                .andExpect(jsonPath("$.system.ram.usagePercent").value(50.0));
    }
}
