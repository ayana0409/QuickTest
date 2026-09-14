/**
 * Role definitions matching Spring Boot backend Role enum and Spring Security authorities.
 */
export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'ROLE_ADMIN' | 'ROLE_TEACHER' | 'ROLE_STUDENT';

/**
 * Supported authentication identity providers.
 */
export type AuthProvider = 'LOCAL' | 'GOOGLE' | 'GITHUB';

/**
 * User representation matching backend UserSummaryDto.
 */
export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  authProvider: AuthProvider;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

/**
 * Authentication response payload containing JWT access token and user info.
 */
export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  userInfo: User;
}

/**
 * Alias for LoginResponse.
 */
export type AuthResponse = LoginResponse;

/**
 * Login credentials request payload.
 */
export interface LoginRequest {
  usernameOrEmail: string;
  password?: string;
}

/**
 * Registration request payload.
 */
export interface RegisterRequest {
  username: string;
  email: string;
  password?: string;
  fullName: string;
  role?: 'TEACHER' | 'STUDENT';
}

/**
 * Standard API response envelope from Spring Boot backend.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}
