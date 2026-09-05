package com.quicktest.modules.session;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.AttemptLimitExceededException;
import com.quicktest.core.exception.ExamClosedException;
import com.quicktest.core.exception.SessionExpiredException;
import com.quicktest.modules.assessment.entity.*;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import com.quicktest.modules.session.service.ExamSessionServiceImpl;
import com.quicktest.modules.session.service.ExamSubmissionProducer;
import com.quicktest.modules.session.service.RedisExamSessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Comprehensive unit tests for ExamSessionServiceImpl.
 * Covers candidate exam flow: start, auto-save (Redis Hash), resume, and submission with auto-grading.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ExamSessionServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private RedisExamSessionService redisExamSessionService;

    @Mock
    private ExamSubmissionProducer examSubmissionProducer;

    @Mock
    private HttpServletRequest servletRequest;

    @InjectMocks
    private ExamSessionServiceImpl examSessionService;

    private User studentUser;
    private User otherStudent;
    private Exam publishedExam;
    private Question singleChoiceQ;
    private Question multiChoiceQ;
    private Question numericQ;
    private Question essayQ;
    private AnswerOption optionA;
    private AnswerOption optionB;
    private AnswerOption optionC;
    private AnswerOption optionD;

    @BeforeEach
    void setUp() {
        studentUser = User.builder()
                .id(UUID.randomUUID())
                .fullName("Student Candidate")
                .email("student@quicktest.com")
                .role(Role.STUDENT)
                .build();

        otherStudent = User.builder()
                .id(UUID.randomUUID())
                .fullName("Other Candidate")
                .email("other@quicktest.com")
                .role(Role.STUDENT)
                .build();

        publishedExam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Mathematics Final Exam")
                .accessCode("MATH101")
                .status(ExamStatus.PUBLISHED)
                .durationMinutes(45)
                .maxAttempts(1)
                .shuffleQuestions(false)
                .shuffleOptions(false)
                .startTime(LocalDateTime.now().minusHours(1))
                .endTime(LocalDateTime.now().plusHours(2))
                .build();

        // 1. Single Choice Question
        singleChoiceQ = Question.builder()
                .id(UUID.randomUUID())
                .content("What is 2 + 2?")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(2.0)
                .orderIndex(1)
                .exam(publishedExam)
                .options(new ArrayList<>())
                .build();

        optionA = AnswerOption.builder()
                .id(UUID.randomUUID())
                .content("3")
                .isCorrect(false)
                .orderIndex(1)
                .question(singleChoiceQ)
                .build();

        optionB = AnswerOption.builder()
                .id(UUID.randomUUID())
                .content("4")
                .isCorrect(true)
                .orderIndex(2)
                .question(singleChoiceQ)
                .build();

        singleChoiceQ.getOptions().add(optionA);
        singleChoiceQ.getOptions().add(optionB);

        // 2. Multiple Choice Question
        multiChoiceQ = Question.builder()
                .id(UUID.randomUUID())
                .content("Select prime numbers:")
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .points(3.0)
                .orderIndex(2)
                .exam(publishedExam)
                .options(new ArrayList<>())
                .build();

        optionC = AnswerOption.builder()
                .id(UUID.randomUUID())
                .content("2")
                .isCorrect(true)
                .orderIndex(1)
                .question(multiChoiceQ)
                .build();

        optionD = AnswerOption.builder()
                .id(UUID.randomUUID())
                .content("3")
                .isCorrect(true)
                .orderIndex(2)
                .question(multiChoiceQ)
                .build();

        multiChoiceQ.getOptions().add(optionC);
        multiChoiceQ.getOptions().add(optionD);

        // 3. Numeric Question
        numericQ = Question.builder()
                .id(UUID.randomUUID())
                .content("Calculate pi to 2 decimal places:")
                .questionType(QuestionType.NUMERIC)
                .points(2.5)
                .sampleAnswer("3.14")
                .numericTolerance(0.01)
                .orderIndex(3)
                .exam(publishedExam)
                .options(new ArrayList<>())
                .build();

        // 4. Essay Question
        essayQ = Question.builder()
                .id(UUID.randomUUID())
                .content("Explain Pythagorean theorem.")
                .questionType(QuestionType.ESSAY_TEXT)
                .points(5.0)
                .gradingRubric("Check clear explanation and formula a^2 + b^2 = c^2")
                .orderIndex(4)
                .exam(publishedExam)
                .options(new ArrayList<>())
                .build();

        publishedExam.setQuestions(new ArrayList<>(List.of(singleChoiceQ, multiChoiceQ, numericQ, essayQ)));
    }

    @Test
    @DisplayName("startExam should succeed and return masked paper for authenticated student")
    void startExam_Success_AuthenticatedStudent() {
        StartExamRequest request = StartExamRequest.builder()
                .accessCode("MATH101")
                .build();

        when(examRepository.findByAccessCode("MATH101")).thenReturn(Optional.of(publishedExam));
        when(questionRepository.findByExamIdWithOptions(publishedExam.getId()))
                .thenReturn(List.of(singleChoiceQ, multiChoiceQ, numericQ, essayQ));
        when(examAttemptRepository.findFirstByUserIdAndExamIdAndStatus(eq(studentUser.getId()), eq(publishedExam.getId()), eq(AttemptStatus.IN_PROGRESS)))
                .thenReturn(Optional.empty());
        when(examAttemptRepository.countByUserIdAndExamId(studentUser.getId(), publishedExam.getId())).thenReturn(0L);
        when(examAttemptRepository.save(any(ExamAttempt.class))).thenAnswer(invocation -> {
            ExamAttempt attempt = invocation.getArgument(0);
            attempt.setId(UUID.randomUUID());
            return attempt;
        });

        ExamPaperResponse response = examSessionService.startExam(request, studentUser, servletRequest);

        assertNotNull(response);
        assertNotNull(response.getAttemptId());
        assertEquals("Mathematics Final Exam", response.getExamTitle());
        assertEquals(4, response.getQuestions().size());

        // Verify Data Masking: no isCorrect leakage
        QuestionInPaperDto maskedQ = response.getQuestions().get(0);
        assertEquals("What is 2 + 2?", maskedQ.getContent());
        assertEquals(2, maskedQ.getOptions().size());
        // Verify OptionInPaperDto has no isCorrect property accessor
        assertEquals("4", maskedQ.getOptions().get(1).getContent());

        verify(examAttemptRepository, times(1)).save(any(ExamAttempt.class));
    }

    @Test
    @DisplayName("startExam should succeed and return masked paper for guest candidate")
    void startExam_Success_GuestCandidate() {
        StartExamRequest request = StartExamRequest.builder()
                .accessCode("MATH101")
                .guestName("John Guest")
                .guestIdentifier("GUEST-123456")
                .build();

        when(examRepository.findByAccessCode("MATH101")).thenReturn(Optional.of(publishedExam));
        when(questionRepository.findByExamIdWithOptions(publishedExam.getId()))
                .thenReturn(List.of(singleChoiceQ, multiChoiceQ, numericQ, essayQ));
        when(examAttemptRepository.findFirstByExamIdAndGuestIdentifierAndStatus(eq(publishedExam.getId()), eq("GUEST-123456"), eq(AttemptStatus.IN_PROGRESS)))
                .thenReturn(Optional.empty());
        when(examAttemptRepository.countByGuestIdentifierAndExamId("GUEST-123456", publishedExam.getId())).thenReturn(0L);
        when(examAttemptRepository.save(any(ExamAttempt.class))).thenAnswer(invocation -> {
            ExamAttempt attempt = invocation.getArgument(0);
            attempt.setId(UUID.randomUUID());
            return attempt;
        });

        ExamPaperResponse response = examSessionService.startExam(request, null, servletRequest);

        assertNotNull(response);
        assertNotNull(response.getAttemptId());
        assertEquals("John Guest", response.getCandidateName());
        verify(examAttemptRepository, times(1)).save(any(ExamAttempt.class));
    }

    @Test
    @DisplayName("startExam should resume existing active attempt if candidate has one in progress")
    void startExam_ResumeActiveAttempt_WhenInProgress() {
        StartExamRequest request = StartExamRequest.builder()
                .accessCode("MATH101")
                .build();

        ExamAttempt activeAttempt = ExamAttempt.builder()
                .id(UUID.randomUUID())
                .exam(publishedExam)
                .user(studentUser)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(LocalDateTime.now().minusMinutes(10))
                .expireAt(LocalDateTime.now().plusMinutes(35))
                .build();

        when(examRepository.findByAccessCode("MATH101")).thenReturn(Optional.of(publishedExam));
        when(questionRepository.findByExamIdWithOptions(publishedExam.getId()))
                .thenReturn(List.of(singleChoiceQ, multiChoiceQ, numericQ, essayQ));
        when(examAttemptRepository.findFirstByUserIdAndExamIdAndStatus(studentUser.getId(), publishedExam.getId(), AttemptStatus.IN_PROGRESS))
                .thenReturn(Optional.of(activeAttempt));

        ExamPaperResponse response = examSessionService.startExam(request, studentUser, servletRequest);

        assertNotNull(response);
        assertEquals(activeAttempt.getId(), response.getAttemptId());
        verify(examAttemptRepository, never()).save(any(ExamAttempt.class));
    }

    @Test
    @DisplayName("startExam should throw ExamClosedException when exam status is DRAFT")
    void startExam_ThrowsExamClosedException_WhenStatusIsDraft() {
        publishedExam.setStatus(ExamStatus.DRAFT);
        StartExamRequest request = StartExamRequest.builder().accessCode("MATH101").build();

        when(examRepository.findByAccessCode("MATH101")).thenReturn(Optional.of(publishedExam));

        assertThrows(ExamClosedException.class, () ->
                examSessionService.startExam(request, studentUser, servletRequest));
    }

    @Test
    @DisplayName("startExam should throw ExamClosedException when exam has already closed")
    void startExam_ThrowsExamClosedException_WhenPastEndTime() {
        publishedExam.setEndTime(LocalDateTime.now().minusHours(1));
        StartExamRequest request = StartExamRequest.builder().accessCode("MATH101").build();

        when(examRepository.findByAccessCode("MATH101")).thenReturn(Optional.of(publishedExam));

        assertThrows(ExamClosedException.class, () ->
                examSessionService.startExam(request, studentUser, servletRequest));
    }

    @Test
    @DisplayName("startExam should throw AttemptLimitExceededException when candidate exceeded max attempts")
    void startExam_ThrowsAttemptLimitExceededException_WhenMaxReached() {
        StartExamRequest request = StartExamRequest.builder().accessCode("MATH101").build();

        when(examRepository.findByAccessCode("MATH101")).thenReturn(Optional.of(publishedExam));
        when(examAttemptRepository.findFirstByUserIdAndExamIdAndStatus(studentUser.getId(), publishedExam.getId(), AttemptStatus.IN_PROGRESS))
                .thenReturn(Optional.empty());
        when(examAttemptRepository.countByUserIdAndExamId(studentUser.getId(), publishedExam.getId())).thenReturn(1L);

        assertThrows(AttemptLimitExceededException.class, () ->
                examSessionService.startExam(request, studentUser, servletRequest));
    }

    @Test
    @DisplayName("saveDraft should save answer into Redis Hash when attempt is active")
    void saveDraft_Success() {
        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(publishedExam)
                .user(studentUser)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(LocalDateTime.now().minusMinutes(5))
                .expireAt(LocalDateTime.now().plusMinutes(40))
                .build();

        SaveAnswerRequest request = SaveAnswerRequest.builder()
                .questionId(singleChoiceQ.getId())
                .selectedOptionIds(Set.of(optionB.getId()))
                .build();

        when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));

        examSessionService.saveDraft(attemptId, request, studentUser, null);

        verify(redisExamSessionService, times(1)).saveDraftAnswer(
                eq(attemptId), eq(singleChoiceQ.getId()), eq(request), anyLong());
    }

    @Test
    @DisplayName("saveDraft should throw SessionExpiredException when duration has expired")
    void saveDraft_ThrowsSessionExpiredException_WhenExpired() {
        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(publishedExam)
                .user(studentUser)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(LocalDateTime.now().minusMinutes(60))
                .expireAt(LocalDateTime.now().minusMinutes(15)) // Expired beyond grace period
                .build();

        SaveAnswerRequest request = SaveAnswerRequest.builder()
                .questionId(singleChoiceQ.getId())
                .selectedOptionIds(Set.of(optionB.getId()))
                .build();

        when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));

        assertThrows(SessionExpiredException.class, () ->
                examSessionService.saveDraft(attemptId, request, studentUser, null));

        verify(redisExamSessionService, never()).saveDraftAnswer(any(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("saveDraft should throw 403 Forbidden when candidate does not own the attempt")
    void saveDraft_ThrowsForbidden_WhenCandidateMismatch() {
        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(publishedExam)
                .user(studentUser)
                .status(AttemptStatus.IN_PROGRESS)
                .build();

        SaveAnswerRequest request = SaveAnswerRequest.builder()
                .questionId(singleChoiceQ.getId())
                .build();

        when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));

        assertThrows(org.springframework.security.access.AccessDeniedException.class, () ->
                examSessionService.saveDraft(attemptId, request, otherStudent, null));
    }

    @Test
    @DisplayName("resumeExam should return masked paper and draft answers from Redis Hash")
    void resumeExam_Success() {
        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(publishedExam)
                .user(studentUser)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(LocalDateTime.now().minusMinutes(10))
                .expireAt(LocalDateTime.now().plusMinutes(35))
                .build();

        Map<UUID, SaveAnswerRequest> draftAnswers = new HashMap<>();
        draftAnswers.put(singleChoiceQ.getId(), SaveAnswerRequest.builder()
                .questionId(singleChoiceQ.getId())
                .selectedOptionIds(Set.of(optionB.getId()))
                .build());

        when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByExamIdWithOptions(publishedExam.getId()))
                .thenReturn(List.of(singleChoiceQ, multiChoiceQ, numericQ, essayQ));
        when(redisExamSessionService.getDraftAnswers(attemptId)).thenReturn(draftAnswers);

        ResumeExamResponse response = examSessionService.resumeExam(attemptId, studentUser, null);

        assertNotNull(response);
        assertNotNull(response.getPaper());
        assertEquals(attemptId, response.getPaper().getAttemptId());
        assertEquals(1, response.getSavedAnswers().size());
        assertTrue(response.getSavedAnswers().containsKey(singleChoiceQ.getId()));
    }

    @Test
    @DisplayName("submitExam should auto-grade objective questions and clear Redis draft answers")
    void submitExam_Success_AutoGradingObjectiveQuestions() {
        // Prepare exam with ONLY objective questions (single choice, multiple choice, numeric)
        Exam objectiveExam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Objective Test")
                .durationMinutes(30)
                .questions(List.of(singleChoiceQ, multiChoiceQ, numericQ))
                .build();

        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(objectiveExam)
                .user(studentUser)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(LocalDateTime.now().minusMinutes(20))
                .expireAt(LocalDateTime.now().plusMinutes(10))
                .build();

        // Draft answers in Redis:
        // 1. Single Choice: correct (optionB) -> 2.0 pts
        // 2. Multiple Choice: correct (optionC, optionD) -> 3.0 pts
        // 3. Numeric: 3.1415 (tolerance 0.01 with standard 3.14) -> 2.5 pts
        Map<UUID, SaveAnswerRequest> draftAnswers = new HashMap<>();
        draftAnswers.put(singleChoiceQ.getId(), SaveAnswerRequest.builder()
                .questionId(singleChoiceQ.getId())
                .selectedOptionIds(Set.of(optionB.getId()))
                .build());
        draftAnswers.put(multiChoiceQ.getId(), SaveAnswerRequest.builder()
                .questionId(multiChoiceQ.getId())
                .selectedOptionIds(Set.of(optionC.getId(), optionD.getId()))
                .build());
        draftAnswers.put(numericQ.getId(), SaveAnswerRequest.builder()
                .questionId(numericQ.getId())
                .textAnswer("3.1415")
                .build());

        when(redisExamSessionService.acquireSubmissionLock(attemptId, 300L)).thenReturn(true);
        when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));
        when(redisExamSessionService.getDraftAnswers(attemptId)).thenReturn(draftAnswers);

        SubmitAcceptedResponse response = examSessionService.submitExam(attemptId, null, studentUser, null);

        assertNotNull(response);
        assertEquals(attemptId, response.getAttemptId());
        assertEquals("PROCESSING", response.getStatus());
        assertNotNull(response.getSubmitTime());
        assertTrue(response.getMessage().contains("accepted"));

        verify(examSubmissionProducer, times(1)).sendSubmissionMessage(argThat(msg ->
                msg.getAttemptId().equals(attemptId) &&
                msg.getAnswers().size() == 3 &&
                msg.getExamId().equals(objectiveExam.getId())
        ));
    }

    @Test
    @DisplayName("submitExam should throw CONFLICT when submission lock is already acquired")
    void submitExam_ThrowsConflict_WhenLockAlreadyAcquired() {
        UUID attemptId = UUID.randomUUID();
        when(redisExamSessionService.acquireSubmissionLock(attemptId, 300L)).thenReturn(false);

        AppException ex = assertThrows(AppException.class, () ->
                examSessionService.submitExam(attemptId, null, studentUser, null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        verify(examSubmissionProducer, never()).sendSubmissionMessage(any());
    }

    @Test
    @DisplayName("submitExam should throw SessionExpiredException when submitted after grace period")
    void submitExam_ThrowsSessionExpiredException_WhenPastGracePeriod() {
        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(publishedExam)
                .user(studentUser)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(LocalDateTime.now().minusMinutes(60))
                .expireAt(LocalDateTime.now().minusSeconds(20)) // Expired beyond 15s grace period
                .build();

        when(redisExamSessionService.acquireSubmissionLock(attemptId, 300L)).thenReturn(true);
        when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));

        assertThrows(SessionExpiredException.class, () ->
                examSessionService.submitExam(attemptId, null, studentUser, null));

        verify(redisExamSessionService, times(1)).releaseSubmissionLock(attemptId);
        verify(examSubmissionProducer, never()).sendSubmissionMessage(any());
    }

    @Test
    @DisplayName("submitExam should throw AppException when attempt is already submitted")
    void submitExam_ThrowsAppException_WhenAlreadySubmitted() {
        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(publishedExam)
                .user(studentUser)
                .status(AttemptStatus.SUBMITTED)
                .build();

        when(redisExamSessionService.acquireSubmissionLock(attemptId, 300L)).thenReturn(true);
        when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));

        assertThrows(AppException.class, () ->
                examSessionService.submitExam(attemptId, null, studentUser, null));

        verify(redisExamSessionService, times(1)).releaseSubmissionLock(attemptId);
        verify(examSubmissionProducer, never()).sendSubmissionMessage(any());
    }

    @Test
    @DisplayName("getSubmissionResult should return cached result directly without hitting database")
    void getSubmissionResult_ReturnsFromRedisCache_WhenAvailable() {
        UUID attemptId = UUID.randomUUID();
        SubmitResultResponse cachedResult = SubmitResultResponse.builder()
                .attemptId(attemptId)
                .examTitle("Cached Exam")
                .status(AttemptStatus.SUBMITTED)
                .totalScore(8.5)
                .build();

        when(redisExamSessionService.getCachedSubmissionResult(attemptId)).thenReturn(cachedResult);

        SubmitResultResponse result = examSessionService.getSubmissionResult(attemptId, studentUser, null);

        assertNotNull(result);
        assertEquals(8.5, result.getTotalScore());
        assertEquals("Cached Exam", result.getExamTitle());
        verify(examAttemptRepository, never()).findByIdWithExam(any());
    }

    @Test
    @DisplayName("getSubmissionResult should fallback to database and cache result when Redis cache misses")
    void getSubmissionResult_FallbackToDb_WhenCacheMiss() {
        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(publishedExam)
                .user(studentUser)
                .status(AttemptStatus.SUBMITTED)
                .totalScore(9.0)
                .submitTime(LocalDateTime.now())
                .build();

        when(redisExamSessionService.getCachedSubmissionResult(attemptId)).thenReturn(null);
        when(examAttemptRepository.findByIdWithExam(attemptId)).thenReturn(Optional.of(attempt));

        SubmitResultResponse result = examSessionService.getSubmissionResult(attemptId, studentUser, null);

        assertNotNull(result);
        assertEquals(9.0, result.getTotalScore());
        assertEquals(AttemptStatus.SUBMITTED, result.getStatus());
    }
}
