import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { PageResponse } from '@/types/exam';
import type {
  AdminUser,
  AdminCreateUserRequest,
  AdminUpdateProfileRequest,
  AdminResetPasswordRequest,
  UserFilterParams,
  UserRole,
} from '@/types/admin';

/**
 * Service providing administrative governance operations for user accounts,
 * role management, status toggling, and password resetting.
 */
export const adminService = {
  /**
   * Fetch paginated list of users with optional filtering by role, status, or search keyword.
   */
  async listUsers(params?: UserFilterParams): Promise<PageResponse<AdminUser>> {
    const apiParams: Record<string, any> = { ...params };
    if (apiParams.role === 'ALL') {
      delete apiParams.role;
    }
    if (typeof apiParams.search === 'string') {
      const trimmed = apiParams.search.trim();
      if (trimmed) {
        apiParams.search = trimmed;
      } else {
        delete apiParams.search;
      }
    }

    const res = await apiClient.get<ApiResponse<PageResponse<AdminUser>>>('/admin/users', {
      params: apiParams,
    });
    return res.data.data;
  },

  /**
   * Get detailed profile and system status of a specific user.
   */
  async getUserDetail(id: string): Promise<AdminUser> {
    const res = await apiClient.get<ApiResponse<AdminUser>>(`/admin/users/${id}`);
    return res.data.data;
  },

  /**
   * Create a new user directly with specified role and credentials.
   */
  async createUser(data: AdminCreateUserRequest): Promise<AdminUser> {
    const res = await apiClient.post<ApiResponse<AdminUser>>('/admin/users', data);
    return res.data.data;
  },

  /**
   * Update an existing user's profile details (fullName, email, username).
   */
  async updateUserProfile(id: string, data: AdminUpdateProfileRequest): Promise<AdminUser> {
    const res = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/profile`, data);
    return res.data.data;
  },

  /**
   * Reset a user's password directly (applicable to LOCAL users).
   */
  async resetUserPassword(id: string, data: AdminResetPasswordRequest): Promise<void> {
    await apiClient.put<ApiResponse<void>>(`/admin/users/${id}/password`, data);
  },

  /**
   * Toggle user active/inactive status.
   */
  async toggleUserStatus(id: string): Promise<AdminUser> {
    const res = await apiClient.patch<ApiResponse<AdminUser>>(`/admin/users/${id}/toggle-status`);
    return res.data.data;
  },

  /**
   * Update user role (ADMIN, TEACHER, STUDENT).
   */
  async updateUserRole(id: string, role: UserRole): Promise<AdminUser> {
    const res = await apiClient.patch<ApiResponse<AdminUser>>(`/admin/users/${id}/role`, { role });
    return res.data.data;
  },

  /**
   * Fetch paginated questions for admin content moderation with rich filtering.
   */
  async getModerationQuestions(
    params?: import('@/types/admin').ModerationFilterParams
  ): Promise<PageResponse<import('@/types/admin').AdminModerationQuestion>> {
    const apiParams: Record<string, any> = { ...params };
    if (typeof apiParams.search === 'string') {
      const trimmed = apiParams.search.trim();
      if (trimmed) {
        apiParams.search = trimmed;
      } else {
        delete apiParams.search;
      }
    }
    const res = await apiClient.get<ApiResponse<PageResponse<import('@/types/admin').AdminModerationQuestion>>>(
      '/admin/moderation/questions',
      { params: apiParams }
    );
    return res.data.data;
  },

  /**
   * Retrieve aggregate moderation metrics for KPI cards.
   */
  async getModerationStats(): Promise<import('@/types/admin').AdminModerationStats> {
    const res = await apiClient.get<ApiResponse<import('@/types/admin').AdminModerationStats>>(
      '/admin/moderation/stats'
    );
    return res.data.data;
  },

  /**
   * Toggle or update the safety flag for a question.
   */
  async updateQuestionSafety(
    id: string,
    isSafe: boolean
  ): Promise<import('@/types/admin').AdminModerationQuestion> {
    const res = await apiClient.patch<ApiResponse<import('@/types/admin').AdminModerationQuestion>>(
      `/admin/moderation/questions/${id}/safety`,
      { isSafe }
    );
    return res.data.data;
  },

  /**
   * Permanently delete an unsafe or policy-violating question.
   */
  async deleteModerationQuestion(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`/admin/moderation/questions/${id}`);
  },

  /**
   * Trigger an asynchronous background AI moderation job.
   */
  async triggerAiModeration(): Promise<import('@/types/admin').AiModerationJobStatusResponse> {
    const res = await apiClient.post<ApiResponse<import('@/types/admin').AiModerationJobStatusResponse>>(
      '/admin/moderation/ai-run'
    );
    return res.data.data;
  },

  /**
   * Get the current status and metrics of the AI moderation background job.
   * Suppresses automatic notifications during polling.
   */
  async getAiModerationStatus(): Promise<import('@/types/admin').AiModerationJobStatusResponse> {
    const res = await apiClient.get<ApiResponse<import('@/types/admin').AiModerationJobStatusResponse>>(
      '/admin/moderation/ai-status',
      { silent: true } as any
    );
    return res.data.data;
  },

  /**
   * Reset the AI moderation cursor to process from the beginning.
   */
  async resetAiModerationCursor(): Promise<void> {
    await apiClient.delete<ApiResponse<void>>('/admin/moderation/ai-cursor');
  },
};

