package com.quicktest.modules.session.repository;

import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.GradingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for CandidateAnswer entity.
 */
@Repository
public interface CandidateAnswerRepository extends JpaRepository<CandidateAnswer, UUID> {

    List<CandidateAnswer> findByExamAttemptId(UUID attemptId);

    Optional<CandidateAnswer> findByExamAttemptIdAndQuestionId(UUID attemptId, UUID questionId);

    List<CandidateAnswer> findByExamAttemptIdAndGradingStatus(UUID attemptId, GradingStatus gradingStatus);

    long countByExamAttemptIdAndGradingStatus(UUID attemptId, GradingStatus gradingStatus);

    boolean existsByExamAttemptIdAndGradingStatus(UUID attemptId, GradingStatus gradingStatus);

    /**
     * Eagerly fetch candidate answers along with Question details and selected options.
     */
    @Query("SELECT DISTINCT ca FROM CandidateAnswer ca " +
           "JOIN FETCH ca.question q " +
           "LEFT JOIN FETCH ca.selectedOptions so " +
           "WHERE ca.examAttempt.id = :attemptId " +
           "ORDER BY q.orderIndex ASC")
    List<CandidateAnswer> findByExamAttemptIdWithQuestion(@Param("attemptId") UUID attemptId);

    /**
     * Compute total awarded score for all graded answers of an attempt.
     */
    @Query("SELECT COALESCE(SUM(ca.awardedScore), 0.0) FROM CandidateAnswer ca WHERE ca.examAttempt.id = :attemptId")
    Double sumAwardedScoreByAttemptId(@Param("attemptId") UUID attemptId);
}
