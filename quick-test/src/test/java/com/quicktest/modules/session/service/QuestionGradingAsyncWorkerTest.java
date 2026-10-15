package com.quicktest.modules.session.service;

import com.quicktest.core.service.AiMetricsRedisService;
import com.quicktest.core.service.GeminiGradingService;
import com.quicktest.core.service.GeminiRotationService;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

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

    @Mock
    private GeminiRotationService geminiRotationService;

    @Mock
    private AiMetricsRedisService aiMetricsRedisService;

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private com.quicktest.modules.assessment.ai.service.TeacherAiTaskService teacherAiTaskService;

    private QuestionGradingAsyncWorker asyncWorker;

    private Question question;
    private Exam exam;
    private ExamAttempt attempt;

    @BeforeEach
    void setUp() {
        // Direct pass-through TransactionManager to execute TransactionTemplate blocks inside tests
        PlatformTransactionManager directTxManager = new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {}

            @Override
            public void rollback(TransactionStatus status) {}
        };

        lenient().when(geminiRotationService.getOptimalBatchTokenBudget()).thenReturn(30000);
        lenient().when(geminiRotationService.getMaxBatchCandidateCount()).thenReturn(25);

        asyncWorker = new QuestionGradingAsyncWorker(
                questionRepository,
                candidateAnswerRepository,
                examAttemptRepository,
                redisExamSessionService,
                geminiGradingService,
                geminiRotationService,
                aiMetricsRedisService,
                directTxManager,
                stringRedisTemplate,
                teacherAiTaskService
        );

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
    @DisplayName("Should execute AI grading batch, finalize exam attempt, update status to PROCESSING, and release Redis lock")
    void testExecuteAiGradingAsync_Success() {
        String jobId = UUID.randomUUID().toString();
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

        when(questionRepository.findByIdWithOptionsAndExam(question.getId())).thenReturn(Optional.of(question));
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
        asyncWorker.executeAiGradingAsync(jobId, exam.getId(), map, 5);

        assertEquals(GradingStatus.GRADED, answer.getGradingStatus());
        assertEquals(9.0, answer.getAwardedScore());
        assertEquals("Accurate law description.", answer.getTeacherFeedback());
        assertEquals(AttemptStatus.SUBMITTED, attempt.getStatus());
        assertEquals(9.0, attempt.getTotalScore());

        // Verify status updates and lock cleanup
        verify(aiMetricsRedisService, times(1)).updateJobStatus(eq(jobId), eq("PROCESSING"), anyString());
        verify(aiMetricsRedisService, times(1)).removeActiveJob(jobId);
        verify(stringRedisTemplate, times(1)).delete("ai:grading:lock:exam:" + exam.getId());
        verify(redisExamSessionService, atLeastOnce()).cacheSubmissionResult(eq(attempt.getId()), any(), anyLong());
    }

    @Test
    @DisplayName("Should stop immediately when Gemini service throws exception and still release Redis lock in finally")
    void testExecuteAiGradingAsync_GeminiError_StopsExecutionAndReleasesLock() {
        String jobId = UUID.randomUUID().toString();
        CandidateAnswer answer1 = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(question)
                .textAnswer("Answer 1")
                .gradingStatus(GradingStatus.PENDING_MANUAL)
                .build();

        when(questionRepository.findByIdWithOptionsAndExam(question.getId())).thenReturn(Optional.of(question));
        when(candidateAnswerRepository.findAllById(List.of(answer1.getId()))).thenReturn(List.of(answer1));
        when(geminiGradingService.gradeBatch(question, List.of(answer1)))
                .thenThrow(new RuntimeException("Connection timeout to Gemini API"));

        Map<UUID, List<UUID>> map = Map.of(question.getId(), List.of(answer1.getId()));
        asyncWorker.executeAiGradingAsync(jobId, exam.getId(), map, 5);

        // Status should remain PENDING_MANUAL
        assertEquals(GradingStatus.PENDING_MANUAL, answer1.getGradingStatus());
        assertNull(answer1.getAwardedScore());
        verify(candidateAnswerRepository, never()).save(answer1);

        // Verify lock is released even on exception
        verify(aiMetricsRedisService, times(1)).removeActiveJob(jobId);
        verify(stringRedisTemplate, times(1)).delete("ai:grading:lock:exam:" + exam.getId());
    }

    @Test
    @DisplayName("Dynamic Batching: Should split answers into separate batches when token budget is exceeded")
    void testExecuteAiGradingAsync_DynamicBatching_SplitsWhenBudgetExceeded() {
        String jobId = UUID.randomUUID().toString();
        // Set a small budget (e.g. 50 tokens) so that 2 answers cannot fit into a single batch
        when(geminiRotationService.getOptimalBatchTokenBudget()).thenReturn(50);
        when(geminiRotationService.getMaxBatchCandidateCount()).thenReturn(25);

        CandidateAnswer answer1 = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(question)
                .textAnswer("An object at rest stays at rest unless acted upon by a net force.")
                .gradingStatus(GradingStatus.PENDING_MANUAL)
                .build();

        CandidateAnswer answer2 = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(question)
                .textAnswer("Force equals mass multiplied by acceleration.")
                .gradingStatus(GradingStatus.PENDING_MANUAL)
                .build();

        AiBatchGradingResultDto resultDto1 = AiBatchGradingResultDto.builder()
                .results(List.of(AiSingleGradeDto.builder()
                        .candidateAnswerId(answer1.getId().toString())
                        .awardedScore(10.0)
                        .feedback("Correct law 1")
                        .build()))
                .build();

        AiBatchGradingResultDto resultDto2 = AiBatchGradingResultDto.builder()
                .results(List.of(AiSingleGradeDto.builder()
                        .candidateAnswerId(answer2.getId().toString())
                        .awardedScore(5.0)
                        .feedback("This is law 2")
                        .build()))
                .build();

        when(questionRepository.findByIdWithOptionsAndExam(question.getId())).thenReturn(Optional.of(question));
        when(candidateAnswerRepository.findAllById(anyList())).thenAnswer(inv -> {
            List<UUID> reqIds = inv.getArgument(0);
            List<CandidateAnswer> list = new ArrayList<>();
            if (reqIds.contains(answer1.getId())) list.add(answer1);
            if (reqIds.contains(answer2.getId())) list.add(answer2);
            return list;
        });

        when(geminiGradingService.gradeBatch(eq(question), eq(List.of(answer1)))).thenReturn(resultDto1);
        when(geminiGradingService.gradeBatch(eq(question), eq(List.of(answer2)))).thenReturn(resultDto2);
        when(candidateAnswerRepository.save(any(CandidateAnswer.class))).thenAnswer(i -> i.getArgument(0));

        when(examAttemptRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));
        when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(attempt.getId(), GradingStatus.PENDING_MANUAL))
                .thenReturn(0L);
        when(candidateAnswerRepository.sumAwardedScoreByAttemptId(attempt.getId())).thenReturn(15.0);
        when(examAttemptRepository.save(any(ExamAttempt.class))).thenAnswer(i -> i.getArgument(0));

        Map<UUID, List<UUID>> map = Map.of(question.getId(), List.of(answer1.getId(), answer2.getId()));
        asyncWorker.executeAiGradingAsync(jobId, exam.getId(), map, 25);

        // Verify that 2 batches were dispatched due to token budget constraint
        verify(geminiGradingService, times(1)).gradeBatch(eq(question), eq(List.of(answer1)));
        verify(geminiGradingService, times(1)).gradeBatch(eq(question), eq(List.of(answer2)));
        assertEquals(GradingStatus.GRADED, answer1.getGradingStatus());
        assertEquals(GradingStatus.GRADED, answer2.getGradingStatus());
    }

    @Test
    @DisplayName("Dynamic Batching: Should cap batch size at maxCandidateCount even if token budget allows more")
    void testExecuteAiGradingAsync_DynamicBatching_EnforcesMaxCandidateLimit() {
        String jobId = UUID.randomUUID().toString();
        // Allow huge token budget but restrict candidate count to 2
        when(geminiRotationService.getOptimalBatchTokenBudget()).thenReturn(100000);
        when(geminiRotationService.getMaxBatchCandidateCount()).thenReturn(2);

        List<CandidateAnswer> answers = new ArrayList<>();
        List<UUID> answerIds = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            UUID ansId = UUID.randomUUID();
            answerIds.add(ansId);
            answers.add(CandidateAnswer.builder()
                    .id(ansId)
                    .examAttempt(attempt)
                    .question(question)
                    .textAnswer("Short answer " + i)
                    .gradingStatus(GradingStatus.PENDING_MANUAL)
                    .build());
        }

        when(questionRepository.findByIdWithOptionsAndExam(question.getId())).thenReturn(Optional.of(question));
        when(candidateAnswerRepository.findAllById(anyList())).thenAnswer(inv -> {
            List<UUID> reqIds = inv.getArgument(0);
            return answers.stream().filter(a -> reqIds.contains(a.getId())).toList();
        });

        AiBatchGradingResultDto batch1Result = AiBatchGradingResultDto.builder()
                .results(List.of(
                        AiSingleGradeDto.builder().candidateAnswerId(answers.get(0).getId().toString()).awardedScore(8.0).feedback("Good").build(),
                        AiSingleGradeDto.builder().candidateAnswerId(answers.get(1).getId().toString()).awardedScore(9.0).feedback("Great").build()
                ))
                .build();

        AiBatchGradingResultDto batch2Result = AiBatchGradingResultDto.builder()
                .results(List.of(
                        AiSingleGradeDto.builder().candidateAnswerId(answers.get(2).getId().toString()).awardedScore(7.0).feedback("Fair").build()
                ))
                .build();

        when(geminiGradingService.gradeBatch(eq(question), eq(List.of(answers.get(0), answers.get(1))))).thenReturn(batch1Result);
        when(geminiGradingService.gradeBatch(eq(question), eq(List.of(answers.get(2))))).thenReturn(batch2Result);
        when(candidateAnswerRepository.save(any(CandidateAnswer.class))).thenAnswer(i -> i.getArgument(0));

        when(examAttemptRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));
        when(candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(attempt.getId(), GradingStatus.PENDING_MANUAL))
                .thenReturn(0L);
        when(candidateAnswerRepository.sumAwardedScoreByAttemptId(attempt.getId())).thenReturn(24.0);
        when(examAttemptRepository.save(any(ExamAttempt.class))).thenAnswer(i -> i.getArgument(0));

        Map<UUID, List<UUID>> map = Map.of(question.getId(), answerIds);
        asyncWorker.executeAiGradingAsync(jobId, exam.getId(), map, 25);

        // Verify that 2 batches were dispatched: batch 1 of 2 answers, batch 2 of 1 answer
        verify(geminiGradingService, times(1)).gradeBatch(eq(question), eq(List.of(answers.get(0), answers.get(1))));
        verify(geminiGradingService, times(1)).gradeBatch(eq(question), eq(List.of(answers.get(2))));
        assertEquals(GradingStatus.GRADED, answers.get(0).getGradingStatus());
        assertEquals(GradingStatus.GRADED, answers.get(1).getGradingStatus());
        assertEquals(GradingStatus.GRADED, answers.get(2).getGradingStatus());
    }
}
