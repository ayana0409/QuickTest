package com.quicktest.core.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderTest {

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        String testSecret = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
        long testExpirationMs = 3600000L;
        jwtTokenProvider = new JwtTokenProvider(testSecret, testExpirationMs);
    }

    @Test
    @DisplayName("Should generate valid JWT token and extract subject and claims")
    void testGenerateAndValidateToken() {
        UUID userId = UUID.randomUUID();
        String username = "teacher_test";
        String email = "teacher@quicktest.com";
        String role = "TEACHER";

        String token = jwtTokenProvider.generateToken(userId, username, email, role);

        assertNotNull(token);
        assertTrue(jwtTokenProvider.validateToken(token));
        assertEquals(username, jwtTokenProvider.getUsernameFromToken(token));
        assertEquals(userId, jwtTokenProvider.getUserIdFromToken(token));
    }

    @Test
    @DisplayName("Should fail validation on tampered token")
    void testTamperedToken() {
        UUID userId = UUID.randomUUID();
        String token = jwtTokenProvider.generateToken(userId, "user1", "user1@test.com", "STUDENT");
        String tamperedToken = token + "xyz";

        assertFalse(jwtTokenProvider.validateToken(tamperedToken));
    }
}
