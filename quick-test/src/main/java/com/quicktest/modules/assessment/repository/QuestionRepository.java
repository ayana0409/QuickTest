package com.quicktest.modules.assessment.repository;

import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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
         * Fetch questions with their answer options in a single SQL query using LEFT
         * JOIN FETCH,
         * avoiding N+1 queries when loading exam questions.
         */
        @Query("SELECT DISTINCT q FROM Question q LEFT JOIN FETCH q.options WHERE q.exam.id = :examId ORDER BY q.orderIndex ASC")
        List<Question> findByExamIdWithOptions(@Param("examId") UUID examId);

        /**
         * Fetch a question by id including options, exam, and exam creator for
         * ownership verification.
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

        /**
         * Batch count questions grouped by exam ID to prevent N+1 queries.
         */
        @Query("SELECT q.exam.id, COUNT(q.id) FROM Question q WHERE q.exam.id IN :examIds GROUP BY q.exam.id")
        List<Object[]> countQuestionsByExamIds(@Param("examIds") List<UUID> examIds);

        /**
         * Retrieve all non-null media identifiers (publicId or imageUrl) for questions
         * in an exam.
         */
        @Query("SELECT COALESCE(q.imagePublicId, q.imageUrl) FROM Question q " +
                        "WHERE q.exam.id = :examId AND (q.imagePublicId IS NOT NULL OR q.imageUrl IS NOT NULL)")
        List<String> findImageIdentifiersByExamId(@Param("examId") UUID examId);

        /**
         * Bulk delete all questions belonging to an exam in a single query.
         */
        @Modifying(clearAutomatically = true)
        @Query("DELETE FROM Question q WHERE q.exam.id = :examId")
        void deleteByExamId(@Param("examId") UUID examId);

        /**
         * Bulk delete a single question by its ID in a single query.
         */
        @Modifying(clearAutomatically = true)
        @Query("DELETE FROM Question q WHERE q.id = :id")
        void deleteQuestionById(@Param("id") UUID id);

        /**
         * Paginated question bank listing: all questions from all exams owned by a
         * teacher,
         * optionally excluding a specific exam and filtering by keyword (content
         * match).
         * Eagerly joins exam (ManyToOne) to allow true database-level pagination
         * (LIMIT/OFFSET).
         * Options are batch-fetched via Hibernate @BatchSize to prevent N+1 queries.
         */
        @Query(value = "SELECT q FROM Question q " +
                        "JOIN FETCH q.exam e " +
                        "JOIN FETCH e.createdBy " +
                        "WHERE e.createdBy.id = :teacherId " +
                        "AND (:excludeExamId IS NULL OR e.id != :excludeExamId) " +
                        "AND (:pattern IS NULL OR LOWER(q.content) LIKE :pattern OR LOWER(e.title) LIKE :pattern) " +
                        "ORDER BY e.title ASC, q.orderIndex ASC", countQuery = "SELECT COUNT(q) FROM Question q " +
                                        "JOIN q.exam e " +
                                        "WHERE e.createdBy.id = :teacherId " +
                                        "AND (:excludeExamId IS NULL OR e.id != :excludeExamId) " +
                                        "AND (:pattern IS NULL OR LOWER(q.content) LIKE :pattern OR LOWER(e.title) LIKE :pattern)")
        Page<Question> findBankByTeacherId(
                        @Param("teacherId") UUID teacherId,
                        @Param("excludeExamId") UUID excludeExamId,
                        @Param("pattern") String pattern,
                        Pageable pageable);

        /**
         * Batch-fetch questions with their options and parent exam for import ownership
         * checks.
         * Uses DISTINCT to avoid duplicates from the JOIN FETCH.
         */
        @Query("SELECT DISTINCT q FROM Question q " +
                        "LEFT JOIN FETCH q.options " +
                        "JOIN FETCH q.exam e " +
                        "JOIN FETCH e.createdBy " +
                        "WHERE q.id IN :ids")
        List<Question> findAllByIdInWithOptionsAndExam(@Param("ids") List<UUID> ids);

        /**
         * High-performance Paginated question IDs for Admin Content Moderation using
         * PostgreSQL Fulltext Search (to_tsvector & plainto_tsquery) backed by GIN indexes.
         * Searches across:
         * - Question content & sample answer (questions)
         * - Exam title & access code (exams)
         * - Answer option content (answer_options)
         * - Question creator name / username (users)
         */
        @Query(value = """
                        SELECT CAST(q.id AS VARCHAR) FROM questions q
                        JOIN exams e ON q.exam_id = e.id
                        LEFT JOIN users u ON e.created_by = u.id
                        WHERE (CAST(:isSafe AS BOOLEAN) IS NULL OR q.is_safe = CAST(:isSafe AS BOOLEAN))
                          AND (CAST(:hasImage AS BOOLEAN) IS NULL OR (
                              (CAST(:hasImage AS BOOLEAN) = TRUE AND (q.image_url IS NOT NULL OR EXISTS (SELECT 1 FROM answer_options ao WHERE ao.question_id = q.id AND ao.image_url IS NOT NULL)))
                              OR (CAST(:hasImage AS BOOLEAN) = FALSE AND q.image_url IS NULL AND NOT EXISTS (SELECT 1 FROM answer_options ao WHERE ao.question_id = q.id AND ao.image_url IS NOT NULL))
                          ))
                          AND (CAST(:questionType AS VARCHAR) IS NULL OR q.question_type = CAST(:questionType AS VARCHAR))
                          AND (
                              CAST(:search AS VARCHAR) IS NULL OR CAST(:search AS VARCHAR) = ''
                              OR to_tsvector('simple', coalesce(q.content, '') || ' ' || coalesce(q.sample_answer, '')) @@ plainto_tsquery('simple', CAST(:search AS VARCHAR))
                              OR to_tsvector('simple', coalesce(e.title, '') || ' ' || coalesce(e.access_code, '')) @@ plainto_tsquery('simple', CAST(:search AS VARCHAR))
                              OR LOWER(e.access_code) LIKE LOWER(CAST(:codePattern AS VARCHAR))
                              OR EXISTS (
                                  SELECT 1 FROM answer_options ao 
                                  WHERE ao.question_id = q.id 
                                    AND to_tsvector('simple', coalesce(ao.content, '')) @@ plainto_tsquery('simple', CAST(:search AS VARCHAR))
                              )
                              OR LOWER(q.content) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                              OR LOWER(e.title) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                              OR LOWER(u.full_name) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                              OR LOWER(u.username) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                          )
                        ORDER BY q.id DESC
                        """, countQuery = """
                        SELECT COUNT(q.id) FROM questions q
                        JOIN exams e ON q.exam_id = e.id
                        LEFT JOIN users u ON e.created_by = u.id
                        WHERE (CAST(:isSafe AS BOOLEAN) IS NULL OR q.is_safe = CAST(:isSafe AS BOOLEAN))
                          AND (CAST(:hasImage AS BOOLEAN) IS NULL OR (
                              (CAST(:hasImage AS BOOLEAN) = TRUE AND (q.image_url IS NOT NULL OR EXISTS (SELECT 1 FROM answer_options ao WHERE ao.question_id = q.id AND ao.image_url IS NOT NULL)))
                              OR (CAST(:hasImage AS BOOLEAN) = FALSE AND q.image_url IS NULL AND NOT EXISTS (SELECT 1 FROM answer_options ao WHERE ao.question_id = q.id AND ao.image_url IS NOT NULL))
                          ))
                          AND (CAST(:questionType AS VARCHAR) IS NULL OR q.question_type = CAST(:questionType AS VARCHAR))
                          AND (
                              CAST(:search AS VARCHAR) IS NULL OR CAST(:search AS VARCHAR) = ''
                              OR to_tsvector('simple', coalesce(q.content, '') || ' ' || coalesce(q.sample_answer, '')) @@ plainto_tsquery('simple', CAST(:search AS VARCHAR))
                              OR to_tsvector('simple', coalesce(e.title, '') || ' ' || coalesce(e.access_code, '')) @@ plainto_tsquery('simple', CAST(:search AS VARCHAR))
                              OR LOWER(e.access_code) LIKE LOWER(CAST(:codePattern AS VARCHAR))
                              OR EXISTS (
                                  SELECT 1 FROM answer_options ao 
                                  WHERE ao.question_id = q.id 
                                    AND to_tsvector('simple', coalesce(ao.content, '')) @@ plainto_tsquery('simple', CAST(:search AS VARCHAR))
                              )
                              OR LOWER(q.content) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                              OR LOWER(e.title) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                              OR LOWER(u.full_name) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                              OR LOWER(u.username) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                          )
                        """, nativeQuery = true)
        Page<String> findModerationQuestionIds(
                        @Param("isSafe") Boolean isSafe,
                        @Param("hasImage") Boolean hasImage,
                        @Param("questionType") String questionType,
                        @Param("search") String search,
                        @Param("codePattern") String codePattern,
                        @Param("likePattern") String likePattern,
                        Pageable pageable);

        /**
         * Count total questions that contain images (either in the question itself or
         * in any of its answer options).
         */
        @Query("SELECT COUNT(DISTINCT q.id) FROM Question q LEFT JOIN q.options o WHERE q.imageUrl IS NOT NULL OR o.imageUrl IS NOT NULL")
        long countQuestionsWithImages();

        /**
         * Count questions by safety flag status.
         */
        long countByIsSafe(Boolean isSafe);
}
