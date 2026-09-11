package com.quicktest.modules.proctoring.repository;

import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for ViolationLog entity.
 */
@Repository
public interface ViolationLogRepository extends JpaRepository<ViolationLog, UUID> {

    List<ViolationLog> findByExamAttemptIdOrderByTimestampAsc(UUID attemptId);

    List<ViolationLog> findByExamAttemptIdOrderByTimestampDesc(UUID attemptId);

    long countByExamAttemptId(UUID attemptId);

    long countByExamAttemptIdAndViolationType(UUID attemptId, ViolationType violationType);

    @Query("SELECT v.violationType, COUNT(v) FROM ViolationLog v WHERE v.examAttempt.id = :attemptId GROUP BY v.violationType")
    List<Object[]> countByViolationTypeGrouped(@Param("attemptId") UUID attemptId);
}
