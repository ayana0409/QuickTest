package com.quicktest.modules.session.service;

import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.dto.StudentAttemptDetailResponse;
import com.quicktest.modules.session.dto.StudentAttemptSummaryDto;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for StudentAttemptServiceImpl.
 * Validates history listing with pagination, detailed attempt retrieval,
 * ownership authorization security checks, and calculation of scores and duration.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class StudentAttemptServiceTest {

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private CandidateAnswerRepository candidateAnswerRepository;

    @Mock
    private ViolationLogRepository violationLogRepository;

    @InjectMocks
    private StudentAttemptServiceImpl studentAttemptService;

    private User studentUser;
    private User otherUser;
    private Exam exam;
    private ExamAttempt attempt;
    private UUID studentId;
    private UUID otherId;
    private UUID attemptId;

    @BeforeEach
    void setUp() {
        studentId = UUID.randomUUID();
        otherId = UUID.randomUUID();
        attemptId = UUID.randomUUID();

        studentUser = User.builder()
                .id(studentId)
                .username("student_john")
                .email("john@quicktest.com")
                .fullName("John Doe")
                .build();

        otherUser = User.builder()
                .id(otherId)
                .username("student_alice")
                .email("alice@quicktest.com")
                .fullName("Alice Wonder")
                .build();

        exam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Midterm Biology Exam")
                .accessCode("BIO-2026")
                .durationMinutes(45)
                .build();

        attempt = ExamAttempt.builder()
                .id(attemptId)
                .user(studentUser)
                .exam(exam)
                .status(AttemptStatus.SUBMITTED)
                .totalScore(8.5)
                .violationCount(1)
                .startTime(LocalDateTime.now().minusMinutes(30))
                .submitTime(LocalDateTime.now().minusMinutes(5))
                .build();
    }

    @Test
    @DisplayName("getStudentAttempts: Should return paginated list of student attempts")
    void getStudentAttempts_Success() {
        Pageable pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "startTime"));
        StudentAttemptSummaryDto summary = new StudentAttemptSummaryDto(
                attemptId,
                exam.getId(),
                "Midterm Biology Exam",
                attempt.getStartTime(),
                attempt.getSubmitTime(),
                AttemptStatus.SUBMITTED,
                8.5,
                10.0,
                1L
        );
        Page<StudentAttemptSummaryDto> page = new PageImpl<>(List.of(summary), pageable, 1);

        when(examAttemptRepository.findStudentAttemptSummaries(eq(studentId), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<StudentAttemptSummaryDto> result = studentAttemptService.getStudentAttempts(studentId, pageable);

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertEquals(attemptId, result.getContent().get(0).getAttemptId());
        assertEquals("Midterm Biology Exam", result.getContent().get(0).getExamTitle());
        assertEquals(8.5, result.getContent().get(0).getAwardedScore());
        assertEquals(1, result.getContent().get(0).getViolationCount());
        verify(examAttemptRepository, times(1)).findStudentAttemptSummaries(eq(studentId), any(Pageable.class));
    }

    @Test
    @DisplayName("getStudentAttempts: Should set default maxScore to 10.0 when maxScore is null or zero")
    void getStudentAttempts_DefaultMaxScore() {
        Pageable pageable = PageRequest.of(0, 10);
        StudentAttemptSummaryDto summaryWithNullMax = new StudentAttemptSummaryDto(
                attemptId,
                exam.getId(),
                "Open Practice Quiz",
                attempt.getStartTime(),
                attempt.getSubmitTime(),
                AttemptStatus.SUBMITTED,
                5.0,
                null,
                0L
        );
        Page<StudentAttemptSummaryDto> page = new PageImpl<>(List.of(summaryWithNullMax), pageable, 1);

        when(examAttemptRepository.findStudentAttemptSummaries(eq(studentId), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<StudentAttemptSummaryDto> result = studentAttemptService.getStudentAttempts(studentId, pageable);

        assertNotNull(result);
        assertEquals(10.0, result.getContent().get(0).getMaxScore());
    }

    @Test
    @DisplayName("getStudentAttemptDetail: Should return full attempt details with questions, answers, and violations")
    void getStudentAttemptDetail_Success() {
        // Prepare question and options
        UUID opt1Id = UUID.randomUUID();
        UUID opt2Id = UUID.randomUUID();
        AnswerOption opt1 = AnswerOption.builder()
                .id(opt1Id)
                .content("Mitochondria")
                .orderIndex(1)
                .isCorrect(true)
                .build();
        AnswerOption opt2 = AnswerOption.builder()
                .id(opt2Id)
                .content("Ribosome")
                .orderIndex(2)
                .isCorrect(false)
                .build();

        Question question = Question.builder()
                .id(UUID.randomUUID())
                .content("What is the powerhouse of the cell?")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(2.0)
                .orderIndex(1)
                .options(List.of(opt1, opt2))
                .build();

        CandidateAnswer answer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(question)
                .selectedOptions(Set.of(opt1))
                .awardedScore(2.0)
                .gradingStatus(GradingStatus.GRADED)
                .build();

        ViolationLog violation = ViolationLog.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .violationType(ViolationType.TAB_SWITCH)
                .description("Switched browser tab")
                .timestamp(LocalDateTime.now().minusMinutes(20))
                .build();

        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));
        when(candidateAnswerRepository.findByExamAttemptIdWithQuestion(attemptId)).thenReturn(List.of(answer));
        when(violationLogRepository.findByExamAttemptIdOrderByTimestampAsc(attemptId)).thenReturn(List.of(violation));

        StudentAttemptDetailResponse detail = studentAttemptService.getStudentAttemptDetail(attemptId, studentId);

        assertNotNull(detail);
        assertEquals(attemptId, detail.getAttemptId());
        assertEquals("Midterm Biology Exam", detail.getExamTitle());
        assertEquals("BIO-2026", detail.getAccessCode());
        assertEquals(8.5, detail.getAwardedScore());
        assertEquals(2.0, detail.getMaxScore()); // Sum of question points: 2.0
        assertNotNull(detail.getDurationSeconds());
        assertTrue(detail.getDurationSeconds() > 0);

        // Verify violation telemetry
        assertEquals(1, detail.getViolations().size());
        assertEquals(ViolationType.TAB_SWITCH, detail.getViolations().get(0).getViolationType());
        assertEquals("Switched browser tab", detail.getViolations().get(0).getDescription());

        // Verify questions and choices
        assertEquals(1, detail.getQuestions().size());
        StudentAttemptDetailResponse.QuestionDetailDto qDto = detail.getQuestions().get(0);
        assertEquals(2.0, qDto.getAwardedScore());
        assertEquals(2, qDto.getOptions().size());
        assertTrue(qDto.getSelectedOptionIds().contains(opt1Id));

        StudentAttemptDetailResponse.OptionDto optDto1 = qDto.getOptions().stream()
                .filter(o -> o.getId().equals(opt1Id)).findFirst().orElseThrow();
        assertTrue(optDto1.getIsSelected());
        assertTrue(optDto1.getIsCorrect());

        StudentAttemptDetailResponse.OptionDto optDto2 = qDto.getOptions().stream()
                .filter(o -> o.getId().equals(opt2Id)).findFirst().orElseThrow();
        assertFalse(optDto2.getIsSelected());
        assertFalse(optDto2.getIsCorrect());
    }

    @Test
    @DisplayName("getStudentAttemptDetail: Should throw 404 NOT_FOUND when attempt ID does not exist")
    void getStudentAttemptDetail_NotFound() {
        UUID nonExistentId = UUID.randomUUID();
        when(examAttemptRepository.findByIdWithExamAndUser(nonExistentId)).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () ->
                studentAttemptService.getStudentAttemptDetail(nonExistentId, studentId));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertTrue(ex.getMessage().contains("ExamAttempt not found"));
    }

    @Test
    @DisplayName("getStudentAttemptDetail: Should throw 403 FORBIDDEN when user is not the owner of the attempt")
    void getStudentAttemptDetail_AccessDeniedForDifferentUser() {
        // Attempt belongs to studentUser, but requested by otherUser
        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));

        AppException ex = assertThrows(AppException.class, () ->
                studentAttemptService.getStudentAttemptDetail(attemptId, otherId));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertTrue(ex.getMessage().contains("Access denied"));
    }

    @Test
    @DisplayName("getStudentAttemptDetail: Should handle essay questions with teacher feedback and sample answers")
    void getStudentAttemptDetail_EssayQuestion() {
        Question essayQuestion = Question.builder()
                .id(UUID.randomUUID())
                .content("Explain photosynthesis in detail.")
                .questionType(QuestionType.ESSAY_TEXT)
                .points(5.0)
                .orderIndex(1)
                .sampleAnswer("Photosynthesis converts light energy into chemical energy...")
                .build();

        CandidateAnswer essayAnswer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(essayQuestion)
                .textAnswer("Plants use chlorophyll and sunlight to make glucose.")
                .teacherFeedback("Good explanation, but missing mention of oxygen release.")
                .awardedScore(4.0)
                .gradingStatus(GradingStatus.GRADED)
                .build();

        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));
        when(candidateAnswerRepository.findByExamAttemptIdWithQuestion(attemptId)).thenReturn(List.of(essayAnswer));
        when(violationLogRepository.findByExamAttemptIdOrderByTimestampAsc(attemptId)).thenReturn(Collections.emptyList());

        StudentAttemptDetailResponse detail = studentAttemptService.getStudentAttemptDetail(attemptId, studentId);

        assertNotNull(detail);
        assertEquals(1, detail.getQuestions().size());
        StudentAttemptDetailResponse.QuestionDetailDto qDto = detail.getQuestions().get(0);
        assertEquals("Plants use chlorophyll and sunlight to make glucose.", qDto.getTextAnswer());
        assertEquals("Photosynthesis converts light energy into chemical energy...", qDto.getSampleAnswer());
        assertEquals("Good explanation, but missing mention of oxygen release.", qDto.getTeacherFeedback());
        assertEquals(4.0, qDto.getAwardedScore());
        assertEquals(5.0, qDto.getPoints());
    }
}
