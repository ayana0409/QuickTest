'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
import toast from 'react-hot-toast';
import type { ApiResponse, LoginResponse } from '@/types/auth';

interface FormErrors {
  usernameOrEmail?: string;
  password?: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || searchParams.get('redirect');

  const { login } = useAuthStore();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

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
    if (errors.usernameOrEmail) {
      setErrors((prev) => ({ ...prev, usernameOrEmail: undefined }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Run custom validations without using browser default validation
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post<ApiResponse<LoginResponse>>(
        '/auth/login',
        {
          usernameOrEmail: usernameOrEmail.trim(),
          password,
        },
        {
          successMessage: 'Đăng nhập thành công!',
        }
      );

      if (response.data && response.data.data) {
        const { accessToken, refreshToken, userInfo } = response.data.data;

        // Check if account is deactivated or locked
        if (userInfo.isActive === false) {
          toast.error('Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt. Vui lòng liên hệ quản trị viên.');
          return;
        }

        login(accessToken, refreshToken, userInfo);

        if (callbackUrl) {
          router.push(callbackUrl);
          return;
        }

        // Determine destination by assigned roles
        const userRoles: string[] =
          Array.isArray(userInfo.roles) && userInfo.roles.length > 0
            ? userInfo.roles
            : userInfo.role
            ? [userInfo.role]
            : [];

        const normalizedRoles = userRoles.map((r) => r.replace(/^ROLE_/, '').toUpperCase());

        if (normalizedRoles.includes('ADMIN')) {
          router.push('/admin');
        } else if (normalizedRoles.includes('TEACHER')) {
          router.push('/teacher/exams');
        } else {
          router.push('/');
        }
      }
    } catch {
      // Error notifications are handled automatically by the Axios interceptor
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
          placeholder="admin, teacher_demo hoặc email..."
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

      <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-center text-xs text-zinc-500">
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
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-600/30">
              Q
            </div>
            <span className="font-bold text-2xl tracking-tight text-zinc-900 dark:text-zinc-100">
              Quick<span className="text-indigo-600">Test</span>
            </span>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Đăng nhập hệ thống
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Nhập thông tin tài khoản để truy cập kỳ thi và trang quản lý
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
