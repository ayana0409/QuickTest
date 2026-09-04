package com.quicktest.modules.assessment.repository;

import com.quicktest.modules.assessment.entity.AnswerOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for AnswerOption entity.
 */
@Repository
public interface AnswerOptionRepository extends JpaRepository<AnswerOption, UUID> {
    List<AnswerOption> findByQuestionIdOrderByOrderIndexAsc(UUID questionId);
}
