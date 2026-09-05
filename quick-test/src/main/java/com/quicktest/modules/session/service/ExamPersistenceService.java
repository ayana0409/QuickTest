package com.quicktest.modules.session.service;

import com.quicktest.core.exception.ResourceNotFoundException;
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

    /**
     * Persist candidate answers in batch and update attempt status within a concise database transaction.
     */
    @Transactional
    public void persistGradedAnswersAndStatus(
            UUID attemptId,
            List<CandidateAnswer> answers,
            AttemptStatus finalStatus,
            Double totalScore,
            LocalDateTime submitTime) {

        log.debug("Opening short DB transaction to persist {} answers for attemptId: {}",
                answers != null ? answers.size() : 0, attemptId);

        // 1. Load managed ExamAttempt from DB within this short transaction (ensures version field is initialized)
        ExamAttempt attempt = examAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        attempt.setStatus(finalStatus);
        attempt.setSubmitTime(submitTime != null ? submitTime : LocalDateTime.now());
        attempt.setTotalScore(totalScore);

        // 2. Associate candidate answers with the managed ExamAttempt and batch insert
        if (answers != null && !answers.isEmpty()) {
            for (CandidateAnswer ans : answers) {
                ans.setExamAttempt(attempt);
            }
            candidateAnswerRepository.saveAll(answers);
        }

        log.info("Successfully persisted attempt ID: {} with status: {}, score: {}", attemptId, finalStatus, totalScore);
    }
}
