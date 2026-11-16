package com.quicktest.core.config.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity representing an externalized dynamic system configuration stored in Database.
 */
@Entity
@Table(
    name = "system_configs",
    indexes = {
        @Index(name = "idx_system_configs_key", columnList = "config_key", unique = true),
        @Index(name = "idx_system_configs_category", columnList = "category")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "config_key", nullable = false, unique = true, length = 128)
    private String configKey;

    @Column(name = "config_value", nullable = false, columnDefinition = "TEXT")
    private String configValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_type", nullable = false, length = 32)
    @Builder.Default
    private SystemConfigValueType valueType = SystemConfigValueType.STRING;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 64)
    @Builder.Default
    private SystemConfigCategory category = SystemConfigCategory.SYSTEM_GENERAL;

    @Column(name = "label", nullable = false, length = 255)
    private String label;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_encrypted", nullable = false)
    @Builder.Default
    private Boolean isEncrypted = false;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
