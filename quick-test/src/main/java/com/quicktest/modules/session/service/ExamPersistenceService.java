package com.quicktest.modules.session.service;

import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Dedicated persistence helper managing short-lived database transactions (< 15ms)
 * to keep HikariCP connection pool usage at a strict minimum during peak submission load.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ExamPersistenceService {

    private final CandidateAnswerRepository candidateAnswerRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final ViolationLogRepository violationLogRepository;

    /**
     * Backward-compatible overload persisting candidate answers and updating attempt status.
     */
    @Transactional
    public void persistGradedAnswersAndStatus(
            UUID attemptId,
            List<CandidateAnswer> answers,
            AttemptStatus finalStatus,
            Double totalScore,
            LocalDateTime submitTime) {

        persistGradedAnswersAndStatusWithViolations(
                attemptId, answers, finalStatus, totalScore, submitTime, null, null);
    }

    /**
     * Persists candidate answers and batches all buffered violation logs from Redis into PostgreSQL
     * in a single, short-lived database transaction.
     *
     * @param attemptId      The target exam attempt identifier
     * @param answers        List of evaluated candidate answers
     * @param finalStatus    Final calculated attempt status
     * @param totalScore     Total awarded score (null if awaiting manual grading)
     * @param submitTime     Candidate submission timestamp
     * @param violationCount Total violations aggregated in Redis
     * @param violationLogs  List of violation logs buffered in Redis
     */
    @Transactional
    public void persistGradedAnswersAndStatusWithViolations(
            UUID attemptId,
            List<CandidateAnswer> answers,
            AttemptStatus finalStatus,
            Double totalScore,
            LocalDateTime submitTime,
            Integer violationCount,
            List<ViolationLog> violationLogs) {

        log.debug("Opening short DB transaction to persist attemptId: {}, answers: {}, violations: {}",
                attemptId, answers != null ? answers.size() : 0, violationLogs != null ? violationLogs.size() : 0);

        // 1. Load managed ExamAttempt from DB within this short transaction (ensures version field is initialized)
        ExamAttempt attempt = examAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        attempt.setStatus(finalStatus);
        attempt.setSubmitTime(submitTime != null ? submitTime : LocalDateTime.now());
        attempt.setTotalScore(totalScore);
        if (violationCount != null) {
            attempt.setViolationCount(violationCount);
        }

        // 2. Associate candidate answers with the managed ExamAttempt and batch insert
        if (answers != null && !answers.isEmpty()) {
            List<CandidateAnswer> existingAnswers = candidateAnswerRepository.findByExamAttemptId(attemptId);
            if (!existingAnswers.isEmpty()) {
                candidateAnswerRepository.deleteAll(existingAnswers);
                candidateAnswerRepository.flush();
            }

            java.util.Map<UUID, CandidateAnswer> uniqueAnswers = new java.util.LinkedHashMap<>();
            for (CandidateAnswer ans : answers) {
                if (ans.getQuestion() != null && ans.getQuestion().getId() != null) {
                    ans.setExamAttempt(attempt);
                    uniqueAnswers.put(ans.getQuestion().getId(), ans);
                }
            }
            candidateAnswerRepository.saveAll(uniqueAnswers.values());
        }

        // 3. Batch insert buffered violation logs if present
        if (violationLogs != null && !violationLogs.isEmpty()) {
            for (ViolationLog vLog : violationLogs) {
                vLog.setExamAttempt(attempt);
            }
            violationLogRepository.saveAll(violationLogs);
            log.info("Batch persisted {} violation logs to PostgreSQL for attemptId: {}",
                    violationLogs.size(), attemptId);
        }

        examAttemptRepository.save(attempt);

        log.info("Successfully persisted attempt ID: {} with status: {}, score: {}, violations: {}",
                attemptId, finalStatus, totalScore, attempt.getViolationCount());
    }
}
