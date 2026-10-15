import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';

export interface AiSlotMetricDto {
  slotIndex: number;
  keyId: string | null;
  keyName: string;
  maskedKey: string;
  modelName: string;
  rpmCurrent: number;
  rpmMax: number;
  tpmCurrent: number;
  tpmMax: number;
  isExhausted: boolean;
  cooldownRemainingSeconds: number;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  lastUsedAt?: string | null;
  lastError?: string | null;
}

export interface AiBackgroundJobDto {
  jobId: string;
  type: string;
  examId: string;
  examTitle: string;
  totalQuestions: number;
  totalAnswers: number;
  processedAnswers: number;
  startedAt: string;
  threadName: string;
  status?: 'PROCESSING' | 'QUEUED' | string;
}

export interface AiSystemStatusResponse {
  configSource: 'DATABASE' | 'ENV_FALLBACK';
  totalConfiguredKeys: number;
  totalSlots: number;
  availableSlots: number;
  exhaustedSlots: number;
  totalCapacityRpm: number;
  activeBackgroundJobsCount: number;
  lastReloadedAt?: string | null;
  activeBackgroundJobs: AiBackgroundJobDto[];
  slots: AiSlotMetricDto[];
}

export interface AiModelResponse {
  id: string;
  modelName: string;
  rpm: number;
  tpm: number;
  isActive: boolean;
  orderIndex: number;
}

export interface AiKeyResponse {
  id: string;
  name: string;
  maskedKey: string;
  provider: string;
  isActive: boolean;
  orderIndex: number;
  models: AiModelResponse[];
  createdAt: string;
  updatedAt?: string | null;
}

export interface AiModelCreateRequest {
  modelName: string;
  rpm: number;
  tpm: number;
  isActive?: boolean;
  orderIndex?: number;
}

export interface AiKeyCreateRequest {
  name: string;
  apiKey: string;
  provider?: string;
  isActive?: boolean;
  orderIndex?: number;
  models: AiModelCreateRequest[];
}

export interface AiKeyUpdateRequest {
  name?: string;
  apiKey?: string;
  isActive?: boolean;
  orderIndex?: number;
  models?: AiModelCreateRequest[];
}

export const aiManagementService = {
  /**
   * Fetches real-time status of AI rotation pool, active slots, Redis metrics, and background jobs.
   */
  async getSystemStatus(silent = false): Promise<AiSystemStatusResponse> {
    const res = await apiClient.get<ApiResponse<AiSystemStatusResponse>>('/admin/ai/status', {
      silent,
    } as any);
    return res.data.data;
  },

  /**
   * Fetches all registered AI API Keys and their model lists.
   */
  async getAllKeys(): Promise<AiKeyResponse[]> {
    const res = await apiClient.get<ApiResponse<AiKeyResponse[]>>('/admin/ai/keys');
    return res.data.data;
  },

  /**
   * Fetches details of a specific AI API Key.
   */
  async getKeyById(id: string): Promise<AiKeyResponse> {
    const res = await apiClient.get<ApiResponse<AiKeyResponse>>(`/admin/ai/keys/${id}`);
    return res.data.data;
  },

  /**
   * Registers a new AI API Key with model limits into DB and refreshes pool.
   */
  async createKey(data: AiKeyCreateRequest): Promise<AiKeyResponse> {
    const res = await apiClient.post<ApiResponse<AiKeyResponse>>('/admin/ai/keys', data);
    return res.data.data;
  },

  /**
   * Updates an existing AI API Key and models configuration.
   */
  async updateKey(id: string, data: AiKeyUpdateRequest): Promise<AiKeyResponse> {
    const res = await apiClient.put<ApiResponse<AiKeyResponse>>(`/admin/ai/keys/${id}`, data);
    return res.data.data;
  },

  /**
   * Deletes an AI API Key from Database and removes it from the rotation pool.
   */
  async deleteKey(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`/admin/ai/keys/${id}`);
  },

  /**
   * Toggles the active/inactive state of an AI Key.
   */
  async toggleKeyActive(id: string): Promise<AiKeyResponse> {
    const res = await apiClient.patch<ApiResponse<AiKeyResponse>>(`/admin/ai/keys/${id}/toggle`);
    return res.data.data;
  },

  /**
   * Toggles the active/inactive state of a specific AI model.
   */
  async toggleModelActive(modelId: string): Promise<AiModelResponse> {
    const res = await apiClient.patch<ApiResponse<AiModelResponse>>(`/admin/ai/models/${modelId}/toggle`);
    return res.data.data;
  },

  /**
   * Explicitly triggers an immediate rotation pool reload from Database or Env.
   */
  async reloadPool(): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/admin/ai/reload');
  },
};
