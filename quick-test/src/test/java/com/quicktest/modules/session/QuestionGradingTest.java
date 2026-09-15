package com.quicktest.modules.session;

import com.quicktest.config.GeminiProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.service.GeminiGradingService;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.service.QuestionGradingAsyncWorker;
import com.quicktest.modules.session.service.QuestionGradingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class QuestionGradingTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private CandidateAnswerRepository candidateAnswerRepository;

    @Mock
    private QuestionGradingAsyncWorker asyncWorker;

    @Mock
    private GeminiProperties geminiProperties;

    @Mock
    private GeminiGradingService geminiGradingService;

    @InjectMocks
    private QuestionGradingServiceImpl questionGradingService;

    private User teacher;
    private Exam exam;
    private Question essayQuestion;

    @BeforeEach
    void setUp() {
        teacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Professor Charles")
                .role(Role.TEACHER)
                .build();

        exam = Exam.builder()
                .id(UUID.randomUUID())
                .title("History & Philosophy Exam")
                .createdBy(teacher)
                .build();

        essayQuestion = Question.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .orderIndex(1)
                .content("Analyze the socioeconomic impacts of the Industrial Revolution.")
                .questionType(QuestionType.ESSAY_TEXT)
                .points(5.0)
                .sampleAnswer("Key points: urbanization, technological advancement, labor conditions.")
                .gradingRubric("Full points for covering both economic benefits and social costs.")
                .build();
    }

    @Test
    @DisplayName("Should retrieve only essay questions with accurate grading statistics")
    void testGetQuestionsForGrading_Success() {
        Question singleChoiceQ = Question.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .orderIndex(2)
                .content("Which year did WW1 start?")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(1.0)
                .build();

        when(examRepository.findByIdWithCreatedBy(exam.getId())).thenReturn(Optional.of(exam));
        when(questionRepository.findByExamIdOrderByOrderIndexAsc(exam.getId()))
                .thenReturn(List.of(essayQuestion, singleChoiceQ));

        when(candidateAnswerRepository.countByQuestionIdAndGradingStatus(essayQuestion.getId(), GradingStatus.PENDING_MANUAL))
                .thenReturn(3L);
        when(candidateAnswerRepository.countByQuestionIdAndGradingStatus(essayQuestion.getId(), GradingStatus.GRADED))
                .thenReturn(7L);
        when(candidateAnswerRepository.countByQuestionId(essayQuestion.getId()))
                .thenReturn(10L);

        List<QuestionGradingSummaryResponse> summaries =
                questionGradingService.getQuestionsForGrading(exam.getId(), teacher);

        assertNotNull(summaries);
        assertEquals(1, summaries.size(), "Only essay questions should be returned for grading");
        QuestionGradingSummaryResponse summary = summaries.get(0);
        assertEquals(essayQuestion.getId(), summary.getQuestionId());
        assertEquals(3L, summary.getPendingCount());
        assertEquals(7L, summary.getGradedCount());
        assertEquals(10L, summary.getTotalSubmissions());
        assertEquals(5.0, summary.getMaxPoints());
    }

    @Test
    @DisplayName("Should throw Forbidden when a teacher tries to access an exam created by another teacher")
    void testForbiddenTeacher_ThrowsException() {
        User otherTeacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Other Teacher")
                .role(Role.TEACHER)
                .build();

        when(examRepository.findByIdWithCreatedBy(exam.getId())).thenReturn(Optional.of(exam));

        AppException ex = assertThrows(AppException.class, () ->
                questionGradingService.getQuestionsForGrading(exam.getId(), otherTeacher));

        assertTrue(ex.getMessage().contains("permission to grade or access this exam"));
    }

    @Test
    @DisplayName("Should retrieve question submissions with rubric and pagination")
    void testGetQuestionSubmissions_Success() {
        User student = User.builder()
                .id(UUID.randomUUID())
                .fullName("Alice Smith")
                .email("alice@test.com")
                .build();

        ExamAttempt attempt = ExamAttempt.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .user(student)
                .submitTime(LocalDateTime.now())
                .status(AttemptStatus.AWAITING_MANUAL_GRADING)
                .build();

        CandidateAnswer answer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(essayQuestion)
                .textAnswer("The Industrial Revolution accelerated mechanization and urban expansion.")
                .gradingStatus(GradingStatus.PENDING_MANUAL)
                .build();

        Pageable pageable = PageRequest.of(0, 10);
        Page<CandidateAnswer> page = new PageImpl<>(List.of(answer), pageable, 1);

        when(questionRepository.findByIdWithOptionsAndExam(essayQuestion.getId()))
                .thenReturn(Optional.of(essayQuestion));
        when(candidateAnswerRepository.findByQuestionIdWithAttemptAndUser(essayQuestion.getId(), pageable))
                .thenReturn(page);

        QuestionSubmissionsDetailResponse response =
                questionGradingService.getQuestionSubmissions(essayQuestion.getId(), null, pageable, teacher);

        assertNotNull(response);
        assertEquals(essayQuestion.getContent(), response.getContent());
        assertEquals(essayQuestion.getGradingRubric(), response.getGradingRubric());
        assertEquals(essayQuestion.getSampleAnswer(), response.getSampleAnswer());
        assertNotNull(response.getSubmissions());
        assertEquals(1, response.getSubmissions().getContent().size());

        CandidateSubmissionItemDto item = response.getSubmissions().getContent().get(0);
        assertEquals("Alice Smith", item.getCandidateName());
        assertEquals("alice@test.com", item.getStudentIdentifier());
        assertEquals(answer.getTextAnswer(), item.getTextAnswer());
    }

    @Test
    @DisplayName("Should save manual grades and finalize exam attempt when no pending essays remain")
    void testSaveManualGrades_Success_FinalizesAttempt() {
        ExamAttempt attempt = ExamAttempt.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .status(AttemptStatus.AWAITING_MANUAL_GRADING)
                .build();

        CandidateAnswer answer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(essayQuestion)
                .textAnswer("Well formulated response on urbanization.")
                .gradingStatus(GradingStatus.PENDING_MANUAL)
                .build();

        ManualBatchGradeRequest request = ManualBatchGradeRequest.builder()
                .items(List.of(
                        ManualGradeItemRequest.builder()
                                .candidateAnswerId(answer.getId())
                                .awardedScore(4.5)
                                .teacherFeedback("Great historical analysis.")
                                .build()
                ))
                .build();

        when(questionRepository.findByIdWithOptionsAndExam(essayQuestion.getId()))
                .thenReturn(Optional.of(essayQuestion));
        when(candidateAnswerRepository.findById(answer.getId())).thenReturn(Optional.of(answer));
        when(candidateAnswerRepository.save(any(CandidateAnswer.class))).thenAnswer(i -> i.getArgument(0));
        when(asyncWorker.finalizeAffectedAttempts(anySet())).thenReturn(1);

        ManualBatchGradeResponse response =
                questionGradingService.saveManualGrades(essayQuestion.getId(), request, teacher);

        assertNotNull(response);
        assertEquals(1, response.getGradedCount());
        assertEquals(1, response.getFinalizedAttemptsCount());
        assertEquals(GradingStatus.GRADED, answer.getGradingStatus());
        assertEquals(4.5, answer.getAwardedScore());
        verify(asyncWorker, times(1)).finalizeAffectedAttempts(anySet());
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when awarded score exceeds question max points")
    void testSaveManualGrades_ScoreExceedsMaxPoints_ThrowsException() {
        CandidateAnswer answer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .question(essayQuestion)
                .build();

        ManualBatchGradeRequest request = ManualBatchGradeRequest.builder()
                .items(List.of(
                        ManualGradeItemRequest.builder()
                                .candidateAnswerId(answer.getId())
                                .awardedScore(6.0) // Max points is 5.0
                                .teacherFeedback("Exceeds max points")
                                .build()
                ))
                .build();

        when(questionRepository.findByIdWithOptionsAndExam(essayQuestion.getId()))
                .thenReturn(Optional.of(essayQuestion));
        when(candidateAnswerRepository.findById(answer.getId())).thenReturn(Optional.of(answer));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                questionGradingService.saveManualGrades(essayQuestion.getId(), request, teacher));

        assertTrue(ex.getMessage().contains("must be between 0.0 and 5.00"));
        verify(candidateAnswerRepository, never()).save(any());
        verify(asyncWorker, never()).finalizeAffectedAttempts(anySet());
    }

    @Test
    @DisplayName("Should trigger AI grading for a single essay question, dispatch to background worker, and return ACCEPTED")
    void testTriggerAiGrading_SingleQuestion_Success() {
        CandidateAnswer ans1 = CandidateAnswer.builder().id(UUID.randomUUID()).question(essayQuestion).build();
        CandidateAnswer ans2 = CandidateAnswer.builder().id(UUID.randomUUID()).question(essayQuestion).build();

        TriggerAiGradingRequest request = TriggerAiGradingRequest.builder()
                .examId(exam.getId())
                .questionId(essayQuestion.getId())
                .scope("SINGLE_QUESTION")
                .batchSize(5)
                .build();

        when(geminiProperties.getApiKey()).thenReturn("test-gemini-api-key");
        when(examRepository.findByIdWithCreatedBy(exam.getId())).thenReturn(Optional.of(exam));
        when(questionRepository.findByIdWithOptionsAndExam(essayQuestion.getId())).thenReturn(Optional.of(essayQuestion));
        when(candidateAnswerRepository.findPendingByQuestionId(essayQuestion.getId(), GradingStatus.PENDING_MANUAL))
                .thenReturn(List.of(ans1, ans2));

        TriggerAiGradingResponse response = questionGradingService.triggerAiGrading(request, teacher);

        assertNotNull(response);
        assertEquals("ACCEPTED", response.getStatus());
        assertEquals(1, response.getTotalQuestionsScheduled());
        assertEquals(2, response.getTotalSubmissionsScheduled());
        verify(asyncWorker, times(1)).executeAiGradingAsync(anyMap(), eq(5));
    }

    @Test
    @DisplayName("Should throw BAD_REQUEST when Gemini API key is not configured")
    void testTriggerAiGrading_MissingApiKey_ThrowsBadRequest() {
        TriggerAiGradingRequest request = TriggerAiGradingRequest.builder()
                .examId(exam.getId())
                .questionId(essayQuestion.getId())
                .scope("SINGLE_QUESTION")
                .batchSize(5)
                .build();

        when(geminiProperties.getApiKey()).thenReturn("xxx");

        AppException ex = assertThrows(AppException.class, () ->
                questionGradingService.triggerAiGrading(request, teacher));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Google Gemini API key is not configured"));
        verify(examRepository, never()).findByIdWithCreatedBy(any());
    }

    @Test
    @DisplayName("Should successfully evaluate single candidate answer with AI")
    void testGradeSingleAnswerWithAi_Success() {
        UUID answerId = UUID.randomUUID();
        CandidateAnswer candidateAnswer = CandidateAnswer.builder()
                .id(answerId)
                .examAttempt(ExamAttempt.builder().id(UUID.randomUUID()).exam(exam).build())
                .question(essayQuestion)
                .textAnswer("Democracy allows civic participation.")
                .gradingStatus(GradingStatus.PENDING_MANUAL)
                .build();

        when(candidateAnswerRepository.findById(answerId)).thenReturn(Optional.of(candidateAnswer));
        when(examRepository.findByIdWithCreatedBy(exam.getId())).thenReturn(Optional.of(exam));

        AiSingleGradeDto mockResult = AiSingleGradeDto.builder()
                .candidateAnswerId(answerId.toString())
                .awardedScore(4.5)
                .feedback("Clear and concise explanation.")
                .build();
        AiBatchGradingResultDto batchResult = AiBatchGradingResultDto.builder()
                .results(List.of(mockResult))
                .build();
        when(geminiGradingService.gradeBatch(eq(essayQuestion), anyList())).thenReturn(batchResult);

        AiSingleGradeDto result = questionGradingService.gradeSingleAnswerWithAi(answerId, teacher);

        assertNotNull(result);
        assertEquals(4.5, result.getAwardedScore());
        assertEquals("Clear and concise explanation.", result.getFeedback());
        assertEquals(GradingStatus.GRADED, candidateAnswer.getGradingStatus());
        assertEquals(4.5, candidateAnswer.getAwardedScore());
        verify(candidateAnswerRepository, times(1)).save(candidateAnswer);
        verify(asyncWorker, times(1)).finalizeAffectedAttempts(anySet());
    }
}
