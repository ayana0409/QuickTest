package com.quicktest.modules.iam;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.dto.UpdatePasswordRequest;
import com.quicktest.modules.iam.dto.UpdateProfileRequest;
import com.quicktest.modules.iam.dto.UserSummaryDto;
import com.quicktest.modules.iam.entity.AuthProvider;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.iam.service.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AuthServiceImpl focusing on profile update and password change logic.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthServiceImpl authService;

    private UUID userId;
    private UserDetailsImpl userPrincipal;
    private User localUser;
    private User ssoUser;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();

        userPrincipal = UserDetailsImpl.builder()
                .id(userId)
                .username("teacher1")
                .email("teacher1@quicktest.com")
                .role(Role.TEACHER)
                .isActive(true)
                .build();

        localUser = User.builder()
                .id(userId)
                .username("teacher1")
                .email("teacher1@quicktest.com")
                .password("encoded_old_password")
                .fullName("Teacher One")
                .role(Role.TEACHER)
                .authProvider(AuthProvider.LOCAL)
                .isActive(true)
                .build();

        ssoUser = User.builder()
                .id(userId)
                .username("sso_user")
                .email("sso@google.com")
                .password(null)
                .fullName("SSO User")
                .role(Role.TEACHER)
                .authProvider(AuthProvider.QUICK_BITE_SSO)
                .isActive(true)
                .build();
    }

    @Test
    @DisplayName("updateProfile: Should successfully update full name")
    void updateProfile_Success() {
        UpdateProfileRequest request = new UpdateProfileRequest("New Full Name");
        when(userRepository.findById(userId)).thenReturn(Optional.of(localUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserSummaryDto result = authService.updateProfile(userPrincipal, request);

        assertThat(result).isNotNull();
        assertThat(result.getFullName()).isEqualTo("New Full Name");
        verify(userRepository).save(localUser);
    }

    @Test
    @DisplayName("updateProfile: Should throw UNAUTHORIZED when principal is null")
    void updateProfile_ThrowsWhenNullPrincipal() {
        UpdateProfileRequest request = new UpdateProfileRequest("New Full Name");

        assertThatThrownBy(() -> authService.updateProfile(null, request))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("User is not authenticated");
    }

    @Test
    @DisplayName("updatePassword: Should successfully change password for local user")
    void updatePassword_Success() {
        UpdatePasswordRequest request = new UpdatePasswordRequest("currentPass123", "newPass456", "newPass456");

        when(userRepository.findById(userId)).thenReturn(Optional.of(localUser));
        when(passwordEncoder.matches("currentPass123", "encoded_old_password")).thenReturn(true);
        when(passwordEncoder.matches("newPass456", "encoded_old_password")).thenReturn(false);
        when(passwordEncoder.encode("newPass456")).thenReturn("encoded_new_password");

        authService.updatePassword(userPrincipal, request);

        assertThat(localUser.getPassword()).isEqualTo("encoded_new_password");
        verify(userRepository).save(localUser);
    }

    @Test
    @DisplayName("updatePassword: Should throw BAD_REQUEST when confirmation password does not match")
    void updatePassword_ThrowsWhenConfirmPasswordMismatch() {
        UpdatePasswordRequest request = new UpdatePasswordRequest("currentPass123", "newPass456", "differentPass");

        assertThatThrownBy(() -> authService.updatePassword(userPrincipal, request))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("New password and confirm password do not match");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("updatePassword: Should throw BAD_REQUEST when user is authenticated via SSO")
    void updatePassword_ThrowsWhenSsoUser() {
        UpdatePasswordRequest request = new UpdatePasswordRequest("currentPass123", "newPass456", "newPass456");
        when(userRepository.findById(userId)).thenReturn(Optional.of(ssoUser));

        assertThatThrownBy(() -> authService.updatePassword(userPrincipal, request))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Password change is not supported for SSO accounts");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("updatePassword: Should throw BAD_REQUEST when current password is incorrect")
    void updatePassword_ThrowsWhenOldPasswordIncorrect() {
        UpdatePasswordRequest request = new UpdatePasswordRequest("wrongOldPass", "newPass456", "newPass456");
        when(userRepository.findById(userId)).thenReturn(Optional.of(localUser));
        when(passwordEncoder.matches("wrongOldPass", "encoded_old_password")).thenReturn(false);

        assertThatThrownBy(() -> authService.updatePassword(userPrincipal, request))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Current password is incorrect");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("updatePassword: Should throw BAD_REQUEST when new password is same as current password")
    void updatePassword_ThrowsWhenNewPasswordSameAsOld() {
        UpdatePasswordRequest request = new UpdatePasswordRequest("currentPass123", "currentPass123", "currentPass123");
        when(userRepository.findById(userId)).thenReturn(Optional.of(localUser));
        when(passwordEncoder.matches("currentPass123", "encoded_old_password")).thenReturn(true);

        assertThatThrownBy(() -> authService.updatePassword(userPrincipal, request))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("New password cannot be the same as current password");

        verify(userRepository, never()).save(any());
    }
}
