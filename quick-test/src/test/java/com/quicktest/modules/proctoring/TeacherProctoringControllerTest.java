package com.quicktest.modules.proctoring;

import com.quicktest.core.common.PageResponse;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.proctoring.controller.TeacherProctoringController;
import com.quicktest.modules.proctoring.dto.*;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.service.ProctoringService;
import com.quicktest.modules.session.entity.AttemptStatus;
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

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for TeacherProctoringController.
 * Validates endpoint delegation, parameters, and response structures.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class TeacherProctoringControllerTest {

        @Mock
        private ProctoringService proctoringService;

        @Mock
        private UserRepository userRepository;

        @InjectMocks
        private TeacherProctoringController teacherProctoringController;

        private User teacher;
        private UserDetailsImpl currentUser;
        private UUID examId;
        private UUID attemptId;

        @BeforeEach
        void setUp() {
                UUID teacherId = UUID.randomUUID();
                teacher = User.builder()
                                .id(teacherId)
                                .username("proctor_teacher")
                                .email("proctor@quicktest.com")
                                .role(Role.TEACHER)
                                .build();

                currentUser = UserDetailsImpl.build(teacher);
                examId = UUID.randomUUID();
                attemptId = UUID.randomUUID();

                lenient().when(userRepository.findById(teacherId)).thenReturn(Optional.of(teacher));
        }

        @Test
        @DisplayName("getExamMonitoring - Returns 200 with paginated monitoring list")
        void getExamMonitoring_Success() {
                AttemptMonitorResponse item = AttemptMonitorResponse.builder()
                                .attemptId(attemptId)
                                .examId(examId)
                                .candidateName("Alice Student")
                                .status(AttemptStatus.IN_PROGRESS)
                                .violationCount(1)
                                .build();

                PageResponse<AttemptMonitorResponse> pageResponse = PageResponse.from(
                                new PageImpl<>(List.of(item), PageRequest.of(0, 10), 1));

                when(proctoringService.getExamMonitoring(eq(examId), isNull(), isNull(), any(Pageable.class),
                                eq(teacher)))
                                .thenReturn(pageResponse);

                var response = teacherProctoringController.getExamMonitoring(
                                examId, null, null, PageRequest.of(0, 10), currentUser);

                assertEquals(HttpStatus.OK, response.getStatusCode());
                assertNotNull(response.getBody());
                assertEquals(200, response.getBody().getStatus());
                assertEquals(1, response.getBody().getData().getContent().size());
        }

        @Test
        @DisplayName("getAttemptViolations - Returns 200 with audit list")
        void getAttemptViolations_Success() {
                ViolationLogResponse logItem = ViolationLogResponse.builder()
                                .id(UUID.randomUUID())
                                .attemptId(attemptId)
                                .violationType(ViolationType.TAB_SWITCH)
                                .description("Tab switch")
                                .timestamp(LocalDateTime.now())
                                .build();

                when(proctoringService.getAttemptViolations(attemptId, teacher))
                                .thenReturn(List.of(logItem));

                var response = teacherProctoringController.getAttemptViolations(attemptId, currentUser);

                assertEquals(HttpStatus.OK, response.getStatusCode());
                assertNotNull(response.getBody());
                assertEquals(1, response.getBody().getData().size());
                assertEquals(ViolationType.TAB_SWITCH, response.getBody().getData().get(0).getViolationType());
        }

        @Test
        @DisplayName("getAttemptStatus - Returns 200 with realtime status")
        void getAttemptStatus_Success() {
                AttemptRealtimeStatusResponse status = AttemptRealtimeStatusResponse.builder()
                                .attemptId(attemptId)
                                .examId(examId)
                                .candidateName("Bob")
                                .status(AttemptStatus.IN_PROGRESS)
                                .violationCount(2)
                                .isOnline(true)
                                .build();

                when(proctoringService.getAttemptRealtimeStatus(attemptId, teacher))
                                .thenReturn(status);

                var response = teacherProctoringController.getAttemptStatus(attemptId, currentUser);

                assertEquals(HttpStatus.OK, response.getStatusCode());
                assertNotNull(response.getBody());
                assertTrue(response.getBody().getData().getIsOnline());
        }

        @Test
        @DisplayName("disqualifyAttempt - Returns 200 on manual disqualification")
        void disqualifyAttempt_Success() {
                doNothing().when(proctoringService).disqualifyAttempt(attemptId, "Violation detected", teacher);

                DisqualifyAttemptRequest request = DisqualifyAttemptRequest.builder()
                                .reason("Violation detected")
                                .build();

                var response = teacherProctoringController.disqualifyAttempt(attemptId, request, currentUser);

                assertEquals(HttpStatus.OK, response.getStatusCode());
                assertNotNull(response.getBody());
                assertEquals(200, response.getBody().getStatus());
                verify(proctoringService).disqualifyAttempt(attemptId, "Violation detected", teacher);
        }
}
