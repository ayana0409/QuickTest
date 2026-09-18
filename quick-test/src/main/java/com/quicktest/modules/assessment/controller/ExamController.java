package com.quicktest.modules.assessment.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.assessment.dto.ExamCreateRequest;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.dto.ExamDuplicateRequest;
import com.quicktest.modules.assessment.dto.ExamRepublishRequest;
import com.quicktest.modules.assessment.dto.ExamSummaryResponse;
import com.quicktest.modules.assessment.dto.ExamUpdateRequest;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.service.ExamService;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller providing exam management operations for teachers.
 */
@RestController
@RequestMapping("/api/teacher/exams")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;
    private final UserRepository userRepository;

    /**
     * Create a new exam in DRAFT status.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ExamDetailResponse>> createExam(
            @Valid @RequestBody ExamCreateRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        ExamDetailResponse response = examService.createExam(request, teacher);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Exam created successfully"));
    }

    /**
     * Get paginated list of exams created by the authenticated teacher with optional search and status filtering.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<ExamSummaryResponse>>> getTeacherExams(
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "status", required = false) ExamStatus status,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        User teacher = getAuthenticatedTeacher(currentUser);
        Page<ExamSummaryResponse> response = examService.getTeacherExams(teacher, search, status, pageable);
        return ResponseEntity.ok(ApiResponse.success(PageResponse.from(response), "Exams retrieved successfully"));
    }

    /**
     * Get complete details of an exam by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExamDetailResponse>> getExamDetail(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        ExamDetailResponse response = examService.getExamDetail(id, teacher);
        return ResponseEntity.ok(ApiResponse.success(response, "Exam details retrieved successfully"));
    }

    /**
     * Update exam configuration details.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ExamDetailResponse>> updateExam(
            @PathVariable("id") UUID id,
            @Valid @RequestBody ExamUpdateRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        ExamDetailResponse response = examService.updateExam(id, request, teacher);
        return ResponseEntity.ok(ApiResponse.success(response, "Exam updated successfully"));
    }

    /**
     * Publish an exam (transitions status from DRAFT to PUBLISHED).
     */
    @PatchMapping("/{id}/publish")
    public ResponseEntity<ApiResponse<ExamDetailResponse>> publishExam(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        ExamDetailResponse response = examService.publishExam(id, teacher);
        return ResponseEntity.ok(ApiResponse.success(response, "Exam published successfully"));
    }

    /**
     * Close an exam (transitions status to CLOSED).
     */
    @PatchMapping("/{id}/close")
    public ResponseEntity<ApiResponse<ExamDetailResponse>> closeExam(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        ExamDetailResponse response = examService.closeExam(id, teacher);
        return ResponseEntity.ok(ApiResponse.success(response, "Exam closed successfully"));
    }

    /**
     * Republish an existing exam (transitions status to PUBLISHED), optionally updating time window.
     */
    @PatchMapping("/{id}/republish")
    public ResponseEntity<ApiResponse<ExamDetailResponse>> republishExam(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) @Valid ExamRepublishRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        ExamDetailResponse response = examService.republishExam(id, request, teacher);
        return ResponseEntity.ok(ApiResponse.success(response, "Exam republished successfully"));
    }

    /**
     * Duplicate an existing exam with all questions and options.
     */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<ExamDetailResponse>> duplicateExam(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) @Valid ExamDuplicateRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        ExamDetailResponse response = examService.duplicateExam(id, request, teacher);
        boolean isAsync = response.getStatus() == ExamStatus.CLONING;
        HttpStatus status = isAsync ? HttpStatus.ACCEPTED : HttpStatus.CREATED;
        String message = isAsync
                ? "Đang nhân bản đề thi và sao chép hình ảnh trong nền..."
                : "Nhân bản đề thi thành công";
        return ResponseEntity.status(status).body(ApiResponse.success(response, message));
    }

    /**
     * Delete an exam (only permitted for DRAFT exams).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteExam(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        examService.deleteExam(id, teacher);
        return ResponseEntity.ok(ApiResponse.success(null, "Exam deleted successfully"));
    }

    private User getAuthenticatedTeacher(UserDetailsImpl currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }
        UUID teacherId = java.util.Objects.requireNonNull(currentUser.getId());
        return userRepository.findById(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", teacherId));
    }
}
