package com.quicktest.modules.session.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.proctoring.dto.ViolationItemRedisDto;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.service.RedisProctoringService;
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
import org.springframework.data.redis.core.StringRedisTemplate;
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
@org.springframework.context.annotation.Lazy(false)
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ExamSubmissionConsumer {

    private final RedisExamSessionService redisExamSessionService;
    private final ExamPersistenceService examPersistenceService;
    private final QuestionRepository questionRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Consume exam submission message from RabbitMQ.
     */
    @com.quicktest.core.logging.AuditLog(module = "WORKER_SUBMISSION", action = "PROCESS_SUBMISSION")
    @RabbitListener(queues = RabbitMQConfig.SUBMISSION_QUEUE)
    public void processSubmission(SubmissionMessage message) {
        UUID attemptId = message.getAttemptId();
        UUID examId = message.getExamId();

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
                            .teacherFeedback("Thí sinh không làm bài (để trống)")
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
                            // Support both dot '.' and comma ',' decimal separators (e.g. 78.5 and 78,5)
                            String normalizedInput = inputVal.replace(" ", "").replace(',', '.');
                            String normalizedSample = sample.trim().replace(" ", "").replace(',', '.');
                            double candidateNumber = Double.parseDouble(normalizedInput);
                            double targetNumber = Double.parseDouble(normalizedSample);
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

                    // If candidate left the essay blank, skip manual grading and automatically score 0
                    if (text.isEmpty()) {
                        candidateAnswer.setAwardedScore(0.0);
                        candidateAnswer.setGradingStatus(GradingStatus.AUTO_GRADED);
                        candidateAnswer.setTeacherFeedback("Thí sinh không làm bài (để trống)");
                    } else {
                        candidateAnswer.setAwardedScore(0.0);
                        candidateAnswer.setGradingStatus(GradingStatus.PENDING_MANUAL);
                        hasPendingManualGrading = true;
                    }
                }

                candidateAnswers.add(candidateAnswer);
            }

            // 3. Collect violation history buffered in Redis
            ViolationPersistenceData violationData = collectViolationsFromRedis(attemptId);

            // 4. Delegate to short-lived DB transaction (DISQUALIFIED overrides SUBMITTED)
            AttemptStatus finalStatus;
            if (violationData.wasDisqualified()) {
                finalStatus = AttemptStatus.DISQUALIFIED;
            } else if (hasPendingManualGrading) {
                finalStatus = AttemptStatus.AWAITING_MANUAL_GRADING;
            } else {
                finalStatus = AttemptStatus.SUBMITTED;
            }

            LocalDateTime submitTime = message.getSubmitTime() != null ? message.getSubmitTime() : LocalDateTime.now();
            Double finalScore;
            if (finalStatus == AttemptStatus.DISQUALIFIED) {
                finalScore = 0.0;
            } else if (hasPendingManualGrading) {
                finalScore = null;
            } else {
                finalScore = totalScore;
            }

            if (violationData != null && (!violationData.entities().isEmpty() || violationData.totalViolations() > 0)) {
                try {
                    examPersistenceService.persistGradedAnswersAndStatusWithViolations(
                            attemptId,
                            candidateAnswers,
                            finalStatus,
                            finalScore,
                            submitTime,
                            violationData.totalViolations(),
                            violationData.entities());
                } catch (org.springframework.dao.DataIntegrityViolationException dbEx) {
                    log.warn("Violation logs batch insert hit constraint issue for attemptId: {}. Falling back to persisting answers and status without raw logs: {}",
                            attemptId, dbEx.getMessage());
                    examPersistenceService.persistGradedAnswersAndStatusWithViolations(
                            attemptId,
                            candidateAnswers,
                            finalStatus,
                            finalScore,
                            submitTime,
                            violationData.totalViolations(),
                            Collections.emptyList());
                }
            } else {
                examPersistenceService.persistGradedAnswersAndStatus(
                        attemptId, candidateAnswers, finalStatus, finalScore, submitTime);
            }

            // 5. Cache final result in Redis for instant client polling
            double maxScore = questions.stream()
                    .mapToDouble(q -> q.getPoints() != null ? q.getPoints() : 0.0)
                    .sum();
            if (maxScore <= 0.0) {
                maxScore = 10.0;
            }

            boolean showResults = message.getShowResultsToStudents() == null || message.getShowResultsToStudents();

            String submitMessage;
            if (finalStatus == AttemptStatus.DISQUALIFIED) {
                submitMessage = "Bài thi đã bị đình chỉ do vi phạm quy chế thi.";
            } else if (!showResults) {
                submitMessage = "Bài thi đã được nộp thành công. Điểm số và đáp án chi tiết không được giáo viên công bố.";
            } else if (hasPendingManualGrading) {
                submitMessage = "Bài thi đã nộp thành công và đang chờ giáo viên chấm phần tự luận.";
            } else {
                submitMessage = "Bài thi đã được nộp và hoàn tất chấm điểm tự động.";
            }

            SubmitResultResponse resultResponse = SubmitResultResponse.builder()
                    .attemptId(attemptId)
                    .examTitle(message.getExamTitle())
                    .status(finalStatus)
                    .totalScore(showResults ? finalScore : null)
                    .maxScore(showResults ? maxScore : null)
                    .showResultsToStudents(showResults)
                    .submitTime(submitTime)
                    .isGuest(message.getUserId() == null)
                    .candidateName(message.getCandidateName())
                    .message(submitMessage)
                    .build();

            redisExamSessionService.cacheSubmissionResult(attemptId, resultResponse, 60L);

            // 6. Cleanup Redis draft answers, locks, and violation keys
            redisExamSessionService.clearDraftAnswers(attemptId);
            cleanupViolationKeys(attemptId);
            redisExamSessionService.releaseSubmissionLock(attemptId);
        } catch (org.springframework.dao.DataIntegrityViolationException nonRecoverableEx) {
            log.error("Non-recoverable data integrity error processing submission for attemptId: {}. Acknowledging message to prevent infinite retry loop.", attemptId, nonRecoverableEx);
            cleanupViolationKeys(attemptId);
            redisExamSessionService.releaseSubmissionLock(attemptId);
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

    /**
     * Collects all accumulated violation telemetry from Redis and converts to entities for batch persistence.
     */
    private ViolationPersistenceData collectViolationsFromRedis(UUID attemptId) {
        if (redisTemplate == null) {
            return new ViolationPersistenceData(0, false, Collections.emptyList());
        }

        String countKey = String.format(RedisProctoringService.KEY_VIOLATION_COUNT, attemptId);
        String logsKey = String.format(RedisProctoringService.KEY_VIOLATION_LOGS, attemptId);
        String statusKey = String.format(RedisProctoringService.KEY_ATTEMPT_STATUS, attemptId);

        String countStr = redisTemplate.opsForValue().get(countKey);
        String redisStatus = redisTemplate.opsForValue().get(statusKey);
        List<String> rawLogs = redisTemplate.opsForList().range(logsKey, 0, -1);

        int totalViolations = countStr != null ? Integer.parseInt(countStr) : 0;
        boolean wasDisqualified = "DISQUALIFIED".equalsIgnoreCase(redisStatus);

        List<ViolationLog> entities = new ArrayList<>();
        if (rawLogs != null) {
            for (String raw : rawLogs) {
                try {
                    ViolationItemRedisDto dto = objectMapper.readValue(raw, ViolationItemRedisDto.class);
                    entities.add(ViolationLog.builder()
                            .examAttempt(ExamAttempt.builder().id(attemptId).build())
                            .violationType(dto.getViolationType())
                            .description(dto.getDescription())
                            .evidenceUrl(dto.getEvidenceUrl())
                            .timestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now())
                            .build());
                } catch (Exception ex) {
                    log.warn("[SubmissionConsumer] Failed to parse Redis violation entry for attemptId: {}", attemptId, ex);
                }
            }
        }

        return new ViolationPersistenceData(totalViolations, wasDisqualified, entities);
    }

    /**
     * Cleans up transient violation keys from Redis after database persistence.
     */
    private void cleanupViolationKeys(UUID attemptId) {
        if (redisTemplate == null) {
            return;
        }

        try {
            redisTemplate.delete(List.of(
                    String.format(RedisProctoringService.KEY_VIOLATION_COUNT, attemptId),
                    String.format(RedisProctoringService.KEY_VIOLATION_LOGS, attemptId),
                    String.format(RedisProctoringService.KEY_ATTEMPT_STATUS, attemptId)
            ));
            log.debug("[SubmissionConsumer] Cleaned up Redis violation keys for attemptId: {}", attemptId);
        } catch (Exception ex) {
            log.warn("[SubmissionConsumer] Failed to cleanup Redis violation keys for attemptId: {}", attemptId, ex);
        }
    }

    public record ViolationPersistenceData(
            int totalViolations,
            boolean wasDisqualified,
            List<ViolationLog> entities
    ) {}
}
