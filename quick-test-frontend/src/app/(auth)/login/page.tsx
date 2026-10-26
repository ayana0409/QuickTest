'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LogIn, Lock, User as UserIcon, Loader2, KeyRound, AlertCircle } from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { apiClient, extractErrorMessage } from '@/lib/axios';
import type { AxiosError } from 'axios';
import type { ApiResponse, LoginResponse, User } from '@/types/auth';

interface FormErrors {
  usernameOrEmail?: string;
  password?: string;
  general?: string;
}

function getDestination(user: User | null | undefined, rawCallbackUrl: string | null): string {
  if (
    rawCallbackUrl &&
    rawCallbackUrl.startsWith('/') &&
    !rawCallbackUrl.startsWith('/login') &&
    !rawCallbackUrl.startsWith('/register')
  ) {
    return rawCallbackUrl;
  }

  const userRoles: string[] =
    Array.isArray(user?.roles) && user.roles.length > 0
      ? user.roles
      : user?.role
        ? [user.role]
        : [];

  const normalizedRoles = userRoles.map((r) => r.replace(/^ROLE_/, '').toUpperCase());

  if (normalizedRoles.includes('ADMIN')) {
    return '/admin';
  } else if (normalizedRoles.includes('TEACHER')) {
    return '/teacher/exams';
  } else {
    return '/student';
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || searchParams.get('redirect');

  const { login, isAuthenticated, user } = useAuthStore();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Auto-redirect if already authenticated (prevents staying stuck on /login?callbackUrl=...)
  React.useEffect(() => {
    if (isAuthenticated && user) {
      const destination = getDestination(user, callbackUrl);
      window.location.replace(destination);
    }
  }, [isAuthenticated, user, callbackUrl]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!usernameOrEmail.trim()) {
      newErrors.usernameOrEmail = 'Vui lòng nhập tên đăng nhập hoặc email';
    }

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsernameOrEmail(e.target.value);
    if (errors.usernameOrEmail || errors.password || errors.general) {
      setErrors((prev) => ({
        ...prev,
        usernameOrEmail: undefined,
        general: undefined,
        // Clear combined credential error on password field when user modifies username
        ...(prev.password === 'Tên đăng nhập hoặc mật khẩu không chính xác' ? { password: undefined } : {}),
      }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password || errors.general) {
      setErrors((prev) => ({
        ...prev,
        password: undefined,
        general: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Run custom validations without using browser default validation
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await apiClient.post<ApiResponse<LoginResponse>>(
        '/auth/login',
        {
          usernameOrEmail: usernameOrEmail.trim(),
          password,
        },
        {
          showErrorToast: false, // Suppress toast popups on failure; errors display below inputs
          successMessage: 'Đăng nhập thành công!',
        }
      );

      if (response.data && response.data.data) {
        const { accessToken, refreshToken, userInfo } = response.data.data;

        // Check if account is deactivated or locked
        if (userInfo.isActive === false) {
          setErrors({
            usernameOrEmail: 'Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt. Vui lòng liên hệ quản trị viên.',
          });
          setIsLoading(false);
          return;
        }

        login(accessToken, refreshToken, userInfo);

        const destination = getDestination(userInfo, callbackUrl);
        // Hard navigation ensures cookies are sent in HTTP headers and clears stale Next.js RSC router cache
        window.location.replace(destination);
        return;
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ message?: string; errors?: Record<string, string>; data?: Record<string, string> }>;
      const status = axiosError.response?.status;
      const rawMessage =
        axiosError.response?.data?.message ||
        (typeof axiosError.response?.data === 'string' ? axiosError.response?.data : '');
      const lowerRawMsg = rawMessage.toLowerCase();

      // Display specific field or inline error similar to registration page
      if (
        status === 401 ||
        lowerRawMsg.includes('invalid username') ||
        lowerRawMsg.includes('bad credentials') ||
        lowerRawMsg.includes('không chính xác')
      ) {
        setErrors({
          password: 'Tên đăng nhập hoặc mật khẩu không chính xác',
        });
      } else if (
        status === 403 ||
        lowerRawMsg.includes('deactivated') ||
        lowerRawMsg.includes('disabled') ||
        lowerRawMsg.includes('khóa') ||
        lowerRawMsg.includes('kích hoạt')
      ) {
        setErrors({
          usernameOrEmail: 'Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt. Vui lòng liên hệ quản trị viên.',
        });
      } else if (lowerRawMsg.includes('username') || lowerRawMsg.includes('tên đăng nhập')) {
        setErrors({
          usernameOrEmail: rawMessage,
        });
      } else if (lowerRawMsg.includes('password') || lowerRawMsg.includes('mật khẩu')) {
        setErrors({
          password: rawMessage,
        });
      } else {
        const fallbackMsg = extractErrorMessage(axiosError as AxiosError);
        setErrors({
          general: fallbackMsg || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Tên đăng nhập hoặc Email"
          type="text"
          value={usernameOrEmail}
          onChange={handleUsernameChange}
          error={errors.usernameOrEmail}
          hasError={Boolean(errors.password === 'Tên đăng nhập hoặc mật khẩu không chính xác')}
          placeholder="quicktest"
          leftIcon={<UserIcon className="w-4 h-4" />}
          autoComplete="username"
        />

        <Input
          label="Mật khẩu"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          error={errors.password}
          placeholder="••••••••"
          showPasswordToggle
          leftIcon={<Lock className="w-4 h-4" />}
          autoComplete="current-password"
        />

        {errors.general && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.general}</span>
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          isLoading={isLoading}
          className="w-full mt-2"
          leftIcon={<LogIn className="w-4 h-4" />}
        >
          Đăng nhập
        </Button>
      </form>

      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <Link
          href="/exam"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 text-xs font-semibold transition-all group"
        >
          <KeyRound className="w-4 h-4 text-indigo-500 group-hover:rotate-12 transition-transform" />
          <span>Làm bài thi không cần đăng nhập</span>
        </Link>
      </div>

      <div className="mt-4 text-center text-xs text-zinc-500">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="text-indigo-600 hover:text-indigo-500 font-semibold">
          Đăng ký tài khoản mới
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="QuickTest Logo"
              className="w-11 h-11 object-contain rounded-xl shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform"
            />
            <span className="font-bold text-2xl tracking-tight text-zinc-900 dark:text-zinc-100">
              Quick<span className="text-indigo-600">Test</span>
            </span>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Đăng nhập hệ thống
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Đăng nhập để truy cập các chức năng nâng cao
          </p>
        </div>

        <Suspense
          fallback={
            <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
