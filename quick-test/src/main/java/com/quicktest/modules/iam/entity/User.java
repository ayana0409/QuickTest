package com.quicktest.modules.iam.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * User entity representing registered teachers and students, supporting both local and SSO auth.
 */
@Entity
@Table(
    name = "users",
    indexes = {
        @Index(name = "idx_users_sso_sub", columnList = "ssoSubjectId"),
        @Index(name = "idx_users_email", columnList = "email")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Direct mapping with claim "sub" (ABP User Guid). Nullable for locally registered users
    @Column(unique = true, length = 64)
    private String ssoSubjectId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private AuthProvider authProvider = AuthProvider.LOCAL;

    @Column(unique = true, length = 100)
    private String username;

    // Nullable for users authenticated via SSO
    @Column(nullable = true)
    private String password;

    @Column(unique = true, nullable = false, length = 150)
    private String email;

    @Column(nullable = false, length = 150)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Role role; // TEACHER, STUDENT

    @Builder.Default
    private Boolean isActive = true;

    private LocalDateTime lastLoginAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
