package com.quicktest.modules.assessment.ai.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.logging.AuditLog;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.assessment.ai.dto.AiCommitQuestionsRequest;
import com.quicktest.modules.assessment.ai.dto.AiGenerateJobResponse;
import com.quicktest.modules.assessment.ai.dto.AiGenerateQuizRequest;
import com.quicktest.modules.assessment.ai.service.AiGenerateService;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Controller for AI-powered document-to-exam generation.
 * Handles document upload, background queue polling, cancellation, and bulk question commit.
 * Requires ROLE_TEACHER or ROLE_ADMIN authority.
 */
@RestController
@RequestMapping("/api/teacher/ai-generate")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
@RequiredArgsConstructor
public class AiGenerateController {

    private final AiGenerateService aiGenerateService;
    private final UserRepository userRepository;

    /**
     * Uploads a document (PDF, DOCX, TXT) or raw text and enqueues generation
     * onto the shared single-thread background queue.
     */
    @PostMapping(value = "/from-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @AuditLog(module = "QUESTION", action = "AI_GENERATE_FROM_DOC")
    public ResponseEntity<ApiResponse<AiGenerateJobResponse>> generateFromDocument(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @ModelAttribute AiGenerateQuizRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        AiGenerateJobResponse response = aiGenerateService.submitQuizGenerationJob(file, request, teacher);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(response, "Yêu cầu tạo đề thi bằng AI đã được đưa vào hàng đợi xử lý."));
    }

    /**
     * Polls the background execution progress and preview questions for a job.
     */
    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<ApiResponse<AiGenerateJobResponse>> getJobStatus(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        AiGenerateJobResponse response = aiGenerateService.getJobStatus(jobId, teacher);
        return ResponseEntity.ok(ApiResponse.success(response, "Lấy trạng thái tiến trình thành công"));
    }

    /**
     * Cancels an active or queued generation job and frees the user's AI lock.
     */
    @PostMapping("/jobs/{jobId}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancelJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        aiGenerateService.cancelQuizGenerationJob(jobId, teacher);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã hủy tiến trình tạo đề thi thành công"));
    }

    /**
     * Commits approved questions from the AI preview screen directly into an exam.
     */
    @PostMapping("/commit-to-exam/{examId}")
    @AuditLog(module = "QUESTION", action = "COMMIT_AI_QUESTIONS")
    public ResponseEntity<ApiResponse<List<QuestionResponse>>> commitToExam(
            @PathVariable UUID examId,
            @Valid @RequestBody AiCommitQuestionsRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        List<QuestionResponse> result = aiGenerateService.commitQuestionsToExam(examId, request, teacher);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(result, String.format("Đã thêm thành công %d câu hỏi vào đề thi.", result.size())));
    }

    /**
     * Resolves the authenticated User entity from the UserDetailsImpl security principal.
     */
    private User getAuthenticatedTeacher(UserDetailsImpl currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }
        UUID teacherId = Objects.requireNonNull(currentUser.getId());
        return userRepository.findById(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", teacherId));
    }
}
