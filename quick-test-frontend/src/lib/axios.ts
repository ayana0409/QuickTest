import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import {
  getAuthCookie,
  removeAuthCookie,
  getRefreshTokenCookie,
  removeRefreshTokenCookie,
} from './cookie';
import { useAuthStore } from '@/stores/authStore';
import type { ApiResponse, LoginResponse } from '@/types/auth';

/**
 * Module augmentation to extend AxiosRequestConfig with toast and notification controls.
 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * If true, suppresses all automatic notifications (both success and error toasts).
     */
    silent?: boolean;
    /**
     * Explicitly toggle success toast display.
     * Default: true for mutating methods (POST, PUT, PATCH, DELETE) except background auth calls, false for GET.
     */
    showSuccessToast?: boolean;
    /**
     * Explicitly toggle error toast display.
     * Default: true (unless silent: true or during active token refresh).
     */
    showErrorToast?: boolean;
    /**
     * Custom success message to override response message from backend.
     */
    successMessage?: string;
    /**
     * Custom error message to override backend or HTTP status error message.
     */
    errorMessage?: string;
  }
}

/**
 * Extended configuration type for internal interceptor handling.
 */
export interface CustomAxiosConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  silent?: boolean;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Base API URL configured from environment variable or fallback to local backend.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

/**
 * Configured Axios instance for Quick Test backend communications.
 */
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Extract human-readable, user-friendly error message from AxiosError.
 */
export function extractErrorMessage(error: AxiosError): string {
  // 1. Network or timeout issues
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      return 'Yêu cầu quá thời gian chờ (Timeout). Vui lòng thử lại!';
    }
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng!';
  }

  const { status, data } = error.response;
  const payload = data as {
    message?: string;
    errors?: Record<string, string>;
    data?: Record<string, string> | unknown;
  } | undefined;

  // 2. Field validation errors (e.g. from Spring MethodArgumentNotValidException)
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    const errorMessages = Object.values(payload.data as Record<string, string>).filter(
      (msg) => typeof msg === 'string' && msg.trim().length > 0
    );
    if (errorMessages.length > 0) {
      return errorMessages.join('; ');
    }
  }

  if (payload?.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors)) {
    const errorMessages = Object.values(payload.errors).filter(
      (msg) => typeof msg === 'string' && msg.trim().length > 0
    );
    if (errorMessages.length > 0) {
      return errorMessages.join('; ');
    }
  }

  // 3. Backend explicit error message
  if (payload?.message && typeof payload.message === 'string' && payload.message.trim().length > 0) {
    return payload.message;
  }

  // 4. HTTP status code fallback messages
  switch (status) {
    case 400:
      return 'Dữ liệu yêu cầu không hợp lệ.';
    case 401:
      return 'Tên đăng nhập hoặc mật khẩu không chính xác.';
    case 403:
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 404:
      return 'Không tìm thấy tài nguyên hoặc dữ liệu yêu cầu.';
    case 409:
      return 'Dữ liệu đã tồn tại hoặc xảy ra xung đột hệ thống.';
    case 422:
      return 'Dữ liệu gửi lên không thể xử lý.';
    case 500:
      return 'Lỗi hệ thống máy chủ nội bộ. Vui lòng thử lại sau.';
    case 502:
    case 503:
    case 504:
      return 'Dịch vụ máy chủ tạm thời không khả dụng. Vui lòng thử lại sau.';
    default:
      return error.message || 'Đã xảy ra lỗi không xác định. Vui lòng thử lại!';
  }
}

/**
 * Request Interceptor: Attach JWT token from cookie (primary) or localStorage (fallback).
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    if (typeof window !== 'undefined') {
      const token =
        getAuthCookie() ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken');

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Attach guest candidate identifier header when present in localStorage
      const guestIdentifier = localStorage.getItem('quicktest_guest_id');
      if (guestIdentifier && config.headers) {
        config.headers['X-Guest-Identifier'] = guestIdentifier;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Response Interceptor: Automatic Toast notification for success/errors and token refresh.
 */
apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as CustomAxiosConfig;

    // Determine if success toast should be displayed
    const isSilent = Boolean(config.silent);
    const method = (config.method || 'GET').toUpperCase();
    const isGetMethod = method === 'GET';

    // Auto-show success toast on mutating methods (POST, PUT, PATCH, DELETE)
    // unless explicitly disabled, or when explicitly requested on GET
    const shouldShowSuccess =
      !isSilent &&
      (config.showSuccessToast === true ||
        (config.showSuccessToast !== false && !isGetMethod));

    // Exclude silent background endpoints like token refresh
    const isExcludedUrl = config.url?.includes('/auth/refresh');

    if (shouldShowSuccess && !isExcludedUrl && typeof window !== 'undefined') {
      const responseData = response.data as { message?: string } | undefined;
      const customMessage = config.successMessage;
      const backendMessage = responseData?.message;

      let messageToDisplay = customMessage || backendMessage;

      // Provide clear default message if backend returns generic "Success" or none
      if (!messageToDisplay || messageToDisplay.toLowerCase() === 'success') {
        if (method === 'DELETE') {
          messageToDisplay = 'Xóa dữ liệu thành công!';
        } else if (method === 'POST') {
          messageToDisplay = 'Tạo mới thành công!';
        } else if (method === 'PUT' || method === 'PATCH') {
          messageToDisplay = 'Cập nhật thành công!';
        } else {
          messageToDisplay = 'Thao tác thành công!';
        }
      }

      if (messageToDisplay) {
        toast.success(messageToDisplay, { id: `toast-success-${messageToDisplay}` });
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosConfig & { _retry?: boolean };

    // 1. Handle 401 Unauthorized token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Exclude authentication endpoints (/auth/login, /auth/refresh)
      const isAuthEndpoint =
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh');

      if (!isAuthEndpoint) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return apiClient(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken =
          getRefreshTokenCookie() ||
          (typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null);

        if (!refreshToken) {
          processQueue(error, null);
          handleLogout();
          if (!originalRequest.silent && originalRequest.showErrorToast !== false && typeof window !== 'undefined') {
            toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', {
              id: 'session-expired',
            });
          }
          return Promise.reject(error);
        }

        try {
          const response = await axios.post<ApiResponse<LoginResponse>>(`${BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;

          // Update tokens in Zustand store (also updates cookie & localStorage)
          useAuthStore.getState().setToken(accessToken);
          useAuthStore.getState().setRefreshToken(newRefreshToken);

          processQueue(null, accessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return apiClient(originalRequest);
        } catch (err) {
          processQueue(err as AxiosError, null);
          handleLogout();
          if (!originalRequest.silent && originalRequest.showErrorToast !== false && typeof window !== 'undefined') {
            toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', {
              id: 'session-expired',
            });
          }
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }
    }

    // 2. Automatically display error toast for failed requests
    const shouldShowError =
      !originalRequest?.silent &&
      originalRequest?.showErrorToast !== false &&
      typeof window !== 'undefined';

    if (shouldShowError) {
      const errorMessage = originalRequest?.errorMessage || extractErrorMessage(error);
      if (errorMessage) {
        toast.error(errorMessage, { id: `toast-error-${errorMessage}` });
      }
    }

    return Promise.reject(error);
  }
);

function handleLogout() {
  if (typeof window !== 'undefined') {
    removeAuthCookie();
    removeRefreshTokenCookie();
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    // Clear Zustand store state
    useAuthStore.getState().logout();

    const currentPath = window.location.pathname;
    if (
      !currentPath.startsWith('/login') &&
      !currentPath.startsWith('/register') &&
      !currentPath.startsWith('/exam')
    ) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?callbackUrl=${encodeURIComponent(currentPath)}`;
    }
  }
}

export default apiClient;
