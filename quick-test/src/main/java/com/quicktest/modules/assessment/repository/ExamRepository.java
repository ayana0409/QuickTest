package com.quicktest.modules.assessment.repository;

import com.quicktest.modules.assessment.dto.ExamSummaryResponse;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for Exam entity.
 */
@Repository
public interface ExamRepository extends JpaRepository<Exam, UUID> {

    Optional<Exam> findByAccessCode(String accessCode);

    boolean existsByAccessCode(String accessCode);

    List<Exam> findByStatusAndEndTimeBefore(ExamStatus status, LocalDateTime dateTime);

    /**
     * Retrieve up to 9 random published, non-private exams for candidate exploration.
     * Uses native PostgreSQL ORDER BY RANDOM() LIMIT 9 to ensure zero memory overhead.
     */
    @Query(value = """
            SELECT * FROM exams
            WHERE status = 'PUBLISHED'
              AND is_private = false
              AND (end_time IS NULL OR end_time > NOW())
            ORDER BY RANDOM()
            LIMIT 9
            """, nativeQuery = true)
    List<Exam> findRandomExploreExams();

    Page<Exam> findByCreatedById(UUID teacherId, Pageable pageable);

    /**
     * Eagerly fetch Exam along with creator teacher details to avoid lazy loading
     * issues.
     */
    @Query("SELECT e FROM Exam e JOIN FETCH e.createdBy WHERE e.id = :id")
    Optional<Exam> findByIdWithCreatedBy(@Param("id") UUID id);

    /**
     * Eagerly fetch Exams along with creator teacher details by a list of IDs.
     */
    @Query("SELECT e FROM Exam e JOIN FETCH e.createdBy WHERE e.id IN :ids")
    List<Exam> findByIdInWithCreatedBy(@Param("ids") List<UUID> ids);

    /**
     * Optimized single-query summary pagination for teacher dashboard with optional
     * status and search filtering,
     * calculating question counts and sum of points without N+1 query overhead.
     */
    @Query(value = "SELECT new com.quicktest.modules.assessment.dto.ExamSummaryResponse(" +
            "e.id, e.title, e.accessCode, e.status, e.durationMinutes, e.maxAttempts, " +
            "e.isProctoringEnabled, e.isCameraProctoringEnabled, e.showResultsToStudents, e.maxViolations, " +
            "COUNT(q.id), COALESCE(SUM(q.points), 0.0), e.isPrivate, e.startTime, e.endTime, e.createdAt, " +
            "COALESCE(SUM(CASE WHEN q.questionType = com.quicktest.modules.assessment.entity.QuestionType.ESSAY_TEXT THEN 1L ELSE 0L END), 0L)) " +
            "FROM Exam e LEFT JOIN e.questions q " +
            "WHERE e.createdBy.id = :teacherId " +
            "AND e.status != com.quicktest.modules.assessment.entity.ExamStatus.CLONING " +
            "AND (:status IS NULL OR e.status = :status) " +
            "AND (:pattern IS NULL OR LOWER(e.title) LIKE :pattern OR (e.accessCode IS NOT NULL AND LOWER(e.accessCode) LIKE :pattern)) "
            +
            "GROUP BY e.id, e.title, e.accessCode, e.status, e.durationMinutes, e.maxAttempts, e.isProctoringEnabled, e.isCameraProctoringEnabled, e.showResultsToStudents, e.maxViolations, e.isPrivate, e.startTime, e.endTime, e.createdAt", countQuery = "SELECT COUNT(e) FROM Exam e "
                    +
                    "WHERE e.createdBy.id = :teacherId " +
                    "AND e.status != com.quicktest.modules.assessment.entity.ExamStatus.CLONING " +
                    "AND (:status IS NULL OR e.status = :status) " +
                    "AND (:pattern IS NULL OR LOWER(e.title) LIKE :pattern OR (e.accessCode IS NOT NULL AND LOWER(e.accessCode) LIKE :pattern))")
    Page<ExamSummaryResponse> findSummariesByTeacherId(
            @Param("teacherId") UUID teacherId,
            @Param("status") ExamStatus status,
            @Param("pattern") String pattern,
            Pageable pageable);

    default Page<ExamSummaryResponse> findSummariesByTeacherId(UUID teacherId, Pageable pageable) {
        return findSummariesByTeacherId(teacherId, null, null, pageable);
    }

    long countByStatus(ExamStatus status);

    @Query(value = "SELECT e FROM Exam e JOIN FETCH e.createdBy u WHERE e.status = :status", countQuery = "SELECT COUNT(e) FROM Exam e WHERE e.status = :status")
    Page<Exam> findAllByStatusWithCreatedBy(@Param("status") ExamStatus status, Pageable pageable);

