package com.quicktest.core.config.dto;

import com.quicktest.core.config.entity.SystemConfigCategory;
import com.quicktest.core.config.entity.SystemConfigValueType;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Data Transfer Object representing a system configuration item with runtime source tracking.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemConfigDto {

    private String key;
    private String value;
    private String defaultValue;
    private SystemConfigValueType valueType;
    private SystemConfigCategory category;
    private String label;
    private String description;
    private SystemConfigSource source;
    private LocalDateTime updatedAt;
    private String updatedBy;
}
