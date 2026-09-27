package com.quicktest.core.ratelimit.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.ratelimit.config.RateLimitProperties;
import com.quicktest.core.ratelimit.config.RateLimitProperties.EndpointRule;
import com.quicktest.core.ratelimit.exception.RateLimitExceededException;
import com.quicktest.core.ratelimit.model.RateLimitResult;
import com.quicktest.core.ratelimit.service.RateLimitService;
import com.quicktest.core.ratelimit.util.ClientIpResolver;
import com.quicktest.core.security.UserDetailsImpl;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Global configuration-driven rate limiting filter.
 * Applies rate limiting rules dynamically loaded from application.properties
 * across all endpoints without requiring any code annotations or changes to controllers.
 */
@Slf4j
@Component
public class GlobalRateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService rateLimitService;
    private final RateLimitProperties properties;
    private final ObjectMapper objectMapper;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    @Autowired(required = false)
    @Qualifier("handlerExceptionResolver")
    private HandlerExceptionResolver handlerExceptionResolver;

    private static final List<String> WHITELISTED_PATTERNS = List.of(
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/v3/api-docs/**",
            "/actuator/**",
            "/ws-exam/**",
            "/favicon.ico",
            "/error"
    );

    public GlobalRateLimitFilter(RateLimitService rateLimitService,
                                  RateLimitProperties properties,
                                  ObjectMapper objectMapper) {
        this.rateLimitService = rateLimitService;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public void setHandlerExceptionResolver(HandlerExceptionResolver handlerExceptionResolver) {
        this.handlerExceptionResolver = handlerExceptionResolver;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // 1. Always allow HTTP OPTIONS requests (CORS preflight)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Skip whitelisted paths
        String requestPath = request.getRequestURI();
        if (isWhitelisted(requestPath)) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Skip if rate limiting is globally disabled
        if (!properties.isEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = ClientIpResolver.getClientIp(request);
        String httpMethod = request.getMethod();

        // 4. Match against configured endpoint rules, fallback to global rule
        EndpointRule matchedRule = findMatchingRule(requestPath, httpMethod);
        String rateLimitKey;
        int limit;
        int periodSeconds;

        if (matchedRule != null) {
            limit = matchedRule.getLimit();
            periodSeconds = matchedRule.getPeriodSeconds();
            String identifier = resolveIdentifier(matchedRule.getKeyType(), request, clientIp);
            String prefix = (matchedRule.getPrefix() != null && !matchedRule.getPrefix().isBlank())
                    ? matchedRule.getPrefix() : "custom";
            rateLimitKey = prefix + ":" + identifier;
        } else if (properties.getGlobal().isEnabled()) {
            limit = properties.getGlobal().getLimit();
            periodSeconds = properties.getGlobal().getPeriodSeconds();
            rateLimitKey = "global:" + clientIp;
        } else {
            filterChain.doFilter(request, response);
            return;
        }

        // 5. Evaluate rate limit in Redis
        RateLimitResult result = rateLimitService.tryAcquire(rateLimitKey, limit, periodSeconds);

        if (result.isAllowed()) {
            // Append informational headers for allowed requests
            response.setHeader("X-RateLimit-Limit", String.valueOf(result.getLimit()));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(result.getRemaining()));
            response.setHeader("X-RateLimit-Reset", String.valueOf(result.getResetSeconds()));
            filterChain.doFilter(request, response);
            return;
        }

        // 6. Quota exceeded: log and trigger exception handling
        log.warn("Rate limit exceeded for key '{}'. Limit: {}, Retry-After: {}s",
                rateLimitKey, result.getLimit(), result.getRetryAfterSeconds());

        RateLimitExceededException ex = new RateLimitExceededException(
                result.getLimit(), result.getResetSeconds(), result.getRetryAfterSeconds());

        // Delegate to GlobalExceptionHandler via HandlerExceptionResolver if available
        if (handlerExceptionResolver != null) {
            handlerExceptionResolver.resolveException(request, response, null, ex);
            return;
        }

        // Fallback response rendering if HandlerExceptionResolver is not bound
        renderFallbackErrorResponse(response, result, ex.getMessage());
    }

    private EndpointRule findMatchingRule(String requestPath, String httpMethod) {
        if (properties.getEndpoints() == null || properties.getEndpoints().isEmpty()) {
            return null;
        }

        for (Map.Entry<String, EndpointRule> entry : properties.getEndpoints().entrySet()) {
            EndpointRule rule = entry.getValue();
            if (rule.getPath() != null && pathMatcher.match(rule.getPath(), requestPath)) {
                if (rule.getMethod() == null || rule.getMethod().isBlank() || rule.getMethod().equalsIgnoreCase(httpMethod)) {
                    if (rule.getPrefix() == null || rule.getPrefix().isBlank()) {
                        rule.setPrefix(entry.getKey());
                    }
                    return rule;
                }
            }
        }
        return null;
    }

    private String resolveIdentifier(String keyType, HttpServletRequest request, String fallbackIp) {
        if ("USER_OR_IP".equalsIgnoreCase(keyType)) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
                Object principal = auth.getPrincipal();
                if (principal instanceof UserDetailsImpl userDetails && userDetails.getId() != null) {
                    return userDetails.getId().toString();
                }
                return auth.getName();
            }
            String guestId = request.getHeader("X-Guest-Identifier");
            if (guestId != null && !guestId.isBlank()) {
                return "guest:" + guestId.trim();
            }
        }
        return fallbackIp;
    }

    private void renderFallbackErrorResponse(HttpServletResponse response, RateLimitResult result, String message)
            throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("Retry-After", String.valueOf(result.getRetryAfterSeconds()));
        response.setHeader("X-RateLimit-Limit", String.valueOf(result.getLimit()));
        response.setHeader("X-RateLimit-Remaining", "0");
        response.setHeader("X-RateLimit-Reset", String.valueOf(result.getResetSeconds()));

        Map<String, Object> details = Map.of(
                "limit", result.getLimit(),
                "remaining", 0,
                "resetSeconds", result.getResetSeconds(),
                "retryAfterSeconds", result.getRetryAfterSeconds()
        );

        ApiResponse<Map<String, Object>> errorResponse = ApiResponse.error(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                message,
                details
        );

        objectMapper.writeValue(response.getWriter(), errorResponse);
    }

    private boolean isWhitelisted(String path) {
        if (path == null) {
            return false;
        }
        for (String pattern : WHITELISTED_PATTERNS) {
            if (pathMatcher.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }
}
