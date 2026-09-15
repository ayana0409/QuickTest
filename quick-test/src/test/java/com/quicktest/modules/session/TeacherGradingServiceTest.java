package com.quicktest.modules.session;

import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import com.quicktest.modules.session.service.RedisExamSessionService;
import com.quicktest.modules.session.service.TeacherGradingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for TeacherGradingServiceImpl.
 * Validates authorization checks, attempt listing, grading details,
 * score boundaries, and status transitions to SUBMITTED upon completion.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class TeacherGradingServiceTest {

        @Mock
        private ExamRepository examRepository;

        @Mock
        private ExamAttemptRepository examAttemptRepository;

        @Mock
        private CandidateAnswerRepository candidateAnswerRepository;

        @Mock
        private RedisExamSessionService redisExamSessionService;

        @InjectMocks
        private TeacherGradingServiceImpl teacherGradingService;

        private User teacherOwner;
        private User otherTeacher;
        private User studentCandidate;
        private Exam mathExam;
        private ExamAttempt awaitingAttempt;
        private Question essayQ1;
        private Question essayQ2;
        private Question singleChoiceQ;
        private CandidateAnswer essayAns1;
        private CandidateAnswer essayAns2;
        private CandidateAnswer singleChoiceAns;

        @BeforeEach
        void setUp() {
                teacherOwner = User.builder()
                                .id(UUID.randomUUID())
                                .email("teacher@quicktest.com")
                                .fullName("Teacher Owner")
                                .role(Role.TEACHER)
                                .build();

                otherTeacher = User.builder()
                                .id(UUID.randomUUID())
                                .email("other@quicktest.com")
                                .fullName("Other Teacher")
                                .role(Role.TEACHER)
                                .build();

                studentCandidate = User.builder()
                                .id(UUID.randomUUID())
                                .email("student@quicktest.com")
                                .fullName("Student Candidate")
                                .role(Role.STUDENT)
                                .build();

                mathExam = Exam.builder()
                                .id(UUID.randomUUID())
                                .title("Advanced Mathematics Exam")
                                .createdBy(teacherOwner)
                                .build();

                awaitingAttempt = ExamAttempt.builder()
                                .id(UUID.randomUUID())
                                .exam(mathExam)
                                .user(studentCandidate)
                                .status(AttemptStatus.AWAITING_MANUAL_GRADING)
                                .violationCount(2)
                                .startTime(LocalDateTime.now().minusHours(1))
                                .submitTime(LocalDateTime.now().minusMinutes(10))
                                .build();

                singleChoiceQ = Question.builder()
                                .id(UUID.randomUUID())
                                .questionType(QuestionType.SINGLE_CHOICE)
                                .orderIndex(1)
                                .content("What is 2 + 2?")
                                .points(2.0)
                                .build();

                essayQ1 = Question.builder()
                                .id(UUID.randomUUID())
                                .questionType(QuestionType.ESSAY_TEXT)
                                .orderIndex(2)
                                .content("Explain the Pythagorean theorem in detail.")
                                .points(5.0)
                                .sampleAnswer("In a right-angled triangle, a^2 + b^2 = c^2.")
                                .gradingRubric("Full points for clear proof and formula.")
                                .build();

                essayQ2 = Question.builder()
                                .id(UUID.randomUUID())
                                .questionType(QuestionType.ESSAY_TEXT)
                                .orderIndex(3)
                                .content("Explain limits and continuity.")
                                .points(3.0)
                                .sampleAnswer("Limit of f(x) as x approaches c equals f(c).")
                                .gradingRubric("Full points for epsilon-delta or standard continuity definition.")
                                .build();

                mathExam.setQuestions(List.of(singleChoiceQ, essayQ1, essayQ2));

                singleChoiceAns = CandidateAnswer.builder()
                                .id(UUID.randomUUID())
                                .examAttempt(awaitingAttempt)
                                .question(singleChoiceQ)
                                .awardedScore(2.0)
                                .gradingStatus(GradingStatus.AUTO_GRADED)
                                .build();

                essayAns1 = CandidateAnswer.builder()
                                .id(UUID.randomUUID())
                                .examAttempt(awaitingAttempt)
                                .question(essayQ1)
                                .textAnswer("Pythagorean theorem states a^2 + b^2 = c^2 for right triangles.")
                                .awardedScore(0.0)
                                .gradingStatus(GradingStatus.PENDING_MANUAL)
                                .build();

                essayAns2 = CandidateAnswer.builder()
                                .id(UUID.randomUUID())
                                .examAttempt(awaitingAttempt)
                                .question(essayQ2)
                                .textAnswer("Function is continuous if limit exists and matches function value.")
                                .awardedScore(0.0)
                                .gradingStatus(GradingStatus.PENDING_MANUAL)
                                .build();
        }

        @Test
        @DisplayName("getAttemptsToGrade should return paginated list when requested by exam owner without search keyword")
        void getAttemptsToGrade_Success_WhenOwner_WithoutKeyword() {
                UUID examId = mathExam.getId();
                Pageable pageable = PageRequest.of(0, 10, Sort.by("submitTime").descending());
                Page<ExamAttempt> page = new PageImpl<>(List.of(awaitingAttempt), pageable, 1);

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.findByExamIdAndStatus(eq(examId), eq(AttemptStatus.AWAITING_MANUAL_GRADING),
                                eq(pageable)))
                                .thenReturn(page);
                when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(awaitingAttempt.getId(),
                                GradingStatus.PENDING_MANUAL))
                                .thenReturn(2L);

                PageResponse<AttemptSummaryResponse> response = teacherGradingService.getAttemptsToGrade(
                                examId, AttemptStatus.AWAITING_MANUAL_GRADING, null, pageable, teacherOwner);

                assertNotNull(response);
                assertEquals(1, response.getContent().size());
                AttemptSummaryResponse item = response.getContent().get(0);
                assertEquals(awaitingAttempt.getId(), item.getAttemptId());
                assertEquals("Student Candidate", item.getCandidateName());
                assertEquals(AttemptStatus.AWAITING_MANUAL_GRADING, item.getStatus());
                assertEquals(2L, item.getPendingEssayCount());
                assertTrue(item.isHasPendingEssay());
                assertEquals(2, item.getViolationCount());
        }

        @Test
        @DisplayName("getAttemptsToGrade should use search query when keyword is provided")
        void getAttemptsToGrade_Success_WhenOwner_WithSearchKeyword() {
                UUID examId = mathExam.getId();
                Pageable pageable = PageRequest.of(0, 10, Sort.by("submitTime").descending());
                Page<ExamAttempt> page = new PageImpl<>(List.of(awaitingAttempt), pageable, 1);

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.searchAttemptsByExamIdAndStatus(eq(examId),
                                eq(AttemptStatus.AWAITING_MANUAL_GRADING), eq("%student%"), eq(pageable)))
                                .thenReturn(page);
                when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(awaitingAttempt.getId(),
                                GradingStatus.PENDING_MANUAL))
                                .thenReturn(2L);

                PageResponse<AttemptSummaryResponse> response = teacherGradingService.getAttemptsToGrade(
                                examId, AttemptStatus.AWAITING_MANUAL_GRADING, "student", pageable, teacherOwner);

                assertNotNull(response);
                assertEquals(1, response.getContent().size());
        }

        @Test
        @DisplayName("getAttemptsToGrade should throw AccessDeniedException when teacher does not own the exam")
        void getAttemptsToGrade_ThrowsAccessDenied_WhenNotOwner() {
                UUID examId = mathExam.getId();
                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));

                assertThrows(AccessDeniedException.class, () -> teacherGradingService.getAttemptsToGrade(
                                examId, null, null, PageRequest.of(0, 10), otherTeacher));

                verify(examAttemptRepository, never()).findByExamId(any(), any());
                verify(examAttemptRepository, never()).findByExamIdAndStatus(any(), any(), any());
        }

        @Test
        @DisplayName("getAttemptDetailForGrading should return full details with categorized questions")
        void getAttemptDetailForGrading_Success() {
                UUID attemptId = awaitingAttempt.getId();
                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(awaitingAttempt));
                when(candidateAnswerRepository.findByExamAttemptIdWithQuestion(attemptId))
                                .thenReturn(List.of(singleChoiceAns, essayAns1, essayAns2));

                AttemptGradingDetailResponse detail = teacherGradingService.getAttemptDetailForGrading(attemptId,
                                teacherOwner);

                assertNotNull(detail);
                assertEquals(attemptId, detail.getAttemptId());
                assertEquals("Student Candidate", detail.getCandidateName());
                assertEquals(2.0, detail.getAutoGradedScore()); // singleChoiceAns awarded 2.0
                assertEquals(10.0, detail.getMaxTotalPoints()); // 2.0 + 5.0 + 3.0 = 10.0
                assertEquals(2, detail.getEssayQuestions().size());
                assertEquals(1, detail.getAutoGradedQuestions().size());
                assertEquals(2, detail.getViolationCount());

                EssayGradingItemDto essayItem1 = detail.getEssayQuestions().get(0);
                assertEquals(essayAns1.getId(), essayItem1.getCandidateAnswerId());
                assertEquals("Explain the Pythagorean theorem in detail.", essayItem1.getContent());
                assertEquals(5.0, essayItem1.getPoints());
                assertEquals("Full points for clear proof and formula.", essayItem1.getGradingRubric());
        }

        @Test
        @DisplayName("submitEssayGrades should finalize status to SUBMITTED and compute total score when all essays are graded")
        void submitEssayGrades_AllEssaysGraded_FinalizesToSubmitted() {
                UUID attemptId = awaitingAttempt.getId();

                GradeEssaySubmissionRequest request = GradeEssaySubmissionRequest.builder()
                                .attemptId(attemptId)
                                .grades(List.of(
                                                GradeEssayItemRequest.builder()
                                                                .candidateAnswerId(essayAns1.getId())
                                                                .awardedScore(4.5)
                                                                .teacherFeedback(
                                                                                "Great explanation, minor symbol typo.")
                                                                .build(),
                                                GradeEssayItemRequest.builder()
                                                                .candidateAnswerId(essayAns2.getId())
                                                                .awardedScore(3.0)
                                                                .teacherFeedback("Flawless explanation.")
                                                                .build()))
                                .build();

                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(awaitingAttempt));
                when(candidateAnswerRepository.findById(essayAns1.getId())).thenReturn(Optional.of(essayAns1));
                when(candidateAnswerRepository.findById(essayAns2.getId())).thenReturn(Optional.of(essayAns2));

                // When all 2 essays graded, remaining pending count is 0
                when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(attemptId,
                                GradingStatus.PENDING_MANUAL))
                                .thenReturn(0L);
                // Total score = 2.0 (single) + 4.5 (essay1) + 3.0 (essay2) = 9.5
                when(candidateAnswerRepository.sumAwardedScoreByAttemptId(attemptId)).thenReturn(9.5);

                GradingResultResponse response = teacherGradingService.submitEssayGrades(request, teacherOwner);

                assertNotNull(response);
                assertEquals(attemptId, response.getAttemptId());
                assertEquals(AttemptStatus.SUBMITTED, response.getStatus());
                assertEquals(9.5, response.getTotalScore());
                assertEquals(0L, response.getRemainingPendingEssays());
                assertTrue(response.getMessage().contains("All essay questions graded successfully"));

                assertEquals(AttemptStatus.SUBMITTED, awaitingAttempt.getStatus());
                assertEquals(9.5, awaitingAttempt.getTotalScore());
                verify(examAttemptRepository, times(1)).save(awaitingAttempt);
                verify(redisExamSessionService, times(1)).cacheSubmissionResult(eq(attemptId), any(), eq(86400L));
        }

        @Test
        @DisplayName("submitEssayGrades should maintain AWAITING_MANUAL_GRADING when some essays remain pending")
        void submitEssayGrades_PartialGrading_MaintainsAwaitingManualGrading() {
                UUID attemptId = awaitingAttempt.getId();

                // Only grade essayAns1, leaving essayAns2 pending
                GradeEssaySubmissionRequest request = GradeEssaySubmissionRequest.builder()
                                .attemptId(attemptId)
                                .grades(List.of(
                                                GradeEssayItemRequest.builder()
                                                                .candidateAnswerId(essayAns1.getId())
                                                                .awardedScore(4.0)
                                                                .teacherFeedback("Good effort.")
                                                                .build()))
                                .build();

                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(awaitingAttempt));
                when(candidateAnswerRepository.findById(essayAns1.getId())).thenReturn(Optional.of(essayAns1));

                // 1 essay still pending
                when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(attemptId,
                                GradingStatus.PENDING_MANUAL))
                                .thenReturn(1L);
                when(candidateAnswerRepository.sumAwardedScoreByAttemptId(attemptId)).thenReturn(6.0);

                GradingResultResponse response = teacherGradingService.submitEssayGrades(request, teacherOwner);

                assertNotNull(response);
                assertEquals(AttemptStatus.AWAITING_MANUAL_GRADING, response.getStatus());
                assertNull(response.getTotalScore());
                assertEquals(1L, response.getRemainingPendingEssays());
                assertTrue(response.getMessage().contains("1 essay question(s) still pending"));

                assertEquals(AttemptStatus.AWAITING_MANUAL_GRADING, awaitingAttempt.getStatus());
                assertNull(awaitingAttempt.getTotalScore());
                verify(examAttemptRepository, times(1)).save(awaitingAttempt);
        }

        @Test
        @DisplayName("submitEssayGrades should throw IllegalArgumentException when awarded score exceeds question points")
        void submitEssayGrades_ThrowsIllegalArgumentException_WhenScoreExceedsMaxPoints() {
                UUID attemptId = awaitingAttempt.getId();

                // essayQ1 max points = 5.0, teacher enters 6.0
                GradeEssaySubmissionRequest request = GradeEssaySubmissionRequest.builder()
                                .attemptId(attemptId)
                                .grades(List.of(
                                                GradeEssayItemRequest.builder()
                                                                .candidateAnswerId(essayAns1.getId())
                                                                .awardedScore(6.0)
                                                                .build()))
                                .build();

                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(awaitingAttempt));
                when(candidateAnswerRepository.findById(essayAns1.getId())).thenReturn(Optional.of(essayAns1));

                IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                                () -> teacherGradingService.submitEssayGrades(request, teacherOwner));

                assertTrue(ex.getMessage().contains("must be between 0.0 and 5.00"));
                verify(candidateAnswerRepository, never()).save(any());
        }

        @Test
        @DisplayName("submitEssayGrades should throw IllegalArgumentException when awarded score is negative")
        void submitEssayGrades_ThrowsIllegalArgumentException_WhenScoreIsNegative() {
                UUID attemptId = awaitingAttempt.getId();

                GradeEssaySubmissionRequest request = GradeEssaySubmissionRequest.builder()
                                .attemptId(attemptId)
                                .grades(List.of(
                                                GradeEssayItemRequest.builder()
                                                                .candidateAnswerId(essayAns1.getId())
                                                                .awardedScore(-1.0)
                                                                .build()))
                                .build();

                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(awaitingAttempt));
                when(candidateAnswerRepository.findById(essayAns1.getId())).thenReturn(Optional.of(essayAns1));

                assertThrows(IllegalArgumentException.class,
                                () -> teacherGradingService.submitEssayGrades(request, teacherOwner));

                verify(candidateAnswerRepository, never()).save(any());
        }

        @Test
        @DisplayName("submitEssayGrades should throw AppException when attempting to grade an IN_PROGRESS attempt")
        void submitEssayGrades_ThrowsAppException_WhenAttemptIsInProgress() {
                UUID attemptId = awaitingAttempt.getId();
                awaitingAttempt.setStatus(AttemptStatus.IN_PROGRESS);

                GradeEssaySubmissionRequest request = GradeEssaySubmissionRequest.builder()
                                .attemptId(attemptId)
                                .grades(List.of(
                                                GradeEssayItemRequest.builder()
                                                                .candidateAnswerId(essayAns1.getId())
                                                                .awardedScore(3.0)
                                                                .build()))
                                .build();

                when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(awaitingAttempt));

                assertThrows(AppException.class, () -> teacherGradingService.submitEssayGrades(request, teacherOwner));

                verify(candidateAnswerRepository, never()).findById(any());
        }
}
