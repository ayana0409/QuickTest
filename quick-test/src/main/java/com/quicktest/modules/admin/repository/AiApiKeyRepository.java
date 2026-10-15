package com.quicktest.modules.admin.repository;

import com.quicktest.modules.admin.entity.AiApiKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AiApiKeyRepository extends JpaRepository<AiApiKey, UUID> {

    /**
     * Retrieves all active keys with their eager models for rotation pool initialization.
     */
    @Query("SELECT DISTINCT k FROM AiApiKey k LEFT JOIN FETCH k.models m WHERE k.isActive = true ORDER BY k.orderIndex ASC")
    List<AiApiKey> findAllActiveWithModels();

    /**
     * Retrieves all keys ordered by order index for admin management view.
     */
    List<AiApiKey> findAllByOrderByOrderIndexAsc();
}
