package com.quicktest.modules.session.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.session.dto.StudentDashboardResponse;
import com.quicktest.modules.session.service.StudentAttemptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for authenticated student dashboard overview,
 * aggregating previous exams, attempt quotas, active session indicators, and performance telemetry.
 */
@Slf4j
@RestController
@RequestMapping("/api/student/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
public class StudentDashboardController {

    private final StudentAttemptService studentAttemptService;

    /**
     * Retrieve aggregated student dashboard data.
     * Pass {@code refresh=true} to bypass the short-lived cache and recompute fresh metrics.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<StudentDashboardResponse>> getStudentDashboard(
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @RequestParam(name = "refresh", defaultValue = "false") boolean refresh) {

        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User must be authenticated to view student dashboard", HttpStatus.UNAUTHORIZED);
        }

        log.info("Student {} requested dashboard data (refresh={})", currentUser.getId(), refresh);
        StudentDashboardResponse response = refresh
                ? studentAttemptService.refreshStudentDashboard(currentUser.getId())
                : studentAttemptService.getStudentDashboard(currentUser.getId());

        return ResponseEntity.ok(ApiResponse.success(response, "Student dashboard retrieved successfully"));
    }
}
