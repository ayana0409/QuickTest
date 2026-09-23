package com.quicktest.modules.iam.service;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.exception.UserAlreadyExistsException;
import com.quicktest.core.security.JwtTokenProvider;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.dto.AuthResponse;
import com.quicktest.modules.iam.dto.LoginRequest;
import com.quicktest.modules.iam.dto.RegisterRequest;
import com.quicktest.modules.iam.dto.UpdatePasswordRequest;
import com.quicktest.modules.iam.dto.UpdateProfileRequest;
import com.quicktest.modules.iam.dto.UserSummaryDto;
import com.quicktest.modules.iam.entity.AuthProvider;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation of AuthService applying Domain-Driven Design principles.
 * Orchestrates entity creation, domain mutations, authentication, and token generation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String username = request.getUsername().trim();
        String email = request.getEmail().trim().toLowerCase();

        // 1. Business Validation for uniqueness
        if (userRepository.existsByUsername(username)) {
            throw new UserAlreadyExistsException("Username '" + username + "' is already taken");
        }
        if (userRepository.existsByEmail(email)) {
            throw new UserAlreadyExistsException("Email '" + email + "' is already registered");
        }
        if (request.getRole() == Role.ADMIN) {
            throw new AppException("Registration with ADMIN role is not permitted", HttpStatus.FORBIDDEN);
        }

        // 2. Domain Entity Creation via Factory Method
        String encodedPassword = passwordEncoder.encode(request.getPassword());
        User newUser = User.createLocalUser(
                username,
                email,
                encodedPassword,
                request.getFullName().trim(),
                request.getRole()
        );

        User savedUser = userRepository.save(newUser);
        log.info("Successfully registered new user with id: {} and role: {}", savedUser.getId(), savedUser.getRole());

        // 3. Generate JWT access and refresh tokens
        String token = jwtTokenProvider.generateToken(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                savedUser.getRole().name()
        );
        String refreshToken = jwtTokenProvider.generateRefreshToken(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail()
        );

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationMs())
                .refreshToken(refreshToken)
                .refreshExpiresIn(jwtTokenProvider.getRefreshExpirationMs())
                .userInfo(UserSummaryDto.fromEntity(savedUser))
                .build();
    }

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        String usernameOrEmail = request.getUsernameOrEmail().trim();

        // 1. Authenticate user via AuthenticationManager
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(usernameOrEmail, request.getPassword())
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        UserDetailsImpl userPrincipal = (UserDetailsImpl) authentication.getPrincipal();

        // 2. Fetch aggregate root and invoke domain behavior to record login
        User user = userRepository.findById(userPrincipal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userPrincipal.getId()));

        user.recordLogin();
        userRepository.save(user);

        // 3. Generate JWT access and refresh tokens
        String token = jwtTokenProvider.generateToken(authentication);
        String refreshToken = jwtTokenProvider.generateRefreshToken(
                user.getId(),
                user.getUsername(),
                user.getEmail()
        );
        log.info("User {} successfully logged in at {}", user.getUsername(), user.getLastLoginAt());

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationMs())
                .refreshToken(refreshToken)
                .refreshExpiresIn(jwtTokenProvider.getRefreshExpirationMs())
                .userInfo(UserSummaryDto.fromEntity(user))
                .build();
    }

    @Override
    @Transactional
    public AuthResponse refreshToken(com.quicktest.modules.iam.dto.RefreshTokenRequest request) {
        String token = request.getRefreshToken();
        
        if (!jwtTokenProvider.validateToken(token)) {
            throw new AppException("Invalid or expired refresh token", HttpStatus.UNAUTHORIZED);
        }

        try {
            // Must have claim type="refresh"
            String tokenType = jwtTokenProvider.extractAllClaims(token).get("type", String.class);
            if (!"refresh".equals(tokenType)) {
                throw new AppException("Provided token is not a refresh token", HttpStatus.UNAUTHORIZED);
            }
        } catch (Exception ex) {
            throw new AppException("Invalid token payload", HttpStatus.UNAUTHORIZED);
        }

        java.util.UUID userId = jwtTokenProvider.getUserIdFromToken(token);
        if (userId == null) {
            throw new AppException("User ID not found in token", HttpStatus.UNAUTHORIZED);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AppException("User is inactive", HttpStatus.FORBIDDEN);
        }

        // Generate new tokens
        String newAccessToken = jwtTokenProvider.generateToken(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name()
        );
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(
                user.getId(),
                user.getUsername(),
                user.getEmail()
        );

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationMs())
                .refreshToken(newRefreshToken)
                .refreshExpiresIn(jwtTokenProvider.getRefreshExpirationMs())
                .userInfo(UserSummaryDto.fromEntity(user))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public UserSummaryDto getCurrentUser(UserDetailsImpl currentUser) {
        if (currentUser == null) {
            throw new AppException("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }

        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", currentUser.getId()));

        return UserSummaryDto.fromEntity(user);
    }

    @Override
    @Transactional
    public UserSummaryDto updateProfile(UserDetailsImpl currentUser, UpdateProfileRequest request) {
        if (currentUser == null) {
            throw new AppException("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }

        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", currentUser.getId()));

        user.updateProfile(request.getFullName());
        User savedUser = userRepository.save(user);
        log.info("User {} updated profile fullName to '{}'", user.getUsername(), savedUser.getFullName());

        return UserSummaryDto.fromEntity(savedUser);
    }

    @Override
    @Transactional
    public void updatePassword(UserDetailsImpl currentUser, UpdatePasswordRequest request) {
        if (currentUser == null) {
            throw new AppException("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }

        // 1. Validate password confirmation
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new AppException("New password and confirm password do not match", HttpStatus.BAD_REQUEST);
        }

        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", currentUser.getId()));

        // 2. Reject password change for third-party SSO accounts
        if (user.getAuthProvider() != AuthProvider.LOCAL) {
            throw new AppException("Password change is not supported for SSO accounts", HttpStatus.BAD_REQUEST);
        }

        // 3. Verify current password
        if (user.getPassword() == null || !passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new AppException("Current password is incorrect", HttpStatus.BAD_REQUEST);
        }

        // 4. Ensure new password is not identical to current password
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new AppException("New password cannot be the same as current password", HttpStatus.BAD_REQUEST);
        }

        // 5. Hash and update new password
        user.updatePassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        log.info("User {} successfully updated their password", user.getUsername());
    }
}
