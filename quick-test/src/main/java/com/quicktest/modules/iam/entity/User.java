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

    /**
     * Domain factory method: Create a new locally authenticated user.
     */
    public static User createLocalUser(String username, String email, String encodedPassword, String fullName, Role role) {
        return User.builder()
                .username(username)
                .email(email)
                .password(encodedPassword)
                .fullName(fullName)
                .role(role)
                .authProvider(AuthProvider.LOCAL)
                .isActive(true)
                .build();
    }

    /**
     * Domain method: Record a successful login timestamp.
     */
    public void recordLogin() {
        this.lastLoginAt = LocalDateTime.now();
    }

    /**
     * Domain method: Update profile details.
     */
    public void updateProfile(String fullName) {
        if (fullName != null && !fullName.trim().isEmpty()) {
            this.fullName = fullName.trim();
        }
    }

    /**
     * Domain method: Update user password.
     */
    public void updatePassword(String encodedPassword) {
        this.password = encodedPassword;
    }

    /**
     * Domain method: Deactivate user account.
     */
    public void deactivate() {
        this.isActive = false;
    }

    /**
     * Domain method: Activate user account.
     */
    public void activate() {
        this.isActive = true;
    }
}
