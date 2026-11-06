package com.quicktest.core.notify;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class QuickNotifyTokenServiceTest {

    private QuickNotifyTokenService tokenService;
    private final String secret = "quicktest-super-secret-key-for-hmac-sha256-signing-must-be-long-enough!";

    @BeforeEach
    void setUp() {
        tokenService = new QuickNotifyTokenService();
        ReflectionTestUtils.setField(tokenService, "jwtSecret", secret);
        ReflectionTestUtils.setField(tokenService, "quickNotifyWsUrl", "ws://localhost:8085/ws");
    }

    @Test
    @DisplayName("Should generate valid JWT ticket for Candidate with att_ prefix and project_id")
    void generateCandidateToken_ValidClaims() {
        UUID attemptId = UUID.randomUUID();

        String token = tokenService.generateCandidateToken(attemptId, Duration.ofMinutes(60));
        assertThat(token).isNotBlank();

        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        assertThat(claims.get("project_id", String.class)).isEqualTo("quicktest");
        assertThat(claims.get("user_id", String.class)).isEqualTo("att_" + attemptId);
        assertThat(claims.getExpiration()).isNotNull();
    }

    @Test
    @DisplayName("Should generate valid JWT ticket for Teacher with exam_monitor_ channel")
    void generateTeacherToken_ValidClaims() {
        UUID examId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();

        // Parameter order in QuickNotifyTokenService: (teacherId, examId)
        String token = tokenService.generateTeacherToken(teacherId, examId);
        assertThat(token).isNotBlank();

        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        assertThat(claims.get("project_id", String.class)).isEqualTo("quicktest");
        assertThat(claims.get("user_id", String.class)).isEqualTo("exam_monitor_" + examId);
        assertThat(claims.get("teacher_id", String.class)).isEqualTo(teacherId.toString());
        assertThat(claims.getExpiration()).isNotNull();
    }
}
