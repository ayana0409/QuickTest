package com.quicktest.modules.session.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.session.dto.QuestionGradingDto;
import com.quicktest.modules.session.dto.SaveAnswerRequest;
import com.quicktest.modules.session.dto.SubmissionMessage;
import com.quicktest.modules.session.dto.SubmitResultResponse;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.entity.GradingStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Background message consumer processing asynchronous exam submissions.
 * Grades objective questions entirely in RAM, caches answer keys, executes short-lived DB writes,
 * and maintains HikariCP connections in a healthy state.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ExamSubmissionConsumer {

    private final RedisExamSessionService redisExamSessionService;
    private final ExamPersistenceService examPersistenceService;
    private final QuestionRepository questionRepository;

    /**
     * Consume exam submission message from RabbitMQ.
     */
    @RabbitListener(queues = RabbitMQConfig.SUBMISSION_QUEUE)
    public void processSubmission(SubmissionMessage message) {
        UUID attemptId = message.getAttemptId();
        UUID examId = message.getExamId();
        log.info("Received submission message from RabbitMQ: attemptId={}, examId={}", attemptId, examId);

        try {
            // 1. Retrieve master exam grading key from Redis Cache (or populate on cache miss)
            List<QuestionGradingDto> questions = resolveExamGradingKey(examId);

            // 2. Perform in-memory grading on RAM
            Map<UUID, SaveAnswerRequest> answersMap = message.getAnswers() != null
                    ? message.getAnswers()
                    : Collections.emptyMap();

            double totalScore = 0.0;
            boolean hasPendingManualGrading = false;
            List<CandidateAnswer> candidateAnswers = new ArrayList<>();

            ExamAttempt attemptRef = ExamAttempt.builder().id(attemptId).build();

            for (QuestionGradingDto qDto : questions) {
                SaveAnswerRequest answerDraft = answersMap.get(qDto.getQuestionId());
                Question qRef = Question.builder().id(qDto.getQuestionId()).build();

                // Unanswered question handling
                if (answerDraft == null) {
                    CandidateAnswer unanswered = CandidateAnswer.builder()
                            .examAttempt(attemptRef)
                            .question(qRef)
                            .selectedOptions(Collections.emptySet())
                            .textAnswer(null)
                            .awardedScore(0.0)
                            .gradingStatus(GradingStatus.AUTO_GRADED)
                            .build();
                    candidateAnswers.add(unanswered);
                    continue;
                }

                CandidateAnswer candidateAnswer = CandidateAnswer.builder()
                        .examAttempt(attemptRef)
                        .question(qRef)
                        .build();

                if (qDto.getQuestionType() == QuestionType.SINGLE_CHOICE
                        || qDto.getQuestionType() == QuestionType.MULTIPLE_CHOICE) {

                    Set<UUID> chosenOptionIds = answerDraft.getSelectedOptionIds() != null
                            ? answerDraft.getSelectedOptionIds()
                            : Collections.emptySet();

                    Set<AnswerOption> chosenOptions = chosenOptionIds.stream()
                            .map(optId -> AnswerOption.builder().id(optId).build())
                            .collect(Collectors.toSet());
                    candidateAnswer.setSelectedOptions(chosenOptions);

                    Set<UUID> correctOptionIds = qDto.getCorrectOptionIds() != null
                            ? qDto.getCorrectOptionIds()
                            : Collections.emptySet();

                    if (!correctOptionIds.isEmpty() && correctOptionIds.equals(chosenOptionIds)) {
                        candidateAnswer.setAwardedScore(qDto.getPoints());
                    } else {
                        candidateAnswer.setAwardedScore(0.0);
                    }
                    candidateAnswer.setGradingStatus(GradingStatus.AUTO_GRADED);
                    totalScore += candidateAnswer.getAwardedScore();

                } else if (qDto.getQuestionType() == QuestionType.NUMERIC) {
                    String inputVal = answerDraft.getTextAnswer() != null ? answerDraft.getTextAnswer().trim() : "";
                    candidateAnswer.setTextAnswer(inputVal);
                    candidateAnswer.setGradingStatus(GradingStatus.AUTO_GRADED);

                    String sample = qDto.getSampleAnswer();
                    if (sample == null || sample.trim().isEmpty()) {
                        log.warn("Question ID {} has missing sampleAnswer for NUMERIC question", qDto.getQuestionId());
                        candidateAnswer.setAwardedScore(0.0);
                    } else {
                        try {
                            double candidateNumber = Double.parseDouble(inputVal);
                            double targetNumber = Double.parseDouble(sample.trim());
                            double tolerance = qDto.getNumericTolerance() != null ? qDto.getNumericTolerance() : 0.0;

                            if (Math.abs(candidateNumber - targetNumber) <= tolerance) {
                                candidateAnswer.setAwardedScore(qDto.getPoints());
                            } else {
                                candidateAnswer.setAwardedScore(0.0);
                            }
                        } catch (NumberFormatException ex) {
                            // Candidate entered non-numeric input
                            candidateAnswer.setAwardedScore(0.0);
                        }
                    }
                    totalScore += candidateAnswer.getAwardedScore();

                } else if (qDto.getQuestionType() == QuestionType.ESSAY_TEXT) {
                    String text = answerDraft.getTextAnswer() != null ? answerDraft.getTextAnswer().trim() : "";
                    candidateAnswer.setTextAnswer(text);
                    candidateAnswer.setAwardedScore(0.0);
                    candidateAnswer.setGradingStatus(GradingStatus.PENDING_MANUAL);
                    hasPendingManualGrading = true;
                }

                candidateAnswers.add(candidateAnswer);
            }

            // 3. Delegate to short-lived DB transaction
            AttemptStatus finalStatus = hasPendingManualGrading
                    ? AttemptStatus.AWAITING_MANUAL_GRADING
                    : AttemptStatus.SUBMITTED;

            LocalDateTime submitTime = message.getSubmitTime() != null ? message.getSubmitTime() : LocalDateTime.now();
            Double finalScore = hasPendingManualGrading ? null : totalScore;

            examPersistenceService.persistGradedAnswersAndStatus(
                    attemptId, candidateAnswers, finalStatus, finalScore, submitTime);

            // 4. Cache final result in Redis for instant client polling
            SubmitResultResponse resultResponse = SubmitResultResponse.builder()
                    .attemptId(attemptId)
                    .examTitle(message.getExamTitle())
                    .status(finalStatus)
                    .totalScore(finalScore)
                    .submitTime(submitTime)
                    .message(hasPendingManualGrading
                            ? "Exam submitted successfully. Essay questions are awaiting manual grading by the teacher."
                            : "Exam submitted and graded successfully.")
                    .build();

            redisExamSessionService.cacheSubmissionResult(attemptId, resultResponse, 60L);

            // 5. Cleanup Redis draft answers and lock
            redisExamSessionService.clearDraftAnswers(attemptId);
            redisExamSessionService.releaseSubmissionLock(attemptId);

            log.info("Finished background processing for attemptId: {}, status: {}, score: {}",
                    attemptId, finalStatus, finalScore);

        } catch (Exception ex) {
            log.error("Fatal error processing submission for attemptId: {}", attemptId, ex);
            redisExamSessionService.releaseSubmissionLock(attemptId);
            throw ex; // Re-throwing sends to DLQ or triggers AMQP retry
        }
    }

    /**
     * Fetch exam grading keys from Redis Cache; fallback to single DB query on cache miss.
     */
    private List<QuestionGradingDto> resolveExamGradingKey(UUID examId) {
        List<QuestionGradingDto> cached = redisExamSessionService.getExamGradingKey(examId);
        if (cached != null && !cached.isEmpty()) {
            log.debug("Redis cache HIT for exam grading key: examId={}", examId);
            return cached;
        }

        log.info("Redis cache MISS for exam grading key: examId={}. Querying database...", examId);
        List<Question> questions = questionRepository.findByExamIdWithOptions(examId);

        List<QuestionGradingDto> dtos = new ArrayList<>();
        for (Question q : questions) {
            Set<UUID> correctIds = q.getOptions() != null
                    ? q.getOptions().stream()
                            .filter(opt -> Boolean.TRUE.equals(opt.getIsCorrect()))
                            .map(AnswerOption::getId)
                            .collect(Collectors.toSet())
                    : Collections.emptySet();

            QuestionGradingDto dto = QuestionGradingDto.builder()
                    .questionId(q.getId())
                    .questionType(q.getQuestionType())
                    .points(q.getPoints())
                    .correctOptionIds(correctIds)
                    .sampleAnswer(q.getSampleAnswer())
                    .numericTolerance(q.getNumericTolerance())
                    .gradingRubric(q.getGradingRubric())
                    .build();

            dtos.add(dto);
        }

        redisExamSessionService.cacheExamGradingKey(examId, dtos, 120L);
        return dtos;
    }
}
