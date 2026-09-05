package com.quicktest.modules.assessment.repository;

import com.quicktest.modules.assessment.dto.ExamSummaryResponse;
import com.quicktest.modules.assessment.entity.Exam;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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
                "COUNT(q.id), COALESCE(SUM(q.points), 0.0), e.startTime, e.endTime, e.createdAt) " +
                "FROM Exam e LEFT JOIN e.questions q " +
                "WHERE e.createdBy.id = :teacherId " +
                "GROUP BY e.id, e.title, e.accessCode, e.status, e.durationMinutes, e.maxAttempts, e.startTime, e.endTime, e.createdAt",
        countQuery = "SELECT COUNT(e) FROM Exam e WHERE e.createdBy.id = :teacherId"
    )
    Page<ExamSummaryResponse> findSummariesByTeacherId(@Param("teacherId") UUID teacherId, Pageable pageable);
}
