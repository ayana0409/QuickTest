package com.quicktest.core.ratelimit.service;

import com.quicktest.core.ratelimit.config.RateLimitProperties;
import com.quicktest.core.ratelimit.model.RateLimitResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RedisRateLimitServiceTest {

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    private RateLimitProperties properties;
    private RedisRateLimitServiceImpl rateLimitService;

    @BeforeEach
    void setUp() {
        properties = new RateLimitProperties();
        properties.setEnabled(true);
        rateLimitService = new RedisRateLimitServiceImpl(stringRedisTemplate, properties);
    }

    @Test
    @DisplayName("tryAcquire should allow request when quota is available")
    void shouldAllowRequestWhenUnderLimit() {
        // Mock script return: { allowed=1, limit=5, remaining=4, windowSeconds=60, retryAfter=0 }
        List<Long> mockScriptResult = List.of(1L, 5L, 4L, 60L, 0L);

        when(stringRedisTemplate.execute(
                any(RedisScript.class),
                ArgumentMatchers.<List<String>>any(),
                any(Object[].class)
        )).thenReturn(mockScriptResult);

        RateLimitResult result = rateLimitService.tryAcquire("test-key", 5, 60);

        assertThat(result.isAllowed()).isTrue();
        assertThat(result.getLimit()).isEqualTo(5L);
        assertThat(result.getRemaining()).isEqualTo(4L);
        assertThat(result.getResetSeconds()).isEqualTo(60L);
        assertThat(result.getRetryAfterSeconds()).isEqualTo(0L);
    }

    @Test
    @DisplayName("tryAcquire should block request when quota is exceeded")
    void shouldBlockRequestWhenLimitExceeded() {
        // Mock script return: { allowed=0, limit=5, remaining=0, windowSeconds=60, retryAfter=45 }
        List<Long> mockScriptResult = List.of(0L, 5L, 0L, 60L, 45L);

        when(stringRedisTemplate.execute(
                any(RedisScript.class),
                ArgumentMatchers.<List<String>>any(),
                any(Object[].class)
        )).thenReturn(mockScriptResult);

        RateLimitResult result = rateLimitService.tryAcquire("test-key", 5, 60);

        assertThat(result.isAllowed()).isFalse();
        assertThat(result.getLimit()).isEqualTo(5L);
        assertThat(result.getRemaining()).isEqualTo(0L);
        assertThat(result.getRetryAfterSeconds()).isEqualTo(45L);
    }

    @Test
    @DisplayName("tryAcquire should fail-open when Redis throws connection exception")
    void shouldFailOpenWhenRedisThrowsException() {
        when(stringRedisTemplate.execute(
                any(RedisScript.class),
                ArgumentMatchers.<List<String>>any(),
                any(Object[].class)
        )).thenThrow(new RuntimeException("Redis connection timed out"));

        RateLimitResult result = rateLimitService.tryAcquire("critical-key", 5, 60);

        // Fail-open: Must allow request so active exams are not interrupted
        assertThat(result.isAllowed()).isTrue();
        assertThat(result.getLimit()).isEqualTo(5L);
        assertThat(result.getRemaining()).isEqualTo(5L);
    }

    @Test
    @DisplayName("tryAcquire should bypass checks when rate limiting is disabled globally")
    void shouldBypassWhenRateLimitingDisabled() {
        properties.setEnabled(false);

        RateLimitResult result = rateLimitService.tryAcquire("test-key", 5, 60);

        assertThat(result.isAllowed()).isTrue();
        verifyNoInteractions(stringRedisTemplate);
    }

    @Test
    @DisplayName("reset should invoke Redis delete on the corresponding rate limit key")
    void shouldDeleteKeyOnReset() {
        rateLimitService.reset("user:123");

        verify(stringRedisTemplate).delete("rate_limit:user:123");
    }
}
