import apiClient from '@/lib/axios';

export interface DatabaseHealth {
    status: string;
    latencyMs: number;
    error?: string;
}

export interface RedisHealth {
    status: string;
    latencyMs: number;
    usedMemoryHuman: string;
    totalKeys: number;
    error?: string;
}

export interface QueueInfo {
    name: string;
    messageCount: number;
}

export interface RabbitMqHealth {
    status: string;
    latencyMs: number;
    queues: QueueInfo[];
    error?: string;
}

export interface Components {
    database: DatabaseHealth;
    redis: RedisHealth;
    rabbitmq: RabbitMqHealth;
}

export interface CpuMetrics {
    usagePercent: number;
}

export interface RamMetrics {
    total: number;
    used: number;
    usagePercent: number;
}

export interface DiskMetrics {
    total: number;
    free: number;
    usagePercent: number;
}

export interface SystemMetrics {
    cpu: CpuMetrics;
    ram: RamMetrics;
    disk: DiskMetrics;
}

export interface SystemHealthResponse {
    status: string;
    components: Components;
    system: SystemMetrics;
    timestamp: string;
}

export const adminHealthService = {
    getSystemHealth: async (): Promise<SystemHealthResponse> => {
        const response = await apiClient.get<SystemHealthResponse>('/v1/admin/system/health', {
            silent: true
        });
        return response.data;
    }
};
