package com.quicktest.modules.session;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.controller.StudentDashboardController;
import com.quicktest.modules.session.dto.StudentDashboardResponse;
import com.quicktest.modules.session.dto.StudentExamCardDto;
import com.quicktest.modules.session.service.StudentAttemptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for StudentDashboardController.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class StudentDashboardControllerTest {

    @Mock
    private StudentAttemptService studentAttemptService;

    @InjectMocks
    private StudentDashboardController studentDashboardController;

    private UserDetailsImpl currentUser;
    private UUID studentId;

    @BeforeEach
    void setUp() {
        studentId = UUID.randomUUID();
        User studentUser = User.builder()
                .id(studentId)
                .username("student1")
                .email("student1@example.com")
                .role(Role.STUDENT)
                .build();
        currentUser = UserDetailsImpl.build(studentUser);
    }

    @Test
    @DisplayName("Should return 200 OK with dashboard data for authenticated student")
    void testGetStudentDashboard_Success() {
        StudentDashboardResponse mockResponse = StudentDashboardResponse.builder()
                .totalExamsAttempted(1)
                .openExamsCount(1)
                .activeSessionsCount(0)
                .myExams(List.of(StudentExamCardDto.builder().examId(UUID.randomUUID()).title("Math 101").build()))
                .availableExams(Collections.emptyList())
                .build();

        when(studentAttemptService.getStudentDashboard(studentId)).thenReturn(mockResponse);

        ResponseEntity<ApiResponse<StudentDashboardResponse>> response =
                studentDashboardController.getStudentDashboard(currentUser);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(200, response.getBody().getStatus());
        assertEquals(1, response.getBody().getData().getTotalExamsAttempted());
        verify(studentAttemptService, times(1)).getStudentDashboard(studentId);
    }

    @Test
    @DisplayName("Should throw 401 UNAUTHORIZED when currentUser is null")
    void testGetStudentDashboard_Unauthenticated() {
        AppException ex = assertThrows(AppException.class, () ->
                studentDashboardController.getStudentDashboard(null));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        verify(studentAttemptService, never()).getStudentDashboard(any());
    }
}
