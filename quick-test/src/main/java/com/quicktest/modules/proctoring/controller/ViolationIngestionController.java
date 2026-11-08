package com.quicktest.modules.proctoring.controller;

import com.cloudinary.Cloudinary;
import com.quicktest.config.CloudinaryProperties;
import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import com.quicktest.modules.proctoring.dto.ViolationReportMessage;
import com.quicktest.modules.proctoring.service.RedisProctoringService;
import com.quicktest.modules.session.dto.SaveAnswerRequest;
import com.quicktest.modules.session.dto.SubmissionMessage;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import com.quicktest.modules.session.service.ExamSubmissionProducer;
import com.quicktest.modules.session.service.RedisExamSessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Dedicated high-throughput REST controller for candidate violation telemetry ingestion.
 * Performs zero database writes by buffering telemetry in Redis with sub-millisecond response times.
 */
@Slf4j
@RestController
@RequestMapping("/api/session")
@RequiredArgsConstructor
public class ViolationIngestionController {

    private final ExamAttemptRepository examAttemptRepository;
    private final RedisProctoringService redisProctoringService;
    private final RedisExamSessionService redisExamSessionService;
    private final ExamSubmissionProducer examSubmissionProducer;
    private final Cloudinary cloudinary;
    private final CloudinaryProperties cloudinaryProperties;

    /**
     * Generates a signed upload signature for direct evidence upload from candidate client to Cloudinary.
     * Prevents exposing Cloudinary apiSecret to client.
     */
    @GetMapping("/{attemptId}/proctoring/upload-signature")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUploadSignature(
            @PathVariable("attemptId") UUID attemptId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        if (currentUser != null && attempt.getUser() != null
                && !attempt.getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You are not authorized to request upload signature for this attempt");
        }

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Phiên thi không còn ở trạng thái đang làm bài."));
        }

        long timestamp = System.currentTimeMillis() / 1000L;
        String folder = "quick-test/proctoring/" + attemptId;

        Map<String, Object> paramsToSign = new java.util.TreeMap<>();
        paramsToSign.put("folder", folder);
        paramsToSign.put("timestamp", timestamp);

        String signature = cloudinary.apiSignRequest(paramsToSign, cloudinaryProperties.getApiSecret());

        Map<String, Object> signatureData = Map.of(
                "signature", signature,
                "timestamp", timestamp,
                "apiKey", cloudinaryProperties.getApiKey() != null ? cloudinaryProperties.getApiKey() : "",
                "cloudName", cloudinaryProperties.getCloudName() != null ? cloudinaryProperties.getCloudName() : "",
                "folder", folder
        );

