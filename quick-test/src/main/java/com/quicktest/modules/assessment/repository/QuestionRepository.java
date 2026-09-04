package com.quicktest.modules.assessment.repository;

import com.quicktest.modules.assessment.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for Question entity.
 */
@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID> {
    List<Question> findByExamIdOrderByOrderIndexAsc(UUID examId);
}
