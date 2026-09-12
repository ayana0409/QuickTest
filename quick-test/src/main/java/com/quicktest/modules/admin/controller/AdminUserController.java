package com.quicktest.modules.admin.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.admin.dto.AdminUserSummaryResponse;
import com.quicktest.modules.admin.dto.UpdateUserRoleRequest;
import com.quicktest.modules.admin.service.AdminService;
import com.quicktest.modules.iam.entity.Role;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller providing administrative user governance endpoints.
 * Requires ROLE_ADMIN authority.
 */
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminService adminService;

    /**
     * Get paginated list of users with optional filtering by role, active status, or keyword search.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminUserSummaryResponse>>> listUsers(
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        Page<AdminUserSummaryResponse> users = adminService.listUsers(role, isActive, search, pageable);
        return ResponseEntity.ok(ApiResponse.success(PageResponse.from(users), "Users retrieved successfully"));
    }

    /**
     * Get detailed summary of a specific user.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AdminUserSummaryResponse>> getUserDetail(@PathVariable("id") UUID id) {
        AdminUserSummaryResponse user = adminService.getUserDetail(id);
        return ResponseEntity.ok(ApiResponse.success(user, "User details retrieved successfully"));
    }

    /**
     * Toggle active/inactive status of a user.
     * Prevents administrators from deactivating their own accounts.
     */
    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<AdminUserSummaryResponse>> toggleUserStatus(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        AdminUserSummaryResponse user = adminService.toggleUserStatus(id, currentUser.getId());
        String msg = Boolean.TRUE.equals(user.getIsActive()) ? "User activated successfully" : "User deactivated successfully";
        return ResponseEntity.ok(ApiResponse.success(user, msg));
    }

    /**
     * Update user role (assign TEACHER, STUDENT, or ADMIN).
     * Prevents self-demotion from ADMIN or removing the last administrator.
     */
    @PatchMapping("/{id}/role")
    public ResponseEntity<ApiResponse<AdminUserSummaryResponse>> updateUserRole(
            @PathVariable("id") UUID id,
            @Valid @RequestBody UpdateUserRoleRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        AdminUserSummaryResponse user = adminService.updateUserRole(id, request, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(user, "User role updated successfully to " + user.getRole()));
    }
}
