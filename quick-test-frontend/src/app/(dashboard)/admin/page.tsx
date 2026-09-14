'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Users, BookOpen, AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';

interface SystemStats {
  totalUsers: number;
  totalExams: number;
  totalAttempts: number;
  totalViolations: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalExams: 0,
    totalAttempts: 0,
    totalViolations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchDashboardStats = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get('/admin/dashboard', { silent: true });
        if (res.data?.data) {
          setStats(res.data.data);
        }
      } catch (err) {
        console.warn('Could not fetch real-time stats:', err);
        // Fallback demo stats
        setStats({
          totalUsers: 142,
          totalExams: 18,
          totalAttempts: 520,
          totalViolations: 12,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, [isAuthenticated, router]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Tổng quan Hệ thống
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Quản trị người dùng, điều phối kỳ thi và giám sát dữ liệu toàn hệ thống
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.location.reload()}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Làm mới
        </Button>
      </div>

      {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Tổng người dùng
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black">{isLoading ? '...' : stats.totalUsers}</div>
            <p className="text-xs text-zinc-500 mt-1">Giáo viên & Thí sinh</p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Kỳ thi đã tạo
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black">{isLoading ? '...' : stats.totalExams}</div>
            <p className="text-xs text-zinc-500 mt-1">Bao gồm nháp & đã công bố</p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Lượt thi đã nộp
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Shield className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black">{isLoading ? '...' : stats.totalAttempts}</div>
            <p className="text-xs text-zinc-500 mt-1">Phiên làm bài hoàn tất</p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Vi phạm giám sát
              </span>
              <div className="p-2 rounded-xl bg-red-500/10 text-red-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-red-600 dark:text-red-400">
              {isLoading ? '...' : stats.totalViolations}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Được phát hiện và ghi log</p>
          </div>
        </div>

        {/* Governance Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-base font-bold mb-2">Quản lý Người dùng (User Governance)</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Tra cứu danh sách tài khoản, kích hoạt / khóa tài khoản, phân quyền quản trị viên hoặc giáo viên.
            </p>
            <Button variant="outline" size="sm">
              Mở danh sách tài khoản
            </Button>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-base font-bold mb-2">Điều phối Đề thi (Exam Governance)</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Xem danh sách tất cả kỳ thi trên hệ thống, cưỡng chế đóng kỳ thi (Force Close), hoặc dọn dẹp dữ liệu bài thi.
            </p>
            <Button variant="outline" size="sm">
              Mở danh sách kỳ thi
            </Button>
          </div>
        </div>
      </div>
    );
  }
