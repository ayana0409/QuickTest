package com.quicktest.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Spring WebSocket STOMP configuration for real-time exam proctoring and
 * telemetry.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketHandshakeInterceptor handshakeInterceptor;
    private final WebSocketAuthInterceptor authInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // SockJS fallback endpoint for browsers
        registry.addEndpoint("/ws-exam")
                .setAllowedOriginPatterns("*")
                .addInterceptors(handshakeInterceptor)
                .withSockJS();

        // Standard pure WebSocket endpoint for mobile / native clients
        registry.addEndpoint("/ws-exam")
                .setAllowedOriginPatterns("*")
                .addInterceptors(handshakeInterceptor);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Outbound prefixes: /topic for broadcast (e.g. rooms), /queue for
        // point-to-point (e.g. alerts)
        registry.enableSimpleBroker("/topic", "/queue");

        // Inbound prefix for message mappings (@MessageMapping)
        registry.setApplicationDestinationPrefixes("/app");

        // User destination prefix for point-to-point messaging (@SendToUser)
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor);
    }
}
