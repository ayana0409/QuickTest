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
                Pageable expectedPageable = PageRequest.of(0, 10, Sort.by(Sort.Order.desc("submitTime")));
                Page<ExamAttempt> page = new PageImpl<>(List.of(awaitingAttempt), expectedPageable, 1);

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.findByExamIdAndStatus(eq(examId), eq(AttemptStatus.AWAITING_MANUAL_GRADING),
                                eq(expectedPageable)))
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
                Pageable expectedPageable = PageRequest.of(0, 10, Sort.by(Sort.Order.desc("submitTime")));
                Page<ExamAttempt> page = new PageImpl<>(List.of(awaitingAttempt), expectedPageable, 1);

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.searchAttemptsByExamIdAndStatus(eq(examId),
                                eq(AttemptStatus.AWAITING_MANUAL_GRADING), eq("%student%"), eq(expectedPageable)))
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
        @DisplayName("getAttemptsToGrade should normalize sort when sorting by totalScore desc")
        void getAttemptsToGrade_Success_WhenSortingByScoreDesc() {
                UUID examId = mathExam.getId();
                Pageable pageable = PageRequest.of(0, 10, Sort.by("totalScore").descending());
                Pageable expectedPageable = PageRequest.of(0, 10, Sort.by(Sort.Order.desc("totalScore")));
                Page<ExamAttempt> page = new PageImpl<>(List.of(awaitingAttempt), expectedPageable, 1);

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.findByExamId(eq(examId), eq(expectedPageable)))
                                .thenReturn(page);
                when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(awaitingAttempt.getId(),
                                GradingStatus.PENDING_MANUAL))
                                .thenReturn(2L);

                PageResponse<AttemptSummaryResponse> response = teacherGradingService.getAttemptsToGrade(
                                examId, null, null, pageable, teacherOwner);

                assertNotNull(response);
                assertEquals(1, response.getContent().size());
                verify(examAttemptRepository).findByExamId(eq(examId), eq(expectedPageable));
        }

        @Test
        @DisplayName("getAttemptsToGrade should normalize sort when sorting by violationCount desc")
        void getAttemptsToGrade_Success_WhenSortingByViolationCountDesc() {
                UUID examId = mathExam.getId();
                Pageable pageable = PageRequest.of(0, 10, Sort.by("violationCount").descending());
                Pageable expectedPageable = PageRequest.of(0, 10, Sort.by(Sort.Order.desc("violationCount")));
                Page<ExamAttempt> page = new PageImpl<>(List.of(awaitingAttempt), expectedPageable, 1);

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.findByExamId(eq(examId), eq(expectedPageable)))
                                .thenReturn(page);
                when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(awaitingAttempt.getId(),
                                GradingStatus.PENDING_MANUAL))
                                .thenReturn(2L);

                PageResponse<AttemptSummaryResponse> response = teacherGradingService.getAttemptsToGrade(
                                examId, null, null, pageable, teacherOwner);

                assertNotNull(response);
                assertEquals(1, response.getContent().size());
                verify(examAttemptRepository).findByExamId(eq(examId), eq(expectedPageable));
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

        // =========================================================
        //  getExamAttemptStats — aggregated statistics tests
        // =========================================================

        @Test
        @DisplayName("getExamAttemptStats - happy path returns correct aggregated values")
        void getExamAttemptStats_happyPath_returnsCorrectAggregation() {
                UUID examId = mathExam.getId();

                // Row layout mirrors the JPQL projection order
                Object[] row = new Object[] {
                        5L,   // totalAttempts
                        3L,   // completedAttempts (SUBMITTED)
                        1L,   // pendingGradingAttempts (AWAITING_MANUAL_GRADING)
                        1L,   // inProgressAttempts
                        0L,   // disqualifiedAttempts
                        7.25, // avgScore
                        9.5,  // maxScore
                        4.0,  // minScore
                        3L,   // gradedCount
                        5L,   // totalViolations
                        3,    // maxViolations
                        2L,   // attemptsWithViolations
                        1800.0, // avgDurationSeconds
                        3600L,  // maxDurationSeconds
                        900L    // minDurationSeconds
                };

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.computeAttemptStats(examId)).thenReturn(row);

                ExamAttemptStatsResponse stats = teacherGradingService.getExamAttemptStats(examId, teacherOwner);

                assertEquals(5L, stats.getTotalAttempts());
                assertEquals(3L, stats.getCompletedAttempts());
                assertEquals(1L, stats.getPendingGradingAttempts());
                assertEquals(1L, stats.getInProgressAttempts());
                assertEquals(0L, stats.getDisqualifiedAttempts());
                assertEquals(7.25, stats.getAverageScore(), 0.01);
                assertEquals(9.5, stats.getHighestScore(), 0.01);
                assertEquals(4.0, stats.getLowestScore(), 0.01);
                assertEquals(3L, stats.getGradedCount());
                assertEquals(5L, stats.getTotalViolations());
                assertEquals(3, stats.getMaxViolations());
                assertEquals(2L, stats.getAttemptsWithViolations());
                assertEquals(1800.0, stats.getAverageDurationSeconds(), 0.5);
                assertEquals(3600L, stats.getMaxDurationSeconds());
                assertEquals(900L, stats.getMinDurationSeconds());
        }

        @Test
        @DisplayName("getExamAttemptStats - exam with zero attempts returns safe zero values")
        void getExamAttemptStats_noAttempts_returnsZeroValues() {
                UUID examId = mathExam.getId();

                // All aggregate functions return NULL when no rows exist; COUNT returns 0
                Object[] row = new Object[] {
                        0L, 0L, 0L, 0L, 0L,  // counts
                        null, null, null, 0L,  // score stats
                        0L, 0, 0L,             // violation stats
                        null, null, null       // duration stats
                };

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.computeAttemptStats(examId)).thenReturn(row);

                ExamAttemptStatsResponse stats = teacherGradingService.getExamAttemptStats(examId, teacherOwner);

                assertEquals(0L, stats.getTotalAttempts());
                assertNull(stats.getAverageScore(), "Should be null when no graded attempts");
                assertNull(stats.getHighestScore());
                assertNull(stats.getLowestScore());
                assertEquals(0L, stats.getTotalViolations());
                assertNull(stats.getAverageDurationSeconds(), "Should be null when no completed attempts");
                assertNull(stats.getMaxDurationSeconds());
                assertNull(stats.getMinDurationSeconds());
        }

        @Test
        @DisplayName("getExamAttemptStats - attempts in progress with no scores still returns counts")
        void getExamAttemptStats_inProgressOnlyNoScores_returnsInProgressCount() {
                UUID examId = mathExam.getId();

                Object[] row = new Object[] {
                        2L, 0L, 0L, 2L, 0L,   // 2 in-progress
                        null, null, null, 0L,   // no scores
                        0L, 0, 0L,              // no violations
                        null, null, null        // no duration
                };

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.computeAttemptStats(examId)).thenReturn(row);

                ExamAttemptStatsResponse stats = teacherGradingService.getExamAttemptStats(examId, teacherOwner);

                assertEquals(2L, stats.getTotalAttempts());
                assertEquals(2L, stats.getInProgressAttempts());
                assertEquals(0L, stats.getCompletedAttempts());
                assertNull(stats.getAverageScore());
                assertEquals(0L, stats.getGradedCount());
        }

        @Test
        @DisplayName("getExamAttemptStats - access denied for non-owner teacher")
        void getExamAttemptStats_notOwner_throwsAccessDeniedException() {
                UUID examId = mathExam.getId();

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));

                assertThrows(
                        org.springframework.security.access.AccessDeniedException.class,
                        () -> teacherGradingService.getExamAttemptStats(examId, otherTeacher)
                );

                verify(examAttemptRepository, never()).computeAttemptStats(any());
        }

        @Test
        @DisplayName("getExamAttemptStats - exam not found throws ResourceNotFoundException")
        void getExamAttemptStats_examNotFound_throwsResourceNotFoundException() {
                UUID examId = UUID.randomUUID();

                when(examRepository.findById(examId)).thenReturn(Optional.empty());

                assertThrows(
                        com.quicktest.core.exception.ResourceNotFoundException.class,
                        () -> teacherGradingService.getExamAttemptStats(examId, teacherOwner)
                );
        }

        @Test
        @DisplayName("getExamAttemptStats - score is rounded to 2 decimal places")
        void getExamAttemptStats_averageScoreRounding_isTwoDecimalPlaces() {
                UUID examId = mathExam.getId();

                Object[] row = new Object[] {
                        3L, 3L, 0L, 0L, 0L,
                        7.333333333, 10.0, 5.0, 3L, // avgScore repeating decimal
                        0L, 0, 0L,
                        null, null, null
                };

                when(examRepository.findById(examId)).thenReturn(Optional.of(mathExam));
                when(examAttemptRepository.computeAttemptStats(examId)).thenReturn(row);

                ExamAttemptStatsResponse stats = teacherGradingService.getExamAttemptStats(examId, teacherOwner);

                // Math.round(7.333... * 100) / 100.0 == 7.33
                assertEquals(7.33, stats.getAverageScore(), 0.001);
        }
}
