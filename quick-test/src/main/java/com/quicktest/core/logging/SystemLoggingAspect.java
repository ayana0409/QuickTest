package com.quicktest.core.logging;

import com.quicktest.core.security.UserDetailsImpl;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.*;

/**
 * Global AOP Middleware Aspect intercepting audited operations, CRUD service methods,
 * background workers, and exceptions to produce centralized structured audit records.
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class SystemLoggingAspect {

    private final SystemLogService systemLogService;

    /**
     * Intercept methods explicitly annotated with @AuditLog.
     */
    @Around("@annotation(auditLog)")
    public Object logAnnotatedMethod(ProceedingJoinPoint joinPoint, AuditLog auditLog) throws Throwable {
        return processAndLog(joinPoint, auditLog, null, null);
    }

    /**
     * Intercept standard CRUD methods in Service implementations that are not explicitly annotated.
     */
    @Around("execution(* com.quicktest.modules..service.*ServiceImpl.create*(..)) || " +
            "execution(* com.quicktest.modules..service.*ServiceImpl.update*(..)) || " +
            "execution(* com.quicktest.modules..service.*ServiceImpl.delete*(..)) && " +
            "!@annotation(com.quicktest.core.logging.AuditLog)")
    public Object logServiceCrudMethod(ProceedingJoinPoint joinPoint) throws Throwable {
        return processAndLog(joinPoint, null, null, null);
    }

    /**
     * Intercept background RabbitListener methods that are not explicitly annotated with @AuditLog.
     */
    @Around("@annotation(org.springframework.amqp.rabbit.annotation.RabbitListener) && " +
            "!@annotation(com.quicktest.core.logging.AuditLog)")
    public Object logRabbitListener(ProceedingJoinPoint joinPoint) throws Throwable {
        return processAndLog(joinPoint, null, "WORKER", "EXECUTE");
    }

    private Object processAndLog(ProceedingJoinPoint joinPoint,
                                 AuditLog auditLog,
                                 String fallbackModule,
                                 String fallbackAction) throws Throwable {
        long startTime = System.currentTimeMillis();
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();

        String module = resolveModuleName(joinPoint, auditLog, fallbackModule);
        String action = resolveActionName(method, auditLog, fallbackAction);
        boolean logParams = auditLog == null || auditLog.logParams();
        boolean logResult = auditLog != null && auditLog.logResult();

        // Extract Actor and HTTP metadata
        ActorInfo actorInfo = extractActor();
        HttpInfo httpInfo = extractHttpInfo();

        Map<String, Object> detailsMap = new LinkedHashMap<>();
        if (logParams) {
            detailsMap.put("parameters", extractMethodParameters(signature, joinPoint.getArgs()));
        }

        try {
            Object result = joinPoint.proceed();
            long executionTimeMs = System.currentTimeMillis() - startTime;

            if (logResult && result != null) {
                detailsMap.put("result", result);
            }

            SystemLog logEntry = SystemLog.builder()
                    .level(LogLevel.INFO)
                    .status(LogStatus.SUCCESS)
                    .module(module)
                    .action(action)
                    .actorId(actorInfo.id)
                    .actorUsername(actorInfo.username)
                    .actorRole(actorInfo.role)
                    .endpoint(httpInfo.endpoint)
                    .httpMethod(httpInfo.httpMethod)
                    .ipAddress(httpInfo.ipAddress)
                    .details(systemLogService.safeSerialize(detailsMap))
                    .executionTimeMs(executionTimeMs)
                    .build();

            systemLogService.logAsync(logEntry);
            return result;

        } catch (Throwable throwable) {
            long executionTimeMs = System.currentTimeMillis() - startTime;

            detailsMap.put("exceptionClass", throwable.getClass().getName());
            detailsMap.put("stackTraceSnippet", extractStackTraceSnippet(throwable));

            SystemLog errorEntry = SystemLog.builder()
                    .level(LogLevel.ERROR)
                    .status(LogStatus.FAILURE)
                    .module(module)
                    .action(action)
                    .actorId(actorInfo.id)
                    .actorUsername(actorInfo.username)
                    .actorRole(actorInfo.role)
                    .endpoint(httpInfo.endpoint)
                    .httpMethod(httpInfo.httpMethod)
                    .ipAddress(httpInfo.ipAddress)
                    .errorMessage(throwable.getMessage() != null ? throwable.getMessage() : throwable.toString())
                    .details(systemLogService.safeSerialize(detailsMap))
                    .executionTimeMs(executionTimeMs)
                    .build();

            systemLogService.logAsync(errorEntry);
            throw throwable;
        }
    }

    private String resolveModuleName(ProceedingJoinPoint joinPoint, AuditLog auditLog, String fallbackModule) {
        if (auditLog != null && !auditLog.module().isBlank()) {
            return auditLog.module().trim().toUpperCase();
        }
        if (fallbackModule != null && !fallbackModule.isBlank()) {
            return fallbackModule;
        }
        String className = joinPoint.getTarget().getClass().getSimpleName();
        return className.replaceAll("ServiceImpl$", "")
                .replaceAll("Controller$", "")
                .replaceAll("Consumer$", "")
                .toUpperCase();
    }

    private String resolveActionName(Method method, AuditLog auditLog, String fallbackAction) {
        if (auditLog != null && !auditLog.action().isBlank()) {
            return auditLog.action().trim().toUpperCase();
        }
        if (fallbackAction != null && !fallbackAction.isBlank()) {
            return fallbackAction;
        }
        // Convert camelCase methodName to UPPER_SNAKE_CASE (e.g. createExam -> CREATE_EXAM)
        return method.getName().replaceAll("([a-z])([A-Z])", "$1_$2").toUpperCase();
    }

    private Map<String, Object> extractMethodParameters(MethodSignature signature, Object[] args) {
        Map<String, Object> params = new LinkedHashMap<>();
        Parameter[] methodParams = signature.getMethod().getParameters();

        for (int i = 0; i < args.length; i++) {
            String paramName = (i < methodParams.length) ? methodParams[i].getName() : "arg" + i;
            params.put(paramName, args[i]);
        }
        return params;
    }

    private String extractStackTraceSnippet(Throwable throwable) {
        try {
            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw);
            throwable.printStackTrace(pw);
            String fullTrace = sw.toString();
            return fullTrace.length() > 2000 ? fullTrace.substring(0, 2000) + "\n... [TRUNCATED]" : fullTrace;
        } catch (Exception e) {
            return throwable.toString();
        }
    }

    private ActorInfo extractActor() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                if (auth.getPrincipal() instanceof UserDetailsImpl userDetails) {
                    return new ActorInfo(
                            userDetails.getId(),
                            userDetails.getUsername(),
                            userDetails.getRole() != null ? userDetails.getRole().name() : null
                    );
                } else {
                    String role = auth.getAuthorities().stream()
                            .map(GrantedAuthority::getAuthority)
                            .findFirst()
                            .orElse(null);
                    return new ActorInfo(null, auth.getName(), role);
                }
            }
        } catch (Exception ignored) {
        }
        return new ActorInfo(null, "ANONYMOUS", null);
    }

    private HttpInfo extractHttpInfo() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                return new HttpInfo(
                        request.getRequestURI(),
                        request.getMethod(),
                        resolveClientIp(request)
                );
            }
        } catch (Exception ignored) {
        }
        return new HttpInfo(null, null, null);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String[] headers = {
                "X-Forwarded-For",
                "Proxy-Client-IP",
                "WL-Proxy-Client-IP",
                "HTTP_CLIENT_IP",
                "HTTP_X_FORWARDED_FOR"
        };
        for (String header : headers) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isBlank() && !"unknown".equalsIgnoreCase(ip)) {
                return ip.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }

    private record ActorInfo(UUID id, String username, String role) {}
    private record HttpInfo(String endpoint, String httpMethod, String ipAddress) {}
}
