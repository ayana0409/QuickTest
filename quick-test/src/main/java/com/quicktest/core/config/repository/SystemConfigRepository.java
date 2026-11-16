package com.quicktest.core.config.repository;

import com.quicktest.core.config.entity.SystemConfig;
import com.quicktest.core.config.entity.SystemConfigCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for managing SystemConfig entities in PostgreSQL.
 */
@Repository
public interface SystemConfigRepository extends JpaRepository<SystemConfig, UUID> {

    Optional<SystemConfig> findByConfigKey(String configKey);

    boolean existsByConfigKey(String configKey);

    List<SystemConfig> findByCategoryOrderByConfigKeyAsc(SystemConfigCategory category);

    void deleteByConfigKey(String configKey);
}
