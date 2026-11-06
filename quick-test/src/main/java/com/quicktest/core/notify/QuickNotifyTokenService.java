package com.quicktest.core.notify;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.UUID;

/**
 * Service generating standardized JWT authentication tickets for client WebSocket connections
 * to the QuickNotify Go Hub, strictly adhering to the QuickNotify token specification.
 */
@Slf4j
@Service
public class QuickNotifyTokenService {

    private static final String PROJECT_ID = "quicktest";

    @Value("${quicknotify.jwt-secret:${app.jwt.secret}}")
    private String jwtSecret;

    @Getter
    @Value("${quicknotify.ws-url:ws://localhost:8080/ws}")
    private String quickNotifyWsUrl;

    /**
     * Resolves raw UTF-8 secret key bytes matching QuickNotify Go Hub's []byte(secretKey) verification.
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.trim().getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Generate entry JWT ticket for candidate client connecting to QuickNotify WebSocket.
     * Formats user_id as "att_{attemptId}" ensuring both authenticated users and guests are supported.
     */
    public String generateCandidateToken(UUID attemptId, Duration duration) {
        Date now = new Date();
        long durationMs = (duration != null && !duration.isNegative())
                ? duration.toMillis() + 4 * 3600 * 1000L // remaining duration + 4 hours buffer
                : 24 * 3600 * 1000L;
        Date expiryDate = new Date(now.getTime() + durationMs);

        return Jwts.builder()
                .claim("project_id", PROJECT_ID)
                .claim("user_id", "att_" + attemptId)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Generate entry JWT ticket for teacher monitoring client connecting to QuickNotify WebSocket.
     */
    public String generateTeacherToken(UUID teacherId, UUID examId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + 24 * 3600 * 1000L); // 24h validity

        return Jwts.builder()
                .claim("project_id", PROJECT_ID)
                .claim("user_id", "exam_monitor_" + examId)
                .claim("teacher_id", teacherId != null ? teacherId.toString() : "")
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }
}

