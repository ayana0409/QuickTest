package com.quicktest.modules.session.repository;

import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for ExamAttempt entity.
 */
@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, UUID> {

    List<ExamAttempt> findByUserId(UUID userId);

    List<ExamAttempt> findByExamId(UUID examId);

    List<ExamAttempt> findByExamIdAndStatus(UUID examId, AttemptStatus status);

    List<ExamAttempt> findByStatusAndExpireAtBefore(AttemptStatus status, java.time.LocalDateTime dateTime);

    List<ExamAttempt> findByGuestIdentifierAndExamId(String guestIdentifier, UUID examId);

    long countByUserIdAndExamId(UUID userId, UUID examId);

    long countByGuestIdentifierAndExamId(String guestIdentifier, UUID examId);

    long countByExamId(UUID examId);

    long countByStatus(AttemptStatus status);

    long countByExamIdAndStatus(UUID examId, AttemptStatus status);

    /**
     * Batch count attempts grouped by exam ID to prevent N+1 queries.
     */
    @Query("SELECT ea.exam.id, COUNT(ea.id) FROM ExamAttempt ea WHERE ea.exam.id IN :examIds GROUP BY ea.exam.id")
    List<Object[]> countAttemptsByExamIds(@Param("examIds") List<UUID> examIds);

    Optional<ExamAttempt> findFirstByExamIdAndGuestIdentifierAndStatus(UUID examId, String guestIdentifier, AttemptStatus status);

    Optional<ExamAttempt> findFirstByUserIdAndExamIdAndStatus(UUID userId, UUID examId, AttemptStatus status);

    /**
     * Eagerly fetch ExamAttempt along with Exam configuration to avoid lazy initialization issues.
     */
    @Query("SELECT ea FROM ExamAttempt ea JOIN FETCH ea.exam e LEFT JOIN FETCH ea.user u WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithExam(@Param("id") UUID id);

    /**
     * Eagerly fetch ExamAttempt with Exam and CandidateAnswers.
     */
    @Query("SELECT DISTINCT ea FROM ExamAttempt ea JOIN FETCH ea.exam e LEFT JOIN FETCH ea.answers a WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithExamAndAnswers(@Param("id") UUID id);

    /**
     * Eagerly fetch ExamAttempt with Exam and User for teacher grading access checks.
     */
    @Query("SELECT ea FROM ExamAttempt ea JOIN FETCH ea.exam e LEFT JOIN FETCH ea.user u WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithExamAndUser(@Param("id") UUID id);

    Page<ExamAttempt> findByExamId(UUID examId, Pageable pageable);

    Page<ExamAttempt> findByExamIdAndStatus(UUID examId, AttemptStatus status, Pageable pageable);

    /**
     * Search exam attempts by candidate keyword without status filter.
     */
    @Query("SELECT ea FROM ExamAttempt ea " +
           "LEFT JOIN ea.user u " +
           "WHERE ea.exam.id = :examId " +
           "AND (LOWER(ea.guestName) LIKE :pattern " +
           "     OR LOWER(ea.guestIdentifier) LIKE :pattern " +
           "     OR LOWER(u.fullName) LIKE :pattern " +
           "     OR LOWER(u.email) LIKE :pattern)")
    Page<ExamAttempt> searchAttemptsByExamId(
            @Param("examId") UUID examId,
            @Param("pattern") String pattern,
            Pageable pageable);

    /**
     * Search exam attempts by candidate keyword and specific attempt status.
     */
    @Query("SELECT ea FROM ExamAttempt ea " +
           "LEFT JOIN ea.user u " +
           "WHERE ea.exam.id = :examId " +
           "AND ea.status = :status " +
           "AND (LOWER(ea.guestName) LIKE :pattern " +
           "     OR LOWER(ea.guestIdentifier) LIKE :pattern " +
           "     OR LOWER(u.fullName) LIKE :pattern " +
           "     OR LOWER(u.email) LIKE :pattern)")
    Page<ExamAttempt> searchAttemptsByExamIdAndStatus(
            @Param("examId") UUID examId,
            @Param("status") AttemptStatus status,
            @Param("pattern") String pattern,
            Pageable pageable);

    /**
     * Retrieve all candidate attempts for Excel export with optional status and search filters.
     * Eagerly fetches exam and user to prevent N+1 query overhead.
     */
    @Query("SELECT ea FROM ExamAttempt ea " +
           "JOIN FETCH ea.exam e " +
           "LEFT JOIN FETCH ea.user u " +
           "WHERE ea.exam.id = :examId " +
           "AND (:status IS NULL OR ea.status = :status) " +
           "AND (:pattern IS NULL OR (" +
           "     LOWER(ea.guestName) LIKE :pattern " +
           "     OR LOWER(ea.guestIdentifier) LIKE :pattern " +
           "     OR LOWER(u.fullName) LIKE :pattern " +
           "     OR LOWER(u.email) LIKE :pattern))")
    List<ExamAttempt> findAttemptsForExport(
            @Param("examId") UUID examId,
            @Param("status") AttemptStatus status,
            @Param("pattern") String pattern,
            Sort sort);

    /**
     * Compute all key statistics for an exam's attempts in a single database round-trip.
     * Uses PostgreSQL native query for robust duration calculation via EXTRACT(EPOCH FROM (submit_time - start_time)).
     * Returns one row with aggregated values; uses CASE expressions to segment counts by status.
     *
     * Result object array layout (index → meaning):
     *  [0]  totalAttempts          (Long)
     *  [1]  completedAttempts      (Long)
     *  [2]  pendingAttempts        (Long)
     *  [3]  inProgressAttempts     (Long)
     *  [4]  disqualifiedAttempts   (Long)
     *  [5]  avgScore               (Double)
     *  [6]  maxScore               (Double)
     *  [7]  minScore               (Double)
     *  [8]  gradedCount            (Long)
     *  [9]  totalViolations        (Long)
     *  [10] maxViolations          (Integer)
     *  [11] attemptsWithViolations (Long)
     *  [12] avgDurationSeconds     (Double)   — AVG of EPOCH diff for SUBMITTED
     *  [13] maxDurationSeconds     (Long)     — MAX of EPOCH diff for SUBMITTED
     *  [14] minDurationSeconds     (Long)     — MIN of EPOCH diff for SUBMITTED
     */
    @Query(value = """
            SELECT
              COUNT(id),
              COALESCE(SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(CASE WHEN status = 'AWAITING_MANUAL_GRADING' THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(CASE WHEN status = 'DISQUALIFIED' THEN 1 ELSE 0 END), 0),
              AVG(total_score),
              MAX(total_score),
              MIN(total_score),
              COALESCE(SUM(CASE WHEN total_score IS NOT NULL THEN 1 ELSE 0 END), 0),
              COALESCE(SUM(violation_count), 0),
              MAX(violation_count),
              COALESCE(SUM(CASE WHEN violation_count > 0 THEN 1 ELSE 0 END), 0),
              AVG(CASE WHEN status = 'SUBMITTED' AND submit_time IS NOT NULL AND start_time IS NOT NULL
                       THEN EXTRACT(EPOCH FROM (submit_time - start_time)) ELSE NULL END),
              MAX(CASE WHEN status = 'SUBMITTED' AND submit_time IS NOT NULL AND start_time IS NOT NULL
                       THEN EXTRACT(EPOCH FROM (submit_time - start_time)) ELSE NULL END),
              MIN(CASE WHEN status = 'SUBMITTED' AND submit_time IS NOT NULL AND start_time IS NOT NULL
                       THEN EXTRACT(EPOCH FROM (submit_time - start_time)) ELSE NULL END)
            FROM exam_attempts
            WHERE exam_id = :examId
            """, nativeQuery = true)
    Object[] computeAttemptStats(@Param("examId") UUID examId);
}
