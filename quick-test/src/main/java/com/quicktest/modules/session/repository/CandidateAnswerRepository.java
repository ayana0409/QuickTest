package com.quicktest.modules.session.repository;

import com.quicktest.modules.session.entity.CandidateAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for CandidateAnswer entity.
 */
@Repository
public interface CandidateAnswerRepository extends JpaRepository<CandidateAnswer, UUID> {
    Optional<CandidateAnswer> findByExamAttemptIdAndQuestionId(UUID attemptId, UUID questionId);
}
