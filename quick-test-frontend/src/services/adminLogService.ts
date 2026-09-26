import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { PageResponse } from '@/types/exam';
import type {
  AdminSystemLog,
  AdminSystemLogDetail,
  AdminSystemLogStats,
  AdminSystemLogMetadata,
  SystemLogFilterParams,
} from '@/types/systemLog';

/**
 * Service providing administrative governance operations for system logs,
 * analytics metrics, full-text search, and retention housekeeping.
 */
export const adminLogService = {
  /**
   * Search and filter system logs with 2-step pagination.
   */
  async searchLogs(params?: SystemLogFilterParams): Promise<PageResponse<AdminSystemLog>> {
    const apiParams: Record<string, any> = { ...params };
    if (apiParams.level === 'ALL') delete apiParams.level;
    if (apiParams.status === 'ALL') delete apiParams.status;
    if (apiParams.module === 'ALL') delete apiParams.module;
    if (apiParams.action === 'ALL') delete apiParams.action;

    if (typeof apiParams.search === 'string') {
      const trimmed = apiParams.search.trim();
      if (trimmed) {
        apiParams.search = trimmed;
      } else {
        delete apiParams.search;
      }
    }

    const res = await apiClient.get<ApiResponse<PageResponse<AdminSystemLog>>>('/admin/logs', {
      params: apiParams,
    });
    return res.data.data;
  },

  /**
   * Fetch full log detail including JSON payload and error stacktrace.
   */
  async getLogDetail(id: string): Promise<AdminSystemLogDetail> {
    const res = await apiClient.get<ApiResponse<AdminSystemLogDetail>>(`/admin/logs/${id}`);
    return res.data.data;
  },

  /**
   * Fetch analytics overview metrics for KPI cards.
   */
  async getStats(): Promise<AdminSystemLogStats> {
    const res = await apiClient.get<ApiResponse<AdminSystemLogStats>>('/admin/logs/stats');
    return res.data.data;
  },

  /**
   * Fetch distinct modules and actions for dynamic filter dropdowns.
   */
  async getMetadata(): Promise<AdminSystemLogMetadata> {
    const res = await apiClient.get<ApiResponse<AdminSystemLogMetadata>>('/admin/logs/metadata');
    return res.data.data;
  },

  /**
   * Trigger retention cleanup to delete logs older than specified days.
   */
  async cleanupOldLogs(days: number): Promise<{ deletedCount: number; retentionDaysKept: number }> {
    const res = await apiClient.delete<ApiResponse<{ deletedCount: number; retentionDaysKept: number }>>(
      '/admin/logs/cleanup',
      {
        params: { days },
      }
    );
    return res.data.data;
  },
};
