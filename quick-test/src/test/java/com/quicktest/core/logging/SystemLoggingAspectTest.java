package com.quicktest.core.logging;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@SuppressWarnings("null")
class SystemLoggingAspectTest {

    @Mock
    private SystemLogService systemLogService;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @Mock
    private MethodSignature methodSignature;

    private SystemLoggingAspect aspect;

    @BeforeEach
    void setUp() {
        aspect = new SystemLoggingAspect(systemLogService);
    }

    public void sampleMethod(String examTitle, int duration) {
    }

    @Test
    @DisplayName("logAnnotatedMethod: logs success with execution time and parameters")
    void logAnnotatedMethod_Success() throws Throwable {
        Method method = getClass().getMethod("sampleMethod", String.class, int.class);
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        when(methodSignature.getMethod()).thenReturn(method);
        when(joinPoint.getTarget()).thenReturn(this);
        when(joinPoint.getArgs()).thenReturn(new Object[]{"Midterm Math", 60});
        when(joinPoint.proceed()).thenReturn("SUCCESS_RESULT");
        when(systemLogService.safeSerialize(any())).thenReturn("{\"parameters\":{\"examTitle\":\"Midterm Math\"}}");

        AuditLog auditLog = mock(AuditLog.class);
        when(auditLog.module()).thenReturn("EXAM");
        when(auditLog.action()).thenReturn("CREATE_EXAM");
        when(auditLog.logParams()).thenReturn(true);
        when(auditLog.logResult()).thenReturn(false);

        Object result = aspect.logAnnotatedMethod(joinPoint, auditLog);

        assertEquals("SUCCESS_RESULT", result);

        ArgumentCaptor<SystemLog> captor = ArgumentCaptor.forClass(SystemLog.class);
        verify(systemLogService).logAsync(captor.capture());

        SystemLog captured = captor.getValue();
        assertEquals(LogLevel.INFO, captured.getLevel());
        assertEquals(LogStatus.SUCCESS, captured.getStatus());
        assertEquals("EXAM", captured.getModule());
        assertEquals("CREATE_EXAM", captured.getAction());
        assertNotNull(captured.getExecutionTimeMs());
    }

    @Test
    @DisplayName("logAnnotatedMethod: catches exception, logs ERROR status, and rethrows")
    void logAnnotatedMethod_Exception() throws Throwable {
        Method method = getClass().getMethod("sampleMethod", String.class, int.class);
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        when(methodSignature.getMethod()).thenReturn(method);
        when(joinPoint.getTarget()).thenReturn(this);
        when(joinPoint.getArgs()).thenReturn(new Object[]{"Midterm Math", 60});
        when(joinPoint.proceed()).thenThrow(new IllegalArgumentException("Invalid duration"));
        when(systemLogService.safeSerialize(any())).thenReturn("{\"error\":\"Invalid duration\"}");

        AuditLog auditLog = mock(AuditLog.class);
        when(auditLog.module()).thenReturn("EXAM");
        when(auditLog.action()).thenReturn("CREATE_EXAM");
        when(auditLog.logParams()).thenReturn(true);

        IllegalArgumentException thrown = assertThrows(IllegalArgumentException.class, () -> {
            aspect.logAnnotatedMethod(joinPoint, auditLog);
        });

        assertEquals("Invalid duration", thrown.getMessage());

        ArgumentCaptor<SystemLog> captor = ArgumentCaptor.forClass(SystemLog.class);
        verify(systemLogService).logAsync(captor.capture());

        SystemLog captured = captor.getValue();
        assertEquals(LogLevel.ERROR, captured.getLevel());
        assertEquals(LogStatus.FAILURE, captured.getStatus());
        assertEquals("EXAM", captured.getModule());
        assertEquals("CREATE_EXAM", captured.getAction());
        assertEquals("Invalid duration", captured.getErrorMessage());
    }
}
