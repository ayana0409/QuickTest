package com.quicktest.modules.assessment.repository;

import com.quicktest.modules.assessment.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
