package com.quicktest.modules.session.repository;

import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.GradingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    /**
     * Paginated candidate answers for a specific question with attempt and user eagerly fetched.
     */
    @Query(
        value = "SELECT ca FROM CandidateAnswer ca " +
                "JOIN FETCH ca.examAttempt a " +
                "LEFT JOIN FETCH a.user u " +
                "WHERE ca.question.id = :questionId " +
                "ORDER BY a.submitTime DESC NULLS LAST",
        countQuery = "SELECT COUNT(ca) FROM CandidateAnswer ca WHERE ca.question.id = :questionId"
    )
    Page<CandidateAnswer> findByQuestionIdWithAttemptAndUser(
            @Param("questionId") UUID questionId, Pageable pageable);

    /**
     * Paginated candidate answers for a specific question filtered by grading status.
     */
    @Query(
        value = "SELECT ca FROM CandidateAnswer ca " +
                "JOIN FETCH ca.examAttempt a " +
                "LEFT JOIN FETCH a.user u " +
                "WHERE ca.question.id = :questionId AND ca.gradingStatus = :status " +
                "ORDER BY a.submitTime DESC NULLS LAST",
        countQuery = "SELECT COUNT(ca) FROM CandidateAnswer ca WHERE ca.question.id = :questionId AND ca.gradingStatus = :status"
    )
    Page<CandidateAnswer> findByQuestionIdAndGradingStatusWithAttemptAndUser(
            @Param("questionId") UUID questionId,
            @Param("status") GradingStatus status,
            Pageable pageable);

    /**
     * Count total candidate answers submitted for a specific question.
     */
    long countByQuestionId(UUID questionId);

    /**
     * Count candidate answers for a question by grading status.
     */
    long countByQuestionIdAndGradingStatus(UUID questionId, GradingStatus status);

    /**
     * Find all pending candidate answers for a specific question to feed into AI batch grading.
     */
    @Query("SELECT ca FROM CandidateAnswer ca " +
           "JOIN FETCH ca.question q " +
           "JOIN FETCH ca.examAttempt a " +
           "WHERE q.id = :questionId AND ca.gradingStatus = :status " +
           "ORDER BY a.submitTime ASC NULLS LAST")
    List<CandidateAnswer> findPendingByQuestionId(
            @Param("questionId") UUID questionId,
            @Param("status") GradingStatus status);

    /**
     * Find all pending essay answers across all questions in an exam for entire-exam AI grading.
     */
    @Query("SELECT ca FROM CandidateAnswer ca " +
           "JOIN FETCH ca.question q " +
           "JOIN FETCH ca.examAttempt a " +
           "WHERE q.exam.id = :examId AND q.questionType = com.quicktest.modules.assessment.entity.QuestionType.ESSAY_TEXT AND ca.gradingStatus = :status " +
           "ORDER BY q.orderIndex ASC, a.submitTime ASC NULLS LAST")
    List<CandidateAnswer> findPendingByExamId(
            @Param("examId") UUID examId,
            @Param("status") GradingStatus status);

    /**
     * Count answered questions grouped by attemptId for all attempts in an exam.
     * Returns List of [attemptId (UUID), answeredCount (Long)].
     */
    @Query("SELECT ca.examAttempt.id, COUNT(ca.id) " +
           "FROM CandidateAnswer ca " +
           "WHERE ca.examAttempt.exam.id = :examId " +
           "GROUP BY ca.examAttempt.id")
    List<Object[]> countAnsweredQuestionsByExamId(@Param("examId") UUID examId);
}
