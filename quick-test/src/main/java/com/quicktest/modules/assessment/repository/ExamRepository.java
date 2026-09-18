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

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for Exam entity.
 */
@Repository
public interface ExamRepository extends JpaRepository<Exam, UUID> {

    Optional<Exam> findByAccessCode(String accessCode);

    boolean existsByAccessCode(String accessCode);

    java.util.List<Exam> findByStatusAndEndTimeBefore(ExamStatus status, java.time.LocalDateTime dateTime);

    Page<Exam> findByCreatedById(UUID teacherId, Pageable pageable);

    /**
     * Eagerly fetch Exam along with creator teacher details to avoid lazy loading issues.
     */
    @Query("SELECT e FROM Exam e JOIN FETCH e.createdBy WHERE e.id = :id")
    Optional<Exam> findByIdWithCreatedBy(@Param("id") UUID id);

    /**
     * Optimized single-query summary pagination for teacher dashboard,
     * calculating question counts and sum of points without N+1 query overhead.
     */
    @Query(
        value = "SELECT new com.quicktest.modules.assessment.dto.ExamSummaryResponse(" +
                "e.id, e.title, e.accessCode, e.status, e.durationMinutes, e.maxAttempts, " +
                "e.isProctoringEnabled, e.maxViolations, " +
                "COUNT(q.id), COALESCE(SUM(q.points), 0.0), e.startTime, e.endTime, e.createdAt) " +
                "FROM Exam e LEFT JOIN e.questions q " +
                "WHERE e.createdBy.id = :teacherId AND e.status != com.quicktest.modules.assessment.entity.ExamStatus.CLONING " +
                "GROUP BY e.id, e.title, e.accessCode, e.status, e.durationMinutes, e.maxAttempts, e.isProctoringEnabled, e.maxViolations, e.startTime, e.endTime, e.createdAt",
        countQuery = "SELECT COUNT(e) FROM Exam e WHERE e.createdBy.id = :teacherId AND e.status != com.quicktest.modules.assessment.entity.ExamStatus.CLONING"
    )
    Page<ExamSummaryResponse> findSummariesByTeacherId(@Param("teacherId") UUID teacherId, Pageable pageable);

    long countByStatus(ExamStatus status);

    @Query(
        value = "SELECT e FROM Exam e JOIN FETCH e.createdBy u WHERE e.status = :status",
        countQuery = "SELECT COUNT(e) FROM Exam e WHERE e.status = :status"
    )
    Page<Exam> findAllByStatusWithCreatedBy(@Param("status") ExamStatus status, Pageable pageable);

    @Query(
        value = "SELECT e FROM Exam e JOIN FETCH e.createdBy u",
        countQuery = "SELECT COUNT(e) FROM Exam e"
    )
    Page<Exam> findAllWithCreatedBy(Pageable pageable);

    @Query(
        value = "SELECT e FROM Exam e JOIN FETCH e.createdBy u " +
                "WHERE (:status IS NULL OR e.status = :status) AND " +
                "(LOWER(e.title) LIKE :pattern " +
                " OR LOWER(e.accessCode) LIKE :pattern " +
                " OR LOWER(u.fullName) LIKE :pattern)",
        countQuery = "SELECT COUNT(e) FROM Exam e JOIN e.createdBy u " +
                     "WHERE (:status IS NULL OR e.status = :status) AND " +
                     "(LOWER(e.title) LIKE :pattern " +
                     " OR LOWER(e.accessCode) LIKE :pattern " +
                     " OR LOWER(u.fullName) LIKE :pattern)"
    )
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
}
