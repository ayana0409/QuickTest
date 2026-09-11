package com.quicktest.modules.proctoring.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.proctoring.dto.HeartbeatMessage;
import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import com.quicktest.modules.proctoring.dto.ViolationReportMessage;
import com.quicktest.modules.proctoring.service.ProctoringService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST controller providing candidate proctoring endpoints for telemetry reporting
 * and heartbeat tracking (serving as HTTP beacon fallback for WebSocket).
 */
@Slf4j
@RestController
@RequestMapping("/api/session/proctoring")
@RequiredArgsConstructor
public class CandidateProctoringController {

    private final ProctoringService proctoringService;

    /**
     * Submit a proctoring telemetry violation event.
     */
    @PostMapping("/violations")
    public ResponseEntity<ApiResponse<ViolationAlertMessage>> reportViolation(
            @Valid @RequestBody ViolationReportMessage request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        UUID userId = (currentUser != null) ? currentUser.getId() : null;
        ViolationAlertMessage alert = proctoringService.recordViolation(request.getAttemptId(), request, userId);

        return ResponseEntity.ok(ApiResponse.success(alert, alert.getMessage()));
    }

    /**
     * Submit candidate heartbeat to keep session status active.
     */
    @PostMapping("/heartbeat")
    public ResponseEntity<ApiResponse<String>> recordHeartbeat(
            @Valid @RequestBody HeartbeatMessage request) {

        proctoringService.recordHeartbeat(request.getAttemptId());
        return ResponseEntity.ok(ApiResponse.success("Heartbeat recorded", "Heartbeat received"));
    }
}
