package com.quicktest.modules.proctoring.repository;

import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for ViolationLog entity.
 */
@Repository
public interface ViolationLogRepository extends JpaRepository<ViolationLog, UUID> {

    List<ViolationLog> findByExamAttemptIdOrderByTimestampAsc(UUID attemptId);

    List<ViolationLog> findByExamAttemptIdOrderByTimestampDesc(UUID attemptId);

    long countByExamAttemptId(UUID attemptId);

    long countByExamAttemptIdAndViolationType(UUID attemptId, ViolationType violationType);

    @Query("SELECT v.violationType, COUNT(v) FROM ViolationLog v WHERE v.examAttempt.id = :attemptId GROUP BY v.violationType")
    List<Object[]> countByViolationTypeGrouped(@Param("attemptId") UUID attemptId);

    @Query("SELECT v FROM ViolationLog v " +
            "JOIN FETCH v.examAttempt ea " +
            "JOIN FETCH ea.exam e " +
            "LEFT JOIN FETCH ea.user u " +
            "ORDER BY v.timestamp DESC")
    List<ViolationLog> findRecentViolations(org.springframework.data.domain.Pageable pageable);

    @Query(value = """
            SELECT CAST(vl.id AS VARCHAR) FROM violation_logs vl
            JOIN exam_attempts ea ON ea.id = vl.attempt_id
            JOIN exams e ON e.id = ea.exam_id
            LEFT JOIN users u ON u.id = ea.user_id
            WHERE vl.evidence_url IS NOT NULL AND vl.evidence_url <> ''
              AND (CAST(:violationType AS VARCHAR) IS NULL OR vl.violation_type = CAST(:violationType AS VARCHAR))
              AND (CAST(:examId AS UUID) IS NULL OR ea.exam_id = CAST(:examId AS UUID))
              AND (CAST(:startDate AS TIMESTAMP) IS NULL OR vl.timestamp >= CAST(:startDate AS TIMESTAMP))
              AND (CAST(:endDate AS TIMESTAMP) IS NULL OR vl.timestamp <= CAST(:endDate AS TIMESTAMP))
              AND (
                  CAST(:search AS VARCHAR) IS NULL OR CAST(:search AS VARCHAR) = ''
                  OR LOWER(e.title) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(u.full_name) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(u.email) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(ea.guest_name) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(ea.guest_identifier) LIKE LOWER(CAST(:likePattern AS VARCHAR))
              )
            ORDER BY vl.timestamp DESC, vl.id DESC
            """,
            countQuery = """
            SELECT COUNT(vl.id) FROM violation_logs vl
            JOIN exam_attempts ea ON ea.id = vl.attempt_id
            JOIN exams e ON e.id = ea.exam_id
            LEFT JOIN users u ON u.id = ea.user_id
            WHERE vl.evidence_url IS NOT NULL AND vl.evidence_url <> ''
              AND (CAST(:violationType AS VARCHAR) IS NULL OR vl.violation_type = CAST(:violationType AS VARCHAR))
              AND (CAST(:examId AS UUID) IS NULL OR ea.exam_id = CAST(:examId AS UUID))
              AND (CAST(:startDate AS TIMESTAMP) IS NULL OR vl.timestamp >= CAST(:startDate AS TIMESTAMP))
              AND (CAST(:endDate AS TIMESTAMP) IS NULL OR vl.timestamp <= CAST(:endDate AS TIMESTAMP))
              AND (
                  CAST(:search AS VARCHAR) IS NULL OR CAST(:search AS VARCHAR) = ''
                  OR LOWER(e.title) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(u.full_name) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(u.email) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(ea.guest_name) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(ea.guest_identifier) LIKE LOWER(CAST(:likePattern AS VARCHAR))
              )
            """, nativeQuery = true)
    org.springframework.data.domain.Page<String> findEvidenceMediaIds(
            @Param("violationType") String violationType,
            @Param("examId") UUID examId,
            @Param("startDate") java.time.LocalDateTime startDate,
            @Param("endDate") java.time.LocalDateTime endDate,
            @Param("search") String search,
            @Param("likePattern") String likePattern,
            org.springframework.data.domain.Pageable pageable);

    @Query("SELECT v FROM ViolationLog v " +
            "JOIN FETCH v.examAttempt ea " +
            "JOIN FETCH ea.exam e " +
            "LEFT JOIN FETCH ea.user u " +
            "WHERE v.id IN :ids")
    List<ViolationLog> findAllByIdInWithDetails(@Param("ids") List<UUID> ids);

    @Query("SELECT COUNT(v) FROM ViolationLog v WHERE v.evidenceUrl IS NOT NULL AND v.evidenceUrl <> ''")
    long countAllEvidenceMedia();

    @Query("SELECT COUNT(v) FROM ViolationLog v WHERE v.evidenceUrl IS NOT NULL AND v.evidenceUrl <> '' AND v.violationType = :violationType")
    long countEvidenceMediaByViolationType(@Param("violationType") ViolationType violationType);

    @Query("SELECT COUNT(v) FROM ViolationLog v WHERE v.evidenceUrl IS NOT NULL AND v.evidenceUrl <> '' AND v.timestamp >= :since")
    long countEvidenceMediaSince(@Param("since") java.time.LocalDateTime since);

    @Query("SELECT COUNT(v) FROM ViolationLog v WHERE v.evidenceUrl IS NOT NULL AND v.evidenceUrl <> '' AND v.timestamp < :before")
    long countEvidenceMediaBefore(@Param("before") java.time.LocalDateTime before);

