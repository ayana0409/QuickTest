import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { SystemConfigItem, SystemConfigUpdateRequest } from '@/types/systemConfig';

/**
 * Service managing system-wide dynamic configuration parameters.
 */
export const systemConfigService = {
  /**
   * Retrieve all configured and registered system configurations.
   */
  async getAllConfigs(): Promise<SystemConfigItem[]> {
    const res = await apiClient.get<ApiResponse<SystemConfigItem[]>>('/admin/configs');
    return res.data.data;
  },

  /**
   * Retrieve details for a specific configuration parameter by key.
   */
  async getConfig(key: string): Promise<SystemConfigItem> {
    const res = await apiClient.get<ApiResponse<SystemConfigItem>>(`/admin/configs/${encodeURIComponent(key)}`);
    return res.data.data;
  },

  /**
   * Update configuration value in Database and Redis.
   */
  async updateConfig(key: string, value: string): Promise<SystemConfigItem> {
    const payload: SystemConfigUpdateRequest = { value };
    const res = await apiClient.put<ApiResponse<SystemConfigItem>>(
      `/admin/configs/${encodeURIComponent(key)}`,
      payload,
      { successMessage: 'Đã lưu thay đổi thành công!' }
    );
    return res.data.data;
  },

  /**
   * Reset configuration to default by evicting from DB and Redis.
   */
  async resetConfig(key: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(
      `/admin/configs/${encodeURIComponent(key)}/reset`,
      { successMessage: 'Đã đặt lại về cài đặt mặc định!' }
    );
  },

  /**
   * Refresh and sync Redis cache with current Database state.
   */
  async refreshCache(): Promise<void> {
    await apiClient.post<ApiResponse<void>>(
      '/admin/configs/refresh-cache',
      {},
      { successMessage: 'Đã làm mới dữ liệu hệ thống!' }
    );
  },
};
