package com.quicktest.modules.assessment.repository;

import com.quicktest.modules.assessment.entity.AnswerOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for AnswerOption entity.
 */
@Repository
public interface AnswerOptionRepository extends JpaRepository<AnswerOption, UUID> {

    List<AnswerOption> findByQuestionIdOrderByOrderIndexAsc(UUID questionId);

    @Modifying
    @Query("DELETE FROM AnswerOption a WHERE a.question.id = :questionId")
    void deleteByQuestionId(@Param("questionId") UUID questionId);

    /**
     * Retrieve all non-null media identifiers (publicId or imageUrl) for answer options in an exam.
     */
    @Query("SELECT COALESCE(a.imagePublicId, a.imageUrl) FROM AnswerOption a " +
           "WHERE a.question.exam.id = :examId AND (a.imagePublicId IS NOT NULL OR a.imageUrl IS NOT NULL)")
    List<String> findImageIdentifiersByExamId(@Param("examId") UUID examId);

    /**
     * Bulk delete all answer options belonging to an exam's questions in a single query.
     */
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM AnswerOption a WHERE a.question.id IN (SELECT q.id FROM Question q WHERE q.exam.id = :examId)")
    void deleteByExamId(@Param("examId") UUID examId);
}
