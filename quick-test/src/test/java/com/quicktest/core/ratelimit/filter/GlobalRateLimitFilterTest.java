package com.quicktest.core.ratelimit.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quicktest.core.ratelimit.config.RateLimitProperties;
import com.quicktest.core.ratelimit.config.RateLimitProperties.EndpointRule;
import com.quicktest.core.ratelimit.exception.RateLimitExceededException;
import com.quicktest.core.ratelimit.model.RateLimitResult;
import com.quicktest.core.ratelimit.service.RateLimitService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GlobalRateLimitFilterTest {

    @Mock
    private RateLimitService rateLimitService;

    @Mock
    private FilterChain filterChain;

    @Mock
    private HandlerExceptionResolver handlerExceptionResolver;

    private RateLimitProperties properties;
    private ObjectMapper objectMapper;
    private GlobalRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        properties = new RateLimitProperties();
        properties.setEnabled(true);
        properties.getGlobal().setEnabled(true);
        properties.getGlobal().setLimit(120);
        properties.getGlobal().setPeriodSeconds(60);

        // Configure a specific endpoint rule
        EndpointRule loginRule = new EndpointRule();
        loginRule.setPath("/api/auth/login");
        loginRule.setMethod("POST");
        loginRule.setLimit(5);
        loginRule.setPeriodSeconds(60);
        loginRule.setPrefix("auth-login");
        loginRule.setKeyType("IP");
        properties.getEndpoints().put("auth-login", loginRule);

        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        filter = new GlobalRateLimitFilter(rateLimitService, properties, objectMapper);
        filter.setHandlerExceptionResolver(handlerExceptionResolver);
    }

    @Test
    @DisplayName("Should bypass OPTIONS requests for CORS preflight")
    void shouldBypassOptionsRequests() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(rateLimitService);
    }

    @Test
    @DisplayName("Should bypass whitelisted paths like Swagger and Actuator")
    void shouldBypassWhitelistedEndpoints() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/swagger-ui/index.html");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(rateLimitService);
    }

    @Test
    @DisplayName("Should apply specific endpoint rule from configuration when matched")
    void shouldApplyConfiguredEndpointRule() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("10.0.0.99");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(rateLimitService.tryAcquire(eq("auth-login:10.0.0.99"), eq(5), eq(60)))
                .thenReturn(RateLimitResult.builder()
                        .allowed(true)
                        .limit(5)
                        .remaining(4)
                        .resetSeconds(60)
                        .retryAfterSeconds(0)
                        .build());

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("5");
        assertThat(response.getHeader("X-RateLimit-Remaining")).isEqualTo("4");
    }

    @Test
    @DisplayName("Should fallback to global rate limit when no specific endpoint rule matches")
    void shouldFallbackToGlobalRuleWhenUnmatched() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/exams");
        request.setRemoteAddr("10.0.0.5");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(rateLimitService.tryAcquire(eq("global:10.0.0.5"), eq(120), eq(60)))
                .thenReturn(RateLimitResult.builder()
                        .allowed(true)
                        .limit(120)
                        .remaining(119)
                        .resetSeconds(60)
                        .retryAfterSeconds(0)
                        .build());

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("120");
        assertThat(response.getHeader("X-RateLimit-Remaining")).isEqualTo("119");
    }

    @Test
    @DisplayName("Should delegate to HandlerExceptionResolver when limit exceeded")
    void shouldDelegateToExceptionHandlerWhenExceeded() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("203.0.113.195");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(rateLimitService.tryAcquire(eq("auth-login:203.0.113.195"), eq(5), eq(60)))
                .thenReturn(RateLimitResult.builder()
                        .allowed(false)
                        .limit(5)
                        .remaining(0)
                        .resetSeconds(60)
                        .retryAfterSeconds(40)
                        .build());

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain, never()).doFilter(request, response);
        ArgumentCaptor<Exception> captor = ArgumentCaptor.forClass(Exception.class);
        verify(handlerExceptionResolver).resolveException(eq(request), eq(response), any(), captor.capture());
        assertThat(captor.getValue()).isInstanceOf(RateLimitExceededException.class);
        RateLimitExceededException ex = (RateLimitExceededException) captor.getValue();
        assertThat(ex.getLimit()).isEqualTo(5L);
        assertThat(ex.getRetryAfterSeconds()).isEqualTo(40L);
    }
}
