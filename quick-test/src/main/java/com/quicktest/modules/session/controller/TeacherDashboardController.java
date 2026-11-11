package com.quicktest.modules.session.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.session.dto.TeacherDashboardResponse;
import com.quicktest.modules.session.service.TeacherDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller providing teacher dashboard analytics and workload summaries.
 */
@RestController
@RequestMapping("/api/teacher/dashboard")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
@RequiredArgsConstructor
public class TeacherDashboardController {

    private final TeacherDashboardService teacherDashboardService;

    /**
     * Retrieve teacher-scoped analytics, 7-day activity series, priority exams, and recent proctoring alerts.
     * Pass {@code refresh=true} to bypass the short-lived cache and recompute fresh metrics.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<TeacherDashboardResponse>> getDashboard(
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @RequestParam(name = "refresh", defaultValue = "false") boolean refresh) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User must be authenticated to view teacher dashboard", HttpStatus.UNAUTHORIZED);
        }

        TeacherDashboardResponse response = refresh
                ? teacherDashboardService.refreshTeacherDashboard(currentUser.getId())
                : teacherDashboardService.getTeacherDashboard(currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response, "Teacher dashboard statistics retrieved successfully"));
    }
}

