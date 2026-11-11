package com.quicktest.modules.session;

import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.dto.TeacherDashboardResponse;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import com.quicktest.modules.session.service.TeacherDashboardServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TeacherDashboardServiceImpl}.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class TeacherDashboardServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private CandidateAnswerRepository candidateAnswerRepository;

    @Mock
    private ViolationLogRepository violationLogRepository;

    @InjectMocks
    private TeacherDashboardServiceImpl teacherDashboardService;

    private UUID teacherId;

    @BeforeEach
    void setUp() {
        teacherId = UUID.randomUUID();
    }

    @Test
    @DisplayName("getTeacherDashboard: Aggregates exam, question, attempt, 7-day series, priority exams and violations")
    void getTeacherDashboard_Success() {
        LocalDate today = LocalDate.now();
        UUID priorityExamId = UUID.randomUUID();
        LocalDateTime createdAt = LocalDateTime.now().minusDays(2).withNano(0);

        when(examRepository.computeTeacherExamMetrics(teacherId))
                .thenReturn(new Object[]{11L, 3L, 5L, 3L});

        when(questionRepository.computeTeacherQuestionMetrics(teacherId))
                .thenReturn(new Object[]{180L, 100L, 45L, 15L, 20L});

        // Simulate Hibernate 6 wrapping single aggregate row in Object[][]
        Object[] innerAttemptRow = new Object[]{90L, 6L, 72L, 9L, 3L, 8.246, 11L};
        when(examAttemptRepository.computeTeacherAttemptMetrics(teacherId))
                .thenReturn(new Object[]{innerAttemptRow});

        when(candidateAnswerRepository.countPendingManualAnswersByTeacherId(teacherId))
                .thenReturn(17L);

        when(examAttemptRepository.countTeacherDailyAttemptsSince(eq(teacherId), any()))
                .thenReturn(Collections.singletonList(
                        new Object[]{java.sql.Date.valueOf(today), 14L, 10L}));

        when(violationLogRepository.countTeacherDailyViolationsSince(eq(teacherId), any()))
                .thenReturn(Collections.singletonList(
                        new Object[]{java.sql.Date.valueOf(today), 2L}));

        Object[] priorityRow = new Object[]{
                priorityExamId,
                "Giữa kỳ Giải tích 1",
                "MATH2026",
                "PUBLISHED",
                60,
                Timestamp.valueOf(createdAt),
                35L,
                4L,
                25L,
                6L,
                new BigDecimal("7.846")
        };
        when(examRepository.findTeacherPriorityExams(teacherId))
                .thenReturn(Collections.singletonList(priorityRow));

        Exam exam = Exam.builder().id(priorityExamId).title("Giữa kỳ Giải tích 1").build();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .guestName("Nguyễn Văn An")
                .guestIdentifier("SV001")
                .build();
        ViolationLog recentLog = ViolationLog.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .violationType(ViolationType.TAB_SWITCH)
                .description("Switched browser tab")
                .timestamp(LocalDateTime.now().withNano(0))
                .build();
        when(violationLogRepository.findRecentViolationsByTeacherId(eq(teacherId), any()))
                .thenReturn(List.of(recentLog));

        TeacherDashboardResponse dashboard = teacherDashboardService.getTeacherDashboard(teacherId);

        assertNotNull(dashboard);
        assertEquals(11L, dashboard.getTotalExams());
        assertEquals(3L, dashboard.getDraftExams());
        assertEquals(5L, dashboard.getPublishedExams());
        assertEquals(3L, dashboard.getClosedExams());

        assertEquals(180L, dashboard.getTotalQuestions());
        assertEquals(100L, dashboard.getSingleChoiceQuestions());
        assertEquals(45L, dashboard.getMultipleChoiceQuestions());
        assertEquals(15L, dashboard.getNumericQuestions());
        assertEquals(20L, dashboard.getEssayQuestions());

        assertEquals(90L, dashboard.getTotalAttempts());
        assertEquals(6L, dashboard.getInProgressAttempts());
        assertEquals(72L, dashboard.getSubmittedAttempts());
        assertEquals(9L, dashboard.getAwaitingGradingAttempts());
        assertEquals(3L, dashboard.getDisqualifiedAttempts());
        assertEquals(17L, dashboard.getPendingManualAnswers());
        assertEquals(8.25, dashboard.getAverageScore(), 0.001);
        assertEquals(11L, dashboard.getTotalViolations());

        assertEquals(7, dashboard.getDailyActivities().size());
        assertEquals(14L, dashboard.getDailyActivities().get(6).getAttemptsCount());
        assertEquals(10L, dashboard.getDailyActivities().get(6).getSubmittedCount());
        assertEquals(2L, dashboard.getDailyActivities().get(6).getViolationsCount());

        assertEquals(1, dashboard.getPriorityExams().size());
        TeacherDashboardResponse.TeacherExamOverviewItem topExam = dashboard.getPriorityExams().get(0);
        assertEquals(priorityExamId, topExam.getId());
        assertEquals("Giữa kỳ Giải tích 1", topExam.getTitle());
        assertEquals("MATH2026", topExam.getAccessCode());
        assertEquals("PUBLISHED", topExam.getStatus());
        assertEquals(60, topExam.getDurationMinutes());
        assertEquals(createdAt, topExam.getCreatedAt());
        assertEquals(35L, topExam.getTotalAttempts());
        assertEquals(4L, topExam.getInProgressCount());
        assertEquals(25L, topExam.getSubmittedCount());
        assertEquals(6L, topExam.getPendingGradingCount());
        assertEquals(7.85, topExam.getAverageScore(), 0.001);

        assertEquals(1, dashboard.getRecentViolations().size());
        assertEquals("Nguyễn Văn An", dashboard.getRecentViolations().get(0).getCandidateName());
        assertEquals(ViolationType.TAB_SWITCH, dashboard.getRecentViolations().get(0).getViolationType());
    }

    @Test
    @DisplayName("getTeacherDashboard: Handles empty repository rows and missing dates cleanly")
    void getTeacherDashboard_EmptyState() {
        when(examRepository.computeTeacherExamMetrics(teacherId)).thenReturn(new Object[0]);
        when(questionRepository.computeTeacherQuestionMetrics(teacherId)).thenReturn(null);
        when(examAttemptRepository.computeTeacherAttemptMetrics(teacherId)).thenReturn(new Object[0]);
        when(candidateAnswerRepository.countPendingManualAnswersByTeacherId(teacherId)).thenReturn(0L);
        when(examAttemptRepository.countTeacherDailyAttemptsSince(eq(teacherId), any())).thenReturn(Collections.emptyList());
        when(violationLogRepository.countTeacherDailyViolationsSince(eq(teacherId), any())).thenReturn(Collections.emptyList());
        when(examRepository.findTeacherPriorityExams(teacherId)).thenReturn(Collections.emptyList());
        when(violationLogRepository.findRecentViolationsByTeacherId(eq(teacherId), any())).thenReturn(Collections.emptyList());

        TeacherDashboardResponse dashboard = teacherDashboardService.getTeacherDashboard(teacherId);

        assertNotNull(dashboard);
        assertEquals(0L, dashboard.getTotalExams());
        assertEquals(0L, dashboard.getTotalQuestions());
        assertEquals(0L, dashboard.getTotalAttempts());
        assertEquals(0.0, dashboard.getAverageScore(), 0.001);
        assertEquals(7, dashboard.getDailyActivities().size());
        assertTrue(dashboard.getPriorityExams().isEmpty());
        assertTrue(dashboard.getRecentViolations().isEmpty());
    }

    @Test
    @DisplayName("refreshTeacherDashboard: Recomputes teacher metrics cleanly")
    void refreshTeacherDashboard_Success() {
        when(examRepository.computeTeacherExamMetrics(teacherId)).thenReturn(new Object[]{3L, 1L, 2L, 0L});
        when(questionRepository.computeTeacherQuestionMetrics(teacherId)).thenReturn(new Object[]{45L, 30L, 10L, 2L, 3L});
        when(examAttemptRepository.computeTeacherAttemptMetrics(teacherId)).thenReturn(new Object[]{18L, 1L, 17L, 0L, 0L, 9.1, 0L});
        when(candidateAnswerRepository.countPendingManualAnswersByTeacherId(teacherId)).thenReturn(0L);
        when(examAttemptRepository.countTeacherDailyAttemptsSince(eq(teacherId), any())).thenReturn(Collections.emptyList());
        when(violationLogRepository.countTeacherDailyViolationsSince(eq(teacherId), any())).thenReturn(Collections.emptyList());
        when(examRepository.findTeacherPriorityExams(teacherId)).thenReturn(Collections.emptyList());
        when(violationLogRepository.findRecentViolationsByTeacherId(eq(teacherId), any())).thenReturn(Collections.emptyList());

        TeacherDashboardResponse refreshed = teacherDashboardService.refreshTeacherDashboard(teacherId);

        assertNotNull(refreshed);
        assertEquals(3L, refreshed.getTotalExams());
        assertEquals(45L, refreshed.getTotalQuestions());
        assertEquals(18L, refreshed.getTotalAttempts());
        assertEquals(9.1, refreshed.getAverageScore(), 0.001);
        verify(examRepository, times(1)).computeTeacherExamMetrics(teacherId);
    }
}

