package com.quicktest.modules.admin.dto;

import com.quicktest.core.logging.LogLevel;
import com.quicktest.core.logging.LogStatus;
import com.quicktest.core.logging.SystemLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Summary DTO for displaying system logs in administrative tables.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSystemLogResponse {

    private UUID id;
    private LogLevel level;
    private String module;
    private String action;
    private LogStatus status;
    private UUID actorId;
    private String actorUsername;
    private String actorRole;
    private String endpoint;
    private String httpMethod;
    private String ipAddress;
    private String errorMessage;
    private Long executionTimeMs;
    private LocalDateTime createdAt;
    private boolean hasDetails;

    public static AdminSystemLogResponse fromEntity(SystemLog entity) {
        if (entity == null) {
            return null;
        }
        return AdminSystemLogResponse.builder()
                .id(entity.getId())
                .level(entity.getLevel())
                .module(entity.getModule())
                .action(entity.getAction())
                .status(entity.getStatus())
                .actorId(entity.getActorId())
                .actorUsername(entity.getActorUsername())
                .actorRole(entity.getActorRole())
                .endpoint(entity.getEndpoint())
                .httpMethod(entity.getHttpMethod())
                .ipAddress(entity.getIpAddress())
                .errorMessage(entity.getErrorMessage())
                .executionTimeMs(entity.getExecutionTimeMs())
                .createdAt(entity.getCreatedAt())
                .hasDetails(entity.getDetails() != null && !entity.getDetails().isBlank())
                .build();
    }
}
