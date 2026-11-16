package com.quicktest.config;

import com.quicktest.core.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

/**
 * Handshake interceptor extracting JWT token from query parameters (e.g. /ws-exam?token=...)
 * and attaching authenticated user details to WebSocket session attributes.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {

        URI uri = request.getURI();
        String query = uri.getQuery();
        if (query != null) {
            String[] params = query.split("&");
            for (String param : params) {
                String[] pair = param.split("=");
                if (pair.length == 2 && "token".equalsIgnoreCase(pair[0])) {
                    try {
                        String token = URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
                        if (jwtTokenProvider.validateToken(token)) {
                            attributes.put("token", token);
                            UUID userId = jwtTokenProvider.getUserIdFromToken(token);
                            String username = jwtTokenProvider.getUsernameFromToken(token);
                            attributes.put("userId", userId);
                            attributes.put("username", username);
                            log.debug("WebSocket handshake successfully authenticated for username: {}", username);
                        }
                    } catch (Exception ex) {
                        log.warn("Failed to decode or validate token during WebSocket handshake", ex);
                    }
                }
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
        // No-op after handshake
    }
}
