package com.quicktest.modules.session;

import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.session.dto.QuestionGradingDto;
import com.quicktest.modules.session.dto.SaveAnswerRequest;
import com.quicktest.modules.session.dto.SubmissionMessage;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.service.ExamPersistenceService;
import com.quicktest.modules.session.service.ExamSubmissionConsumer;
import com.quicktest.modules.session.service.RedisExamSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ExamSubmissionConsumer.
 * Validates background RAM-based grading for Single Choice, Multiple Choice,
 * Numeric (with tolerance),
 * Essay questions, zero-score records for unanswered questions, and Redis
 * caching.
 */
@ExtendWith(MockitoExtension.class)
class ExamSubmissionConsumerTest {

        @Mock
        private RedisExamSessionService redisExamSessionService;

        @Mock
        private ExamPersistenceService examPersistenceService;

        @Mock
        private QuestionRepository questionRepository;

        @InjectMocks
        private ExamSubmissionConsumer examSubmissionConsumer;

        private UUID examId;
        private UUID attemptId;
        private UUID singleChoiceQId;
        private UUID multiChoiceQId;
        private UUID numericQId;
        private UUID essayQId;

        private UUID optA;
        private UUID optB; // correct for single choice
        private UUID optC; // correct for multi choice
        private UUID optD; // correct for multi choice

        private List<QuestionGradingDto> cachedGradingKey;

        @BeforeEach
        void setUp() {
                examId = UUID.randomUUID();
                attemptId = UUID.randomUUID();
                singleChoiceQId = UUID.randomUUID();
                multiChoiceQId = UUID.randomUUID();
                numericQId = UUID.randomUUID();
                essayQId = UUID.randomUUID();

                optA = UUID.randomUUID();
                optB = UUID.randomUUID();
                optC = UUID.randomUUID();
                optD = UUID.randomUUID();

                cachedGradingKey = List.of(
                                QuestionGradingDto.builder()
                                                .questionId(singleChoiceQId)
                                                .questionType(QuestionType.SINGLE_CHOICE)
                                                .points(2.0)
                                                .correctOptionIds(Set.of(optB))
                                                .build(),
                                QuestionGradingDto.builder()
                                                .questionId(multiChoiceQId)
                                                .questionType(QuestionType.MULTIPLE_CHOICE)
                                                .points(3.0)
                                                .correctOptionIds(Set.of(optC, optD))
                                                .build(),
                                QuestionGradingDto.builder()
                                                .questionId(numericQId)
                                                .questionType(QuestionType.NUMERIC)
                                                .points(2.5)
                                                .sampleAnswer("3.14")
                                                .numericTolerance(0.01)
                                                .build());
        }

        @Test
        @DisplayName("processSubmission should accurately grade all objective questions and persist results")
        void processSubmission_AllObjectiveQuestions_GradesCorrectly() {
                // Arrange
                when(redisExamSessionService.getExamGradingKey(examId)).thenReturn(cachedGradingKey);

                Map<UUID, SaveAnswerRequest> answers = new HashMap<>();
                answers.put(singleChoiceQId, SaveAnswerRequest.builder()
                                .questionId(singleChoiceQId)
                                .selectedOptionIds(Set.of(optB))
                                .build());
                answers.put(multiChoiceQId, SaveAnswerRequest.builder()
                                .questionId(multiChoiceQId)
                                .selectedOptionIds(Set.of(optC, optD))
                                .build());
                answers.put(numericQId, SaveAnswerRequest.builder()
                                .questionId(numericQId)
                                .textAnswer("3.1415") // within 0.01 tolerance (diff = 0.0015 <= 0.01)
                                .build());

                SubmissionMessage message = SubmissionMessage.builder()
                                .attemptId(attemptId)
                                .examId(examId)
                                .examTitle("Math and Science Quiz")
                                .submitTime(LocalDateTime.now())
                                .answers(answers)
                                .build();

                // Act
                examSubmissionConsumer.processSubmission(message);

                // Assert
                // Total score = 2.0 + 3.0 + 2.5 = 7.5
                verify(examPersistenceService, times(1)).persistGradedAnswersAndStatus(
                                eq(attemptId),
                                argThat((List<CandidateAnswer> list) -> list != null && list.size() == 3),
                                eq(AttemptStatus.SUBMITTED),
                                eq(7.5),
                                any(LocalDateTime.class));

                verify(redisExamSessionService, times(1)).cacheSubmissionResult(
                                eq(attemptId),
                                argThat(result -> result.getStatus() == AttemptStatus.SUBMITTED
                                                && result.getTotalScore() == 7.5),
                                eq(60L));

                verify(redisExamSessionService, times(1)).clearDraftAnswers(attemptId);
                verify(redisExamSessionService, times(1)).releaseSubmissionLock(attemptId);
        }

