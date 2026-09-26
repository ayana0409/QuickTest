package com.quicktest.modules.admin.service;

import com.quicktest.modules.admin.dto.SystemHealthResponse;
import com.quicktest.modules.admin.dto.SystemHealthResponse.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import oshi.SystemInfo;
import oshi.hardware.CentralProcessor;
import oshi.hardware.GlobalMemory;
import oshi.hardware.HardwareAbstractionLayer;

import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminSystemHealthServiceImpl implements AdminSystemHealthService {

    private final JdbcTemplate jdbcTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final AmqpAdmin amqpAdmin;

    private SystemInfo systemInfo;
    private HardwareAbstractionLayer hal;
    private CentralProcessor processor;
    private long[] prevTicks;

    private static final String[] QUEUES = {
            "exam.submission.queue",
            "media.upload.queue",
            "media.delete.queue",
            "exam.clone.queue",
            "ai.moderation.queue",
            "exam.submission.dlq"
    };

    @PostConstruct
    public void init() {
        this.systemInfo = new SystemInfo();
        this.hal = systemInfo.getHardware();
        this.processor = hal.getProcessor();
        this.prevTicks = processor.getSystemCpuLoadTicks();
    }

    @Override
    public SystemHealthResponse getSystemHealth() {
        DatabaseHealth dbHealth = checkDatabase();
        RedisHealth redisHealth = checkRedis();
        RabbitMqHealth rabbitHealth = checkRabbitMq();
        SystemMetrics systemMetrics = checkSystemMetrics();

        boolean allUp = "UP".equals(dbHealth.getStatus())
                && "UP".equals(redisHealth.getStatus())
                && "UP".equals(rabbitHealth.getStatus());

        return SystemHealthResponse.builder()
                .status(allUp ? "UP" : "DOWN")
                .components(Components.builder()
                        .database(dbHealth)
                        .redis(redisHealth)
                        .rabbitmq(rabbitHealth)
                        .build())
                .system(systemMetrics)
                .timestamp(Instant.now().toString())
                .build();
    }

    private DatabaseHealth checkDatabase() {
        long start = System.currentTimeMillis();
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            long latency = System.currentTimeMillis() - start;
            return DatabaseHealth.builder()
                    .status("UP")
                    .latencyMs(latency)
                    .build();
        } catch (Exception e) {
            log.error("Database health check failed", e);
            return DatabaseHealth.builder()
                    .status("DOWN")
                    .latencyMs(System.currentTimeMillis() - start)
                    .error(e.getMessage())
                    .build();
        }
    }

    private RedisHealth checkRedis() {
        long start = System.currentTimeMillis();
        try {
            String[] memoryHolder = new String[1];
            Long[] keysHolder = new Long[1];
            
            String ping = redisTemplate.execute((RedisConnection connection) -> {
                Properties info = connection.info("memory");
                if (info != null && info.getProperty("used_memory_human") != null) {
                    memoryHolder[0] = info.getProperty("used_memory_human");
                }
                keysHolder[0] = connection.dbSize();
                return connection.ping();
            });

            long latency = System.currentTimeMillis() - start;
            return RedisHealth.builder()
                    .status(ping != null ? "UP" : "DOWN")
                    .latencyMs(latency)
                    .usedMemoryHuman(memoryHolder[0] != null ? memoryHolder[0] : "N/A")
                    .totalKeys(keysHolder[0] != null ? keysHolder[0] : 0L)
                    .build();
        } catch (Exception e) {
            log.error("Redis health check failed", e);
            return RedisHealth.builder()
                    .status("DOWN")
                    .latencyMs(System.currentTimeMillis() - start)
                    .error(e.getMessage())
                    .build();
        }
    }

    private RabbitMqHealth checkRabbitMq() {
        long start = System.currentTimeMillis();
        try {
            Boolean isOpen = rabbitTemplate.execute(channel -> channel.isOpen());
            long latency = System.currentTimeMillis() - start;

            List<QueueInfo> queueInfos = new ArrayList<>();
            for (String queueName : QUEUES) {
                Properties props = amqpAdmin.getQueueProperties(queueName);
                long msgCount = 0;
                if (props != null && props.get("QUEUE_MESSAGE_COUNT") != null) {
                    msgCount = Long.parseLong(props.get("QUEUE_MESSAGE_COUNT").toString());
                }
                queueInfos.add(QueueInfo.builder()
                        .name(queueName)
                        .messageCount(msgCount)
                        .build());
            }

            return RabbitMqHealth.builder()
                    .status(Boolean.TRUE.equals(isOpen) ? "UP" : "DOWN")
                    .latencyMs(latency)
                    .queues(queueInfos)
                    .build();
        } catch (Exception e) {
            log.error("RabbitMQ health check failed", e);
            return RabbitMqHealth.builder()
                    .status("DOWN")
                    .latencyMs(System.currentTimeMillis() - start)
                    .error(e.getMessage())
                    .build();
        }
    }

    private SystemMetrics checkSystemMetrics() {
        // CPU
        double cpuLoad = processor.getSystemCpuLoadBetweenTicks(prevTicks) * 100;
        prevTicks = processor.getSystemCpuLoadTicks(); // update for next call

        // Memory
        GlobalMemory memory = hal.getMemory();
        long totalRam = memory.getTotal();
        long availableRam = memory.getAvailable();
        long usedRam = totalRam - availableRam;
        double ramUsagePercent = totalRam > 0 ? (double) usedRam / totalRam * 100 : 0;

        // Disk (Root or current dir)
        File root = new File("/");
        long totalDisk = root.getTotalSpace();
        long freeDisk = root.getFreeSpace();
        if (totalDisk == 0) {
             root = new File(".");
             totalDisk = root.getTotalSpace();
             freeDisk = root.getFreeSpace();
        }
        double diskUsagePercent = totalDisk > 0 ? (double) (totalDisk - freeDisk) / totalDisk * 100 : 0;

        return SystemMetrics.builder()
                .cpu(CpuMetrics.builder()
                        .usagePercent(Math.round(cpuLoad * 100.0) / 100.0)
                        .build())
                .ram(RamMetrics.builder()
                        .total(totalRam)
                        .used(usedRam)
                        .usagePercent(Math.round(ramUsagePercent * 100.0) / 100.0)
                        .build())
                .disk(DiskMetrics.builder()
                        .total(totalDisk)
                        .free(freeDisk)
                        .usagePercent(Math.round(diskUsagePercent * 100.0) / 100.0)
                        .build())
                .build();
    }
}
