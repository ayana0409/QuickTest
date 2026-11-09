'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  KeyRound,
  User,
  IdCard,
  ArrowRight,
  ShieldCheck,
  LogIn,
  HelpCircle,
  ChevronLeft,
} from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { candidateSessionService } from '@/services/candidateSession.service';

/**
 * Exam Entry Lobby Page (/exam):
 * Public portal allowing both authenticated candidates and anonymous guests
 * to join an exam using an Access Code without mandatory login.
 */
function ExamEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const { user, isAuthenticated } = useAuthStore();

  const [accessCode, setAccessCode] = useState(initialCode);
  const [guestName, setGuestName] = useState('');
  const [guestIdentifier, setGuestIdentifier] = useState('');
  const [errors, setErrors] = useState<{
    accessCode?: string;
    guestName?: string;
    guestIdentifier?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Sync accessCode if URL query parameter changes
  useEffect(() => {
    if (initialCode) {
      setAccessCode(initialCode.toUpperCase());
    }
  }, [initialCode]);

  // Restore cached guest data if any
  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated) {
      const savedName = localStorage.getItem('quicktest_guest_name');
      const savedId = localStorage.getItem('quicktest_guest_id');
      if (savedName) setGuestName(savedName);
      if (savedId) setGuestIdentifier(savedId);
    }
  }, [isAuthenticated]);

  const validate = (): boolean => {
    const errs: {
      accessCode?: string;
      guestName?: string;
      guestIdentifier?: string;
    } = {};

    const cleanCode = accessCode.trim().toUpperCase();
    if (!cleanCode) {
      errs.accessCode = 'Vui lòng nhập mã phòng thi';
    } else if (cleanCode.length < 4) {
      errs.accessCode = 'Mã phòng thi không hợp lệ (tối thiểu 4 ký tự)';
    }

    if (!isAuthenticated) {
      if (!guestName.trim()) {
        errs.guestName = 'Vui lòng nhập họ và tên của bạn';
      } else if (guestName.trim().length < 2) {
        errs.guestName = 'Họ và tên phải có ít nhất 2 ký tự';
      }

      if (!guestIdentifier.trim()) {
        errs.guestIdentifier = 'Vui lòng nhập Mã sinh viên, Email hoặc SĐT';
      } else if (guestIdentifier.trim().length < 3) {
        errs.guestIdentifier = 'Mã định danh phải có ít nhất 3 ký tự';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleJoinExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    const cleanCode = accessCode.trim().toUpperCase();
    const cleanName = guestName.trim();
    const cleanIdentifier = guestIdentifier.trim();

    try {
      if (!isAuthenticated) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('quicktest_guest_name', cleanName);
          localStorage.setItem('quicktest_guest_id', cleanIdentifier);
        }
      }

      const paper = await candidateSessionService.startExam({
        accessCode: cleanCode,
        guestName: !isAuthenticated ? cleanName : undefined,
        guestIdentifier: !isAuthenticated ? cleanIdentifier : undefined,
      });

      if (paper && paper.attemptId) {
        router.push(`/exam/${paper.attemptId}`);
      } else {
        router.push(`/exam/${cleanCode}`);
      }
    } catch {
      // Error notifications are handled automatically by the Axios interceptor
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Header */}
      <header className="w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 h-14 sm:h-16 flex items-center">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 transition-colors"
              title="Quay lại Trang chủ"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="QuickTest Logo"
                className="w-8 h-8 object-contain rounded-xl shadow-2xs"
              />
              <span className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">
                Quick<span className="text-indigo-600 dark:text-indigo-400">Test</span>
              </span>
            </Link>
          </div>

          <div>
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="hidden sm:inline">Thí sinh:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]">
                  {user.fullName || user.username}
                </span>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Center Form Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl shadow-zinc-900/5 relative overflow-hidden">
          {/* Top Accent Line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-b-full" />

          {/* Card Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Vào phòng thi trực tuyến
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Nhập mã phòng thi được cung cấp bởi giảng viên
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleJoinExam} noValidate className="space-y-4">
            {/* Access Code Input */}
            <div>
              <Input
                label="Mã phòng thi (Access Code) *"
                type="text"
                value={accessCode}
                onChange={(e) => {
                  setAccessCode(e.target.value.toUpperCase());
                  if (errors.accessCode) {
                    setErrors((prev) => ({ ...prev, accessCode: undefined }));
                  }
                }}
                error={errors.accessCode}
                placeholder="VD: GP8W9D"
                leftIcon={<KeyRound className="w-4 h-4 text-zinc-400" />}
                autoComplete="off"
                className="font-mono tracking-widest uppercase text-sm font-bold"
                autoFocus
              />
            </div>

            {/* If Authenticated: Show account badge */}
            {isAuthenticated && user ? (
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300 min-w-0">
                  <User className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate">
                    Tài khoản: <strong className="text-zinc-900 dark:text-zinc-100">{user.fullName || user.username}</strong>
                  </span>
                </div>
                <Link href="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline shrink-0">
                  Đổi
                </Link>
              </div>
            ) : (
              /* If Anonymous Guest: Collect name & identifier */
              <div className="space-y-3.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Thí sinh tự do (Không cần đăng nhập)</span>
                </div>

                <div>
                  <Input
                    label="Họ và tên thí sinh *"
                    type="text"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      if (errors.guestName) {
                        setErrors((prev) => ({ ...prev, guestName: undefined }));
                      }
                    }}
                    error={errors.guestName}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    leftIcon={<User className="w-4 h-4 text-zinc-400" />}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <Input
                    label="Mã định danh (MSSV / Email / SĐT) *"
                    type="text"
                    value={guestIdentifier}
                    onChange={(e) => {
                      setGuestIdentifier(e.target.value);
                      if (errors.guestIdentifier) {
                        setErrors((prev) => ({ ...prev, guestIdentifier: undefined }));
                      }
                    }}
                    error={errors.guestIdentifier}
                    placeholder="Ví dụ: B20DCCN001 hoặc email..."
                    leftIcon={<IdCard className="w-4 h-4 text-zinc-400" />}
                    autoComplete="off"
                  />
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-zinc-400">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Dùng để tự động lưu và khôi phục bài làm nếu mất kết nối.</span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                isLoading={isLoading}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 shadow-sm text-sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Bắt đầu làm bài thi
              </Button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-zinc-400 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950">
        © {new Date().getFullYear()} QuickTest Platform. All rights reserved.
      </footer>
    </div>
  );
}

export default function ExamEntryPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ExamEntryContent />
    </React.Suspense>
  );
}
