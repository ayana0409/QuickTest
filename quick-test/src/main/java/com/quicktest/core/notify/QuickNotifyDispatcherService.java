package com.quicktest.core.notify;

import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Asynchronous dispatcher transmitting real-time proctoring and exam lifecycle events
 * to the QuickNotify Go WebSocket Hub via its HTTP inbound endpoint (/api/v1/notify).
 * Strictly conforms to the QuickNotify JSON Envelope specification.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuickNotifyDispatcherService {

    private static final String PROJECT_ID = "quicktest";
    private static final String CHANNEL_WEBSOCKET = "websocket";
    private static final String SCOPE_USER = "user";
    private static final String CONTENT_TYPE_RAW = "raw";

    @Value("${quicknotify.base-url:http://localhost:8080}")
    private String quickNotifyBaseUrl;

    @Value("${quicknotify.api-key:${QUICKNOTIFY_API_KEY:}}")
    private String quickNotifyApiKey;

    private final RestTemplate restTemplate;

    /**
     * Asynchronously dispatches a candidate violation alert to both the candidate channel
     * and the teacher proctoring monitor channel.
     * Non-blocking: executed on the dedicated 'quickNotifyExecutor' thread pool.
     */
    @Async("quickNotifyExecutor")
    public void dispatchViolationAlert(UUID attemptId, UUID examId, ViolationAlertMessage alert) {
        String alertMessageText = alert.getMessage() != null ? alert.getMessage() : "Cảnh báo vi phạm quy chế thi";

        // 1. Dispatch alert directly to candidate's personal attempt channel
        Map<String, Object> candidateData = new HashMap<>();
        candidateData.put("message", alertMessageText);
        candidateData.put("eventType", "VIOLATION_ALERT");
        candidateData.put("attemptId", attemptId.toString());
        candidateData.put("violationType", alert.getViolationType() != null ? alert.getViolationType().name() : null);
        candidateData.put("violationCount", alert.getViolationCount());
        candidateData.put("maxAllowed", alert.getMaxAllowed());
        candidateData.put("remainingAllowed", alert.getRemainingAllowed());
        candidateData.put("disqualified", Boolean.TRUE.equals(alert.getDisqualified()));
        candidateData.put("timestamp", alert.getTimestamp() != null ? alert.getTimestamp().toString() : null);

        sendNotifyEnvelope("att_" + attemptId, "high", candidateData);

        // 2. Broadcast violation event to teacher monitoring channel for this exam
        Map<String, Object> teacherData = new HashMap<>();
        teacherData.put("message", String.format("Thí sinh bài thi %s vi phạm: %s", attemptId, alertMessageText));
        teacherData.put("eventType", "CANDIDATE_VIOLATION");
        teacherData.put("attemptId", attemptId.toString());
        teacherData.put("examId", examId.toString());
        teacherData.put("violationType", alert.getViolationType() != null ? alert.getViolationType().name() : null);
        teacherData.put("violationCount", alert.getViolationCount());
        teacherData.put("disqualified", Boolean.TRUE.equals(alert.getDisqualified()));
        teacherData.put("timestamp", alert.getTimestamp() != null ? alert.getTimestamp().toString() : null);

        sendNotifyEnvelope("exam_monitor_" + examId, "high", teacherData);
    }

    /**
     * Broadcasts an exam lifecycle event (e.g. EXAM_CLOSED, AUTO_SUBMIT) to all candidates in an exam.
     */
    @Async("quickNotifyExecutor")
    public void dispatchExamLifecycleEvent(UUID examId, String eventType, String action, String reason, String message) {
        Map<String, Object> data = new HashMap<>();
        data.put("message", message != null ? message : "Thông báo kỳ thi");
        data.put("eventType", eventType);
        data.put("action", action);
        data.put("examId", examId.toString());
        data.put("reason", reason);

        sendNotifyEnvelope("exam_monitor_" + examId, "high", data);
    }

    /**
     * Asynchronously dispatches a session eviction signal when a candidate opens the exam
     * on another device, browser, or tab, kicking out the previous session immediately.
     */
    @Async("quickNotifyExecutor")
    public void dispatchSessionEvicted(
            UUID attemptId,
            UUID examId,
            String evictedSessionToken,
            String activeSessionToken,
            String newIpAddress) {

        String evictionMessage = "Bài thi của bạn vừa được mở trên một thiết bị hoặc trình duyệt khác. Để bảo đảm tính bảo mật và công bằng, phiên làm bài tại đây đã dừng lại.";

        Map<String, Object> candidateData = new HashMap<>();
        candidateData.put("eventType", "SESSION_EVICTED");
        candidateData.put("attemptId", attemptId.toString());
        candidateData.put("examId", examId != null ? examId.toString() : null);
        candidateData.put("evictedSessionToken", evictedSessionToken);
        candidateData.put("activeSessionToken", activeSessionToken);
        candidateData.put("newIpAddress", newIpAddress);
        candidateData.put("message", evictionMessage);

        sendNotifyEnvelope("att_" + attemptId, "high", candidateData);

        if (examId != null) {
            Map<String, Object> teacherData = new HashMap<>();
            teacherData.put("eventType", "SESSION_EVICTED");
            teacherData.put("attemptId", attemptId.toString());
            teacherData.put("examId", examId.toString());
            teacherData.put("newIpAddress", newIpAddress);
            teacherData.put("message", String.format("Thí sinh bài thi %s vừa chuyển sang làm bài trên thiết bị hoặc trình duyệt khác (IP: %s)", attemptId, newIpAddress));

            sendNotifyEnvelope("exam_monitor_" + examId, "normal", teacherData);
        }
    }

    /**
     * Constructs and posts a standard QuickNotify JSON Envelope to /api/v1/notify.
     */
    private void sendNotifyEnvelope(String targetUserId, String priority, Map<String, Object> contentData) {
        try {
            String eventId = "evt_" + UUID.randomUUID().toString().replace("-", "");
            String endpoint = quickNotifyBaseUrl + "/api/v1/notify";

            Map<String, Object> envelope = new HashMap<>();
            envelope.put("event_id", eventId);
            envelope.put("project_id", PROJECT_ID);
            envelope.put("scope", SCOPE_USER);
            envelope.put("priority", priority);
            envelope.put("channels", List.of(CHANNEL_WEBSOCKET));
            envelope.put("target", Map.of("user_id", targetUserId));
            envelope.put("content", Map.of(
                    "type", CONTENT_TYPE_RAW,
                    "data", contentData
            ));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (quickNotifyApiKey != null && !quickNotifyApiKey.isBlank()) {
                headers.set("X-API-Key", quickNotifyApiKey);
            }

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(envelope, headers);
            restTemplate.postForEntity(endpoint, requestEntity, String.class);

            log.debug("Dispatched QuickNotify event {} to user_id: {}", eventId, targetUserId);
        } catch (Exception ex) {
            // Non-blocking fire-and-forget: failure to push WebSocket notification must never break business flow
            log.warn("Failed to dispatch QuickNotify event to target {}: {}", targetUserId, ex.getMessage());
        }
    }
}

