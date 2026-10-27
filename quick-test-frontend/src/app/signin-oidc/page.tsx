'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { authenticateQuickBiteCode } from '@/services/quickBiteAuth.service';
import type { User } from '@/types/auth';

function getDestination(user: User | null | undefined, rawCallbackUrl?: string | null): string {
  const userRoles: string[] =
    Array.isArray(user?.roles) && user.roles.length > 0
      ? user.roles
      : user?.role
        ? [user.role]
        : [];

  const normalizedRoles = userRoles.map((r) => r.replace(/^ROLE_/, '').toUpperCase());
  const isAdmin = normalizedRoles.includes('ADMIN');
  const isTeacher = normalizedRoles.includes('TEACHER');
  const defaultHome = isAdmin ? '/admin' : isTeacher ? '/teacher/exams' : '/student';

  if (
    rawCallbackUrl &&
    rawCallbackUrl.startsWith('/') &&
    !rawCallbackUrl.startsWith('/login') &&
    !rawCallbackUrl.startsWith('/register') &&
    !rawCallbackUrl.startsWith('/signin-oidc')
  ) {
    if (rawCallbackUrl.startsWith('/admin')) {
      return isAdmin ? rawCallbackUrl : defaultHome;
    }
    if (rawCallbackUrl.startsWith('/teacher')) {
      return (isAdmin || isTeacher) ? rawCallbackUrl : defaultHome;
    }
    return rawCallbackUrl;
  }

  return defaultHome;
}

function SigninOidcContent() {
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const processedRef = React.useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const errorParam = searchParams.get('error');
    if (errorParam) {
      setErrorMessage('Yêu cầu đăng nhập không hợp lệ hoặc đã bị hủy. Vui lòng thử lại.');
      return;
    }

    const code = searchParams.get('code');
    if (!code) {
      setErrorMessage('Không tìm thấy thông tin đăng nhập. Vui lòng thử lại.');
      return;
    }

    const redirectUri = `${window.location.origin}/signin-oidc`;

    // 15 seconds safety timeout
    const timeoutId = setTimeout(() => {
      setErrorMessage((prev) => {
        if (!prev && !isSuccess) {
          return 'Quá trình đăng nhập mất nhiều thời gian hơn dự kiến. Vui lòng thử lại!';
        }
        return prev;
      });
    }, 15000);

    // Execute code exchange directly
    authenticateQuickBiteCode(code, redirectUri)
      .then((data) => {
        clearTimeout(timeoutId);
        setIsSuccess(true);
        login(data.accessToken, data.refreshToken, data.userInfo);

        const savedCallback = sessionStorage.getItem('quickbite_sso_callback');
        sessionStorage.removeItem('quickbite_sso_callback');
        sessionStorage.removeItem('quickbite_sso_state');

        const destination = getDestination(data.userInfo, savedCallback);
        setTimeout(() => {
          window.location.replace(destination);
        }, 350);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setErrorMessage('Đăng nhập không thành công. Vui lòng thử lại!');
      });
  }, [searchParams, login, isSuccess]);

  return (
    <div className="w-full max-w-md p-1.5 rounded-3xl bg-zinc-200/60 dark:bg-zinc-800/50 backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 shadow-xl shadow-zinc-950/5">
      <div className="w-full bg-white dark:bg-zinc-900 px-8 py-10 rounded-[calc(1.5rem-0.375rem)] border border-zinc-100 dark:border-zinc-800/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] text-center">
        {errorMessage ? (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-100 dark:border-red-900/40 shadow-sm">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 tracking-tight">
                Đăng nhập không thành công
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <div className="pt-3">
              <Link href="/login" className="block w-full">
                <Button variant="outline" className="w-full h-11 rounded-xl text-sm font-medium" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Quay lại trang đăng nhập
                </Button>
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/40 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 tracking-tight">
                Đăng nhập thành công!
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Đang chuyển hướng vào hệ thống...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-3 animate-in fade-in duration-200">
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 animate-pulse" />
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 dark:text-indigo-400 relative z-10" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 tracking-tight">
                Đang đăng nhập...
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Vui lòng chờ trong giây lát
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SigninOidcPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-zinc-50 dark:bg-zinc-950">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <Loader2 className="w-6 h-6 animate-spin text-orange-600 mx-auto" />
          </div>
        }
      >
        <SigninOidcContent />
      </Suspense>
    </div>
  );
}
