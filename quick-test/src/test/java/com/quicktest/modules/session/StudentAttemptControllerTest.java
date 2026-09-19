package com.quicktest.modules.session;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.controller.StudentAttemptController;
import com.quicktest.modules.session.dto.StudentAttemptDetailResponse;
import com.quicktest.modules.session.dto.StudentAttemptSummaryDto;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.service.StudentAttemptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for StudentAttemptController.
 * Validates request routing, parameter extraction, response encapsulation,
 * and security authentication checks for student attempt endpoints.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class StudentAttemptControllerTest {

    @Mock
    private StudentAttemptService studentAttemptService;

    @InjectMocks
    private StudentAttemptController studentAttemptController;

    private User studentUser;
    private UserDetailsImpl currentUser;
    private UUID studentId;
    private UUID attemptId;

    @BeforeEach
    void setUp() {
        studentId = UUID.randomUUID();
        attemptId = UUID.randomUUID();

        studentUser = User.builder()
                .id(studentId)
                .username("student_jane")
                .email("jane@quicktest.com")
                .role(Role.STUDENT)
                .build();

        currentUser = UserDetailsImpl.build(studentUser);
    }

    @Test
    @DisplayName("getStudentAttempts - Returns 200 with paginated attempt history")
    void getStudentAttempts_Success() {
        StudentAttemptSummaryDto summary = new StudentAttemptSummaryDto(
                attemptId,
                UUID.randomUUID(),
                "Physics Final Exam",
                LocalDateTime.now().minusHours(2),
                LocalDateTime.now().minusHours(1),
                AttemptStatus.SUBMITTED,
                9.0,
                10.0,
                0L
        );
        PageResponse<StudentAttemptSummaryDto> pageResponse = PageResponse.from(
                new PageImpl<>(List.of(summary), PageRequest.of(0, 10), 1));

        when(studentAttemptService.getStudentAttempts(eq(studentId), any(Pageable.class)))
                .thenReturn(pageResponse);

        ResponseEntity<ApiResponse<PageResponse<StudentAttemptSummaryDto>>> response =
                studentAttemptController.getStudentAttempts(currentUser, PageRequest.of(0, 10));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(200, response.getBody().getStatus());
        assertEquals("Attempt history retrieved successfully", response.getBody().getMessage());
        assertEquals(1, response.getBody().getData().getContent().size());
        assertEquals("Physics Final Exam", response.getBody().getData().getContent().get(0).getExamTitle());
        verify(studentAttemptService, times(1)).getStudentAttempts(eq(studentId), any(Pageable.class));
    }

    @Test
    @DisplayName("getStudentAttempts - Throws 401 UNAUTHORIZED when currentUser is null")
    void getStudentAttempts_Unauthenticated() {
        AppException ex = assertThrows(AppException.class, () ->
                studentAttemptController.getStudentAttempts(null, PageRequest.of(0, 10)));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertTrue(ex.getMessage().contains("User must be authenticated"));
        verifyNoInteractions(studentAttemptService);
    }

    @Test
    @DisplayName("getStudentAttemptDetail - Returns 200 with detailed attempt response")
    void getStudentAttemptDetail_Success() {
        StudentAttemptDetailResponse detailResponse = StudentAttemptDetailResponse.builder()
                .attemptId(attemptId)
                .examId(UUID.randomUUID())
                .examTitle("Physics Final Exam")
                .accessCode("PHY-101")
                .status(AttemptStatus.SUBMITTED)
                .awardedScore(9.0)
                .maxScore(10.0)
                .startTime(LocalDateTime.now().minusHours(2))
                .submitTime(LocalDateTime.now().minusHours(1))
                .durationSeconds(3600L)
                .violationCount(0)
                .violations(Collections.emptyList())
                .questions(Collections.emptyList())
                .build();

        when(studentAttemptService.getStudentAttemptDetail(attemptId, studentId))
                .thenReturn(detailResponse);

        ResponseEntity<ApiResponse<StudentAttemptDetailResponse>> response =
                studentAttemptController.getStudentAttemptDetail(attemptId, currentUser);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(200, response.getBody().getStatus());
        assertEquals("Attempt details retrieved successfully", response.getBody().getMessage());
        assertEquals(attemptId, response.getBody().getData().getAttemptId());
        assertEquals("PHY-101", response.getBody().getData().getAccessCode());
        verify(studentAttemptService, times(1)).getStudentAttemptDetail(attemptId, studentId);
    }

    @Test
    @DisplayName("getStudentAttemptDetail - Throws 401 UNAUTHORIZED when currentUser is null")
    void getStudentAttemptDetail_Unauthenticated() {
        AppException ex = assertThrows(AppException.class, () ->
                studentAttemptController.getStudentAttemptDetail(attemptId, null));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertTrue(ex.getMessage().contains("User must be authenticated"));
        verifyNoInteractions(studentAttemptService);
    }

    @Test
    @DisplayName("getStudentAttemptDetail - Propagates 403 FORBIDDEN when attempt belongs to another student")
    void getStudentAttemptDetail_ForbiddenImposter() {
        when(studentAttemptService.getStudentAttemptDetail(attemptId, studentId))
                .thenThrow(new AppException("You do not have permission to view this attempt", HttpStatus.FORBIDDEN));

        AppException ex = assertThrows(AppException.class, () ->
                studentAttemptController.getStudentAttemptDetail(attemptId, currentUser));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertTrue(ex.getMessage().contains("You do not have permission"));
    }
}
