package com.quicktest.modules.proctoring.repository;

import com.quicktest.modules.proctoring.entity.ViolationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for ViolationLog entity.
 */
@Repository
public interface ViolationLogRepository extends JpaRepository<ViolationLog, UUID> {
    List<ViolationLog> findByExamAttemptIdOrderByTimestampAsc(UUID attemptId);
}
