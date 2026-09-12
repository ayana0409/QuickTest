package com.quicktest.modules.admin.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.modules.admin.dto.AdminExamSummaryResponse;
import com.quicktest.modules.admin.service.AdminService;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.entity.ExamStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller providing administrative exam governance endpoints.
 * Requires ROLE_ADMIN authority.
 */
@RestController
@RequestMapping("/api/admin/exams")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminExamController {

    private final AdminService adminService;

    /**
     * Get paginated list of all exams across all teachers with optional status and search filtering.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminExamSummaryResponse>>> listExams(
            @RequestParam(required = false) ExamStatus status,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        Page<AdminExamSummaryResponse> exams = adminService.listExams(status, search, pageable);
        return ResponseEntity.ok(ApiResponse.success(PageResponse.from(exams), "Exams retrieved successfully"));
    }

    /**
     * Get complete details of an exam by ID (including questions and configuration).
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExamDetailResponse>> getExamDetail(@PathVariable("id") UUID id) {
        ExamDetailResponse exam = adminService.getExamDetail(id);
        return ResponseEntity.ok(ApiResponse.success(exam, "Exam details retrieved successfully"));
    }

    /**
     * Force-close an ongoing or published exam.
     */
    @PatchMapping("/{id}/close")
    public ResponseEntity<ApiResponse<Void>> forceCloseExam(@PathVariable("id") UUID id) {
        adminService.forceCloseExam(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Exam force-closed successfully"));
    }

    /**
     * Delete an exam.
     * Allowed only if exam is in DRAFT or CLOSED status, and has zero candidate attempts.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteExam(@PathVariable("id") UUID id) {
        adminService.deleteExam(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Exam deleted successfully"));
    }
}
