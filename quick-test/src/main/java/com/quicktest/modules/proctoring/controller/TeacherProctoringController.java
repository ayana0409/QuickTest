package com.quicktest.modules.proctoring.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.notify.QuickNotifyTokenService;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.proctoring.dto.*;
import com.quicktest.modules.proctoring.service.ProctoringQueryService;
import com.quicktest.modules.proctoring.service.ProctoringService;
import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * REST controller providing real-time proctoring monitoring, candidate audit
 * logs,
 * telemetry status checks, and manual candidate disqualification for
 * instructors.
 */
@Slf4j
@RestController
@RequestMapping("/api/teacher/proctoring")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class TeacherProctoringController {

    private final ProctoringService proctoringService;
    private final ProctoringQueryService proctoringQueryService;
    private final QuickNotifyTokenService quickNotifyTokenService;
    private final UserRepository userRepository;

    /**
     * Retrieve paginated real-time monitoring list of candidates for an exam.
     */
    @GetMapping(value = { "/exams/{examId}/attempts", "/exams/{examId}/monitoring" })
    public ResponseEntity<ApiResponse<PageResponse<AttemptMonitorResponse>>> getExamMonitoring(
            @PathVariable("examId") UUID examId,
            @RequestParam(value = "status", required = false) AttemptStatus status,
            @RequestParam(value = "hasViolation", required = false) Boolean hasViolation,
            @RequestParam(value = "search", required = false) String search,
            @PageableDefault(size = 24, sort = { "violationCount", "startTime" }, direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        PageResponse<AttemptMonitorResponse> response = proctoringService.getExamMonitoring(
                examId, status, hasViolation, search, pageable, teacher);

        return ResponseEntity.ok(ApiResponse.success(response, "Monitoring list retrieved successfully"));
    }

    /**
     * Generate entry JWT ticket and WebSocket Gateway URL for teacher monitoring
     * dashboard
     * connecting to QuickNotify Go Hub.
     */
    @GetMapping("/exams/{examId}/realtime-token")
    public ResponseEntity<ApiResponse<Map<String, String>>> getExamRealtimeToken(
            @PathVariable("examId") UUID examId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        String token = quickNotifyTokenService.generateTeacherToken(teacher.getId(), examId);
        String wsUrl = quickNotifyTokenService.getQuickNotifyWsUrl();

        return ResponseEntity.ok(ApiResponse.success(
                java.util.Map.of(
                        "realtimeToken", token,
                        "realtimeWsUrl", wsUrl,
                        "token", token,
                        "wsUrl", wsUrl,
                        "topic", "exam_monitor_" + examId
                ),
                "Realtime token generated successfully"));
    }

    /**
     * Retrieve complete audit trail of recorded violation logs for a specific
     * attempt.
     * Automatically retrieves live uncommitted violations from Redis if attempt is
     * IN_PROGRESS,
     * or queries persisted records from PostgreSQL once attempt is finalized.
     */
    @GetMapping("/attempts/{attemptId}/violations")
    public ResponseEntity<ApiResponse<List<ViolationLogResponse>>> getAttemptViolations(
            @PathVariable("attemptId") UUID attemptId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        List<ViolationLogResponse> violations = proctoringQueryService.getAttemptViolationLogs(attemptId, teacher);

        return ResponseEntity.ok(ApiResponse.success(violations, "Candidate violations retrieved successfully"));
    }

    /**
     * Retrieve detailed violation history payload including data source indicator
     * ("REDIS_LIVE" vs "POSTGRESQL_FINAL") and structured violation events.
     */
    @GetMapping("/attempts/{attemptId}/violations/detailed")
    public ResponseEntity<ApiResponse<ViolationDetailResponse>> getAttemptViolationsDetailed(
            @PathVariable("attemptId") UUID attemptId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        ViolationDetailResponse response = proctoringQueryService.getAttemptViolationsForTeacher(attemptId, teacher);

        return ResponseEntity.ok(ApiResponse.success(response, "Detailed violations retrieved successfully"));
    }

    /**
     * Retrieve detailed real-time telemetry status, heartbeat status, and breakdown
     * for an attempt.
     */
    @GetMapping("/attempts/{attemptId}/status")
    public ResponseEntity<ApiResponse<AttemptRealtimeStatusResponse>> getAttemptStatus(
            @PathVariable("attemptId") UUID attemptId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        AttemptRealtimeStatusResponse status = proctoringService.getAttemptRealtimeStatus(attemptId, teacher);

        return ResponseEntity.ok(ApiResponse.success(status, "Candidate telemetry status retrieved successfully"));
    }

    /**
     * Manually force disqualify a candidate from an active or completed attempt.
     */
    @PostMapping("/attempts/{attemptId}/disqualify")
    public ResponseEntity<ApiResponse<String>> disqualifyAttempt(
            @PathVariable("attemptId") UUID attemptId,
            @RequestBody(required = false) DisqualifyAttemptRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        String reason = request != null ? request.getReason() : null;
        proctoringService.disqualifyAttempt(attemptId, reason, teacher);

        return ResponseEntity.ok(ApiResponse.success("Candidate has been successfully disqualified",
                "Candidate disqualified successfully"));
    }

    private User getAuthenticatedTeacher(UserDetailsImpl currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }
        UUID teacherId = Objects.requireNonNull(currentUser.getId());
        return userRepository.findById(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", teacherId));
    }
}
