package com.quicktest.modules.session.repository;

import com.quicktest.modules.session.entity.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for ExamAttempt entity.
 */
@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, UUID> {
    List<ExamAttempt> findByUserId(UUID userId);
    List<ExamAttempt> findByExamId(UUID examId);
    List<ExamAttempt> findByGuestIdentifierAndExamId(String guestIdentifier, UUID examId);
}