        return ResponseEntity.ok(ApiResponse.success(signatureData, "Upload signature generated successfully"));
    }

    /**
     * Ingest candidate telemetry violation event (e.g. TAB_SWITCH, EXIT_FULLSCREEN, DEVTOOLS_OPEN).
     * Buffers directly to Redis and dispatches non-blocking notifications to QuickNotify.
     *
     * @param attemptId   The target exam attempt identifier
     * @param report      Violation details payload
     * @param currentUser Authenticated user principal (null for guest candidates)
     * @return Generated alert message with current infraction counts and disqualification status
     */
    @PostMapping("/{attemptId}/proctoring/violation")
    public ResponseEntity<ApiResponse<ViolationAlertMessage>> recordViolation(
            @PathVariable("attemptId") UUID attemptId,
            @Valid @RequestBody ViolationReportMessage report,
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @RequestHeader(value = "X-Exam-Session-Token", required = false) String sessionToken) {

        log.debug("Received HTTP violation telemetry for attemptId: {}, type: {}",
                attemptId, report.getViolationType());

        if (sessionToken != null
                && !sessionToken.isBlank()
                && !redisProctoringService.validateActiveSessionToken(attemptId, sessionToken)) {
            return ResponseEntity.status(409)
                    .body(ApiResponse.error(409, "SESSION_EVICTED: Phiên làm bài đã được chuyển sang thiết bị hoặc trình duyệt khác."));
        }

        // Fast metadata check: fetch attempt with exam and user
        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        // Ensure authorized candidate owns this attempt
        if (currentUser != null && attempt.getUser() != null
                && !attempt.getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You are not authorized to submit telemetry for this attempt");
        }

        // If attempt is already DISQUALIFIED, return disqualified alert so client immediately locks screen
        if (attempt.getStatus() == AttemptStatus.DISQUALIFIED) {
            int maxAllowed = (attempt.getExam().getMaxViolations() != null && attempt.getExam().getMaxViolations() > 0)
                    ? attempt.getExam().getMaxViolations()
                    : 5;
            ViolationAlertMessage disqualifiedAlert = ViolationAlertMessage.builder()
                    .attemptId(attemptId)
                    .violationType(report.getViolationType())
                    .violationCount(attempt.getViolationCount() != null ? attempt.getViolationCount() : maxAllowed)
                    .maxAllowed(maxAllowed)
                    .remainingAllowed(0)
                    .disqualified(true)
                    .message("Bài thi đã bị đình chỉ do vi phạm quy chế thi.")
                    .timestamp(LocalDateTime.now())
                    .build();
            return ResponseEntity.ok(ApiResponse.success(disqualifiedAlert, disqualifiedAlert.getMessage()));
        }

        // Verify attempt is actively in progress
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            log.warn("Attempt {} is not IN_PROGRESS (status: {}). Ingestion rejected.",
                    attemptId, attempt.getStatus());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, "Phiên thi không còn ở trạng thái đang làm bài."));
        }

        Exam exam = attempt.getExam();
        boolean isProctoringEnabled = Boolean.TRUE.equals(exam.getIsProctoringEnabled());
        if (!isProctoringEnabled) {
            log.debug("Proctoring disabled for exam {}. Bypassing violation recording.", exam.getId());
            return ResponseEntity.ok(ApiResponse.success(
                    ViolationAlertMessage.builder()
                            .attemptId(attemptId)
                            .violationType(report.getViolationType())
                            .disqualified(false)
                            .message("Phòng thi không bật chức năng giám sát.")
                            .build()
            ));
        }

        int maxAllowedViolations = (exam.getMaxViolations() != null && exam.getMaxViolations() > 0)
                ? exam.getMaxViolations()
                : 5;

        // Calculate remaining duration for accurate Redis TTL
        Duration remainingDuration = attempt.getExpireAt() != null
                ? Duration.between(LocalDateTime.now(), attempt.getExpireAt())
                : Duration.ofHours(4);
        if (remainingDuration.isNegative()) {
            remainingDuration = Duration.ofMinutes(5);
        }

        report.setAttemptId(attemptId);
        ViolationAlertMessage alert = redisProctoringService.recordViolationInMemory(
                attemptId, exam.getId(), maxAllowedViolations, remainingDuration, report);

        // If candidate exceeded violation limit and was auto-disqualified, persist terminal status and answers
        if (Boolean.TRUE.equals(alert.getDisqualified())) {
            log.warn("Attempt {} reached violation limit ({}/{}). Finalizing disqualified attempt with answers and violations.",
                    attemptId, alert.getViolationCount(), maxAllowedViolations);
            attempt.setStatus(AttemptStatus.DISQUALIFIED);
            attempt.setViolationCount(alert.getViolationCount());
            examAttemptRepository.save(attempt);

            // Package and dispatch submission message to RabbitMQ to finalize candidate's answers and violation logs
            try {
                Map<UUID, SaveAnswerRequest> draftAnswers = redisExamSessionService.getDraftAnswers(attemptId);
                SubmissionMessage message = SubmissionMessage.builder()
                        .attemptId(attemptId)
                        .examId(exam.getId())
                        .examTitle(exam.getTitle())
                        .userId(attempt.getUser() != null ? attempt.getUser().getId() : null)
                        .guestIdentifier(attempt.getGuestIdentifier())
                        .submitTime(LocalDateTime.now())
                        .answers(draftAnswers)
                        .build();

                examSubmissionProducer.sendSubmissionMessage(message);
            } catch (Exception ex) {
                log.error("Failed to enqueue submission message on auto-disqualification for attemptId: {}", attemptId, ex);
            }
        }

        return ResponseEntity.ok(ApiResponse.success(alert, alert.getMessage()));
    }
}

