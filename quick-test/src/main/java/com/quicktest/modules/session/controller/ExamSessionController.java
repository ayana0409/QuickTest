package com.quicktest.modules.session.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.service.ExamSessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller governing the candidate exam-taking experience.
 * Supports both authenticated registered students and anonymous guests.
 */
@Slf4j
@RestController
@RequestMapping("/api/session")
@RequiredArgsConstructor
public class ExamSessionController {

    private final ExamSessionService examSessionService;
    private final UserRepository userRepository;

    /**
     * Start a new exam session or retrieve an active attempt for the given access code.
     * Masked exam paper (without answer keys) is returned.
     */
    @PostMapping("/start")
    public ResponseEntity<ApiResponse<ExamPaperResponse>> startExam(
            @Valid @RequestBody StartExamRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            HttpServletRequest servletRequest) {

        User userEntity = resolveUser(currentUser);
        ExamPaperResponse response = examSessionService.startExam(request, userEntity, servletRequest);

        return ResponseEntity.ok(ApiResponse.success(response, "Exam session started successfully"));
    }

    /**
     * Auto-save a candidate's answer for a single question into Redis Hash.
     */
    @PutMapping("/{attemptId}/save")
    public ResponseEntity<ApiResponse<Void>> saveAnswer(
            @PathVariable("attemptId") UUID attemptId,
            @Valid @RequestBody SaveAnswerRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @RequestParam(value = "guestIdentifier", required = false) String guestIdentifier,
            @RequestHeader(value = "X-Guest-Identifier", required = false) String guestHeader) {

        User userEntity = resolveUser(currentUser);
        String resolvedGuestId = resolveGuestIdentifier(guestIdentifier, guestHeader);

        examSessionService.saveDraft(attemptId, request, userEntity, resolvedGuestId);

        return ResponseEntity.ok(ApiResponse.success(null, "Answer draft saved successfully"));
    }

    /**
     * Resume an active exam session after page refresh or network disconnection.
     * Returns the masked exam paper alongside all auto-saved draft answers.
     */
    @GetMapping("/{attemptId}/resume")
    public ResponseEntity<ApiResponse<ResumeExamResponse>> resumeExam(
            @PathVariable("attemptId") UUID attemptId,
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @RequestParam(value = "guestIdentifier", required = false) String guestIdentifier,
            @RequestHeader(value = "X-Guest-Identifier", required = false) String guestHeader) {

        User userEntity = resolveUser(currentUser);
        String resolvedGuestId = resolveGuestIdentifier(guestIdentifier, guestHeader);

        ResumeExamResponse response = examSessionService.resumeExam(attemptId, userEntity, resolvedGuestId);

        return ResponseEntity.ok(ApiResponse.success(response, "Exam session resumed successfully"));
    }

    /**
     * Finalize and submit the exam attempt.
     * Synchronizes Redis draft answers to PostgreSQL, executes auto-grading, and clears cache.
     */
    @PostMapping("/{attemptId}/submit")
    public ResponseEntity<ApiResponse<SubmitResultResponse>> submitExam(
            @PathVariable("attemptId") UUID attemptId,
            @RequestBody(required = false) SubmitExamRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @RequestParam(value = "guestIdentifier", required = false) String guestIdentifier,
            @RequestHeader(value = "X-Guest-Identifier", required = false) String guestHeader) {

        User userEntity = resolveUser(currentUser);
        String resolvedGuestId = resolveGuestIdentifier(guestIdentifier, guestHeader);

        SubmitResultResponse response = examSessionService.submitExam(attemptId, request, userEntity, resolvedGuestId);

        return ResponseEntity.ok(ApiResponse.success(response, "Exam submitted successfully"));
    }

    /**
     * Helper to resolve the authenticated User entity from UserDetailsImpl if present.
     */
    private User resolveUser(UserDetailsImpl currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            return null;
        }
        return userRepository.findById(currentUser.getId()).orElse(null);
    }

    /**
     * Helper to resolve guest identifier from query parameter or header.
     */
    private String resolveGuestIdentifier(String guestIdentifier, String guestHeader) {
        if (guestIdentifier != null && !guestIdentifier.isBlank()) {
            return guestIdentifier.trim();
        }
        if (guestHeader != null && !guestHeader.isBlank()) {
            return guestHeader.trim();
        }
        return null;
    }
}
