package com.quicktest.modules.proctoring.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.proctoring.dto.ViolationDetailResponse;
import com.quicktest.modules.proctoring.dto.ViolationItemRedisDto;
import com.quicktest.modules.proctoring.dto.ViolationLogResponse;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Tiered violation query service:
 * - Active attempts (IN_PROGRESS)       -> reads directly from Redis (sub-millisecond, zero DB I/O).
 * - Finalized attempts (SUBMITTED/etc.) -> reads persisted records from PostgreSQL.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProctoringQueryService {

    private final ExamAttemptRepository examAttemptRepository;
    private final ViolationLogRepository violationLogRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Retrieve detailed violation history for an attempt.
     * Automatically switches between Redis (live) and PostgreSQL (finalized).
     */
    @Transactional(readOnly = true)
    public ViolationDetailResponse getAttemptViolations(UUID attemptId) {
        ExamAttempt attempt = examAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        return attempt.getStatus() == AttemptStatus.IN_PROGRESS
                ? fetchFromRedis(attempt)
                : fetchFromDatabase(attempt);
    }

    /**
     * Retrieve detailed violation history with teacher ownership authorization.
     */
    @Transactional(readOnly = true)
    public ViolationDetailResponse getAttemptViolationsForTeacher(UUID attemptId, User currentTeacher) {
        ExamAttempt attempt = examAttemptRepository.findByIdWithExam(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyExamOwnership(attempt.getExam(), currentTeacher);

        return attempt.getStatus() == AttemptStatus.IN_PROGRESS
                ? fetchFromRedis(attempt)
                : fetchFromDatabase(attempt);
    }

    /**
     * Backward-compatible audit log format for existing teacher proctoring dashboard.
     * Returns List<ViolationLogResponse>, dynamically mapped from Redis if IN_PROGRESS,
     * or queried from PostgreSQL if finalized.
     */
    @Transactional(readOnly = true)
    public List<ViolationLogResponse> getAttemptViolationLogs(UUID attemptId, User currentTeacher) {
        ExamAttempt attempt = examAttemptRepository.findByIdWithExam(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyExamOwnership(attempt.getExam(), currentTeacher);

        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            String logsKey = String.format(RedisProctoringService.KEY_VIOLATION_LOGS, attemptId);
            List<String> rawLogs = redisTemplate.opsForList().range(logsKey, 0, -1);
            List<ViolationLogResponse> responses = new ArrayList<>();

            if (rawLogs != null) {
                for (String raw : rawLogs) {
                    try {
                        ViolationItemRedisDto dto = objectMapper.readValue(raw, ViolationItemRedisDto.class);
                        responses.add(ViolationLogResponse.builder()
                                .id(null)
                                .attemptId(attemptId)
                                .violationType(dto.getViolationType())
                                .description(dto.getDescription())
                                .evidenceUrl(dto.getEvidenceUrl())
                                .timestamp(dto.getTimestamp())
                                .build());
                    } catch (Exception ex) {
                        log.warn("Corrupted Redis violation entry for attemptId: {}", attemptId, ex);
                    }
                }
            }
            return responses;
        }

        // Finalized attempt: query PostgreSQL
        List<ViolationLog> dbLogs = violationLogRepository.findByExamAttemptIdOrderByTimestampAsc(attemptId);
        List<ViolationLogResponse> responses = new ArrayList<>(dbLogs.size());
        for (ViolationLog v : dbLogs) {
            responses.add(ViolationLogResponse.builder()
                    .id(v.getId())
                    .attemptId(attemptId)
                    .violationType(v.getViolationType())
                    .description(v.getDescription())
                    .evidenceUrl(v.getEvidenceUrl())
                    .timestamp(v.getTimestamp())
                    .build());
        }
        return responses;
    }

    // ─────────────────────────────────────────────────────────────
    // Internal Helper Methods
    // ─────────────────────────────────────────────────────────────

    private ViolationDetailResponse fetchFromRedis(ExamAttempt attempt) {
        UUID attemptId = attempt.getId();
        String countKey = String.format(RedisProctoringService.KEY_VIOLATION_COUNT, attemptId);
        String logsKey = String.format(RedisProctoringService.KEY_VIOLATION_LOGS, attemptId);

        String countStr = redisTemplate.opsForValue().get(countKey);
        int count = countStr != null ? Integer.parseInt(countStr) : 0;

        List<String> rawLogs = redisTemplate.opsForList().range(logsKey, 0, -1);
        List<ViolationItemRedisDto> items = new ArrayList<>();

        if (rawLogs != null) {
            for (String raw : rawLogs) {
                try {
                    items.add(objectMapper.readValue(raw, ViolationItemRedisDto.class));
                } catch (Exception ex) {
                    log.warn("Failed to deserialize Redis violation item for attemptId: {}", attemptId, ex);
                }
            }
        }

        log.debug("Serving live violation telemetry from Redis for attemptId: {}, count: {}", attemptId, count);

        return ViolationDetailResponse.builder()
                .attemptId(attemptId)
                .source("REDIS_LIVE")
                .violationCount(count)
                .status(attempt.getStatus())
                .violations(items)
                .build();
    }

    private ViolationDetailResponse fetchFromDatabase(ExamAttempt attempt) {
        List<ViolationLog> dbLogs = violationLogRepository.findByExamAttemptIdOrderByTimestampAsc(attempt.getId());

        List<ViolationItemRedisDto> items = dbLogs.stream()
                .map(v -> ViolationItemRedisDto.builder()
                        .violationType(v.getViolationType())
                        .description(v.getDescription())
                        .evidenceUrl(v.getEvidenceUrl())
                        .timestamp(v.getTimestamp())
                        .build())
                .toList();

        log.debug("Serving historical violation records from PostgreSQL for attemptId: {}", attempt.getId());

        return ViolationDetailResponse.builder()
                .attemptId(attempt.getId())
                .source("POSTGRESQL_FINAL")
                .violationCount(attempt.getViolationCount() != null ? attempt.getViolationCount() : dbLogs.size())
                .status(attempt.getStatus())
                .violations(items)
                .build();
    }

    private void verifyExamOwnership(Exam exam, User teacher) {
        if (teacher == null) {
            throw new AccessDeniedException("Authentication required to access exam proctoring");
        }
        if (teacher.getRole() == Role.ADMIN) {
            return;
        }
        if (exam.getCreatedBy() == null || !exam.getCreatedBy().getId().equals(teacher.getId())) {
            throw new AccessDeniedException("You are not authorized to monitor this exam");
        }
    }
}

