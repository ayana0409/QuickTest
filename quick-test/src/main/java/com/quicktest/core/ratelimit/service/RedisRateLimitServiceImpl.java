package com.quicktest.core.ratelimit.service;

import com.quicktest.core.ratelimit.config.RateLimitProperties;
import com.quicktest.core.ratelimit.model.RateLimitResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Distributed rate limiting service backed by Redis and atomic Lua script.
 * Implements sliding window counter using Redis Sorted Set (ZSET).
 */
@Slf4j
@Service
public class RedisRateLimitServiceImpl implements RateLimitService {

    private final StringRedisTemplate stringRedisTemplate;
    private final RateLimitProperties properties;
    private final RedisScript<List> rateLimitScript;

    private static final String LUA_SLIDING_WINDOW_SCRIPT =
            "local key = KEYS[1]\n" +
            "local now = tonumber(ARGV[1])\n" +
            "local windowSeconds = tonumber(ARGV[2])\n" +
            "local limit = tonumber(ARGV[3])\n" +
            "local member = ARGV[4]\n" +
            "local windowMillis = windowSeconds * 1000\n" +
            "local clearBefore = now - windowMillis\n" +
            "\n" +
            "-- 1. Clear requests outside the current sliding window\n" +
            "redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)\n" +
            "\n" +
            "-- 2. Count active requests within the window\n" +
            "local currentRequests = redis.call('ZCARD', key)\n" +
            "\n" +
            "if currentRequests < limit then\n" +
            "    -- Request allowed: register entry\n" +
            "    redis.call('ZADD', key, now, member)\n" +
            "    redis.call('EXPIRE', key, windowSeconds + 1)\n" +
            "    local remaining = limit - currentRequests - 1\n" +
            "    return { 1, limit, remaining, windowSeconds, 0 }\n" +
            "else\n" +
            "    -- Request exceeded: calculate retry-after duration\n" +
            "    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')\n" +
            "    local retryAfter = windowSeconds\n" +
            "    if oldest and #oldest >= 2 then\n" +
            "        local oldestTimestamp = tonumber(oldest[2])\n" +
            "        local diff = math.ceil((oldestTimestamp + windowMillis - now) / 1000)\n" +
            "        if diff > 0 then\n" +
            "            retryAfter = diff\n" +
            "        else\n" +
            "            retryAfter = 1\n" +
            "        end\n" +
            "    end\n" +
            "    return { 0, limit, 0, windowSeconds, retryAfter }\n" +
            "end";

    public RedisRateLimitServiceImpl(StringRedisTemplate stringRedisTemplate, RateLimitProperties properties) {
        this.stringRedisTemplate = stringRedisTemplate;
        this.properties = properties;
        this.rateLimitScript = new DefaultRedisScript<>(LUA_SLIDING_WINDOW_SCRIPT, List.class);
    }

    @Override
    public RateLimitResult tryAcquire(String key, int limit, int windowSeconds) {
        if (!properties.isEnabled() || limit <= 0 || windowSeconds <= 0) {
            return RateLimitResult.builder()
                    .allowed(true)
                    .limit(limit)
                    .remaining(limit)
                    .resetSeconds(windowSeconds)
                    .retryAfterSeconds(0)
                    .build();
        }

        long now = System.currentTimeMillis();
        String member = now + ":" + UUID.randomUUID().toString().substring(0, 8);
        String redisKey = "rate_limit:" + key;

        try {
            List<?> results = stringRedisTemplate.execute(
                    rateLimitScript,
                    Collections.singletonList(redisKey),
                    String.valueOf(now),
                    String.valueOf(windowSeconds),
                    String.valueOf(limit),
                    member
            );

            if (results != null && results.size() >= 5) {
                boolean allowed = toLong(results.get(0)) == 1L;
                long resultLimit = toLong(results.get(1));
                long remaining = toLong(results.get(2));
                long resetSeconds = toLong(results.get(3));
                long retryAfter = toLong(results.get(4));

                return RateLimitResult.builder()
                        .allowed(allowed)
                        .limit(resultLimit)
                        .remaining(remaining)
                        .resetSeconds(resetSeconds)
                        .retryAfterSeconds(retryAfter)
                        .build();
            }

            // Fallback if script returned unexpected shape
            return RateLimitResult.builder()
                    .allowed(true)
                    .limit(limit)
                    .remaining(limit)
                    .resetSeconds(windowSeconds)
                    .retryAfterSeconds(0)
                    .build();

        } catch (Exception ex) {
            // Fail-open: log warning but do not interrupt users (e.g. students in active exam)
            log.error("Redis rate limit check failed for key '{}'. Failing open. Reason: {}", redisKey, ex.getMessage());
            return RateLimitResult.builder()
                    .allowed(true)
                    .limit(limit)
                    .remaining(limit)
                    .resetSeconds(windowSeconds)
                    .retryAfterSeconds(0)
                    .build();
        }
    }

    @Override
    public void reset(String key) {
        try {
            stringRedisTemplate.delete("rate_limit:" + key);
        } catch (Exception ex) {
            log.warn("Failed to reset rate limit for key 'rate_limit:{}': {}", key, ex.getMessage());
        }
    }

    private long toLong(Object obj) {
        if (obj instanceof Number num) {
            return num.longValue();
        }
        if (obj != null) {
            try {
                return Long.parseLong(obj.toString());
            } catch (NumberFormatException ignored) {
            }
        }
        return 0L;
    }
}
