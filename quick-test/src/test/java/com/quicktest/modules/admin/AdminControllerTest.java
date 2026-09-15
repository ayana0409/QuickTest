package com.quicktest.modules.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.admin.controller.AdminDashboardController;
import com.quicktest.modules.admin.controller.AdminExamController;
import com.quicktest.modules.admin.controller.AdminUserController;
import com.quicktest.modules.admin.dto.*;
import com.quicktest.modules.admin.service.AdminService;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.iam.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for Admin endpoints.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AdminControllerTest {

    @Mock
    private AdminService adminService;

    @InjectMocks
    private AdminUserController adminUserController;

    @InjectMocks
    private AdminExamController adminExamController;

    @InjectMocks
    private AdminDashboardController adminDashboardController;

    private MockMvc userMockMvc;
    private MockMvc examMockMvc;
    private MockMvc dashboardMockMvc;

    private ObjectMapper objectMapper;
    private UUID adminId;
    private UserDetailsImpl mockAdminPrincipal;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        adminId = UUID.randomUUID();
        mockAdminPrincipal = UserDetailsImpl.builder()
                .id(adminId)
                .username("admin")
                .email("admin@quicktest.com")
                .role(Role.ADMIN)
                .isActive(true)
                .build();

        // Custom argument resolver to inject @AuthenticationPrincipal
        HandlerMethodArgumentResolver authPrincipalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return mockAdminPrincipal;
            }
        };

        userMockMvc = MockMvcBuilders.standaloneSetup(adminUserController)
                .setCustomArgumentResolvers(authPrincipalResolver, new PageableHandlerMethodArgumentResolver())
                .build();

        examMockMvc = MockMvcBuilders.standaloneSetup(adminExamController)
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();

        dashboardMockMvc = MockMvcBuilders.standaloneSetup(adminDashboardController)
                .build();
    }

    // =========================================================================
    // AdminUserController Tests
    // =========================================================================

    @Test
    @DisplayName("GET /api/admin/users: Should return 200 with paginated users")
    void listUsers_ReturnsOk() throws Exception {
        AdminUserSummaryResponse userSummary = AdminUserSummaryResponse.builder()
                .id(UUID.randomUUID())
                .username("teacher1")
                .email("teacher1@test.com")
                .fullName("Teacher One")
                .role(Role.TEACHER)
                .isActive(true)
                .build();

        Page<AdminUserSummaryResponse> page = new PageImpl<>(List.of(userSummary), PageRequest.of(0, 20), 1);
        when(adminService.listUsers(any(), any(), any(), any())).thenReturn(page);

        userMockMvc.perform(get("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.content[0].username").value("teacher1"));
    }

    @Test
    @DisplayName("PATCH /api/admin/users/{id}/toggle-status: Should return 200 and updated user")
    void toggleUserStatus_ReturnsOk() throws Exception {
        UUID targetId = UUID.randomUUID();
        AdminUserSummaryResponse userSummary = AdminUserSummaryResponse.builder()
                .id(targetId)
                .username("student1")
                .role(Role.STUDENT)
                .isActive(false)
                .build();

        when(adminService.toggleUserStatus(eq(targetId), eq(adminId))).thenReturn(userSummary);

        userMockMvc.perform(patch("/api/admin/users/" + targetId + "/toggle-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.isActive").value(false));
    }

    @Test
    @DisplayName("PATCH /api/admin/users/{id}/role: Should return 200 and updated role")
    void updateUserRole_ReturnsOk() throws Exception {
        UUID targetId = UUID.randomUUID();
        UpdateUserRoleRequest req = UpdateUserRoleRequest.builder().role(Role.TEACHER).build();
        AdminUserSummaryResponse userSummary = AdminUserSummaryResponse.builder()
                .id(targetId)
                .role(Role.TEACHER)
                .build();

        when(adminService.updateUserRole(eq(targetId), any(UpdateUserRoleRequest.class), eq(adminId)))
                .thenReturn(userSummary);

        userMockMvc.perform(patch("/api/admin/users/" + targetId + "/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.role").value("TEACHER"));
    }

    // =========================================================================
    // AdminExamController Tests
    // =========================================================================

    @Test
    @DisplayName("GET /api/admin/exams: Should return 200 with exam list")
    void listExams_ReturnsOk() throws Exception {
        AdminExamSummaryResponse examSummary = AdminExamSummaryResponse.builder()
                .id(UUID.randomUUID())
                .title("Final Exam")
                .accessCode("FINAL01")
                .status(ExamStatus.PUBLISHED)
                .totalAttempts(10L)
                .build();

        Page<AdminExamSummaryResponse> page = new PageImpl<>(List.of(examSummary));
        when(adminService.listExams(any(), any(), any())).thenReturn(page);

        examMockMvc.perform(get("/api/admin/exams"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.content[0].title").value("Final Exam"));
    }

    @Test
    @DisplayName("PATCH /api/admin/exams/{id}/close: Should return 200")
    void forceCloseExam_ReturnsOk() throws Exception {
        UUID examId = UUID.randomUUID();
        doNothing().when(adminService).forceCloseExam(examId);

        examMockMvc.perform(patch("/api/admin/exams/" + examId + "/close"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Exam force-closed successfully"));
    }

    @Test
    @DisplayName("DELETE /api/admin/exams/{id}: Should return 200")
    void deleteExam_ReturnsOk() throws Exception {
        UUID examId = UUID.randomUUID();
        doNothing().when(adminService).deleteExam(examId);

        examMockMvc.perform(delete("/api/admin/exams/" + examId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Exam deleted successfully"));
    }

    // =========================================================================
    // AdminDashboardController Tests
    // =========================================================================

    @Test
    @DisplayName("GET /api/admin/dashboard: Should return 200 with metrics")
    void getDashboard_ReturnsOk() throws Exception {
        AdminDashboardResponse dashboard = AdminDashboardResponse.builder()
                .totalUsers(50L)
                .totalExams(10L)
                .totalAttempts(150L)
                .totalViolations(3L)
                .recentViolations(Collections.emptyList())
                .build();

        when(adminService.getDashboard()).thenReturn(dashboard);

        dashboardMockMvc.perform(get("/api/admin/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.totalUsers").value(50))
                .andExpect(jsonPath("$.data.totalExams").value(10));
    }

    @Test
    @DisplayName("GET /api/admin/analytics and aliases: Should return 200 with metrics")
    void getDashboard_Aliases_ReturnsOk() throws Exception {
        AdminDashboardResponse dashboard = AdminDashboardResponse.builder()
                .totalUsers(50L)
                .totalExams(10L)
                .totalAttempts(150L)
                .totalViolations(3L)
                .recentViolations(Collections.emptyList())
                .build();

        when(adminService.getDashboard()).thenReturn(dashboard);

        // Test /api/admin/analytics
        dashboardMockMvc.perform(get("/api/admin/analytics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.totalUsers").value(50));

        // Test /api/admin/dashboard/overview
        dashboardMockMvc.perform(get("/api/admin/dashboard/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.totalExams").value(10));

        // Test /api/admin/analytics/overview
        dashboardMockMvc.perform(get("/api/admin/analytics/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.totalAttempts").value(150));
    }
}
