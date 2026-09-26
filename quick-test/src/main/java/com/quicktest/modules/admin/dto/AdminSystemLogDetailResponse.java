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
 * Detailed DTO for inspecting full audit payload, exception stacktrace, and execution context.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSystemLogDetailResponse {

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
    private String details;
    private String errorMessage;
    private Long executionTimeMs;
    private LocalDateTime createdAt;

    public static AdminSystemLogDetailResponse fromEntity(SystemLog entity) {
        if (entity == null) {
            return null;
        }
        return AdminSystemLogDetailResponse.builder()
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
                .details(entity.getDetails())
                .errorMessage(entity.getErrorMessage())
                .executionTimeMs(entity.getExecutionTimeMs())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
