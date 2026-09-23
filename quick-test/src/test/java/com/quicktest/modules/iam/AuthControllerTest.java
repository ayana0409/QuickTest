package com.quicktest.modules.iam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.controller.AuthController;
import com.quicktest.modules.iam.dto.*;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller tests for AuthController covering registration, login, profile retrieval,
 * and refresh token exchange.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AuthControllerTest {

    @Mock
    private AuthService authService;

    @InjectMocks
    private AuthController authController;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    private UserSummaryDto sampleUserDto;
    private UserDetailsImpl mockPrincipal;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();

        UUID userId = UUID.randomUUID();
        sampleUserDto = UserSummaryDto.builder()
                .id(userId)
                .username("john_doe")
                .email("john@example.com")
                .fullName("John Doe")
                .roles(List.of("ROLE_TEACHER"))
                .isActive(true)
                .build();

        mockPrincipal = UserDetailsImpl.builder()
                .id(userId)
                .username("john_doe")
                .email("john@example.com")
                .role(Role.TEACHER)
                .isActive(true)
                .build();

        HandlerMethodArgumentResolver authPrincipalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return mockPrincipal;
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(authController)
                .setCustomArgumentResolvers(authPrincipalResolver)
                .build();
    }

    @Test
    @DisplayName("POST /api/auth/register: Should return 201 when registration request is valid")
    void register_Success() throws Exception {
        RegisterRequest request = RegisterRequest.builder()
                .fullName("John Doe")
                .username("john_doe")
                .email("john@example.com")
                .password("Password@123")
                .role(Role.TEACHER)
                .build();

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken("mock-jwt-access-token")
                .refreshToken("mock-jwt-refresh-token")
                .tokenType("Bearer")
                .expiresIn(86400L)
                .userInfo(sampleUserDto)
                .build();

        when(authService.register(any(RegisterRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("mock-jwt-access-token"))
                .andExpect(jsonPath("$.data.refreshToken").value("mock-jwt-refresh-token"))
                .andExpect(jsonPath("$.data.userInfo.email").value("john@example.com"));
    }

    @Test
    @DisplayName("POST /api/auth/login: Should return 200 when credentials are valid")
    void login_Success() throws Exception {
        LoginRequest request = LoginRequest.builder()
                .usernameOrEmail("john@example.com")
                .password("Password@123")
                .build();

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken("mock-jwt-access-token")
                .refreshToken("mock-jwt-refresh-token")
                .tokenType("Bearer")
                .expiresIn(86400L)
                .userInfo(sampleUserDto)
                .build();

        when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("mock-jwt-access-token"))
                .andExpect(jsonPath("$.data.refreshToken").value("mock-jwt-refresh-token"));
    }

    @Test
    @DisplayName("POST /api/auth/refresh: Should return 200 with new token pair when refresh token is valid")
    void refreshToken_Success() throws Exception {
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("valid-refresh-token");

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken("new-access-token")
                .refreshToken("new-refresh-token")
                .tokenType("Bearer")
                .expiresIn(86400L)
                .userInfo(sampleUserDto)
                .build();

        when(authService.refreshToken(any(RefreshTokenRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("new-access-token"))
                .andExpect(jsonPath("$.data.refreshToken").value("new-refresh-token"))
                .andExpect(jsonPath("$.message").value("Token refreshed successfully"));
    }

    @Test
    @DisplayName("POST /api/auth/refresh: Should return 400 when refreshToken body is missing or blank")
    void refreshToken_ValidationError() throws Exception {
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("");

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/auth/me: Should return 200 with current user profile")
    void getCurrentUser_Success() throws Exception {
        when(authService.getCurrentUser(any())).thenReturn(sampleUserDto);

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.username").value("john_doe"))
                .andExpect(jsonPath("$.data.email").value("john@example.com"));
    }

    @Test
    @DisplayName("PUT /api/auth/profile: Should return 200 when profile update request is valid")
    void updateProfile_Success() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest("Jane Doe");
        UserSummaryDto updatedDto = UserSummaryDto.builder()
                .id(sampleUserDto.getId())
                .username("john_doe")
                .email("john@example.com")
                .fullName("Jane Doe")
                .roles(List.of("ROLE_TEACHER"))
                .isActive(true)
                .build();

        when(authService.updateProfile(any(), any(UpdateProfileRequest.class))).thenReturn(updatedDto);

        mockMvc.perform(put("/api/auth/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.fullName").value("Jane Doe"))
                .andExpect(jsonPath("$.message").value("Profile updated successfully"));
    }

    @Test
    @DisplayName("PUT /api/auth/profile: Should return 400 when fullName is invalid")
    void updateProfile_ValidationError() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest("");

        mockMvc.perform(put("/api/auth/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/auth/password: Should return 200 when password update request is valid")
    void updatePassword_Success() throws Exception {
        UpdatePasswordRequest request = new UpdatePasswordRequest("oldSecret123", "newSecret123", "newSecret123");

        mockMvc.perform(put("/api/auth/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Password updated successfully"));
    }

    @Test
    @DisplayName("PUT /api/auth/password: Should return 400 when new password is too short")
    void updatePassword_ValidationError() throws Exception {
        UpdatePasswordRequest request = new UpdatePasswordRequest("oldSecret123", "123", "123");

        mockMvc.perform(put("/api/auth/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
