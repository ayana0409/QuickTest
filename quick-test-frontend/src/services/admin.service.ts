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
};
