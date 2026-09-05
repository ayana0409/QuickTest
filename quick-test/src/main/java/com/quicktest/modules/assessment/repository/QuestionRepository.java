package com.quicktest.modules.assessment.repository;

import com.quicktest.modules.assessment.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for Question entity.
 */
@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID> {

    List<Question> findByExamIdOrderByOrderIndexAsc(UUID examId);

    /**
     * Fetch questions with their answer options in a single SQL query using LEFT JOIN FETCH,
     * avoiding N+1 queries when loading exam questions.
     */
    @Query("SELECT DISTINCT q FROM Question q LEFT JOIN FETCH q.options WHERE q.exam.id = :examId ORDER BY q.orderIndex ASC")
    List<Question> findByExamIdWithOptions(@Param("examId") UUID examId);

    /**
     * Fetch a question by id including options, exam, and exam creator for ownership verification.
     */
    @Query("SELECT q FROM Question q LEFT JOIN FETCH q.options JOIN FETCH q.exam e JOIN FETCH e.createdBy WHERE q.id = :id")
    Optional<Question> findByIdWithOptionsAndExam(@Param("id") UUID id);

    /**
     * Count total questions in an exam.
     */
    long countByExamId(UUID examId);

    /**
     * Calculate sum of points for all questions in an exam.
     */
    @Query("SELECT COALESCE(SUM(q.points), 0.0) FROM Question q WHERE q.exam.id = :examId")
    Double sumPointsByExamId(@Param("examId") UUID examId);
}
