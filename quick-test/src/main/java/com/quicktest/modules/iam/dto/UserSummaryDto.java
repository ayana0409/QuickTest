package com.quicktest.modules.iam.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.iam.entity.AuthProvider;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Safe user summary DTO without sensitive credential fields.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryDto {

    private UUID id;
    private String username;
    private String email;
    private String fullName;
    private Role role;
    private AuthProvider authProvider;
    private Boolean isActive;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime lastLoginAt;

    /**
     * Map User domain entity to UserSummaryDto.
     */
    public static UserSummaryDto fromEntity(User user) {
        if (user == null) {
            return null;
        }
        return UserSummaryDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .authProvider(user.getAuthProvider())
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .lastLoginAt(user.getLastLoginAt())
                .build();
    }
}
