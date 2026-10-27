package com.quicktest.modules.iam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.security.JwtTokenProvider;
import com.quicktest.core.security.sso.QuickBiteTokenValidator;
import com.quicktest.core.security.sso.QuickBiteUserClaims;
import com.quicktest.modules.iam.controller.AuthController;
import com.quicktest.modules.iam.dto.AuthResponse;
import com.quicktest.modules.iam.dto.QuickBiteSsoLoginRequest;
import com.quicktest.modules.iam.dto.QuickBiteSsoTokenRequest;
import com.quicktest.modules.iam.dto.UserSummaryDto;
import com.quicktest.modules.iam.entity.AuthProvider;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.iam.service.AuthService;
import com.quicktest.modules.iam.service.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class QuickBiteSsoTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private QuickBiteTokenValidator quickBiteTokenValidator;

    private AuthServiceImpl authService;
    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        authService = new AuthServiceImpl(
                userRepository,
                passwordEncoder,
                authenticationManager,
                jwtTokenProvider,
                quickBiteTokenValidator
        );

        AuthController authController = new AuthController(authService);
        mockMvc = MockMvcBuilders.standaloneSetup(authController).build();
    }

    @Test
    @DisplayName("Role mapping: Admin group correctly maps to Role.ADMIN")
    void testRoleMapping_AdminGroup() {
        QuickBiteTokenValidator validator = new QuickBiteTokenValidator(
                true,
                "https://identity.mock.test/",
                "https://identity.mock.test/.well-known/jwks",
                "https://identity.mock.test/connect/userinfo",
                "https://identity.mock.test/connect/token",
                "mock-client-id",
                "openid profile email roles",
                new RestTemplateBuilder(),
                new ObjectMapper()
        );

        assertThat(validator.mapToQuickTestRole(List.of("admin"))).isEqualTo(Role.ADMIN);
        assertThat(validator.mapToQuickTestRole(List.of("quickbite-admin"))).isEqualTo(Role.ADMIN);
        assertThat(validator.mapToQuickTestRole(List.of("superadmin"))).isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("Role mapping: SubAdmin and Merchant groups map to Role.TEACHER")
    void testRoleMapping_TeacherGroup() {
        QuickBiteTokenValidator validator = new QuickBiteTokenValidator(
                true,
                "https://identity.mock.test/",
                "https://identity.mock.test/.well-known/jwks",
                "https://identity.mock.test/connect/userinfo",
                "https://identity.mock.test/connect/token",
                "mock-client-id",
                "openid profile email roles",
                new RestTemplateBuilder(),
                new ObjectMapper()
        );

        assertThat(validator.mapToQuickTestRole(List.of("sub-admin"))).isEqualTo(Role.TEACHER);
        assertThat(validator.mapToQuickTestRole(List.of("quickbite-sub-admin"))).isEqualTo(Role.TEACHER);
        assertThat(validator.mapToQuickTestRole(List.of("merchant"))).isEqualTo(Role.TEACHER);
        assertThat(validator.mapToQuickTestRole(List.of("manager"))).isEqualTo(Role.TEACHER);
    }

    @Test
    @DisplayName("Role mapping: Default customer maps to Role.STUDENT")
    void testRoleMapping_StudentGroup() {
        QuickBiteTokenValidator validator = new QuickBiteTokenValidator(
                true,
                "https://identity.mock.test/",
                "https://identity.mock.test/.well-known/jwks",
                "https://identity.mock.test/connect/userinfo",
                "https://identity.mock.test/connect/token",
                "mock-client-id",
                "openid profile email roles",
                new RestTemplateBuilder(),
                new ObjectMapper()
        );

        assertThat(validator.mapToQuickTestRole(List.of("customer"))).isEqualTo(Role.STUDENT);
        assertThat(validator.mapToQuickTestRole(Collections.emptyList())).isEqualTo(Role.STUDENT);
    }

    @Test
    @DisplayName("Configuration: Throws error when required SSO config is missing")
    void testMissingConfiguration_ThrowsException() {
        // Validator with empty config
        QuickBiteTokenValidator unconfiguredValidator = new QuickBiteTokenValidator(
                true,
                "",
                "",
                "",
                "",
                "",
                "",
                new RestTemplateBuilder(),
                new ObjectMapper()
        );

        org.junit.jupiter.api.Assertions.assertThrows(
                com.quicktest.core.exception.AppException.class,
                () -> unconfiguredValidator.validateAndExtractClaims("dummy.token.payload")
        );
    }

    @Test
    @DisplayName("SSO Token Login: Should auto-provision new user when ssoSubjectId not found")
    void testAuthenticateWithQuickBiteToken_NewUser() {
        String token = "sample-quickbite-token";
        QuickBiteUserClaims claims = QuickBiteUserClaims.builder()
                .sub("3a2301f8-d287-b1c0-5279-44e8d32753dd")
                .username("john_doe")
                .email("john@quickbite.vn")
                .fullName("John Doe")
                .rawRoles(List.of("teacher"))
                .mappedRole(Role.TEACHER)
                .build();

        when(quickBiteTokenValidator.validateAndExtractClaims(token)).thenReturn(claims);
        when(userRepository.findBySsoSubjectId(claims.getSub())).thenReturn(Optional.empty());
        when(userRepository.findByEmail(claims.getEmail())).thenReturn(Optional.empty());
        when(userRepository.existsByUsername("john_doe")).thenReturn(false);

        User savedUser = User.builder()
                .id(UUID.randomUUID())
                .ssoSubjectId(claims.getSub())
                .username("john_doe")
                .email(claims.getEmail())
                .fullName("John Doe")
                .role(Role.TEACHER)
                .authProvider(AuthProvider.QUICK_BITE_SSO)
                .isActive(true)
                .build();

        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtTokenProvider.generateToken(any(), any(), any(), any())).thenReturn("quicktest-jwt");
        when(jwtTokenProvider.generateRefreshToken(any(), any(), any())).thenReturn("quicktest-refresh");
        when(jwtTokenProvider.getExpirationMs()).thenReturn(86400000L);
        when(jwtTokenProvider.getRefreshExpirationMs()).thenReturn(604800000L);

        AuthResponse response = authService.authenticateWithQuickBiteToken(token);

        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("quicktest-jwt");
        assertThat(response.getUserInfo().getUsername()).isEqualTo("john_doe");
        assertThat(response.getUserInfo().getAuthProvider()).isEqualTo(AuthProvider.QUICK_BITE_SSO);
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    @DisplayName("POST /api/auth/sso/quickbite: Should return 200 with AuthResponse on valid token")
    void testPostSsoTokenEndpoint() throws Exception {
        QuickBiteSsoTokenRequest request = new QuickBiteSsoTokenRequest("valid-token");
        QuickBiteUserClaims claims = QuickBiteUserClaims.builder()
                .sub("test-sub-123")
                .username("qb_user")
                .email("qb@test.com")
                .fullName("QB User")
                .mappedRole(Role.STUDENT)
                .build();

        when(quickBiteTokenValidator.validateAndExtractClaims("valid-token")).thenReturn(claims);

        User existingUser = User.builder()
                .id(UUID.randomUUID())
                .ssoSubjectId("test-sub-123")
                .username("qb_user")
                .email("qb@test.com")
                .fullName("QB User")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.QUICK_BITE_SSO)
                .isActive(true)
                .build();

        when(userRepository.findBySsoSubjectId("test-sub-123")).thenReturn(Optional.of(existingUser));
        when(userRepository.save(any(User.class))).thenReturn(existingUser);
        when(jwtTokenProvider.generateToken(any(), any(), any(), any())).thenReturn("jwt-123");
        when(jwtTokenProvider.generateRefreshToken(any(), any(), any())).thenReturn("ref-123");

        mockMvc.perform(post("/api/auth/sso/quickbite")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("jwt-123"))
                .andExpect(jsonPath("$.data.userInfo.username").value("qb_user"));
    }
}
