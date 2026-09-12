package com.quicktest.modules.admin.service;

import com.quicktest.modules.admin.dto.AdminDashboardResponse;
import com.quicktest.modules.admin.dto.AdminExamSummaryResponse;
import com.quicktest.modules.admin.dto.AdminUserSummaryResponse;
import com.quicktest.modules.admin.dto.UpdateUserRoleRequest;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.iam.entity.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

/**
 * Service interface defining administrative operations for user governance,
 * exam lifecycle control, and system dashboard analytics.
 */
public interface AdminService {

    // --- User Governance ---
    Page<AdminUserSummaryResponse> listUsers(Role role, Boolean isActive, String keyword, Pageable pageable);

    AdminUserSummaryResponse getUserDetail(UUID userId);

    AdminUserSummaryResponse toggleUserStatus(UUID userId, UUID currentAdminId);

    AdminUserSummaryResponse updateUserRole(UUID userId, UpdateUserRoleRequest request, UUID currentAdminId);

    // --- Exam Governance ---
    Page<AdminExamSummaryResponse> listExams(ExamStatus status, String keyword, Pageable pageable);

    ExamDetailResponse getExamDetail(UUID examId);

    void forceCloseExam(UUID examId);

    void deleteExam(UUID examId);

    // --- System Analytics ---
    AdminDashboardResponse getDashboard();
}
