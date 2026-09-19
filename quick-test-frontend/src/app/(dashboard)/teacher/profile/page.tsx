'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Mail,
  Shield,
  Calendar,
  Clock,
  Key,
  Copy,
  Check,
  LogOut,
  BookOpen,
  FileCheck,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
import { formatDateTime } from '@/lib/utils';
import type { ApiResponse } from '@/types/auth';
import toast from 'react-hot-toast';

interface DetailedProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roles?: string[];
  role?: string;
  authProvider?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export default function TeacherProfilePage() {
  const router = useRouter();
  const { user, activeRole, logout } = useAuthStore();
  const [profile, setProfile] = useState<DetailedProfile | null>(user as DetailedProfile | null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);

  useEffect(() => {
    async function fetchMe() {
      setIsLoading(true);
      try {
        const res = await apiClient.get<ApiResponse<DetailedProfile>>('/auth/me', {
          silent: true,
        });
        if (res.data?.data) {
          setProfile(res.data.data);
        }
      } catch {
        // Fallback to local user from authStore
      } finally {
        setIsLoading(false);
      }
    }
    fetchMe();
  }, []);

  const handleCopyId = () => {
    if (!profile?.id) return;
    navigator.clipboard.writeText(profile.id);
    setIsCopiedId(true);
    toast.success('Đã sao chép User ID!');
    setTimeout(() => setIsCopiedId(false), 2000);
  };

  const handleLogout = () => {
    logout();
    toast.success('Đăng xuất thành công');
    router.push('/login');
  };

  const displayName = profile?.fullName || user?.fullName || 'Giáo viên';
  const displayEmail = profile?.email || user?.email || 'Chưa cập nhật';
  const displayUsername = profile?.username || user?.username || 'teacher';
  const roleName = activeRole || 'TEACHER';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb Strip */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/teacher/exams" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
          Trang chủ
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          Thông tin cá nhân
        </span>
      </div>

      {/* Hero Profile Card (Double-Bezel Architecture) */}
      <div className="p-1.5 rounded-[2rem] bg-gradient-to-b from-indigo-500/10 via-zinc-100 to-zinc-100 dark:from-indigo-500/20 dark:via-zinc-900 dark:to-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
        <div className="p-6 sm:p-8 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-zinc-900/90 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar Circle */}
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg shadow-indigo-500/25">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center" title="Trạng thái: Đang hoạt động">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              {/* User Identity Info */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {displayName}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80">
                    Giáo viên (Teacher)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80">
                    Đang hoạt động
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                    @{displayUsername}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-zinc-400" />
                    {displayEmail}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/teacher/exams')}
                leftIcon={<BookOpen className="w-4 h-4 text-indigo-500" />}
              >
                Đề thi của tôi
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleLogout}
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                Đăng xuất
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Thông tin tài khoản */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Thông tin tài khoản
              </h3>
              <p className="text-[11px] text-zinc-400">
                Chi tiết định danh của bạn trên hệ thống QuickTest
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Họ và tên:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{displayName}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Tên đăng nhập:</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{displayUsername}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Email:</span>
              <div className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                <span>{displayEmail}</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[10px] font-semibold">
                  Đã xác thực
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500">Phương thức đăng nhập:</span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-[11px]">
                {profile?.authProvider || 'LOCAL'} (Mật khẩu)
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-zinc-500">User ID (UUID):</span>
              <div className="flex items-center gap-1.5">
                <code className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 truncate max-w-[160px] sm:max-w-[200px]">
                  {profile?.id || '—'}
                </code>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Sao chép User ID"
                >
                  {isCopiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Quyền hạn & Phân quyền */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Vai trò & Quyền hạn
              </h3>
              <p className="text-[11px] text-zinc-400">
                Các quyền thao tác được phân quyền cho tài khoản của bạn
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                  Vai trò chính: {roleName}
                </span>
              </div>
              <span className="text-[11px] font-mono text-indigo-500 font-bold">
                ROLE_TEACHER
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Khởi tạo và quản lý toàn diện đề thi (Soạn thảo, Xuất bản, Đóng, Nhân bản)</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Tái sử dụng câu hỏi từ Ngân hàng đề thi cá nhân (Deep-copy hình ảnh qua Queue)</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Chấm điểm câu hỏi tự luận theo barem hoặc kích hoạt AI chấm tự động</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Giám sát phòng thi thời gian thực và xuất báo cáo kết quả ra Excel (.xlsx)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Hoạt động & Nhật ký phiên */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Nhật ký & Thời gian
              </h3>
              <p className="text-[11px] text-zinc-400">
                Theo dõi mốc thời gian hoạt động tài khoản
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Ngày đăng ký tài khoản:
              </span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {profile?.createdAt ? formatDateTime(profile.createdAt) : 'Hệ thống khởi tạo'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Lần đăng nhập gần nhất:
              </span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {profile?.lastLoginAt ? formatDateTime(profile.lastLoginAt) : 'Phiên hiện tại'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                Cơ chế bảo mật:
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                JWT Bearer + Token Refresh
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Điều hướng nhanh */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Truy cập nhanh
              </h3>
              <p className="text-[11px] text-zinc-400">
                Các phân hệ chính dành cho giáo viên
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Link
              href="/teacher/exams"
              className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Quản lý đề thi (Exam Management)
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Tạo đề, cấu trúc câu hỏi, giám sát và xuất bản
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-600 transition-colors" />
            </Link>

            <Link
              href="/teacher/grading"
              className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/20 transition-all text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Chấm bài tự luận (Essay Grading)
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Chấm bài thủ công theo barem hoặc AI tự động
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-purple-600 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
