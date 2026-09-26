package com.quicktest.core.logging;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Repository interface for managing and querying centralized SystemLog records.
 */
@Repository
public interface SystemLogRepository extends JpaRepository<SystemLog, UUID>, JpaSpecificationExecutor<SystemLog> {

    /**
     * High-performance Paginated log IDs using PostgreSQL Full-Text Search (to_tsvector & plainto_tsquery)
     * backed by GIN index (idx_syslog_fts). Searches across module, action, actor_username, ip_address,
     * actor_id, details, and error_message.
     */
    @Query(value = """
            SELECT CAST(l.id AS VARCHAR) FROM system_logs l
            WHERE (CAST(:level AS VARCHAR) IS NULL OR l.level = CAST(:level AS VARCHAR))
              AND (CAST(:status AS VARCHAR) IS NULL OR l.status = CAST(:status AS VARCHAR))
              AND (CAST(:module AS VARCHAR) IS NULL OR l.module = CAST(:module AS VARCHAR))
              AND (CAST(:action AS VARCHAR) IS NULL OR l.action = CAST(:action AS VARCHAR))
              AND (CAST(:actorId AS UUID) IS NULL OR l.actor_id = CAST(:actorId AS UUID))
              AND (CAST(:startDate AS TIMESTAMP) IS NULL OR l.created_at >= CAST(:startDate AS TIMESTAMP))
              AND (CAST(:endDate AS TIMESTAMP) IS NULL OR l.created_at <= CAST(:endDate AS TIMESTAMP))
              AND (
                  CAST(:search AS VARCHAR) IS NULL OR CAST(:search AS VARCHAR) = ''
                  OR to_tsvector('simple',
                      coalesce(l.module, '') || ' ' ||
                      coalesce(l.action, '') || ' ' ||
                      coalesce(l.actor_username, '') || ' ' ||
                      coalesce(l.ip_address, '') || ' ' ||
                      coalesce(cast(l.actor_id as text), '') || ' ' ||
                      coalesce(l.details, '') || ' ' ||
                      coalesce(l.error_message, '')
                  ) @@ plainto_tsquery('simple', CAST(:search AS VARCHAR))
                  OR LOWER(l.actor_username) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(l.ip_address) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(l.module) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(l.action) LIKE LOWER(CAST(:likePattern AS VARCHAR))
              )
            ORDER BY l.created_at DESC, l.id DESC
            """,
            countQuery = """
            SELECT COUNT(l.id) FROM system_logs l
            WHERE (CAST(:level AS VARCHAR) IS NULL OR l.level = CAST(:level AS VARCHAR))
              AND (CAST(:status AS VARCHAR) IS NULL OR l.status = CAST(:status AS VARCHAR))
              AND (CAST(:module AS VARCHAR) IS NULL OR l.module = CAST(:module AS VARCHAR))
              AND (CAST(:action AS VARCHAR) IS NULL OR l.action = CAST(:action AS VARCHAR))
              AND (CAST(:actorId AS UUID) IS NULL OR l.actor_id = CAST(:actorId AS UUID))
              AND (CAST(:startDate AS TIMESTAMP) IS NULL OR l.created_at >= CAST(:startDate AS TIMESTAMP))
              AND (CAST(:endDate AS TIMESTAMP) IS NULL OR l.created_at <= CAST(:endDate AS TIMESTAMP))
              AND (
                  CAST(:search AS VARCHAR) IS NULL OR CAST(:search AS VARCHAR) = ''
                  OR to_tsvector('simple',
                      coalesce(l.module, '') || ' ' ||
                      coalesce(l.action, '') || ' ' ||
                      coalesce(l.actor_username, '') || ' ' ||
                      coalesce(l.ip_address, '') || ' ' ||
                      coalesce(cast(l.actor_id as text), '') || ' ' ||
                      coalesce(l.details, '') || ' ' ||
                      coalesce(l.error_message, '')
                  ) @@ plainto_tsquery('simple', CAST(:search AS VARCHAR))
                  OR LOWER(l.actor_username) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(l.ip_address) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(l.module) LIKE LOWER(CAST(:likePattern AS VARCHAR))
                  OR LOWER(l.action) LIKE LOWER(CAST(:likePattern AS VARCHAR))
              )
            """, nativeQuery = true)
    Page<String> findLogIds(
            @Param("level") String level,
            @Param("status") String status,
            @Param("module") String module,
            @Param("action") String action,
            @Param("actorId") UUID actorId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("search") String search,
            @Param("likePattern") String likePattern,
            Pageable pageable);

    /**
     * Batch-fetch SystemLog entities by IDs.
     */
    List<SystemLog> findAllByIdIn(List<UUID> ids);

    /**
     * Find log records by module ordered by creation timestamp descending.
     */
    Page<SystemLog> findByModuleOrderByCreatedAtDesc(String module, Pageable pageable);

    /**
     * Find log records by actor ID ordered by creation timestamp descending.
     */
    Page<SystemLog> findByActorIdOrderByCreatedAtDesc(UUID actorId, Pageable pageable);

    /**
     * Find log records by severity level ordered by creation timestamp descending.
     */
    Page<SystemLog> findByLevelOrderByCreatedAtDesc(LogLevel level, Pageable pageable);

    /**
     * Delete log records older than a specific date for retention housekeeping.
     */
    long deleteByCreatedAtBefore(LocalDateTime cutoff);

    /**
     * Count logs by status.
     */
    long countByStatus(LogStatus status);

    /**
     * Count logs by level.
     */
    long countByLevel(LogLevel level);

    /**
     * Calculate average execution latency in ms.
     */
    @Query("SELECT AVG(l.executionTimeMs) FROM SystemLog l WHERE l.executionTimeMs IS NOT NULL")
    Double getAverageExecutionTime();

    /**
     * Count logs by module.
     */
    @Query("SELECT l.module, COUNT(l) FROM SystemLog l GROUP BY l.module ORDER BY COUNT(l) DESC")
    List<Object[]> countLogsByModule();

    /**
     * Fetch all distinct modules currently logged in the database.
     */
    @Query("SELECT DISTINCT l.module FROM SystemLog l ORDER BY l.module ASC")
    List<String> findDistinctModules();

    /**
     * Fetch all distinct actions currently logged in the database.
     */
    @Query("SELECT DISTINCT l.action FROM SystemLog l ORDER BY l.action ASC")
    List<String> findDistinctActions();
}
