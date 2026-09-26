package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemHealthResponse {
    private String status;
    private Components components;
    private SystemMetrics system;
    private String timestamp;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Components {
        private DatabaseHealth database;
        private RedisHealth redis;
        private RabbitMqHealth rabbitmq;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DatabaseHealth {
        private String status;
        private Long latencyMs;
        private String error;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RedisHealth {
        private String status;
        private Long latencyMs;
        private String usedMemoryHuman;
        private Long totalKeys;
        private String error;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RabbitMqHealth {
        private String status;
        private Long latencyMs;
        private List<QueueInfo> queues;
        private String error;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QueueInfo {
        private String name;
        private Long messageCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SystemMetrics {
        private CpuMetrics cpu;
        private RamMetrics ram;
        private DiskMetrics disk;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CpuMetrics {
        private Double usagePercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RamMetrics {
        private Long total;
        private Long used;
        private Double usagePercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiskMetrics {
        private Long total;
        private Long free;
        private Double usagePercent;
    }
}
