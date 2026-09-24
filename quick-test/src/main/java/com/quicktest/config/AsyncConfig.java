package com.quicktest.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Async configuration providing dedicated thread pools for background tasks.
 * Separates AI moderation workload from the main application thread pool.
 */
@Slf4j
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Dedicated single-thread executor for AI content moderation jobs.
     * Uses 1 core thread and max 1 thread to guarantee at most one
     * moderation job runs at a time (serialized execution).
     * Queue capacity of 1 prevents stacking multiple pending jobs.
     */
    @Bean(name = "aiModerationExecutor")
    public Executor aiModerationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(1);
        executor.setThreadNamePrefix("ai-moderation-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(120);
        executor.initialize();
        log.info("AI Moderation thread pool executor initialized: coreSize=1, maxSize=1, queue=1");
        return executor;
    }
}
