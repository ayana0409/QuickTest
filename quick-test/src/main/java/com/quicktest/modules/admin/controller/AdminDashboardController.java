package com.quicktest.modules.admin.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.modules.admin.dto.AdminDashboardResponse;
import com.quicktest.modules.admin.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller providing administrative dashboard and system analytics endpoints.
 * Requires ROLE_ADMIN authority.
 */
@RestController
@RequestMapping("/api/admin/dashboard")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminService adminService;

    /**
     * Get system-wide analytics, user/exam/attempt counters, and recent proctoring violation logs.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<AdminDashboardResponse>> getDashboard() {
        AdminDashboardResponse response = adminService.getDashboard();
        return ResponseEntity.ok(ApiResponse.success(response, "Admin dashboard statistics retrieved successfully"));
    }
}
