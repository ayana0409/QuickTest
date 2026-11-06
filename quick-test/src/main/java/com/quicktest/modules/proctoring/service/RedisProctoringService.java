package com.quicktest.modules.proctoring.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.notify.QuickNotifyDispatcherService;
import com.quicktest.modules.proctoring.dto.AttemptSessionLockDto;
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
    public static final String KEY_SESSION_LOCK = "quicktest:attempt:%s:session_lock";
    public static final String KEY_VIOLATION_DEDUP = "quicktest:attempt:%s:violation_dedup";

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
        String dedupKey = String.format(KEY_VIOLATION_DEDUP, attemptId);

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

        // 1b. 2-second deduplication window to prevent a single Alt+Tab / Fullscreen exit from counting multiple times
        String recentViolation = redisTemplate.opsForValue().get(dedupKey);
        if (recentViolation != null) {
            String existingCountStr = redisTemplate.opsForValue().get(countKey);
            int existingCount = 1;
            if (existingCountStr != null) {
                try {
                    existingCount = Integer.parseInt(existingCountStr);
                } catch (NumberFormatException ignored) {}
            }
            int remaining = Math.max(0, maxAllowedViolations - existingCount);
            log.debug("Deduplicated burst violation for attempt {} (type={})", attemptId, report.getViolationType());
            return ViolationAlertMessage.builder()
                    .attemptId(attemptId)
                    .violationType(report.getViolationType())
                    .violationCount(existingCount)
                    .maxAllowed(maxAllowedViolations)
                    .remainingAllowed(remaining)
                    .disqualified(existingCount >= maxAllowedViolations)
                    .message(String.format("Cảnh báo vi phạm quy chế: Lần %d/%d.",
                            existingCount, maxAllowedViolations, remaining))
                    .timestamp(LocalDateTime.now())
                    .build();
        }
        redisTemplate.opsForValue().set(dedupKey, report.getViolationType().name(), Duration.ofSeconds(2));

        // 2. Atomically increment violation counter in Redis
        Long countLong = redisTemplate.opsForValue().increment(countKey);
        redisTemplate.expire(countKey, keyTtl);
        int currentCount = countLong != null ? countLong.intValue() : 1;

        // 3. Serialize and push violation record to Redis List
        String description = (report.getDescription() != null && !report.getDescription().isBlank())
                ? report.getDescription().trim()
                : "Vi phạm quy chế phòng thi: " + report.getViolationType().name();

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
                ? String.format("Bài thi đã bị đình chỉ do vượt quá số lần vi phạm cho phép (%d/%d).", currentCount, maxAllowedViolations)
                : String.format("Cảnh báo vi phạm quy chế: Lần %d/%d (Còn lại: %d lần nhắc nhở).",
                        currentCount, maxAllowedViolations, remaining);

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

    /**
     * Acquires or replaces the exclusive session lock for an exam attempt in Redis.
     * If a previous session with a different sessionToken was active, dispatches a real-time
     * SESSION_EVICTED signal to kick out the old browser/device immediately.
     *
     * @param attemptId         Target exam attempt identifier
     * @param examId            Parent exam identifier
     * @param sessionToken      Unique per-tab/browser session token generated by client
     * @param deviceFingerprint Browser/device fingerprint hash
     * @param ipAddress         Client IP address
     * @param userAgent         Client User-Agent string
     * @param remainingDuration Remaining duration of the exam attempt (used for Redis TTL)
     * @return The evicted AttemptSessionLockDto if a different session was replaced, or null
     */
    public AttemptSessionLockDto acquireOrReplaceSessionLock(
            UUID attemptId,
            UUID examId,
            String sessionToken,
            String deviceFingerprint,
            String ipAddress,
            String userAgent,
            Duration remainingDuration) {

        if (sessionToken == null || sessionToken.isBlank()) {
            return null;
        }

        String normalizedToken = sessionToken.trim();
        String lockKey = String.format(KEY_SESSION_LOCK, attemptId);

        Duration lockTtl = (remainingDuration != null && !remainingDuration.isNegative() && !remainingDuration.isZero())
                ? remainingDuration.plusSeconds(60)
                : Duration.ofMinutes(30);

        AttemptSessionLockDto previousLock = null;
        String existingJson = redisTemplate.opsForValue().get(lockKey);
        if (existingJson != null && !existingJson.isBlank()) {
            try {
                previousLock = objectMapper.readValue(existingJson, AttemptSessionLockDto.class);
            } catch (JsonProcessingException e) {
                log.warn("Failed to deserialize existing session lock for attemptId: {}", attemptId, e);
            }
        }

        AttemptSessionLockDto newLock = AttemptSessionLockDto.builder()
                .sessionToken(normalizedToken)
                .deviceFingerprint(deviceFingerprint)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .lockedAt(System.currentTimeMillis())
                .build();

        try {
            String newJson = objectMapper.writeValueAsString(newLock);
            redisTemplate.opsForValue().set(lockKey, newJson, lockTtl);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize session lock for attemptId: {}", attemptId, e);
        }

        // If a previous session existed with a DIFFERENT session token, evict the old session
        if (previousLock != null
                && previousLock.getSessionToken() != null
                && !previousLock.getSessionToken().equals(normalizedToken)) {
            log.warn("Session takeover detected for attemptId {}! Evicting old sessionToken={} (IP={}) in favor of new sessionToken={} (IP={})",
                    attemptId, previousLock.getSessionToken(), previousLock.getIpAddress(), normalizedToken, ipAddress);

            quickNotifyDispatcher.dispatchSessionEvicted(
                    attemptId,
                    examId,
                    previousLock.getSessionToken(),
                    normalizedToken,
                    ipAddress != null ? ipAddress : "UNKNOWN"
            );
            return previousLock;
        }

        return null;
    }

    /**
     * Validates that the incoming sessionToken matches the currently active session lock in Redis.
     *
     * @param attemptId    Target exam attempt identifier
     * @param sessionToken Incoming X-Exam-Session-Token header value
     * @return true if valid or no lock exists; false if another session has taken over
     */
    public boolean validateActiveSessionToken(UUID attemptId, String sessionToken) {
        String lockKey = String.format(KEY_SESSION_LOCK, attemptId);
        String existingJson = redisTemplate.opsForValue().get(lockKey);
        if (existingJson == null || existingJson.isBlank()) {
            return true;
        }

        try {
            AttemptSessionLockDto activeLock = objectMapper.readValue(existingJson, AttemptSessionLockDto.class);
            if (activeLock == null || activeLock.getSessionToken() == null || activeLock.getSessionToken().isBlank()) {
                return true;
            }
            if (sessionToken == null || sessionToken.isBlank()) {
                return false;
            }
            return activeLock.getSessionToken().equals(sessionToken.trim());
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse session lock in Redis for attemptId: {}", attemptId, e);
            return true;
        }
    }
}

