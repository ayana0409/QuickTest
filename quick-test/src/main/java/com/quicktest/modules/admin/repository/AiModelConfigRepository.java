package com.quicktest.modules.admin.repository;

import com.quicktest.modules.admin.entity.AiModelConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AiModelConfigRepository extends JpaRepository<AiModelConfigEntity, UUID> {

    List<AiModelConfigEntity> findByAiKeyIdOrderByOrderIndexAsc(UUID aiKeyId);
}
