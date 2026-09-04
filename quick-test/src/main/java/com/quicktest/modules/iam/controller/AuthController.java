package com.quicktest.modules.iam.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.dto.AuthResponse;
import com.quicktest.modules.iam.dto.LoginRequest;
import com.quicktest.modules.iam.dto.RegisterRequest;
import com.quicktest.modules.iam.dto.UserSummaryDto;
import com.quicktest.modules.iam.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
     * Get the profile details of the currently authenticated user.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserSummaryDto>> getCurrentUser(@AuthenticationPrincipal UserDetailsImpl currentUser) {
        UserSummaryDto userProfile = authService.getCurrentUser(currentUser);
        return ResponseEntity.ok(ApiResponse.success(userProfile, "Profile retrieved successfully"));
    }
}
