package com.quicktest.modules.proctoring.service;

import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.logging.AuditLog;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.proctoring.dto.*;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation managing real-time candidate proctoring, telemetry tracking,
 * atomic Redis counters, asynchronous violation logging, threshold auto-disqualification,
 * and teacher monitoring broadcasts.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ProctoringServiceImpl implements ProctoringService {

    private static final int DEFAULT_MAX_VIOLATIONS = 5;
    private static final Duration REDIS_KEY_TTL = Duration.ofHours(24);
    private static final Duration HEARTBEAT_TTL = Duration.ofSeconds(120);

    private static final String KEY_VIOLATIONS_COUNT = "proctoring:attempt:%s:count";
    private static final String KEY_VIOLATIONS_TYPE = "proctoring:attempt:%s:type:%s";
    private static final String KEY_HEARTBEAT = "proctoring:attempt:%s:heartbeat";

    private final ExamRepository examRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final ViolationLogRepository violationLogRepository;
    private final StringRedisTemplate stringRedisTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    @Override
    @Transactional
    public ViolationAlertMessage recordViolation(UUID attemptId, ViolationReportMessage report, UUID authenticatedUserId) {
        log.info("Recording proctoring violation for attemptId: {}, type: {}, userId: {}",
                attemptId, report.getViolationType(), authenticatedUserId);

        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        // If user is authenticated, ensure candidate owns this attempt
        if (authenticatedUserId != null && attempt.getUser() != null
                && !attempt.getUser().getId().equals(authenticatedUserId)) {
            throw new AccessDeniedException("You are not authorized to submit telemetry for this attempt");
        }

        // Only record violations if attempt is actively in progress
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            log.warn("Attempt {} is not IN_PROGRESS (status: {}). Rejecting violation recording.",
                    attemptId, attempt.getStatus());
            throw new AppException("Cannot report violations for an exam attempt that is not IN_PROGRESS", HttpStatus.BAD_REQUEST);
        }

        Exam exam = attempt.getExam();
        boolean isProctoringEnabled = exam.getIsProctoringEnabled() != null && exam.getIsProctoringEnabled();
        int maxAllowed = (exam.getMaxViolations() != null && exam.getMaxViolations() > 0)
                ? exam.getMaxViolations()
                : DEFAULT_MAX_VIOLATIONS;

        // If proctoring is not enabled by the instructor, bypass violation recording
        if (!isProctoringEnabled) {
            log.info("Proctoring is disabled for exam {}. Ignoring violation for attempt {}.",
                    exam.getId(), attemptId);
            return ViolationAlertMessage.builder()
                    .attemptId(attemptId)
                    .violationType(report.getViolationType())
                    .violationCount(attempt.getViolationCount())
                    .maxAllowed(maxAllowed)
                    .remainingAllowed(maxAllowed)
                    .disqualified(false)
                    .message("Proctoring is disabled for this exam.")
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        // 1. Atomic Redis Counter increment
        String countKey = String.format(KEY_VIOLATIONS_COUNT, attemptId);
        Long redisCount = stringRedisTemplate.opsForValue().increment(countKey);
        stringRedisTemplate.expire(countKey, REDIS_KEY_TTL);

        String typeKey = String.format(KEY_VIOLATIONS_TYPE, attemptId, report.getViolationType().name());
        stringRedisTemplate.opsForValue().increment(typeKey);
        stringRedisTemplate.expire(typeKey, REDIS_KEY_TTL);

        int currentTotal = redisCount != null ? redisCount.intValue() : (attempt.getViolationCount() + 1);

        // 2. Persist audit log entry to database
        ViolationLog logEntry = ViolationLog.builder()
                .examAttempt(attempt)
                .violationType(report.getViolationType())
                .description(report.getDescription() != null && !report.getDescription().isBlank()
                        ? report.getDescription().trim()
                        : "Detected rule violation: " + report.getViolationType().name())
                .build();
        violationLogRepository.save(logEntry);

        // 3. Update attempt violation count in database
        attempt.setViolationCount(currentTotal);

        // 4. Check threshold for automatic disqualification
        boolean isDisqualified = currentTotal >= maxAllowed;
        if (isDisqualified) {
            log.warn("Attempt {} has exceeded violation threshold ({}/{}). Auto-disqualifying candidate.",
                    attemptId, currentTotal, maxAllowed);
            attempt.setStatus(AttemptStatus.DISQUALIFIED);
        }
        examAttemptRepository.save(attempt);

        int remaining = Math.max(0, maxAllowed - currentTotal);
        String alertText = isDisqualified
                ? String.format("Candidate disqualified! Violation limit exceeded (%d/%d).", currentTotal, maxAllowed)
                : String.format("Violation detected: %s. Total violations: %d/%d. Remaining warnings: %d.",
                        report.getViolationType().name(), currentTotal, maxAllowed, remaining);

        // 5. Construct alert message
        ViolationAlertMessage alertMessage = ViolationAlertMessage.builder()
                .attemptId(attemptId)
                .violationType(report.getViolationType())
                .violationCount(currentTotal)
                .maxAllowed(maxAllowed)
                .remainingAllowed(remaining)
                .disqualified(isDisqualified)
                .message(alertText)
                .timestamp(LocalDateTime.now())
                .build();

        // 6. Push real-time alert to candidate channel
        broadcastToCandidate(attempt, alertMessage);

        // 7. Push real-time event to teacher monitoring channel
        CandidateViolationEvent teacherEvent = CandidateViolationEvent.builder()
                .attemptId(attemptId)
                .examId(attempt.getExam().getId())
                .candidateName(resolveCandidateName(attempt))
                .candidateIdentifier(resolveCandidateIdentifier(attempt))
                .violationType(report.getViolationType())
                .violationCount(currentTotal)
                .description(logEntry.getDescription())
                .disqualified(isDisqualified)
                .timestamp(LocalDateTime.now())
                .build();

        broadcastToTeacher(attempt.getExam().getId(), teacherEvent);

        return alertMessage;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttemptMonitorResponse> getExamMonitoring(
            UUID examId,
            AttemptStatus status,
            String search,
            Pageable pageable,
            User currentTeacher) {

        log.debug("Teacher {} querying proctoring monitoring for examId: {}, status: {}",
                currentTeacher.getId(), examId, status);

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));

        verifyExamOwnership(exam, currentTeacher);

        Page<ExamAttempt> attemptsPage;
        boolean hasSearch = search != null && !search.trim().isEmpty();

        if (hasSearch && status != null) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            attemptsPage = examAttemptRepository.searchAttemptsByExamIdAndStatus(examId, status, pattern, pageable);
        } else if (hasSearch) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            attemptsPage = examAttemptRepository.searchAttemptsByExamId(examId, pattern, pageable);
        } else if (status != null) {
            attemptsPage = examAttemptRepository.findByExamIdAndStatus(examId, status, pageable);
        } else {
            attemptsPage = examAttemptRepository.findByExamId(examId, pageable);
        }

        Page<AttemptMonitorResponse> responsePage = attemptsPage.map(ea -> AttemptMonitorResponse.builder()
                .attemptId(ea.getId())
                .examId(examId)
                .userId(ea.getUser() != null ? ea.getUser().getId() : null)
                .candidateName(resolveCandidateName(ea))
                .candidateIdentifier(resolveCandidateIdentifier(ea))
                .status(ea.getStatus())
                .violationCount(getEffectiveViolationCount(ea))
                .isDisqualified(ea.getStatus() == AttemptStatus.DISQUALIFIED)
                .startTime(ea.getStartTime())
                .expireAt(ea.getExpireAt())
                .submitTime(ea.getSubmitTime())
                .isOnline(isCandidateOnline(ea.getId()))
                .build());

        return PageResponse.from(responsePage);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ViolationLogResponse> getAttemptViolations(UUID attemptId, User currentTeacher) {
        log.debug("Teacher {} querying violations for attemptId: {}", currentTeacher.getId(), attemptId);

        ExamAttempt attempt = examAttemptRepository.findByIdWithExam(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyExamOwnership(attempt.getExam(), currentTeacher);

        List<ViolationLog> logs = violationLogRepository.findByExamAttemptIdOrderByTimestampAsc(attemptId);

        return logs.stream()
                .map(v -> ViolationLogResponse.builder()
                        .id(v.getId())
                        .attemptId(attemptId)
                        .violationType(v.getViolationType())
                        .description(v.getDescription())
                        .timestamp(v.getTimestamp())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public AttemptRealtimeStatusResponse getAttemptRealtimeStatus(UUID attemptId, User currentTeacher) {
        log.debug("Teacher {} querying realtime status for attemptId: {}", currentTeacher.getId(), attemptId);

        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyExamOwnership(attempt.getExam(), currentTeacher);

        int violationCount = getEffectiveViolationCount(attempt);
        boolean isOnline = isCandidateOnline(attemptId);

        // Aggregated breakdown of violation types
        Map<ViolationType, Long> breakdown = new EnumMap<>(ViolationType.class);
        List<Object[]> groupedCounts = violationLogRepository.countByViolationTypeGrouped(attemptId);
        for (Object[] row : groupedCounts) {
            ViolationType vType = (ViolationType) row[0];
            Long count = (Long) row[1];
            breakdown.put(vType, count);
        }

        // Top 10 most recent violations
        List<ViolationLog> recentLogs = violationLogRepository.findByExamAttemptIdOrderByTimestampDesc(attemptId);
        List<ViolationLogResponse> recentResponses = recentLogs.stream()
                .limit(10)
                .map(v -> ViolationLogResponse.builder()
                        .id(v.getId())
                        .attemptId(attemptId)
                        .violationType(v.getViolationType())
                        .description(v.getDescription())
                        .timestamp(v.getTimestamp())
                        .build())
                .collect(Collectors.toList());

        return AttemptRealtimeStatusResponse.builder()
                .attemptId(attemptId)
                .examId(attempt.getExam().getId())
                .candidateName(resolveCandidateName(attempt))
                .candidateIdentifier(resolveCandidateIdentifier(attempt))
                .status(attempt.getStatus())
                .violationCount(violationCount)
                .isDisqualified(attempt.getStatus() == AttemptStatus.DISQUALIFIED)
                .isOnline(isOnline)
                .lastHeartbeat(isOnline ? LocalDateTime.now() : null)
                .violationBreakdown(breakdown)
                .recentViolations(recentResponses)
                .build();
    }

    @Override
    @Transactional
    @AuditLog(module = "PROCTORING", action = "DISQUALIFY_ATTEMPT")
    public void disqualifyAttempt(UUID attemptId, String reason, User currentTeacher) {
        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyExamOwnership(attempt.getExam(), currentTeacher);

        if (attempt.getStatus() == AttemptStatus.DISQUALIFIED) {
            throw new AppException("Exam attempt is already disqualified", HttpStatus.BAD_REQUEST);
        }

        attempt.setStatus(AttemptStatus.DISQUALIFIED);

        String desc = "[TEACHER DISQUALIFICATION] " + (reason != null && !reason.isBlank()
                ? reason.trim()
                : "Manually disqualified by proctoring teacher");

        ViolationLog disqualificationLog = ViolationLog.builder()
                .examAttempt(attempt)
                .violationType(ViolationType.TEACHER_DISQUALIFY)
                .description(desc)
                .build();
        violationLogRepository.save(disqualificationLog);

        examAttemptRepository.save(attempt);

        int maxAllowed = (attempt.getExam().getMaxViolations() != null && attempt.getExam().getMaxViolations() > 0)
                ? attempt.getExam().getMaxViolations()
                : DEFAULT_MAX_VIOLATIONS;

        // Push alerts over WebSocket
        ViolationAlertMessage alert = ViolationAlertMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.TEACHER_DISQUALIFY)
                .violationCount(getEffectiveViolationCount(attempt))
                .maxAllowed(maxAllowed)
                .remainingAllowed(0)
                .disqualified(true)
                .message("You have been disqualified by the instructor: " + desc)
                .timestamp(LocalDateTime.now())
                .build();

        broadcastToCandidate(attempt, alert);

        CandidateViolationEvent teacherEvent = CandidateViolationEvent.builder()
                .attemptId(attemptId)
                .examId(attempt.getExam().getId())
                .candidateName(resolveCandidateName(attempt))
                .candidateIdentifier(resolveCandidateIdentifier(attempt))
                .violationType(ViolationType.TEACHER_DISQUALIFY)
                .violationCount(getEffectiveViolationCount(attempt))
                .description(desc)
                .disqualified(true)
                .timestamp(LocalDateTime.now())
                .build();

        broadcastToTeacher(attempt.getExam().getId(), teacherEvent);
    }

    @Override
    public void recordHeartbeat(UUID attemptId) {
        String key = String.format(KEY_HEARTBEAT, attemptId);
        stringRedisTemplate.opsForValue().set(key, String.valueOf(System.currentTimeMillis()), HEARTBEAT_TTL);
    }

    @Override
    public boolean isCandidateOnline(UUID attemptId) {
        String key = String.format(KEY_HEARTBEAT, attemptId);
        Boolean hasKey = stringRedisTemplate.hasKey(key);
        return Boolean.TRUE.equals(hasKey);
    }

    @Override
    public int getViolationCount(UUID attemptId) {
        String key = String.format(KEY_VIOLATIONS_COUNT, attemptId);
        String val = stringRedisTemplate.opsForValue().get(key);
        if (val != null) {
            try {
                return Integer.parseInt(val);
            } catch (NumberFormatException ignored) {}
        }
        return examAttemptRepository.findById(attemptId)
                .map(ExamAttempt::getViolationCount)
                .orElse(0);
    }

    private int getEffectiveViolationCount(ExamAttempt attempt) {
        String key = String.format(KEY_VIOLATIONS_COUNT, attempt.getId());
        String val = stringRedisTemplate.opsForValue().get(key);
        if (val != null) {
            try {
                return Integer.parseInt(val);
            } catch (NumberFormatException ignored) {}
        }
        return attempt.getViolationCount() != null ? attempt.getViolationCount() : 0;
    }

    private void broadcastToCandidate(ExamAttempt attempt, ViolationAlertMessage alertMessage) {
        try {
            messagingTemplate.convertAndSend("/topic/attempts/" + attempt.getId() + "/proctoring", alertMessage);
            if (attempt.getUser() != null) {
                messagingTemplate.convertAndSendToUser(
                        attempt.getUser().getId().toString(),
                        "/queue/proctoring/alert",
                        alertMessage
                );
            }
        } catch (Exception ex) {
            log.error("Failed to dispatch WebSocket alert to candidate attempt: {}", attempt.getId(), ex);
        }
    }

    private void broadcastToTeacher(UUID examId, CandidateViolationEvent teacherEvent) {
        try {
            messagingTemplate.convertAndSend("/topic/exams/" + examId + "/proctoring", teacherEvent);
        } catch (Exception ex) {
            log.error("Failed to dispatch WebSocket event to teacher room for exam: {}", examId, ex);
        }
    }

    private void verifyExamOwnership(Exam exam, User currentTeacher) {
        if (exam.getCreatedBy() == null || currentTeacher == null
                || !exam.getCreatedBy().getId().equals(currentTeacher.getId())) {
            throw new AccessDeniedException("You are not authorized to access proctoring information for this exam");
        }
    }

    private String resolveCandidateName(ExamAttempt ea) {
        if (ea.getUser() != null && ea.getUser().getFullName() != null) {
            return ea.getUser().getFullName();
        }
        if (ea.getGuestName() != null && !ea.getGuestName().isBlank()) {
            return ea.getGuestName().trim();
        }
        return "Anonymous Candidate";
    }

    private String resolveCandidateIdentifier(ExamAttempt ea) {
        if (ea.getUser() != null && ea.getUser().getEmail() != null) {
            return ea.getUser().getEmail();
        }
        if (ea.getGuestIdentifier() != null && !ea.getGuestIdentifier().isBlank()) {
            return ea.getGuestIdentifier().trim();
        }
        return null;
    }
}
