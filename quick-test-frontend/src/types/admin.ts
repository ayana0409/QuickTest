import { Role, AuthProvider } from './auth';

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  authProvider?: AuthProvider | 'QUICK_BITE_SSO' | string;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface AdminCreateUserRequest {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}

export interface AdminUpdateProfileRequest {
  fullName: string;
  email?: string;
  username?: string;
}

export interface AdminResetPasswordRequest {
  newPassword: string;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

import type { PageResponse } from './exam';

export interface UserFilterParams {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}
