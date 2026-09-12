package com.quicktest.modules.session.service;

import com.quicktest.core.service.GeminiGradingService;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.session.dto.AiBatchGradingResultDto;
import com.quicktest.modules.session.dto.AiSingleGradeDto;
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

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class QuestionGradingAsyncWorkerTest {

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private CandidateAnswerRepository candidateAnswerRepository;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private RedisExamSessionService redisExamSessionService;

    @Mock
    private GeminiGradingService geminiGradingService;

    @InjectMocks
    private QuestionGradingAsyncWorker asyncWorker;

    private Question question;
    private Exam exam;
    private ExamAttempt attempt;

    @BeforeEach
    void setUp() {
        exam = Exam.builder().id(UUID.randomUUID()).title("Science Exam").build();

        question = Question.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .content("What is Newton's first law?")
                .questionType(QuestionType.ESSAY_TEXT)
                .points(10.0)
                .build();

        attempt = ExamAttempt.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .status(AttemptStatus.AWAITING_MANUAL_GRADING)
                .build();
    }

    @Test
    @DisplayName("Should execute AI grading batch and finalize exam attempt")
    void testExecuteAiGradingAsync_Success() {
        CandidateAnswer answer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(question)
                .textAnswer("An object at rest stays at rest unless acted upon by a net force.")
                .gradingStatus(GradingStatus.PENDING_MANUAL)
                .build();

        AiBatchGradingResultDto resultDto = AiBatchGradingResultDto.builder()
                .results(List.of(
                        AiSingleGradeDto.builder()
                                .candidateAnswerId(answer.getId().toString())
                                .awardedScore(9.0)
                                .feedback("Accurate law description.")
                                .build()
                ))
                .build();

        when(questionRepository.findById(question.getId())).thenReturn(Optional.of(question));
        when(candidateAnswerRepository.findAllById(List.of(answer.getId()))).thenReturn(List.of(answer));
        when(geminiGradingService.gradeBatch(question, List.of(answer))).thenReturn(resultDto);
        when(candidateAnswerRepository.save(any(CandidateAnswer.class))).thenAnswer(i -> i.getArgument(0));

        // Attempt finalization mocks
        when(examAttemptRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));
        when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(attempt.getId(), GradingStatus.PENDING_MANUAL))
                .thenReturn(0L);
        when(candidateAnswerRepository.sumAwardedScoreByAttemptId(attempt.getId())).thenReturn(9.0);
        when(examAttemptRepository.save(any(ExamAttempt.class))).thenAnswer(i -> i.getArgument(0));

        Map<UUID, List<UUID>> map = Map.of(question.getId(), List.of(answer.getId()));
        asyncWorker.executeAiGradingAsync(map, 5);

        assertEquals(GradingStatus.GRADED, answer.getGradingStatus());
        assertEquals(9.0, answer.getAwardedScore());
        assertEquals("Accurate law description.", answer.getTeacherFeedback());
        assertEquals(AttemptStatus.SUBMITTED, attempt.getStatus());
        assertEquals(9.0, attempt.getTotalScore());
        verify(redisExamSessionService, times(1)).cacheSubmissionResult(eq(attempt.getId()), any(), anyLong());
    }

    @Test
    @DisplayName("Should stop immediately when Gemini service throws exception")
    void testExecuteAiGradingAsync_GeminiError_StopsExecution() {
        CandidateAnswer answer1 = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(question)
                .textAnswer("Answer 1")
                .gradingStatus(GradingStatus.PENDING_MANUAL)
                .build();

        when(questionRepository.findById(question.getId())).thenReturn(Optional.of(question));
        when(candidateAnswerRepository.findAllById(List.of(answer1.getId()))).thenReturn(List.of(answer1));
        when(geminiGradingService.gradeBatch(question, List.of(answer1)))
                .thenThrow(new RuntimeException("Connection timeout to Gemini API"));

        Map<UUID, List<UUID>> map = Map.of(question.getId(), List.of(answer1.getId()));
        asyncWorker.executeAiGradingAsync(map, 5);

        // Status should remain PENDING_MANUAL
        assertEquals(GradingStatus.PENDING_MANUAL, answer1.getGradingStatus());
        assertNull(answer1.getAwardedScore());
        verify(candidateAnswerRepository, never()).save(answer1);
    }
}
