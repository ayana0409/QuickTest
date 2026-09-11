package com.quicktest.modules.session.repository;

import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    long countByExamIdAndStatus(UUID examId, AttemptStatus status);

    Optional<ExamAttempt> findFirstByExamIdAndGuestIdentifierAndStatus(UUID examId, String guestIdentifier, AttemptStatus status);

    Optional<ExamAttempt> findFirstByUserIdAndExamIdAndStatus(UUID userId, UUID examId, AttemptStatus status);

    /**
     * Eagerly fetch ExamAttempt along with Exam configuration to avoid lazy initialization issues.
     */
    @Query("SELECT ea FROM ExamAttempt ea JOIN FETCH ea.exam e LEFT JOIN FETCH ea.user u WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithExam(@Param("id") UUID id);

    /**
     * Eagerly fetch ExamAttempt with Exam and CandidateAnswers.
     */
    @Query("SELECT DISTINCT ea FROM ExamAttempt ea JOIN FETCH ea.exam e LEFT JOIN FETCH ea.answers a WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithExamAndAnswers(@Param("id") UUID id);

    /**
     * Eagerly fetch ExamAttempt with Exam and User for teacher grading access checks.
     */
    @Query("SELECT ea FROM ExamAttempt ea JOIN FETCH ea.exam e LEFT JOIN FETCH ea.user u WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithExamAndUser(@Param("id") UUID id);

    Page<ExamAttempt> findByExamId(UUID examId, Pageable pageable);

    Page<ExamAttempt> findByExamIdAndStatus(UUID examId, AttemptStatus status, Pageable pageable);

    /**
     * Search exam attempts by candidate keyword without status filter.
     */
    @Query("SELECT ea FROM ExamAttempt ea " +
           "LEFT JOIN ea.user u " +
           "WHERE ea.exam.id = :examId " +
           "AND (LOWER(ea.guestName) LIKE :pattern " +
           "     OR LOWER(ea.guestIdentifier) LIKE :pattern " +
           "     OR LOWER(u.fullName) LIKE :pattern " +
           "     OR LOWER(u.email) LIKE :pattern)")
    Page<ExamAttempt> searchAttemptsByExamId(
            @Param("examId") UUID examId,
            @Param("pattern") String pattern,
            Pageable pageable);

    /**
     * Search exam attempts by candidate keyword and specific attempt status.
     */
    @Query("SELECT ea FROM ExamAttempt ea " +
           "LEFT JOIN ea.user u " +
           "WHERE ea.exam.id = :examId " +
           "AND ea.status = :status " +
           "AND (LOWER(ea.guestName) LIKE :pattern " +
           "     OR LOWER(ea.guestIdentifier) LIKE :pattern " +
           "     OR LOWER(u.fullName) LIKE :pattern " +
           "     OR LOWER(u.email) LIKE :pattern)")
    Page<ExamAttempt> searchAttemptsByExamIdAndStatus(
            @Param("examId") UUID examId,
            @Param("status") AttemptStatus status,
            @Param("pattern") String pattern,
            Pageable pageable);
}
