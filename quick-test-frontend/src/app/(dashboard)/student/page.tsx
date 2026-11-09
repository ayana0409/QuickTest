'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  KeyRound,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  BookOpen,
  Award,
  Play,
  RotateCcw,
  Search,
  RefreshCw,
  Flame,
  ChevronRight,
  User,
  Compass,
  X,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { studentService } from '@/services/student.service';
import { candidateSessionService } from '@/services/candidateSession.service';
import type { StudentDashboardResponse, StudentExamCardDto } from '@/types/exam';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

/**
 * Format timestamp into standard Vietnamese local time string.
 */
function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [dashboardData, setDashboardData] = useState<StudentDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [accessCode, setAccessCode] = useState<string>('');
  const [isSubmittingCode, setIsSubmittingCode] = useState<boolean>(false);
  const [startingExamCode, setStartingExamCode] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'MY_EXAMS' | 'EXPLORE'>('MY_EXAMS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'ACTIVE_SESSION'>('ALL');

  /**
   * Fetch authenticated student dashboard telemetry from backend.
   */
  const loadDashboard = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const data = await studentService.getStudentDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load student dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /**
   * Quick join room / paper by direct access code.
   */
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim().toUpperCase();

    if (!cleanCode) {
      toast.error('Vui lòng nhập mã phòng thi hoặc mã đề');
      return;
    }

    setIsSubmittingCode(true);

    try {
      const paper = await candidateSessionService.startExam({ accessCode: cleanCode });
      if (paper && paper.attemptId) {
        router.push(`/exam/${paper.attemptId}`);
      } else {
        router.push(`/exam/${cleanCode.toLowerCase()}`);
      }
    } catch {
      // Axios interceptor handles error notifications
    } finally {
      setIsSubmittingCode(false);
    }
  };

  /**
   * Start or retake an exam directly from an exam card.
   */
  const handleStartExam = async (card: StudentExamCardDto) => {
    if (card.hasActiveSession && card.activeAttemptId) {
      router.push(`/exam/${card.activeAttemptId}`);
      return;
    }

    setStartingExamCode(card.accessCode);
    try {
      const paper = await candidateSessionService.startExam({ accessCode: card.accessCode });
      if (paper && paper.attemptId) {
        router.push(`/exam/${paper.attemptId}`);
      } else {
        router.push(`/exam/${card.accessCode.toLowerCase()}`);
      }
    } catch {
      // Handled by axios interceptor
    } finally {
      setStartingExamCode(null);
    }
  };

  /**
   * Filter and search exams based on candidate criteria.
   */
  const currentList = useMemo(() => {
    if (!dashboardData) return [];
    const sourceList = activeTab === 'MY_EXAMS' ? (dashboardData.myExams || []) : (dashboardData.exploreExams || []);

    return sourceList.filter((card) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = card.title?.toLowerCase().includes(q);
        const matchesCode = card.accessCode?.toLowerCase().includes(q);
        const matchesTeacher = card.teacherName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesTeacher) return false;
      }

      if (statusFilter === 'OPEN') return card.isOpen;
      if (statusFilter === 'CLOSED') return !card.isOpen;
      if (statusFilter === 'ACTIVE_SESSION') return card.hasActiveSession;

      return true;
    });
  }, [dashboardData, activeTab, searchQuery, statusFilter]);

  // First active in-progress attempt to spotlight at top banner
  const activeSpotlightExam = useMemo(() => {
    return dashboardData?.myExams?.find((e) => e.hasActiveSession && e.activeAttemptId);
  }, [dashboardData]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">
      {/* Compact Welcome Header & Quick Access Code Bar */}
      <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Cổng Khảo thí QuickTest</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Xin chào, {user?.fullName || user?.username || 'Thí sinh'}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Nhập mã phòng thi để bắt đầu hoặc theo dõi tiến độ các bài kiểm tra đã tham gia.
          </p>
        </div>

        {/* Quick Access Code Inline Bar */}
        <div className="w-full lg:w-96 shrink-0">
          <form
            onSubmit={handleJoinByCode}
            className="p-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center gap-2"
          >
            <div className="relative flex-1 min-w-0">
              <KeyRound className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Nhập mã phòng (VD: JAVA26)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 placeholder:normal-case text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-wider"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              isLoading={isSubmittingCode}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 px-3.5 shrink-0 shadow-2xs"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Vào thi
            </Button>
          </form>
        </div>
      </div>

      {/* Global In-Progress Session Spotlight Banner */}
      {activeSpotlightExam && (
        <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 p-3.5 sm:p-4 text-amber-950 dark:text-amber-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Flame className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Đang làm dở
                </span>
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded bg-white/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                  #{activeSpotlightExam.accessCode}
                </span>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                {activeSpotlightExam.title}
              </h3>
            </div>
          </div>

          <Button
            onClick={() => router.push(`/exam/${activeSpotlightExam.activeAttemptId}`)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 rounded-xl text-xs h-8 px-3.5 shadow-2xs"
            size="sm"
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Tiếp tục thi
          </Button>
        </div>
      )}

      {/* KPI Metrics Overview: 2x2 on Mobile, 4 columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">
              Bài thi đã làm
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
              {loading ? '—' : dashboardData?.totalExamsAttempted ?? 0}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              Tổng số đề đã tham gia
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 leading-snug">
              Đang mở thi
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {loading ? '—' : dashboardData?.openExamsCount ?? 0}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              Trong thời hạn cho phép
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400 leading-snug">
              Phiên dở dang
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 leading-tight">
              {loading ? '—' : dashboardData?.activeSessionsCount ?? 0}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              Đang làm chưa nộp bài
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-purple-600 dark:text-purple-400 leading-snug">
              Điểm trung bình
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
              {loading ? '—' : dashboardData?.averageScore != null ? `${dashboardData.averageScore}/10` : '—'}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              {dashboardData?.completedAttemptsCount
                ? `Trên ${dashboardData.completedAttemptsCount} bài đã nộp`
                : 'Chưa có bài hoàn thành'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Section: Tabs, Search & Exam Cards */}
      <div className="space-y-4">
        {/* Section Title & History Action */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Danh sách bài thi
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Kiểm tra số lượt thi còn lại, trạng thái mở đóng và kết quả
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
              title="Làm mới danh sách"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400", refreshing && "animate-spin text-indigo-600")} />
            </button>

            <Link href="/student/history">
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                className="font-semibold text-xs rounded-xl h-8 sm:h-9 px-3"
              >
                Lịch sử thi
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter Toolbar: Apple Segmented Control + Search & Status */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Apple Segmented Control */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('MY_EXAMS')}
              className={cn(
                'flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                activeTab === 'MY_EXAMS'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              )}
            >
              <span>Đã tham gia</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                {dashboardData?.myExams?.length ?? 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('EXPLORE')}
              className={cn(
                'flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                activeTab === 'EXPLORE'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              )}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Khám phá</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-zinc-200/70 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                {dashboardData?.exploreExams?.length ?? 0}
              </span>
            </button>
          </div>

          {/* Search & Status Dropdown */}
          <div className="flex items-center gap-2 flex-1 md:max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên hoặc mã đề..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shrink-0"
            >
              <option value="ALL">Tất cả</option>
              <option value="OPEN">Đang mở</option>
              <option value="CLOSED">Đã đóng</option>
              <option value="ACTIVE_SESSION">Làm dở</option>
            </select>
          </div>
        </div>

        {/* Discovery Notification Bar */}
        {activeTab === 'EXPLORE' && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">
                Đề thi công khai ngẫu nhiên từ cộng đồng.
              </span>
            </div>
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
              <span>Đổi đề</span>
            </button>
          </div>
        )}

        {/* Exam Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="w-20 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                  <div className="w-16 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                </div>
                <div className="w-3/4 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                <div className="w-1/2 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                <div className="h-9 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-2.5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              {activeTab === 'MY_EXAMS' ? <GraduationCap className="w-6 h-6" /> : <Compass className="w-6 h-6" />}
            </div>
            <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
              {activeTab === 'MY_EXAMS'
                ? 'Bạn chưa tham gia bài thi nào'
                : 'Chưa có đề thi công khai nào'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
              {activeTab === 'MY_EXAMS'
                ? 'Nhập mã phòng thi do giảng viên cung cấp ở thanh phía trên để bắt đầu.'
                : 'Hiện chưa có đề thi công khai phù hợp với bộ lọc của bạn.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {currentList.map((card) => {
              const isStartingThis = startingExamCode === card.accessCode;

              return (
                <div
                  key={card.examId}
                  className={cn(
                    'group flex flex-col justify-between rounded-2xl bg-white dark:bg-zinc-900 border p-4 sm:p-5 shadow-2xs transition-all space-y-4',
                    card.hasActiveSession
                      ? 'border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-500/20'
                      : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  )}
                >
                  <div className="space-y-3">
                    {/* Top Row: Access Code & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                        #{card.accessCode}
                      </span>

                      {card.hasActiveSession ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          Đang làm dở
                        </span>
                      ) : card.isOpen ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Đang mở
                        </span>
                      ) : card.examTimeStatus === 'UPCOMING' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                          Sắp mở
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          Đã đóng
                        </span>
                      )}
                    </div>

                    {/* Title & Teacher */}
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                        {card.title}
                      </h3>
                      {card.teacherName && (
                        <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">GV: {card.teacherName}</span>
                        </p>
                      )}
                    </div>

                    {/* Meta Info: Duration & Question Count */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{card.durationMinutes} phút</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{card.questionCount} câu</span>
                      </div>
                    </div>

                    {/* Compact Attempt Quota Box */}
                    <div className="rounded-xl p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Lượt thi:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            {card.attemptsUsed}/{card.maxAttempts}
                          </span>
                          {card.highestScore != null && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                              Cao nhất: {card.highestScore}đ
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all duration-300',
                            card.remainingAttempts > 0
                              ? 'bg-indigo-600 dark:bg-indigo-500'
                              : 'bg-zinc-400 dark:bg-zinc-500'
                          )}
                          style={{
                            width: `${Math.min(100, (card.attemptsUsed / Math.max(1, card.maxAttempts)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    {card.hasActiveSession ? (
                      <Button
                        onClick={() => handleStartExam(card)}
                        className="w-full font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs h-9 shadow-2xs"
                        size="sm"
                        leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        Tiếp tục thi
                      </Button>
                    ) : card.isOpen && card.remainingAttempts > 0 ? (
                      <Button
                        onClick={() => handleStartExam(card)}
                        isLoading={isStartingThis}
                        className="w-full font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 shadow-2xs"
                        size="sm"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        {card.attemptsUsed > 0 ? 'Thi tiếp lượt mới' : 'Bắt đầu thi'}
                      </Button>
                    ) : card.latestAttemptId ? (
                      <Link href={`/student/history/${card.latestAttemptId}`} className="block w-full">
                        <Button
                          variant="secondary"
                          className="w-full font-semibold rounded-xl text-xs h-9"
                          size="sm"
                          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                          Xem kết quả
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        disabled
                        variant="secondary"
                        className="w-full font-semibold opacity-60 rounded-xl text-xs h-9"
                        size="sm"
                      >
                        {!card.isOpen ? 'Đã đóng' : 'Hết lượt thi'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
