package com.quicktest.modules.proctoring.service;

import com.quicktest.core.common.PageResponse;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.proctoring.dto.*;
import com.quicktest.modules.session.entity.AttemptStatus;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

/**
 * Service interface defining real-time proctoring, telemetry tracking,
 * violation logging, threshold alerting, and candidate disqualification.
 */
public interface ProctoringService {

    /**
     * Record a telemetry violation reported from candidate client.
     * Updates Redis counters, persists audit log, checks threshold,
     * triggers auto-disqualification if exceeded, and pushes real-time alerts.
     */
    ViolationAlertMessage recordViolation(UUID attemptId, ViolationReportMessage report, UUID authenticatedUserId);

    /**
     * Retrieve paginated monitoring list of candidates for an exam.
     */
    PageResponse<AttemptMonitorResponse> getExamMonitoring(
            UUID examId,
            AttemptStatus status,
            String search,
            Pageable pageable,
            User currentTeacher
    );

    /**
     * Retrieve all violation logs for a specific attempt (audit trail).
     */
    List<ViolationLogResponse> getAttemptViolations(UUID attemptId, User currentTeacher);

    /**
     * Retrieve detailed real-time telemetry status of an attempt.
     */
    AttemptRealtimeStatusResponse getAttemptRealtimeStatus(UUID attemptId, User currentTeacher);

    /**
     * Manually force disqualify a candidate from an exam attempt.
     */
    void disqualifyAttempt(UUID attemptId, String reason, User currentTeacher);

    /**
     * Record client heartbeat in Redis cache to track active online presence.
     */
    void recordHeartbeat(UUID attemptId);

    /**
     * Check if a candidate attempt is currently active/online based on recent heartbeats.
     */
    boolean isCandidateOnline(UUID attemptId);

    /**
     * Query current violation count from Redis, falling back to database.
     */
    int getViolationCount(UUID attemptId);
}