    @Query(value = "SELECT e FROM Exam e JOIN FETCH e.createdBy u", countQuery = "SELECT COUNT(e) FROM Exam e")
    Page<Exam> findAllWithCreatedBy(Pageable pageable);

    @Query(value = "SELECT e FROM Exam e JOIN FETCH e.createdBy u " +
            "WHERE (:status IS NULL OR e.status = :status) AND " +
            "(LOWER(e.title) LIKE :pattern " +
            " OR LOWER(e.accessCode) LIKE :pattern " +
            " OR LOWER(u.fullName) LIKE :pattern)", countQuery = "SELECT COUNT(e) FROM Exam e JOIN e.createdBy u " +
                    "WHERE (:status IS NULL OR e.status = :status) AND " +
                    "(LOWER(e.title) LIKE :pattern " +
                    " OR LOWER(e.accessCode) LIKE :pattern " +
                    " OR LOWER(u.fullName) LIKE :pattern)")
    Page<Exam> searchExams(
            @Param("status") ExamStatus status,
            @Param("pattern") String pattern,
            Pageable pageable);

    /**
     * Bulk delete exam entity by ID in a single query.
     */
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Exam e WHERE e.id = :id")
    void deleteExamById(@Param("id") UUID id);

    /**
     * Compute global exam lifecycle counters in a single table scan, excluding temporary cloning exams.
     * Columns: [0]=total, [1]=draft, [2]=published, [3]=closed.
     */
    @Query(value = """
            SELECT COUNT(*),
                   COALESCE(SUM(CASE WHEN e.status = 'DRAFT' THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN e.status = 'PUBLISHED' THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN e.status = 'CLOSED' THEN 1 ELSE 0 END), 0)
            FROM exams e
            WHERE e.status <> 'CLONING'
            """, nativeQuery = true)
    Object[] computeExamDashboardMetrics();

    /**
     * Compute exam lifecycle status counts for a specific teacher in a single scan.
     * Columns: [0]=total, [1]=draft, [2]=published, [3]=closed.
     */
    @Query(value = """
            SELECT COUNT(*),
                   COALESCE(SUM(CASE WHEN e.status = 'DRAFT' THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN e.status = 'PUBLISHED' THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN e.status = 'CLOSED' THEN 1 ELSE 0 END), 0)
            FROM exams e
            WHERE e.created_by = :teacherId
              AND e.status <> 'CLONING'
            """, nativeQuery = true)
    Object[] computeTeacherExamMetrics(@Param("teacherId") UUID teacherId);

    /**
     * Retrieve top 5 priority exams for the teacher ordered by pending manual grading,
     * active live attempts, published status, and creation timestamp.
     * Columns: [0]=id, [1]=title, [2]=accessCode, [3]=status, [4]=durationMinutes, [5]=createdAt,
     *          [6]=totalAttempts, [7]=inProgressCount, [8]=submittedCount, [9]=pendingGradingCount, [10]=avgScore.
     */
    @Query(value = """
            SELECT e.id,
                   e.title,
                   e.access_code,
                   e.status,
                   e.duration_minutes,
                   e.created_at,
                   COUNT(a.id) AS total_attempts,
                   COALESCE(SUM(CASE WHEN a.status = 'IN_PROGRESS' THEN 1 ELSE 0 END), 0) AS in_progress_count,
                   COALESCE(SUM(CASE WHEN a.status = 'SUBMITTED' THEN 1 ELSE 0 END), 0) AS submitted_count,
                   COALESCE(SUM(CASE WHEN a.status = 'AWAITING_MANUAL_GRADING' THEN 1 ELSE 0 END), 0) AS pending_grading_count,
                   COALESCE(AVG(CASE WHEN a.status = 'SUBMITTED' AND a.total_score IS NOT NULL THEN a.total_score END), 0.0) AS avg_score
            FROM exams e
            LEFT JOIN exam_attempts a ON a.exam_id = e.id
            WHERE e.created_by = :teacherId
              AND e.status <> 'CLONING'
            GROUP BY e.id, e.title, e.access_code, e.status, e.duration_minutes, e.created_at
            ORDER BY pending_grading_count DESC,
                     in_progress_count DESC,
                     CASE WHEN e.status = 'PUBLISHED' THEN 0 WHEN e.status = 'DRAFT' THEN 1 ELSE 2 END ASC,
                     e.created_at DESC
            LIMIT 5
            """, nativeQuery = true)
    List<Object[]> findTeacherPriorityExams(@Param("teacherId") UUID teacherId);
}
