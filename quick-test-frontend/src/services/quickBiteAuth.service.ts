import { apiClient } from '@/lib/axios';
import type { ApiResponse, LoginResponse } from '@/types/auth';

/**
 * Get QuickBite Identity Service base URL strictly from environment variables.
 * Throws an explicit error if the required variable is missing.
 */
export function getQuickBiteIdentityUrl(): string {
  const url = process.env.NEXT_PUBLIC_QUICKBITE_IDENTITY_URL;
  if (!url || !url.trim()) {
    throw new Error('Thiếu cấu hình biến môi trường: NEXT_PUBLIC_QUICKBITE_IDENTITY_URL chưa được thiết lập');
  }
  return url.trim();
}

/**
 * Get QuickBite OAuth2 Client ID strictly from environment variables.
 * Throws an explicit error if the required variable is missing.
 */
export function getQuickBiteClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_QUICKBITE_CLIENT_ID;
  if (!clientId || !clientId.trim()) {
    throw new Error('Thiếu cấu hình biến môi trường: NEXT_PUBLIC_QUICKBITE_CLIENT_ID chưa được thiết lập');
  }
  return clientId.trim();
}

/**
 * Get QuickBite OAuth2 Scope strictly from environment variables.
 * Throws an explicit error if the required variable is missing.
 */
export function getQuickBiteScope(): string {
  const scope = process.env.NEXT_PUBLIC_QUICKBITE_SCOPE;
  if (!scope || !scope.trim()) {
    throw new Error('Thiếu cấu hình biến môi trường: NEXT_PUBLIC_QUICKBITE_SCOPE chưa được thiết lập');
  }
  return scope.trim();
}

/**
 * Exchange a QuickBite SSO access token for QuickTest JWT credentials.
 */
export async function authenticateQuickBiteToken(accessToken: string): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/auth/sso/quickbite',
    { accessToken: accessToken.trim() },
    {
      showErrorToast: false,
      successMessage: 'Đăng nhập thành công!',
    }
  );

  if (!response.data?.data) {
    throw new Error('Đăng nhập không thành công. Vui lòng thử lại!');
  }

  return response.data.data;
}

/**
 * Direct login via QuickBite Identity Service credentials.
 */
export async function loginWithQuickBiteCredentials(
  username: string,
  password: string
): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/auth/sso/quickbite/login',
    {
      username: username.trim(),
      password,
    },
    {
      showErrorToast: false,
      successMessage: 'Đăng nhập thành công!',
    }
  );

  if (!response.data?.data) {
    throw new Error('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!');
  }

  return response.data.data;
}

/**
 * Exchange an OAuth2 Authorization Code from QuickBite Identity Service for QuickTest credentials.
 */
export async function authenticateQuickBiteCode(
  code: string,
  redirectUri: string
): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/auth/sso/quickbite/code',
    {
      code: code.trim(),
      redirectUri: redirectUri.trim(),
    },
    {
      showErrorToast: false,
      successMessage: 'Đăng nhập thành công!',
    }
  );

  if (!response.data?.data) {
    throw new Error('Đăng nhập không thành công. Vui lòng thử lại!');
  }

  return response.data.data;
}

/**
 * Redirect browser directly to QuickBite Identity Service authorization endpoint.
 * If user has an existing session at Identity Service, it will auto-redirect back seamlessly.
 */
export function redirectToQuickBiteLogin(callbackUrl?: string | null): void {
  const identityUrl = getQuickBiteIdentityUrl().replace(/\/+$/, '');
  const clientId = getQuickBiteClientId();
  const scope = getQuickBiteScope();
  const redirectUri = `${window.location.origin}/signin-oidc`;

  if (callbackUrl) {
    sessionStorage.setItem('quickbite_sso_callback', callbackUrl);
  } else {
    sessionStorage.removeItem('quickbite_sso_callback');
  }

  const state = Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem('quickbite_sso_state', state);

  const authUrl = `${identityUrl}/connect/authorize?client_id=${encodeURIComponent(
    clientId
  )}&response_type=code&scope=${encodeURIComponent(
    scope
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_mode=query&state=${encodeURIComponent(state)}`;

  console.log('[QuickBite SSO] Navigating to authorization URL:', authUrl);
  // Redirect directly to external QuickBite Identity Service
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = authUrl;
}

