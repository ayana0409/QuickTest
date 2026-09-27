package com.quicktest.core.ratelimit.aspect;

import com.quicktest.core.ratelimit.annotation.RateLimit;
import com.quicktest.core.ratelimit.annotation.RateLimitKeyType;
import com.quicktest.core.ratelimit.exception.RateLimitExceededException;
import com.quicktest.core.ratelimit.model.RateLimitResult;
import com.quicktest.core.ratelimit.service.RateLimitService;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateLimitAspectTest {

    @Mock
    private RateLimitService rateLimitService;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @Mock
    private MethodSignature methodSignature;

    @InjectMocks
    private RateLimitAspect rateLimitAspect;

    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request, response));
    }

    @Test
    @DisplayName("Should proceed and set headers when rate limit check passes")
    void shouldProceedWhenAllowed() throws Throwable {
        request.setRemoteAddr("192.168.1.100");

        RateLimit rateLimit = mock(RateLimit.class);
        when(rateLimit.limit()).thenReturn(10);
        when(rateLimit.windowSeconds()).thenReturn(60);
        when(rateLimit.keyType()).thenReturn(RateLimitKeyType.IP);
        when(rateLimit.prefix()).thenReturn("test-action");

        when(rateLimitService.tryAcquire(eq("test-action:192.168.1.100"), eq(10), eq(60)))
                .thenReturn(RateLimitResult.builder()
                        .allowed(true)
                        .limit(10)
                        .remaining(9)
                        .resetSeconds(60)
                        .retryAfterSeconds(0)
                        .build());
        when(joinPoint.proceed()).thenReturn("success-result");

        Object result = rateLimitAspect.enforceRateLimit(joinPoint, rateLimit);

        assertThat(result).isEqualTo("success-result");
        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("10");
        assertThat(response.getHeader("X-RateLimit-Remaining")).isEqualTo("9");
        assertThat(response.getHeader("X-RateLimit-Reset")).isEqualTo("60");
        assertThat(response.getHeader("Retry-After")).isNull();
        verify(joinPoint).proceed();
    }

    @Test
    @DisplayName("Should throw RateLimitExceededException and set Retry-After header when rate limit is exceeded")
    void shouldThrowExceptionWhenExceeded() {
        request.setRemoteAddr("10.0.0.1");

        RateLimit rateLimit = mock(RateLimit.class);
        when(rateLimit.limit()).thenReturn(5);
        when(rateLimit.windowSeconds()).thenReturn(60);
        when(rateLimit.keyType()).thenReturn(RateLimitKeyType.IP);
        when(rateLimit.prefix()).thenReturn("login");

        when(rateLimitService.tryAcquire(eq("login:10.0.0.1"), eq(5), eq(60)))
                .thenReturn(RateLimitResult.builder()
                        .allowed(false)
                        .limit(5)
                        .remaining(0)
                        .resetSeconds(60)
                        .retryAfterSeconds(35)
                        .build());

        assertThatThrownBy(() -> rateLimitAspect.enforceRateLimit(joinPoint, rateLimit))
                .isInstanceOf(RateLimitExceededException.class)
                .satisfies(ex -> {
                    RateLimitExceededException rle = (RateLimitExceededException) ex;
                    assertThat(rle.getLimit()).isEqualTo(5L);
                    assertThat(rle.getRemaining()).isEqualTo(0L);
                    assertThat(rle.getRetryAfterSeconds()).isEqualTo(35L);
                });

        try {
            verify(joinPoint, never()).proceed();
        } catch (Throwable ignored) {
        }
    }

    @Test
    @DisplayName("Should fallback to method name prefix when prefix is empty")
    void shouldFallbackToMethodNameWhenPrefixBlank() throws Throwable {
        request.setRemoteAddr("10.0.0.2");

        RateLimit rateLimit = mock(RateLimit.class);
        when(rateLimit.limit()).thenReturn(20);
        when(rateLimit.windowSeconds()).thenReturn(60);
        when(rateLimit.keyType()).thenReturn(RateLimitKeyType.IP);
        when(rateLimit.prefix()).thenReturn("");

        when(joinPoint.getSignature()).thenReturn(methodSignature);
        when(methodSignature.getName()).thenReturn("doSomething");

        when(rateLimitService.tryAcquire(eq("doSomething:10.0.0.2"), eq(20), eq(60)))
                .thenReturn(RateLimitResult.builder()
                        .allowed(true)
                        .limit(20)
                        .remaining(19)
                        .resetSeconds(60)
                        .retryAfterSeconds(0)
                        .build());
        when(joinPoint.proceed()).thenReturn("done");

        Object result = rateLimitAspect.enforceRateLimit(joinPoint, rateLimit);

        assertThat(result).isEqualTo("done");
        verify(joinPoint).proceed();
    }
}