        @Test
        @DisplayName("processSubmission should award zero score for incorrect and out-of-tolerance answers")
        void processSubmission_WrongAnswers_AwardsZero() {
                when(redisExamSessionService.getExamGradingKey(examId)).thenReturn(cachedGradingKey);

                Map<UUID, SaveAnswerRequest> answers = new HashMap<>();
                // Wrong single choice: optA instead of optB
                answers.put(singleChoiceQId, SaveAnswerRequest.builder()
                                .questionId(singleChoiceQId)
                                .selectedOptionIds(Set.of(optA))
                                .build());
                // Incomplete multi choice: only optC instead of {optC, optD}
                answers.put(multiChoiceQId, SaveAnswerRequest.builder()
                                .questionId(multiChoiceQId)
                                .selectedOptionIds(Set.of(optC))
                                .build());
                // Numeric out of tolerance: 3.20 (diff = 0.06 > 0.01)
                answers.put(numericQId, SaveAnswerRequest.builder()
                                .questionId(numericQId)
                                .textAnswer("3.20")
                                .build());

                SubmissionMessage message = SubmissionMessage.builder()
                                .attemptId(attemptId)
                                .examId(examId)
                                .examTitle("Math and Science Quiz")
                                .submitTime(LocalDateTime.now())
                                .answers(answers)
                                .build();

                examSubmissionConsumer.processSubmission(message);

                verify(examPersistenceService, times(1)).persistGradedAnswersAndStatus(
                                eq(attemptId),
                                argThat((List<CandidateAnswer> list) -> list != null && list.size() == 3),
                                eq(AttemptStatus.SUBMITTED),
                                eq(0.0),
                                any(LocalDateTime.class));
        }

        @Test
        @DisplayName("processSubmission should set AWAITING_MANUAL_GRADING when exam has essay questions")
        void processSubmission_EssayQuestion_SetsAwaitingManualGrading() {
                List<QuestionGradingDto> keysWithEssay = new ArrayList<>(cachedGradingKey);
                keysWithEssay.add(QuestionGradingDto.builder()
                                .questionId(essayQId)
                                .questionType(QuestionType.ESSAY_TEXT)
                                .points(5.0)
                                .build());

                when(redisExamSessionService.getExamGradingKey(examId)).thenReturn(keysWithEssay);

                Map<UUID, SaveAnswerRequest> answers = new HashMap<>();
                answers.put(essayQId, SaveAnswerRequest.builder()
                                .questionId(essayQId)
                                .textAnswer("Detailed essay explanation on quantum mechanics.")
                                .build());

                SubmissionMessage message = SubmissionMessage.builder()
                                .attemptId(attemptId)
                                .examId(examId)
                                .examTitle("Physics and Essay Exam")
                                .submitTime(LocalDateTime.now())
                                .answers(answers)
                                .build();

                examSubmissionConsumer.processSubmission(message);

                // Status should be AWAITING_MANUAL_GRADING and totalScore null
                verify(examPersistenceService, times(1)).persistGradedAnswersAndStatus(
                                eq(attemptId),
                                argThat((List<CandidateAnswer> list) -> list != null && list.size() == 4),
                                eq(AttemptStatus.AWAITING_MANUAL_GRADING),
                                isNull(),
                                any(LocalDateTime.class));

                verify(redisExamSessionService, times(1)).cacheSubmissionResult(
                                eq(attemptId),
                                argThat(result -> result.getStatus() == AttemptStatus.AWAITING_MANUAL_GRADING
                                                && result.getTotalScore() == null),
                                eq(60L));
        }

        @Test
        @DisplayName("processSubmission should create zero-score CandidateAnswer for unanswered questions")
        void processSubmission_UnansweredQuestions_PersistsZeroScoreCandidateAnswers() {
                when(redisExamSessionService.getExamGradingKey(examId)).thenReturn(cachedGradingKey);

                // Empty answers (candidate skipped all 3 questions)
                SubmissionMessage message = SubmissionMessage.builder()
                                .attemptId(attemptId)
                                .examId(examId)
                                .examTitle("Quiz with skipped questions")
                                .submitTime(LocalDateTime.now())
                                .answers(Collections.emptyMap())
                                .build();

                examSubmissionConsumer.processSubmission(message);

                verify(examPersistenceService, times(1)).persistGradedAnswersAndStatus(
                                eq(attemptId),
                                argThat((List<CandidateAnswer> list) -> {
                                        if (list == null || list.size() != 3)
                                                return false;
                                        return list.stream().allMatch(a -> a.getAwardedScore() == 0.0
                                                        && a.getGradingStatus() == GradingStatus.AUTO_GRADED);
                                }),
                                eq(AttemptStatus.SUBMITTED),
                                eq(0.0),
                                any(LocalDateTime.class));
        }

        @Test
        @DisplayName("processSubmission should load grading key from DB and cache to Redis when cache misses")
        void processSubmission_LoadsGradingKeyFromDb_WhenRedisCacheMiss() {
                // Redis returns empty list
                when(redisExamSessionService.getExamGradingKey(examId)).thenReturn(Collections.emptyList());

                Question q1 = Question.builder()
                                .id(singleChoiceQId)
                                .questionType(QuestionType.SINGLE_CHOICE)
                                .points(2.0)
                                .orderIndex(1)
                                .options(List.of(
                                                AnswerOption.builder().id(optA).isCorrect(false).build(),
                                                AnswerOption.builder().id(optB).isCorrect(true).build()))
                                .build();

                when(questionRepository.findByExamIdWithOptions(examId)).thenReturn(List.of(q1));

                SubmissionMessage message = SubmissionMessage.builder()
                                .attemptId(attemptId)
                                .examId(examId)
                                .examTitle("DB Fallback Test")
                                .submitTime(LocalDateTime.now())
                                .answers(Collections.emptyMap())
                                .build();

                examSubmissionConsumer.processSubmission(message);

                // Verify grading key was retrieved from DB and cached to Redis
                verify(questionRepository, times(1)).findByExamIdWithOptions(examId);
                verify(redisExamSessionService, times(1)).cacheExamGradingKey(eq(examId), anyList(), anyLong());
        }
}
