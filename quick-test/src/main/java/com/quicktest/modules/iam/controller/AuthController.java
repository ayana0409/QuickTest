package com.quicktest.modules.iam.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.dto.AuthResponse;
import com.quicktest.modules.iam.dto.LoginRequest;
import com.quicktest.modules.iam.dto.QuickBiteSsoLoginRequest;
import com.quicktest.modules.iam.dto.QuickBiteSsoTokenRequest;
import com.quicktest.modules.iam.dto.RefreshTokenRequest;
import com.quicktest.modules.iam.dto.RegisterRequest;
import com.quicktest.modules.iam.dto.UpdatePasswordRequest;
import com.quicktest.modules.iam.dto.UpdateProfileRequest;
import com.quicktest.modules.iam.dto.UserSummaryDto;
import com.quicktest.modules.iam.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller exposing identity and access management endpoints.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Register a new user account.
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "User registered successfully"));
    }

    /**
     * Authenticate an existing user and obtain an access token.
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Login successful"));
    }

    /**
     * Authenticate or register an account via an existing QuickBite SSO Access Token.
     */
    @PostMapping("/sso/quickbite")
    public ResponseEntity<ApiResponse<AuthResponse>> authenticateQuickBiteToken(
            @Valid @RequestBody QuickBiteSsoTokenRequest request) {
        AuthResponse response = authService.authenticateWithQuickBiteToken(request.getAccessToken());
        return ResponseEntity.ok(ApiResponse.success(response, "QuickBite SSO authentication successful"));
    }

    /**
     * Authenticate using QuickBite credentials directly (OAuth2 Password Grant flow).
     */
    @PostMapping("/sso/quickbite/login")
    public ResponseEntity<ApiResponse<AuthResponse>> loginWithQuickBite(
            @Valid @RequestBody QuickBiteSsoLoginRequest request) {
        AuthResponse response = authService.loginWithQuickBiteCredentials(request.getUsername(), request.getPassword());
        return ResponseEntity.ok(ApiResponse.success(response, "QuickBite SSO login successful"));
    }

    /**
     * Authenticate using QuickBite OAuth2 Authorization Code flow (Redirect callback).
     */
    @PostMapping("/sso/quickbite/code")
    public ResponseEntity<ApiResponse<AuthResponse>> authenticateWithQuickBiteCode(
            @Valid @RequestBody com.quicktest.modules.iam.dto.QuickBiteSsoCodeRequest request) {
        AuthResponse response = authService.authenticateWithQuickBiteCode(request.getCode(), request.getRedirectUri());
        return ResponseEntity.ok(ApiResponse.success(response, "QuickBite SSO code exchange successful"));
    }

    /**
     * Get the profile details of the currently authenticated user.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserSummaryDto>> getCurrentUser(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        UserSummaryDto userProfile = authService.getCurrentUser(currentUser);
        return ResponseEntity.ok(ApiResponse.success(userProfile, "Profile retrieved successfully"));
    }

    /**
     * Refresh access and refresh tokens.
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Token refreshed successfully"));
    }

    /**
     * Update profile details of the currently authenticated user.
     */
    @PutMapping("/profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserSummaryDto>> updateProfile(
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @Valid @RequestBody UpdateProfileRequest request) {
        UserSummaryDto userProfile = authService.updateProfile(currentUser, request);
        return ResponseEntity.ok(ApiResponse.success(userProfile, "Profile updated successfully"));
    }

    /**
     * Change password of the currently authenticated user.
     */
    @PutMapping("/password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> updatePassword(
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @Valid @RequestBody UpdatePasswordRequest request) {
        authService.updatePassword(currentUser, request);
        return ResponseEntity.ok(ApiResponse.success(null, "Password updated successfully"));
    }
}
