package com.quicktest.modules.iam.service;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.exception.UserAlreadyExistsException;
import com.quicktest.core.security.JwtTokenProvider;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.dto.AuthResponse;
import com.quicktest.modules.iam.dto.LoginRequest;
import com.quicktest.modules.iam.dto.RegisterRequest;
import com.quicktest.modules.iam.dto.UserSummaryDto;
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

        // 3. Generate JWT access token
        String token = jwtTokenProvider.generateToken(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                savedUser.getRole().name()
        );

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationMs())
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

        // 3. Generate JWT access token
        String token = jwtTokenProvider.generateToken(authentication);
        log.info("User {} successfully logged in at {}", user.getUsername(), user.getLastLoginAt());

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationMs())
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
}
