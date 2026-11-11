package com.quicktest.modules.session;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.controller.TeacherDashboardController;
import com.quicktest.modules.session.dto.TeacherDashboardResponse;
import com.quicktest.modules.session.service.TeacherDashboardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.Collections;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller tests for {@link TeacherDashboardController}.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class TeacherDashboardControllerTest {

    @Mock
    private TeacherDashboardService teacherDashboardService;

    @InjectMocks
    private TeacherDashboardController teacherDashboardController;

    private MockMvc mockMvc;
    private UUID teacherId;
    private UserDetailsImpl teacherPrincipal;

    @BeforeEach
    void setUp() {
        teacherId = UUID.randomUUID();
        User teacher = User.builder()
                .id(teacherId)
                .username("teacher1")
                .email("teacher1@quicktest.com")
                .role(Role.TEACHER)
                .isActive(true)
                .build();
        teacherPrincipal = UserDetailsImpl.build(teacher);

        HandlerMethodArgumentResolver authPrincipalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return teacherPrincipal;
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(teacherDashboardController)
                .setCustomArgumentResolvers(authPrincipalResolver)
                .build();
    }

    @Test
    @DisplayName("GET /api/teacher/dashboard: Returns 200 OK with teacher metrics")
    void getDashboard_ReturnsOk() throws Exception {
        TeacherDashboardResponse dashboard = TeacherDashboardResponse.builder()
                .totalExams(8L)
                .publishedExams(4L)
                .totalQuestions(120L)
                .totalAttempts(65L)
                .pendingManualAnswers(9L)
                .dailyActivities(Collections.emptyList())
                .priorityExams(Collections.emptyList())
                .recentViolations(Collections.emptyList())
                .build();

        when(teacherDashboardService.getTeacherDashboard(teacherId)).thenReturn(dashboard);

        mockMvc.perform(get("/api/teacher/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.totalExams").value(8))
                .andExpect(jsonPath("$.data.publishedExams").value(4))
                .andExpect(jsonPath("$.data.pendingManualAnswers").value(9));

        verify(teacherDashboardService, times(1)).getTeacherDashboard(teacherId);
        verify(teacherDashboardService, never()).refreshTeacherDashboard(any());
    }

    @Test
    @DisplayName("GET /api/teacher/dashboard?refresh=true: Calls refreshTeacherDashboard")
    void getDashboard_WithRefreshParam_CallsRefresh() throws Exception {
        TeacherDashboardResponse refreshed = TeacherDashboardResponse.builder()
                .totalExams(9L)
                .inProgressAttempts(3L)
                .dailyActivities(Collections.emptyList())
                .priorityExams(Collections.emptyList())
                .recentViolations(Collections.emptyList())
                .build();

        when(teacherDashboardService.refreshTeacherDashboard(teacherId)).thenReturn(refreshed);

        mockMvc.perform(get("/api/teacher/dashboard").param("refresh", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.totalExams").value(9))
                .andExpect(jsonPath("$.data.inProgressAttempts").value(3));

        verify(teacherDashboardService, times(1)).refreshTeacherDashboard(teacherId);
        verify(teacherDashboardService, never()).getTeacherDashboard(any());
    }

    @Test
    @DisplayName("getDashboard: Throws 401 UNAUTHORIZED when principal is null")
    void getDashboard_Unauthenticated_ThrowsUnauthorized() {
        AppException ex = assertThrows(AppException.class,
                () -> teacherDashboardController.getDashboard(null, false));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        verifyNoInteractions(teacherDashboardService);
    }
}

