'use client';

import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  BookOpen,
  FileCheck,
  Sparkles,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Starter landing view for the Teacher workspace (/teacher).
 * Provides immediate navigation to core teaching workflows while the full analytics dashboard is being assembled.
 */
export default function TeacherDashboardPage() {
  const { user } = useAuthStore();
  const teacherName = user?.fullName || user?.username || 'Thầy/Cô';

  const quickActions = [
    {
      title: 'Quản lý đề thi',
      description: 'Tạo đề mới, chỉnh sửa câu hỏi và theo dõi phòng thi đang mở.',
      href: '/teacher/exams',
      icon: BookOpen,
      accentClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    },
    {
      title: 'Chấm bài tự luận',
      description: 'Xem bài làm của học sinh, chấm điểm và gửi nhận xét chi tiết.',
      href: '/teacher/grading',
      icon: FileCheck,
      accentClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Tác vụ tự động',
      description: 'Theo dõi tiến trình soạn câu hỏi từ tài liệu và hỗ trợ chấm bài.',
      href: '/teacher/ai-tasks',
      icon: Sparkles,
      accentClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Welcome Banner (Double-Bezel Container) */}
      <div className="p-1.5 rounded-[2rem] bg-zinc-200/50 dark:bg-zinc-800/40 ring-1 ring-black/5 dark:ring-white/10">
        <div className="p-5 sm:p-8 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-zinc-900 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Góc giảng dạy</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Xin chào, {teacherName}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Đây là không gian tổng quan dành cho giáo viên. Thầy/Cô có thể truy cập nhanh các công việc giảng dạy bên dưới.
            </p>
          </div>

          <Link
            href="/teacher/exams/create"
            className="group inline-flex items-center justify-center gap-2.5 pl-5 pr-2 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shrink-0"
          >
            <span>Tạo đề thi mới</span>
            <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105">
              <Plus className="w-4 h-4" strokeWidth={1.75} />
            </span>
          </Link>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {quickActions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group p-1.5 rounded-[1.5rem] bg-zinc-200/40 dark:bg-zinc-800/35 ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5"
            >
              <div className="h-full p-5 rounded-[calc(1.5rem-0.375rem)] bg-white dark:bg-zinc-900 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.accentClass}`}>
                    <ActionIcon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {action.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>Mở ngay</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1" strokeWidth={1.75} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

