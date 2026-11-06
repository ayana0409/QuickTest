package com.quicktest.modules.proctoring.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.notify.QuickNotifyDispatcherService;
import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import com.quicktest.modules.proctoring.dto.ViolationItemRedisDto;
import com.quicktest.modules.proctoring.dto.ViolationReportMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * High-performance in-memory proctoring telemetry service.
 * Operates purely on Redis (sub-millisecond latency) with zero database transactions
 * during active exam sessions, eliminating HikariCP connection pool contention.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RedisProctoringService {

    public static final String KEY_VIOLATION_COUNT = "quicktest:attempt:%s:violation_count";
    public static final String KEY_VIOLATION_LOGS = "quicktest:attempt:%s:violation_logs";
    public static final String KEY_ATTEMPT_STATUS = "quicktest:attempt:%s:status";

    private final StringRedisTemplate redisTemplate;
    private final QuickNotifyDispatcherService quickNotifyDispatcher;
    private final ObjectMapper objectMapper;

    /**
     * Records candidate telemetry violations purely in Redis.
     * Atomically increments counters, buffers event details, evaluates disqualification thresholds,
     * and triggers asynchronous real-time dispatching to QuickNotify.
     *
     * @param attemptId             Target exam attempt identifier
     * @param examId                Parent exam identifier for proctor channel dispatching
     * @param maxAllowedViolations  Maximum allowed infractions before automatic disqualification
     * @param examRemainingDuration Remaining exam duration used to calculate Redis TTL (+4h buffer)
     * @param report                Incoming violation telemetry payload
     * @return Generated real-time alert message
     */
    public ViolationAlertMessage recordViolationInMemory(
            UUID attemptId,
            UUID examId,
            int maxAllowedViolations,
            Duration examRemainingDuration,
            ViolationReportMessage report) {

        Duration keyTtl = (examRemainingDuration != null && !examRemainingDuration.isNegative())
                ? examRemainingDuration.plusHours(4)
                : Duration.ofHours(4);

        String countKey = String.format(KEY_VIOLATION_COUNT, attemptId);
        String logsKey = String.format(KEY_VIOLATION_LOGS, attemptId);
        String statusKey = String.format(KEY_ATTEMPT_STATUS, attemptId);

        // 1. Short-circuit if candidate has already been disqualified
        String currentStatus = redisTemplate.opsForValue().get(statusKey);
        if ("DISQUALIFIED".equalsIgnoreCase(currentStatus)) {
            log.debug("Attempt {} is already DISQUALIFIED. Rejecting further violation ingestion.", attemptId);
            return ViolationAlertMessage.builder()
                    .attemptId(attemptId)
                    .violationType(report.getViolationType())
                    .violationCount(maxAllowedViolations)
                    .maxAllowed(maxAllowedViolations)
                    .remainingAllowed(0)
                    .disqualified(true)
                    .message("Thí sinh đã bị đình chỉ thi do vi phạm quy chế.")
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        // 2. Atomically increment violation counter in Redis
        Long countLong = redisTemplate.opsForValue().increment(countKey);
        redisTemplate.expire(countKey, keyTtl);
        int currentCount = countLong != null ? countLong.intValue() : 1;

        // 3. Serialize and push violation record to Redis List
        String description = (report.getDescription() != null && !report.getDescription().isBlank())
                ? report.getDescription().trim()
                : "Vi phạm phát hiện: " + report.getViolationType().name();

        ViolationItemRedisDto logItem = ViolationItemRedisDto.builder()
                .violationType(report.getViolationType())
                .description(description)
                .timestamp(LocalDateTime.now())
                .build();

        try {
            String jsonPayload = objectMapper.writeValueAsString(logItem);
            redisTemplate.opsForList().rightPush(logsKey, jsonPayload);
            redisTemplate.expire(logsKey, keyTtl);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize violation item for attemptId: {}", attemptId, e);
        }

        // 4. Threshold evaluation for automatic disqualification
        boolean isDisqualified = currentCount >= maxAllowedViolations;
        if (isDisqualified) {
            log.warn("Attempt {} reached violation threshold ({}/{}). Setting DISQUALIFIED in Redis.",
                    attemptId, currentCount, maxAllowedViolations);
            redisTemplate.opsForValue().set(statusKey, "DISQUALIFIED", keyTtl);
        }

        int remaining = Math.max(0, maxAllowedViolations - currentCount);
        String alertText = isDisqualified
                ? String.format("Đình chỉ thi! Đã vượt quá giới hạn vi phạm (%d/%d).", currentCount, maxAllowedViolations)
                : String.format("Cảnh báo vi phạm [%s]: Số lần %d/%d. Còn lại: %d.",
                        report.getViolationType().name(), currentCount, maxAllowedViolations, remaining);

        ViolationAlertMessage alert = ViolationAlertMessage.builder()
                .attemptId(attemptId)
                .violationType(report.getViolationType())
                .violationCount(currentCount)
                .maxAllowed(maxAllowedViolations)
                .remainingAllowed(remaining)
                .disqualified(isDisqualified)
                .message(alertText)
                .timestamp(LocalDateTime.now())
                .build();

        // 5. Fire-and-forget real-time notification dispatch via QuickNotify
        quickNotifyDispatcher.dispatchViolationAlert(attemptId, examId, alert);

        return alert;
    }
}

