package com.quicktest.core.notify;

import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import com.quicktest.modules.proctoring.entity.ViolationType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuickNotifyDispatcherServiceTest {

    @Mock
    private RestTemplate restTemplate;

    private QuickNotifyDispatcherService dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new QuickNotifyDispatcherService(restTemplate);
        ReflectionTestUtils.setField(dispatcher, "quickNotifyBaseUrl", "http://localhost:8085");
        ReflectionTestUtils.setField(dispatcher, "quickNotifyApiKey", "test-api-key-12345");
    }

    @Test
    @DisplayName("Should dispatch violation alert with X-API-Key header to QuickNotify hub")
    void dispatchViolationAlert_AttachesApiKeyHeader() {
        UUID attemptId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();

        ViolationAlertMessage alert = ViolationAlertMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.TAB_SWITCH)
                .violationCount(2)
                .maxAllowed(5)
                .remainingAllowed(3)
                .disqualified(false)
                .message("Cảnh báo vi phạm [TAB_SWITCH]")
                .timestamp(LocalDateTime.now())
                .build();

        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("OK"));

        dispatcher.dispatchViolationAlert(attemptId, examId, alert);

        ArgumentCaptor<HttpEntity> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, times(2)).postForEntity(
                eq("http://localhost:8085/api/v1/notify"),
                captor.capture(),
                eq(String.class)
        );

        HttpEntity firstRequest = captor.getAllValues().get(0);
        HttpHeaders headers = firstRequest.getHeaders();
        assertThat(headers.getFirst("X-API-Key")).isEqualTo("test-api-key-12345");
        assertThat(headers.getContentType().toString()).contains("application/json");
    }

    @Test
    @DisplayName("Should gracefully handle QuickNotify downtime without throwing exception (Fire-and-forget)")
    void dispatchViolationAlert_GracefulHandlingWhenQuickNotifyIsDown() {
        UUID attemptId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();

        ViolationAlertMessage alert = ViolationAlertMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.DEVTOOLS_OPEN)
                .violationCount(1)
                .message("Test Alert")
                .timestamp(LocalDateTime.now())
                .build();

        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RestClientException("Connection refused: QuickNotify is offline"));

        assertThatCode(() -> dispatcher.dispatchViolationAlert(attemptId, examId, alert))
                .doesNotThrowAnyException();
    }
}
