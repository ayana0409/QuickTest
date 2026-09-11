package com.quicktest.modules.proctoring;

import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.proctoring.dto.*;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.proctoring.service.ProctoringServiceImpl;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ProctoringServiceImpl.
 * Validates violation logging, Redis counter increments, auto-disqualification
 * threshold,
 * teacher authorization, and telemetry status queries.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ProctoringServiceTest {

        @Mock
        private ExamRepository examRepository;

        @Mock
        private ExamAttemptRepository examAttemptRepository;

        @Mock
        private ViolationLogRepository violationLogRepository;

        @Mock
        private StringRedisTemplate stringRedisTemplate;

        @Mock
        private ValueOperations<String, String> valueOperations;

        @Mock
        private SimpMessagingTemplate messagingTemplate;

        @InjectMocks
        private ProctoringServiceImpl proctoringService;

        private User teacher;
        private User otherTeacher;
        private User student;
        private Exam exam;
        private ExamAttempt attempt;
        private UUID examId;
        private UUID attemptId;

        @BeforeEach
        void setUp() {
                teacher = User.builder()
                                .id(UUID.randomUUID())
                                .username("teacher_proctor")
                                .email("teacher@quicktest.com")
                                .role(Role.TEACHER)
                                .build();

                otherTeacher = User.builder()
                                .id(UUID.randomUUID())
                                .username("other_teacher")
                                .email("other@quicktest.com")
                                .role(Role.TEACHER)
                                .build();

                student = User.builder()
                                .id(UUID.randomUUID())
                                .username("candidate_one")
                                .email("student@quicktest.com")
                                .role(Role.STUDENT)
                                .build();

                examId = UUID.randomUUID();
                exam = Exam.builder()
                                .id(examId)
                                .title("Final Exam with Proctoring")
                                .accessCode("PROC123")
                                .createdBy(teacher)
                                .durationMinutes(60)
                                .build();

                attemptId = UUID.randomUUID();
                attempt = ExamAttempt.builder()
                                .id(attemptId)
                                .exam(exam)
                                .user(student)
                                .status(AttemptStatus.IN_PROGRESS)
                                .violationCount(0)
                                .startTime(LocalDateTime.now())
                                .build();

                lenient().when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        }

        @Test
        @DisplayName("recordViolation - First violation should increment counter and return warning alert")
        void recordViolation_FirstViolation_Success() {
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));
                when(valueOperations.increment(anyString())).thenReturn(1L);

                ViolationReportMessage report = ViolationReportMessage.builder()
                                .attemptId(attemptId)
                                .violationType(ViolationType.TAB_SWITCH)
                                .description("Tab switch detected")
                                .build();

                ViolationAlertMessage alert = proctoringService.recordViolation(attemptId, report, student.getId());

                assertNotNull(alert);
                assertEquals(1, alert.getViolationCount());
                assertFalse(alert.getDisqualified());
                assertEquals(4, alert.getRemainingAllowed());
                assertEquals(AttemptStatus.IN_PROGRESS, attempt.getStatus());

                verify(violationLogRepository).save(any(ViolationLog.class));
                verify(examAttemptRepository).save(attempt);
                verify(messagingTemplate, atLeastOnce()).convertAndSend(contains("/topic/attempts/"),
                                any(ViolationAlertMessage.class));
        }

        @Test
        @DisplayName("recordViolation - Exceeding 5 violations should auto-disqualify candidate")
        void recordViolation_ExceedThreshold_AutoDisqualify() {
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));
                when(valueOperations.increment(anyString())).thenReturn(5L);

                ViolationReportMessage report = ViolationReportMessage.builder()
                                .attemptId(attemptId)
                                .violationType(ViolationType.DEVTOOLS_OPEN)
                                .description("Developer tools opened")
                                .build();

                ViolationAlertMessage alert = proctoringService.recordViolation(attemptId, report, student.getId());

                assertNotNull(alert);
                assertEquals(5, alert.getViolationCount());
                assertTrue(alert.getDisqualified());
                assertEquals(0, alert.getRemainingAllowed());
                assertEquals(AttemptStatus.DISQUALIFIED, attempt.getStatus());

                verify(violationLogRepository).save(any(ViolationLog.class));
                verify(examAttemptRepository).save(attempt);
        }

        @Test
        @DisplayName("recordViolation - Attempt not IN_PROGRESS should throw AppException")
        void recordViolation_NotInProgress_ThrowsException() {
                attempt.setStatus(AttemptStatus.SUBMITTED);
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));

                ViolationReportMessage report = ViolationReportMessage.builder()
                                .attemptId(attemptId)
                                .violationType(ViolationType.TAB_SWITCH)
                                .build();

                assertThrows(AppException.class,
                                () -> proctoringService.recordViolation(attemptId, report, student.getId()));
        }

        @Test
        @DisplayName("recordViolation - Unauthorized user submitting telemetry should throw AccessDeniedException")
        void recordViolation_WrongUser_ThrowsAccessDenied() {
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));

                ViolationReportMessage report = ViolationReportMessage.builder()
                                .attemptId(attemptId)
                                .violationType(ViolationType.TAB_SWITCH)
                                .build();

                UUID impostorUserId = UUID.randomUUID();
                assertThrows(AccessDeniedException.class,
                                () -> proctoringService.recordViolation(attemptId, report, impostorUserId));
        }

        @Test
        @DisplayName("disqualifyAttempt - Teacher manually disqualifying candidate should succeed")
        void disqualifyAttempt_Success() {
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));

                proctoringService.disqualifyAttempt(attemptId, "Suspicious behavior observed", teacher);

                assertEquals(AttemptStatus.DISQUALIFIED, attempt.getStatus());
                verify(violationLogRepository).save(any(ViolationLog.class));
                verify(examAttemptRepository).save(attempt);
                verify(messagingTemplate, atLeastOnce()).convertAndSend(contains("/topic/attempts/"),
                                any(ViolationAlertMessage.class));
        }

        @Test
        @DisplayName("disqualifyAttempt - Non-owner teacher should throw AccessDeniedException")
        void disqualifyAttempt_NonOwner_ThrowsAccessDenied() {
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));

                assertThrows(AccessDeniedException.class,
                                () -> proctoringService.disqualifyAttempt(attemptId, "Reason", otherTeacher));
                verify(examAttemptRepository, never()).save(any());
        }

        @Test
        @DisplayName("disqualifyAttempt - Already disqualified attempt should throw AppException")
        void disqualifyAttempt_AlreadyDisqualified_ThrowsException() {
                attempt.setStatus(AttemptStatus.DISQUALIFIED);
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));

                assertThrows(AppException.class,
                                () -> proctoringService.disqualifyAttempt(attemptId, "Reason", teacher));
        }

        @Test
        @DisplayName("getAttemptViolations - Returns complete audit logs")
        void getAttemptViolations_Success() {
                when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));

                ViolationLog log1 = ViolationLog.builder()
                                .id(UUID.randomUUID())
                                .examAttempt(attempt)
                                .violationType(ViolationType.TAB_SWITCH)
                                .description("Tab switch")
                                .timestamp(LocalDateTime.now().minusMinutes(5))
                                .build();

                when(violationLogRepository.findByExamAttemptIdOrderByTimestampAsc(attemptId))
                                .thenReturn(List.of(log1));

                List<ViolationLogResponse> violations = proctoringService.getAttemptViolations(attemptId, teacher);

                assertNotNull(violations);
                assertEquals(1, violations.size());
                assertEquals(ViolationType.TAB_SWITCH, violations.get(0).getViolationType());
        }

        @Test
        @DisplayName("getAttemptRealtimeStatus - Aggregates violation breakdown and status")
        void getAttemptRealtimeStatus_Success() {
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));
                when(valueOperations.get(contains("count"))).thenReturn("2");
                when(stringRedisTemplate.hasKey(contains("heartbeat"))).thenReturn(true);

                List<Object[]> grouped = Collections.singletonList(new Object[] { ViolationType.TAB_SWITCH, 2L });
                when(violationLogRepository.countByViolationTypeGrouped(attemptId)).thenReturn(grouped);
                when(violationLogRepository.findByExamAttemptIdOrderByTimestampDesc(attemptId))
                                .thenReturn(Collections.emptyList());

                AttemptRealtimeStatusResponse status = proctoringService.getAttemptRealtimeStatus(attemptId, teacher);

                assertNotNull(status);
                assertEquals(2, status.getViolationCount());
                assertTrue(status.getIsOnline());
                assertEquals(2L, status.getViolationBreakdown().get(ViolationType.TAB_SWITCH));
        }

        @Test
        @DisplayName("getExamMonitoring - Teacher views paginated candidate list")
        void getExamMonitoring_Success() {
                when(examRepository.findById(examId)).thenReturn(Optional.of(exam));
                Page<ExamAttempt> page = new PageImpl<>(List.of(attempt), PageRequest.of(0, 10), 1);
                when(examAttemptRepository.findByExamId(eq(examId), any(Pageable.class))).thenReturn(page);

                PageResponse<AttemptMonitorResponse> result = proctoringService.getExamMonitoring(
                                examId, null, null, PageRequest.of(0, 10), teacher);

                assertNotNull(result);
                assertEquals(1, result.getTotalElements());
                assertEquals(1, result.getContent().size());
                assertEquals(attemptId, result.getContent().get(0).getAttemptId());
        }
}
