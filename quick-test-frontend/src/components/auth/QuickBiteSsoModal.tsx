'use client';

import React, { useState } from 'react';
import { Utensils, X, Lock, User as UserIcon, ArrowRight, AlertCircle } from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { loginWithQuickBiteCredentials } from '@/services/quickBiteAuth.service';
import type { LoginResponse } from '@/types/auth';

interface QuickBiteSsoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: LoginResponse) => void;
}

export function QuickBiteSsoModal({ isOpen, onClose, onSuccess }: QuickBiteSsoModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
    general?: string;
  }>({});

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!username.trim()) {
      newErrors.username = 'Vui lòng nhập tên đăng nhập hoặc email';
    }
    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const data = await loginWithQuickBiteCredentials(username, password);
      onSuccess(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const serverMsg = errorObj.response?.data?.message || errorObj.message;
      setErrors({
        password: serverMsg || 'Tên đăng nhập hoặc mật khẩu không chính xác',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-orange-50/70 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/20">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Đăng nhập bằng QuickBite
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Sử dụng tài khoản QuickBite của bạn để truy cập
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Tên đăng nhập hoặc Email"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username || errors.password || errors.general) {
                  setErrors((prev) => ({ ...prev, username: undefined, general: undefined }));
                }
              }}
              error={errors.username}
              hasError={Boolean(errors.password || errors.general)}
              placeholder="Nhập tên đăng nhập hoặc email"
              leftIcon={<UserIcon className="w-4 h-4" />}
              autoComplete="username"
              disabled={isLoading}
            />

            <Input
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password || errors.general) {
                  setErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                }
              }}
              error={errors.password}
              placeholder="••••••••"
              showPasswordToggle
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete="current-password"
              disabled={isLoading}
            />

            {errors.general && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.general}</span>
              </p>
            )}

            <div className="flex gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="w-1/3"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-2/3 bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-600/20"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Đăng nhập
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
