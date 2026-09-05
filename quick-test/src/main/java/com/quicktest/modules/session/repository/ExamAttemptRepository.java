package com.quicktest.modules.session.repository;

import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for ExamAttempt entity.
 */
@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, UUID> {

    List<ExamAttempt> findByUserId(UUID userId);

    List<ExamAttempt> findByExamId(UUID examId);

    List<ExamAttempt> findByGuestIdentifierAndExamId(String guestIdentifier, UUID examId);

    long countByUserIdAndExamId(UUID userId, UUID examId);

    long countByGuestIdentifierAndExamId(String guestIdentifier, UUID examId);

    Optional<ExamAttempt> findFirstByExamIdAndGuestIdentifierAndStatus(UUID examId, String guestIdentifier, AttemptStatus status);

    Optional<ExamAttempt> findFirstByUserIdAndExamIdAndStatus(UUID userId, UUID examId, AttemptStatus status);

    /**
     * Eagerly fetch ExamAttempt along with Exam configuration to avoid lazy initialization issues.
     */
    @Query("SELECT ea FROM ExamAttempt ea JOIN FETCH ea.exam e WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithExam(@Param("id") UUID id);

    /**
     * Eagerly fetch ExamAttempt with Exam and CandidateAnswers.
     */
    @Query("SELECT DISTINCT ea FROM ExamAttempt ea JOIN FETCH ea.exam e LEFT JOIN FETCH ea.answers a WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithExamAndAnswers(@Param("id") UUID id);
}
