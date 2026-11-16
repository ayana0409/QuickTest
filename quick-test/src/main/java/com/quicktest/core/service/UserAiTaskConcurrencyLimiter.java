package com.quicktest.core.service;

import com.quicktest.core.config.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.UUID;

/**
 * Service managing per-user concurrency limits for background AI tasks (grading and quiz generation).
 * Dynamically resolves max allowed concurrent tasks per user from SystemConfigService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserAiTaskConcurrencyLimiter {

    private final StringRedisTemplate stringRedisTemplate;
    private final SystemConfigService systemConfigService;

    public static final String REDIS_USER_LOCK_PREFIX = "ai:lock:user:";
    private static final int DEFAULT_SAFETY_TTL_SECONDS = 8 * 3600; // 8 hours

    public static final String CONFIG_KEY_MAX_CONCURRENT_TASKS = "gemini.max-concurrent-tasks-per-user";

    private static final String ACQUIRE_LUA_SCRIPT =
            "local key = KEYS[1]\n" +
            "local jobId = ARGV[1]\n" +
            "local maxTasks = tonumber(ARGV[2])\n" +
            "local ttl = tonumber(ARGV[3])\n" +
            "local keyType = redis.call('TYPE', key)['ok']\n" +
            "if keyType == 'string' then\n" +
            "    redis.call('DEL', key)\n" +
            "end\n" +
            "local count = redis.call('SCARD', key)\n" +
            "if count < maxTasks then\n" +
            "    redis.call('SADD', key, jobId)\n" +
            "    redis.call('EXPIRE', key, ttl)\n" +
            "    return 1\n" +
            "else\n" +
            "    return 0\n" +
            "end";

    private static final String RELEASE_LUA_SCRIPT =
            "local key = KEYS[1]\n" +
            "local jobId = ARGV[1]\n" +
            "local keyType = redis.call('TYPE', key)['ok']\n" +
            "if keyType == 'string' then\n" +
            "    redis.call('DEL', key)\n" +
            "    return 1\n" +
            "else\n" +
            "    redis.call('SREM', key, jobId)\n" +
            "    local count = redis.call('SCARD', key)\n" +
            "    if count == 0 then\n" +
            "        redis.call('DEL', key)\n" +
            "    end\n" +
            "    return 1\n" +
            "end";

    private final DefaultRedisScript<Long> acquireScript = new DefaultRedisScript<>(ACQUIRE_LUA_SCRIPT, Long.class);
    private final DefaultRedisScript<Long> releaseScript = new DefaultRedisScript<>(RELEASE_LUA_SCRIPT, Long.class);

    /**
     * Resolve dynamic limit of allowed concurrent AI background tasks per user account.
     */
    public int getMaxConcurrentTasksPerUser() {
        return Math.max(1, systemConfigService.getInteger(CONFIG_KEY_MAX_CONCURRENT_TASKS, 1));
    }

    /**
     * Atomically check and acquire a task slot for the given user.
     *
     * @param userId ID of the requesting teacher/user.
     * @param jobId  Unique job identifier.
     * @return true if slot was acquired; false if user reached their concurrency limit.
     */
    public boolean tryAcquireSlot(UUID userId, String jobId) {
        if (userId == null || jobId == null) return false;
        String userLockKey = REDIS_USER_LOCK_PREFIX + userId;
        int maxTasks = getMaxConcurrentTasksPerUser();

        try {
            Long result = stringRedisTemplate.execute(
                    acquireScript,
                    Collections.singletonList(userLockKey),
                    jobId,
                    String.valueOf(maxTasks),
                    String.valueOf(DEFAULT_SAFETY_TTL_SECONDS)
            );
            boolean acquired = result != null && result == 1L;
            if (acquired) {
                log.info("[ConcurrencyLimiter] User [{}] acquired slot for AI task [{}]. Limit: {}", userId, jobId, maxTasks);
            } else {
                log.warn("[ConcurrencyLimiter] User [{}] rejected: exceeded max concurrent AI tasks limit ({})", userId, maxTasks);
            }
            return acquired;
        } catch (Exception e) {
            log.error("[ConcurrencyLimiter] Redis error while acquiring slot for user {}: {}", userId, e.getMessage(), e);
            return true;
        }
    }

    /**
     * Release task slot previously held by this job.
     */
    public void releaseSlot(UUID userId, String jobId) {
        if (userId == null || jobId == null) return;
        String userLockKey = REDIS_USER_LOCK_PREFIX + userId;

        try {
            stringRedisTemplate.execute(
                    releaseScript,
                    Collections.singletonList(userLockKey),
                    jobId
            );
            log.info("[ConcurrencyLimiter] User [{}] released slot for AI task [{}]", userId, jobId);
        } catch (Exception e) {
            log.warn("[ConcurrencyLimiter] Failed to release slot for user {} / job {}: {}", userId, jobId, e.getMessage());
        }
    }
}
