'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, User, Mail, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';

interface RegisterFormErrors {
  fullName?: string;
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT' as 'STUDENT' | 'TEACHER',
  });

  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Custom validation logic without using browser default validation
  const validateForm = (): boolean => {
    const newErrors: RegisterFormErrors = {};

    // 1. Full name validation
    const trimmedFullName = formData.fullName.trim();
    if (!trimmedFullName) {
      newErrors.fullName = 'Vui lòng nhập họ và tên';
    } else if (trimmedFullName.length < 2) {
      newErrors.fullName = 'Họ và tên phải có ít nhất 2 ký tự';
    }

    // 2. Username validation
    const trimmedUsername = formData.username.trim();
    if (!trimmedUsername) {
      newErrors.username = 'Vui lòng nhập tên đăng nhập';
    } else if (trimmedUsername.length < 3) {
      newErrors.username = 'Tên đăng nhập phải có ít nhất 3 ký tự';
    } else if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      newErrors.username = 'Tên đăng nhập chỉ gồm chữ cái, chữ số và dấu gạch dưới (_)';
    }

    // 3. Email validation
    const trimmedEmail = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      newErrors.email = 'Vui lòng nhập địa chỉ email';
    } else if (!emailRegex.test(trimmedEmail)) {
      newErrors.email = 'Địa chỉ email không đúng định dạng (ví dụ: name@example.com)';
    }

    // 4. Password validation
    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có độ dài tối thiểu 6 ký tự';
    }

    // 5. Confirm Password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng nhập lại mật khẩu để xác nhận';
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp với mật khẩu đã nhập';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear individual field error as user types
    if (errors[field as keyof RegisterFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    // Re-check confirmPassword match if password is modified
    if (field === 'password' && formData.confirmPassword) {
      if (value !== formData.confirmPassword) {
        setErrors((prev) => ({
          ...prev,
          confirmPassword: 'Mật khẩu xác nhận không khớp với mật khẩu đã nhập',
        }));
      } else {
        setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Run custom validations
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      };

      const response = await apiClient.post<ApiResponse<unknown>>(
        '/auth/register',
        payload,
        {
          successMessage: 'Đăng ký tài khoản thành công! Đang chuyển hướng...',
        }
      );

      if (response.data?.success || response.status === 201 || response.status === 200) {
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const serverMsg = error.response?.data?.message || '';

      // Map server error to specific form fields if applicable
      const lowerMsg = serverMsg.toLowerCase();
      if (lowerMsg.includes('username') || lowerMsg.includes('tên đăng nhập')) {
        setErrors((prev) => ({ ...prev, username: serverMsg }));
      } else if (lowerMsg.includes('email')) {
        setErrors((prev) => ({ ...prev, email: serverMsg }));
      }
    } finally {
      setIsLoading(false);
    }
  };

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
            Tạo tài khoản mới
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Bắt đầu tham gia hoặc tổ chức các kỳ thi trực tuyến
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Họ và tên"
              type="text"
              value={formData.fullName}
              onChange={(e) => handleFieldChange('fullName', e.target.value)}
              error={errors.fullName}
              placeholder="Nguyễn Văn A"
              leftIcon={<User className="w-4 h-4" />}
              autoComplete="name"
            />

            <Input
              label="Tên đăng nhập"
              type="text"
              value={formData.username}
              onChange={(e) => handleFieldChange('username', e.target.value)}
              error={errors.username}
              placeholder="nguyenvana"
              leftIcon={<User className="w-4 h-4" />}
              autoComplete="username"
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              error={errors.email}
              placeholder="vana@example.com"
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
            />

            <Input
              label="Mật khẩu"
              type="password"
              value={formData.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              error={errors.password}
              placeholder="Tối thiểu 6 ký tự"
              showPasswordToggle
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete="new-password"
            />

            <Input
              label="Nhập lại mật khẩu"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              placeholder="Xác nhận lại mật khẩu vừa nhập"
              showPasswordToggle
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              autoComplete="new-password"
            />

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Vai trò người dùng
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'STUDENT' })}
                  className={`py-2.5 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                    formData.role === 'STUDENT'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-600/30'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  Thí sinh / Học sinh
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'TEACHER' })}
                  className={`py-2.5 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                    formData.role === 'TEACHER'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-600/30'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  Giáo viên / Giám thị
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-3"
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Đăng ký tài khoản
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-center text-xs text-zinc-500">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-semibold">
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
