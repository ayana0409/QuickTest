package com.quicktest.modules.proctoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quicktest.core.notify.QuickNotifyDispatcherService;
import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import com.quicktest.modules.proctoring.dto.ViolationReportMessage;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.service.RedisProctoringService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RedisProctoringServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private ListOperations<String, String> listOperations;

    @Mock
    private QuickNotifyDispatcherService quickNotifyDispatcher;

    private ObjectMapper objectMapper;
    private RedisProctoringService service;

    private UUID attemptId;
    private UUID examId;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        service = new RedisProctoringService(redisTemplate, quickNotifyDispatcher, objectMapper);
        attemptId = UUID.randomUUID();
        examId = UUID.randomUUID();
    }

    @Test
    @DisplayName("Should increment violation count and append log into Redis list")
    void recordViolation_IncrementCountAndAppendLog() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisTemplate.opsForList()).thenReturn(listOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.increment(anyString())).thenReturn(2L);

        ViolationReportMessage report = ViolationReportMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.TAB_SWITCH)
                .description("Candidate switched tab")
                .build();

        ViolationAlertMessage alert = service.recordViolationInMemory(
                attemptId, examId, 5, Duration.ofMinutes(45), report);

        assertThat(alert).isNotNull();
        assertThat(alert.getViolationCount()).isEqualTo(2);
        assertThat(alert.getDisqualified()).isFalse();

        verify(valueOperations).increment("quicktest:attempt:" + attemptId + ":violation_count");
        verify(listOperations).rightPush(eq("quicktest:attempt:" + attemptId + ":violation_logs"), anyString());
        verify(quickNotifyDispatcher).dispatchViolationAlert(eq(attemptId), eq(examId), any(ViolationAlertMessage.class));
        verify(valueOperations, never()).set(eq("quicktest:attempt:" + attemptId + ":status"), eq("DISQUALIFIED"), any(Duration.class));
    }

    @Test
    @DisplayName("Should mark attempt as DISQUALIFIED in Redis when violation count reaches maxAllowed")
    void recordViolation_ExceedsThreshold_MarksDisqualified() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisTemplate.opsForList()).thenReturn(listOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.increment(anyString())).thenReturn(3L);

        ViolationReportMessage report = ViolationReportMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.DEVTOOLS_OPEN)
                .description("Opened developer tools")
                .build();

        ViolationAlertMessage alert = service.recordViolationInMemory(
                attemptId, examId, 3, Duration.ofMinutes(45), report);

        assertThat(alert).isNotNull();
        assertThat(alert.getViolationCount()).isEqualTo(3);
        assertThat(alert.getDisqualified()).isTrue();

        verify(valueOperations).set(eq("quicktest:attempt:" + attemptId + ":status"), eq("DISQUALIFIED"), any(Duration.class));
        verify(quickNotifyDispatcher).dispatchViolationAlert(eq(attemptId), eq(examId), any(ViolationAlertMessage.class));
    }

    @Test
    @DisplayName("Should short-circuit when candidate has already been disqualified in Redis")
    void recordViolation_AlreadyDisqualified_ShortCircuits() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("quicktest:attempt:" + attemptId + ":status")).thenReturn("DISQUALIFIED");

        ViolationReportMessage report = ViolationReportMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.TAB_SWITCH)
                .build();

        ViolationAlertMessage alert = service.recordViolationInMemory(
                attemptId, examId, 3, Duration.ofMinutes(45), report);

        assertThat(alert).isNotNull();
        assertThat(alert.getDisqualified()).isTrue();
        verify(valueOperations, never()).increment(anyString());
        verifyNoInteractions(quickNotifyDispatcher);
    }
}
