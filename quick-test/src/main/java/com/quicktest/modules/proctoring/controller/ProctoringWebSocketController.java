package com.quicktest.modules.proctoring.controller;

import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.proctoring.dto.HeartbeatMessage;
import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import com.quicktest.modules.proctoring.dto.ViolationReportMessage;
import com.quicktest.modules.proctoring.service.ProctoringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/**
 * WebSocket STOMP controller receiving candidate telemetry violations and periodic heartbeats.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class ProctoringWebSocketController {

    private final ProctoringService proctoringService;

    /**
     * Handle incoming violation report sent from candidate client.
     * Destination: /app/proctoring/violation
     */
    @MessageMapping("/proctoring/violation")
    public ViolationAlertMessage handleViolationReport(
            @Payload ViolationReportMessage message,
            Principal principal) {

        UUID userId = extractUserId(principal);
        log.debug("Received STOMP violation report for attempt: {}, type: {}, userId: {}",
                message.getAttemptId(), message.getViolationType(), userId);

        return proctoringService.recordViolation(message.getAttemptId(), message, userId);
    }

    /**
     * Handle client heartbeat ping.
     * Destination: /app/proctoring/heartbeat
     */
    @MessageMapping("/proctoring/heartbeat")
    public void handleHeartbeat(@Payload HeartbeatMessage message) {
        if (message != null && message.getAttemptId() != null) {
            proctoringService.recordHeartbeat(message.getAttemptId());
        }
    }

    private UUID extractUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth) {
            if (auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
                return userDetails.getId();
            }
        }
        return null;
    }
}
