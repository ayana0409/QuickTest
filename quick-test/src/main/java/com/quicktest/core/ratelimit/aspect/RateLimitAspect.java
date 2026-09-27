package com.quicktest.core.ratelimit.aspect;

import com.quicktest.core.ratelimit.annotation.RateLimit;
import com.quicktest.core.ratelimit.annotation.RateLimitKeyType;
import com.quicktest.core.ratelimit.exception.RateLimitExceededException;
import com.quicktest.core.ratelimit.model.RateLimitResult;
import com.quicktest.core.ratelimit.service.RateLimitService;
import com.quicktest.core.ratelimit.util.ClientIpResolver;
import com.quicktest.core.security.UserDetailsImpl;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.servlet.HandlerMapping;

import java.lang.reflect.Method;
import java.util.Map;

/**
 * Aspect intercepting controller methods annotated with @RateLimit to enforce rate limits.
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class RateLimitAspect {

    private final RateLimitService rateLimitService;
    private final ExpressionParser expressionParser = new SpelExpressionParser();
    private final ParameterNameDiscoverer parameterNameDiscoverer = new DefaultParameterNameDiscoverer();

    @Around("@annotation(rateLimit)")
    public Object enforceRateLimit(ProceedingJoinPoint joinPoint, RateLimit rateLimit) throws Throwable {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes != null ? attributes.getRequest() : null;
        HttpServletResponse response = attributes != null ? attributes.getResponse() : null;

        String key = resolveRateLimitKey(joinPoint, rateLimit, request);
        int limit = rateLimit.limit();
        int windowSeconds = rateLimit.windowSeconds();

        RateLimitResult result = rateLimitService.tryAcquire(key, limit, windowSeconds);

        if (!result.isAllowed()) {
            log.warn("Rate limit exceeded for key '{}'. Limit: {}, Retry-After: {}s",
                    key, result.getLimit(), result.getRetryAfterSeconds());
            throw new RateLimitExceededException(result.getLimit(), result.getResetSeconds(), result.getRetryAfterSeconds());
        }

        if (response != null) {
            response.setHeader("X-RateLimit-Limit", String.valueOf(result.getLimit()));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(result.getRemaining()));
            response.setHeader("X-RateLimit-Reset", String.valueOf(result.getResetSeconds()));
        }

        return joinPoint.proceed();
    }

    private String resolveRateLimitKey(ProceedingJoinPoint joinPoint, RateLimit rateLimit, HttpServletRequest request) {
        String clientIp = ClientIpResolver.getClientIp(request);
        String userId = resolveUserId();

        String prefix = !rateLimit.prefix().isBlank() ? rateLimit.prefix() : joinPoint.getSignature().getName();
        String identifier;

        RateLimitKeyType keyType = rateLimit.keyType();
        switch (keyType) {
            case USER_ID -> identifier = (userId != null && !userId.isBlank()) ? userId : clientIp;
            case COMBINED -> identifier = (userId != null && !userId.isBlank()) ? (userId + ":" + clientIp) : clientIp;
            case PARAM -> identifier = resolveParamValue(joinPoint, rateLimit.keyParam(), request, clientIp);
            case SPEL -> identifier = resolveSpelValue(joinPoint, rateLimit.keySpel(), clientIp);
            case IP -> identifier = clientIp;
            default -> identifier = clientIp;
        }

        return prefix + ":" + identifier;
    }

    private String resolveUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            Object principal = auth.getPrincipal();
            if (principal instanceof UserDetailsImpl userDetails) {
                return userDetails.getId() != null ? userDetails.getId().toString() : userDetails.getUsername();
            }
            return auth.getName();
        }
        return null;
    }

    private String resolveParamValue(ProceedingJoinPoint joinPoint, String paramName, HttpServletRequest request, String fallback) {
        if (paramName == null || paramName.isBlank()) {
            return fallback;
        }

        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Object[] args = joinPoint.getArgs();

        String[] paramNames = parameterNameDiscoverer.getParameterNames(method);
        if (paramNames != null) {
            for (int i = 0; i < paramNames.length && i < args.length; i++) {
                if (paramName.equals(paramNames[i]) && args[i] != null) {
                    return args[i].toString();
                }
            }
        }

        if (request != null) {
            @SuppressWarnings("unchecked")
            Map<String, String> uriVars = (Map<String, String>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
            if (uriVars != null && uriVars.containsKey(paramName)) {
                return uriVars.get(paramName);
            }
            String queryVal = request.getParameter(paramName);
            if (queryVal != null && !queryVal.isBlank()) {
                return queryVal;
            }
        }

        return fallback;
    }

    private String resolveSpelValue(ProceedingJoinPoint joinPoint, String spelExpression, String fallback) {
        if (spelExpression == null || spelExpression.isBlank()) {
            return fallback;
        }

        try {
            MethodSignature signature = (MethodSignature) joinPoint.getSignature();
            Method method = signature.getMethod();
            Object[] args = joinPoint.getArgs();

            StandardEvaluationContext context = new StandardEvaluationContext();
            String[] paramNames = parameterNameDiscoverer.getParameterNames(method);
            if (paramNames != null) {
                for (int i = 0; i < paramNames.length && i < args.length; i++) {
                    context.setVariable(paramNames[i], args[i]);
                }
            }

            Object value = expressionParser.parseExpression(spelExpression).getValue(context);
            return value != null ? value.toString() : fallback;
        } catch (Exception ex) {
            log.warn("Failed to evaluate rate limit SpEL '{}': {}", spelExpression, ex.getMessage());
            return fallback;
        }
    }
}
