package com.quicktest.config;

import com.quicktest.core.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

/**
 * Channel interceptor authenticating STOMP CONNECT commands using JWT Bearer tokens
 * provided in STOMP native headers or propagated from session handshake attributes.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@SuppressWarnings("null")
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = null;

            // 1. Check native STOMP "Authorization: Bearer <token>" header
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }

            // 2. Check native "token" header
            if (token == null || token.isBlank()) {
                token = accessor.getFirstNativeHeader("token");
            }

            // 3. Fallback to token saved in session attributes during handshake
            if ((token == null || token.isBlank()) && accessor.getSessionAttributes() != null) {
                token = (String) accessor.getSessionAttributes().get("token");
            }

            // Validate and establish security context on STOMP accessor
            if (token != null && !token.isBlank() && jwtTokenProvider.validateToken(token)) {
                try {
                    String username = jwtTokenProvider.getUsernameFromToken(token);
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    accessor.setUser(authentication);
                    log.debug("Established STOMP authentication for principal: {}", username);
                } catch (Exception ex) {
                    log.warn("Failed to load user details for STOMP authentication: {}", ex.getMessage());
                }
            } else {
                log.debug("STOMP connection initiated without authenticated user (guest or anonymous)");
            }
        }
        return message;
    }
}
