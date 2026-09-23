package com.quicktest.modules.iam.service;

import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.dto.AuthResponse;
import com.quicktest.modules.iam.dto.LoginRequest;
import com.quicktest.modules.iam.dto.RegisterRequest;
import com.quicktest.modules.iam.dto.UserSummaryDto;

/**
 * Application service interface for authentication and identity management operations.
 */
public interface AuthService {

    /**
     * Register a new user account with LOCAL auth provider.
     */
    AuthResponse register(RegisterRequest request);

    /**
     * Authenticate an existing user with username/email and password.
     */
    AuthResponse login(LoginRequest request);

    /**
     * Retrieve the user profile summary of the currently authenticated user.
     */
    UserSummaryDto getCurrentUser(UserDetailsImpl currentUser);

    /**
     * Refresh access and refresh tokens using a valid refresh token.
     */
    AuthResponse refreshToken(com.quicktest.modules.iam.dto.RefreshTokenRequest request);

    /**
     * Update profile details for the currently authenticated user.
     */
    UserSummaryDto updateProfile(UserDetailsImpl currentUser, com.quicktest.modules.iam.dto.UpdateProfileRequest request);

    /**
     * Update password for the currently authenticated user.
     */
    void updatePassword(UserDetailsImpl currentUser, com.quicktest.modules.iam.dto.UpdatePasswordRequest request);
}
