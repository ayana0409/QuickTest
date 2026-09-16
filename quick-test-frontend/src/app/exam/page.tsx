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
  Zap,
  LogIn,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { candidateSessionService } from '@/services/candidateSession.service';
import toast from 'react-hot-toast';

/**
 * Exam Entry Lobby Page (/exam):
 * Public portal allowing both authenticated candidates and anonymous guests
 * to join an exam using an Access Code without mandatory login.
 */
export default function ExamEntryPage() {
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
        // Cache guest credentials locally for background auto-saves and session recovery
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
        // Fallback navigate to access code route
        router.push(`/exam/${cleanCode}`);
      }
    } catch {
      // Error notifications are handled automatically by the Axios interceptor
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#0D1117] text-[#E6EDF3] selection:bg-indigo-600/30 selection:text-indigo-200">
      {/* Top Header */}
      <header className="w-full border-b border-[#30363D] bg-[#161B22]/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-indigo-600/30">
              Q
            </div>
            <span className="font-bold text-lg tracking-tight text-white">
              Quick<span className="text-indigo-400">Test</span>
            </span>
          </Link>

          <div>
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>Thí sinh:</span>
                <span className="font-semibold text-white">
                  {user.fullName || user.username}
                </span>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập tài khoản</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Center Form Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-[#161B22] border border-[#30363D] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-b-full shadow-[0_0_20px_rgba(99,102,241,0.5)]" />

          {/* Card Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-inner">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Vào phòng thi trực tuyến
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              Nhập mã phòng thi được cung cấp bởi giáo viên hoặc ban tổ chức
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
                className="font-mono tracking-widest uppercase text-base"
                autoFocus
              />
            </div>

            {/* If Authenticated: Show badge */}
            {isAuthenticated && user ? (
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-300">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span>
                    Tham gia với tài khoản:{' '}
                    <strong className="text-white">{user.fullName || user.username}</strong>
                  </span>
                </div>
                <Link href="/login" className="text-indigo-400 hover:underline">
                  Đổi tài khoản
                </Link>
              </div>
            ) : (
              /* If Anonymous Guest: Collect name & identifier */
              <div className="space-y-4 pt-2 border-t border-[#21262D]">
                <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Chế độ thí sinh tự do (Không cần đăng nhập)</span>
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
                    placeholder="Ví dụ: 2026B123 hoặc email@domain.com"
                    leftIcon={<IdCard className="w-4 h-4 text-zinc-400" />}
                    autoComplete="off"
                  />
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-zinc-500">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Dùng để bảo vệ phiên làm bài và nhận kết quả chấm điểm.</span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <Button
                type="submit"
                size="lg"
                isLoading={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 shadow-lg shadow-indigo-600/30 transition-all text-sm sm:text-base"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Bắt đầu làm bài thi
              </Button>
            </div>
          </form>

          {/* Quick Notice */}
          <div className="mt-6 pt-6 border-t border-[#21262D] text-center text-xs text-zinc-500">
            Hệ thống hỗ trợ tự động lưu bài làm và chống gian lận đa tầng trong suốt thời gian thi.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-zinc-600 border-t border-[#30363D]">
        © {new Date().getFullYear()} Quick Test. All rights reserved.
      </footer>
    </div>
  );
}