    @Query("SELECT COUNT(DISTINCT ea.exam.id) FROM ViolationLog v JOIN v.examAttempt ea WHERE v.evidenceUrl IS NOT NULL AND v.evidenceUrl <> ''")
    long countDistinctExamsWithEvidenceMedia();

    @Query(value = """
            SELECT COUNT(v.id) FROM violation_logs v
            JOIN exam_attempts ea ON ea.id = v.attempt_id
            WHERE v.evidence_url IS NOT NULL AND v.evidence_url <> ''
              AND (CAST(:cutoff AS TIMESTAMP) IS NULL OR v.timestamp < CAST(:cutoff AS TIMESTAMP))
              AND (CAST(:violationType AS VARCHAR) IS NULL OR v.violation_type = CAST(:violationType AS VARCHAR))
              AND (CAST(:examId AS UUID) IS NULL OR ea.exam_id = CAST(:examId AS UUID))
              AND (:onlyFinishedExams = FALSE OR ea.status <> 'IN_PROGRESS')
            """, nativeQuery = true)
    long countEvidenceMediaForCleanup(
            @Param("cutoff") java.time.LocalDateTime cutoff,
            @Param("violationType") String violationType,
            @Param("examId") UUID examId,
            @Param("onlyFinishedExams") boolean onlyFinishedExams);

    /**
     * Count total violations grouped by violation type across the whole system.
     * Columns: [0]=violationType, [1]=count.
     */
    @Query("SELECT v.violationType, COUNT(v) FROM ViolationLog v GROUP BY v.violationType")
    List<Object[]> countAllGroupedByViolationType();

    /**
     * Group daily violation counts starting from the given timestamp.
     * Columns: [0]=activityDate (DATE), [1]=violationsCount.
     */
    @Query(value = """
            SELECT CAST(v.timestamp AS DATE) AS activity_date,
                   COUNT(*)
            FROM violation_logs v
            WHERE v.timestamp >= :since
            GROUP BY CAST(v.timestamp AS DATE)
            ORDER BY activity_date ASC
            """, nativeQuery = true)
    List<Object[]> countDailyViolationsSince(@Param("since") java.time.LocalDateTime since);

    /**
     * Group daily violation counts starting from the given timestamp across a teacher's exams.
     * Columns: [0]=activityDate (DATE), [1]=violationsCount.
     */
    @Query(value = """
            SELECT CAST(v.timestamp AS DATE) AS activity_date,
                   COUNT(*)
            FROM violation_logs v
            JOIN exam_attempts ea ON ea.id = v.attempt_id
            JOIN exams e ON e.id = ea.exam_id
            WHERE e.created_by = :teacherId
              AND e.status <> 'CLONING'
              AND v.timestamp >= :since
            GROUP BY CAST(v.timestamp AS DATE)
            ORDER BY activity_date ASC
            """, nativeQuery = true)
    List<Object[]> countTeacherDailyViolationsSince(
            @Param("teacherId") UUID teacherId,
            @Param("since") java.time.LocalDateTime since);

    /**
     * Retrieve recent proctoring violations recorded within a teacher's exams with full eager associations.
     */
    @Query("""
            SELECT v FROM ViolationLog v
            JOIN FETCH v.examAttempt ea
            JOIN FETCH ea.exam e
            LEFT JOIN FETCH ea.user u
            WHERE e.createdBy.id = :teacherId
              AND e.status <> com.quicktest.modules.assessment.entity.ExamStatus.CLONING
            ORDER BY v.timestamp DESC
            """)
    List<ViolationLog> findRecentViolationsByTeacherId(
            @Param("teacherId") UUID teacherId,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Count total recorded violations grouped by violation type for a specific authenticated student.
     * Columns: [0]=violationType, [1]=count.
     */
    @Query("SELECT v.violationType, COUNT(v) FROM ViolationLog v JOIN v.examAttempt ea WHERE ea.user.id = :userId GROUP BY v.violationType")
    List<Object[]> countStudentViolationsGroupedByType(@Param("userId") UUID userId);

    /**
     * Group daily violation counts starting from the given timestamp for a specific student.
     * Columns: [0]=activityDate (DATE), [1]=violationsCount.
     */
    @Query(value = """
            SELECT CAST(v.timestamp AS DATE) AS activity_date,
                   COUNT(*)
            FROM violation_logs v
            JOIN exam_attempts ea ON ea.id = v.attempt_id
            WHERE ea.user_id = :userId
              AND v.timestamp >= :since
            GROUP BY CAST(v.timestamp AS DATE)
            ORDER BY activity_date ASC
            """, nativeQuery = true)
    List<Object[]> countStudentDailyViolationsSince(
            @Param("userId") UUID userId,
            @Param("since") java.time.LocalDateTime since);

    /**
     * Retrieve recent proctoring violations recorded for a specific student with eager exam association.
     */
    @Query("""
            SELECT v FROM ViolationLog v
            JOIN FETCH v.examAttempt ea
            JOIN FETCH ea.exam e
            LEFT JOIN FETCH ea.user u
            WHERE ea.user.id = :userId
            ORDER BY v.timestamp DESC
            """)
    List<ViolationLog> findRecentViolationsByStudentId(
            @Param("userId") UUID userId,
            org.springframework.data.domain.Pageable pageable);
}
