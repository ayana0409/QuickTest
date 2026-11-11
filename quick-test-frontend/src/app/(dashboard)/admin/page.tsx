'use client';

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';
import { adminService } from '@/services/admin.service';
import type { AdminDailyActivityPoint, AdminDashboardStats } from '@/types/admin';
import { formatCandidateInitials, formatViolationType } from '@/lib/formatters/statusFormatter';

type TrendViewMode = 'all' | 'attempts' | 'violations';
type BreakdownViewMode = 'attempts' | 'exams' | 'violations';

interface BreakdownSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  percent: number;
}

interface QuickDestination {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}

const subscribeNoop = () => () => {};

const QUICK_DESTINATIONS: QuickDestination[] = [
  {
    title: 'Quản lý tài khoản',
    description: 'Phân quyền và cấp mới',
    href: '/admin/users',
    icon: Users,
    accentClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  },
  {
    title: 'Kho đề thi',
    description: 'Theo dõi đề toàn trường',
    href: '/admin/exams',
    icon: BookOpen,
    accentClass: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  },
  {
    title: 'Kiểm duyệt nội dung',
    description: 'Rà soát độ an toàn đề',
    href: '/admin/moderation',
    icon: ShieldCheck,
    accentClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  {
    title: 'Trợ lý rà soát',
    description: 'Kiểm tra câu hỏi tự động',
    href: '/admin/ai',
    icon: Sparkles,
    accentClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  },
  {
    title: 'Ảnh giám sát',
    description: 'Lưu trữ và dọn dẹp ảnh',
    href: '/admin/media',
    icon: Camera,
    accentClass: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  },
  {
    title: 'Nhịp độ hệ thống',
    description: 'Tình trạng vận hành máy chủ',
    href: '/admin/health',
    icon: Activity,
    accentClass: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400',
  },
];

// Colorblind-safe palette reserving rose exclusively for proctoring alerts
const VIOLATION_SLICE_COLORS = [
  '#e11d48',
  '#f59e0b',
  '#4f46e5',
  '#0284c7',
  '#0d9488',
  '#8b5cf6',
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatRelativeTime(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'Vừa ghi nhận';
  }
  const diffMinutes = Math.floor((Date.now() - parsed.getTime()) / 60000);
  if (diffMinutes < 1) {
    return 'Vừa xong';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildPeakInsight(series: AdminDailyActivityPoint[]): string {
  if (series.length === 0) {
    return 'Chưa ghi nhận hoạt động làm bài trong 7 ngày gần đây.';
  }
  let peak = series[0];
  let totalAttempts = 0;
  let totalViolations = 0;

  for (const point of series) {
    totalAttempts += point.attemptsCount;
    totalViolations += point.violationsCount;
    if (point.attemptsCount > peak.attemptsCount) {
      peak = point;
    }
  }

  if (totalAttempts === 0 && totalViolations === 0) {
    return 'Trong 7 ngày gần nhất chưa phát sinh lượt tham gia hay cảnh báo nào.';
  }

  return `Tổng ${formatNumber(totalAttempts)} lượt tham gia tuần qua · Cao điểm ngày ${peak.label} (${formatNumber(peak.attemptsCount)} lượt).`;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, isLoggedIn } = useAuthStore();

  // Client mount guard prevents Recharts responsive container -1 sizing warnings on SSR
  const hasMounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [trendMode, setTrendMode] = useState<TrendViewMode>('all');
  const [breakdownMode, setBreakdownMode] = useState<BreakdownViewMode>('attempts');

  const isAdmin = useMemo(() => {
    const roles = user?.roles ?? [];
    return roles.some((role) => role.toUpperCase().includes('ADMIN'));
  }, [user?.roles]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated && !isLoggedIn) {
      router.replace('/login');
      return;
    }

    if (!isAdmin) {
      const roles = user?.roles ?? [];
      const isTeacher = roles.some((role) => role.toUpperCase().includes('TEACHER'));
      window.location.replace(isTeacher ? '/teacher' : '/student');
      return;
    }

    let isActive = true;

    async function loadInitialDashboard() {
      try {
        const data = await adminService.getDashboardStats(false);
        if (!isActive) return;
        setStats(data);
        setErrorMessage(null);
        setLastUpdatedAt(new Date());
      } catch {
        if (!isActive) return;
        setErrorMessage('Chưa thể kết nối để lấy số liệu tổng quan. Vui lòng thử lại sau ít phút.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialDashboard();

    return () => {
      isActive = false;
    };
  }, [isInitialized, isAuthenticated, isLoggedIn, isAdmin, user?.roles, router]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const freshData = await adminService.getDashboardStats(true);
      setStats(freshData);
      setErrorMessage(null);
      setLastUpdatedAt(new Date());
    } catch {
      setErrorMessage('Không thể làm mới số liệu lúc này. Dữ liệu bên dưới giữ nguyên ở lần tải trước.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const trendSummary = useMemo(() => {
    const series = stats?.dailyActivities ?? [];
    return {
      series,
      insight: buildPeakInsight(series),
      weeklyAttempts: series.reduce((sum, item) => sum + item.attemptsCount, 0),
      weeklySubmitted: series.reduce((sum, item) => sum + item.submittedCount, 0),
      weeklyViolations: series.reduce((sum, item) => sum + item.violationsCount, 0),
    };
  }, [stats?.dailyActivities]);

  const breakdownData = useMemo(() => {
    if (!stats) {
      return {
        total: 0,
        centerLabel: 'Tổng cộng',
        insight: '',
        slices: [] as BreakdownSlice[],
      };
    }

    let rawItems: Array<{ key: string; label: string; value: number; color: string }> = [];
    let centerLabel = 'Tổng cộng';
    let insight = '';

    if (breakdownMode === 'attempts') {
      rawItems = [
        { key: 'submitted', label: 'Đã hoàn thành', value: stats.submittedAttempts, color: '#10b981' },
        { key: 'inProgress', label: 'Đang làm bài', value: stats.inProgressAttempts, color: '#4f46e5' },
        { key: 'awaiting', label: 'Chờ chấm tay', value: stats.awaitingGradingAttempts, color: '#f59e0b' },
        { key: 'disqualified', label: 'Bị đình chỉ', value: stats.disqualifiedAttempts, color: '#e11d48' },
      ];
      centerLabel = 'Tổng lượt thi';
      const completionRate =
        stats.totalAttempts > 0
          ? Math.round((stats.submittedAttempts / stats.totalAttempts) * 100)
          : 0;
      insight = `${completionRate}% bài tham gia đã hoàn tất nộp bài.`;
    } else if (breakdownMode === 'exams') {
      rawItems = [
        { key: 'published', label: 'Đang mở thi', value: stats.publishedExams, color: '#4f46e5' },
        { key: 'closed', label: 'Đã đóng', value: stats.closedExams, color: '#0284c7' },
        { key: 'draft', label: 'Bản nháp', value: stats.draftExams, color: '#94a3b8' },
        { key: 'archived', label: 'Đã lưu trữ', value: stats.archivedExams, color: '#64748b' },
      ];
      centerLabel = 'Tổng đề thi';
      insight = `${formatNumber(stats.publishedExams)} đề đang mở cho thí sinh vào làm bài.`;
    } else {
      const entries = Object.entries(stats.violationByTypes ?? {}).sort((a, b) => b[1] - a[1]);
      rawItems = entries.map(([type, count], idx) => ({
        key: type,
        label: formatViolationType(type).label,
        value: count,
        color: VIOLATION_SLICE_COLORS[idx % VIOLATION_SLICE_COLORS.length],
      }));
      centerLabel = 'Tổng cảnh báo';
      insight =
        entries.length > 0
          ? `Phổ biến nhất: ${formatViolationType(entries[0][0]).label.toLowerCase()}.`
          : 'Các phòng thi chưa ghi nhận cảnh báo nào.';
    }

    const total = rawItems.reduce((sum, item) => sum + item.value, 0);
    const slices: BreakdownSlice[] = rawItems.map((item) => ({
      ...item,
      percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
    }));

    return { total, centerLabel, insight, slices };
  }, [stats, breakdownMode]);

  const moderationStats = useMemo(() => {
    if (!stats || stats.totalQuestions === 0) {
      return {
        safePercent: 0,
        pendingCount: 0,
      };
    }
    return {
      safePercent: Math.round((stats.safeQuestions / stats.totalQuestions) * 100),
      pendingCount: stats.unreviewedQuestions + stats.unsafeQuestions,
    };
  }, [stats]);

  if (!isInitialized || !isAdmin) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <Shield className="h-8 w-8 animate-pulse text-indigo-600 motion-reduce:animate-none" />
          <p className="text-sm font-medium">Đang xác nhận quyền quản trị...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-5 pb-10 sm:space-y-6">
      {/* Header Control Bar */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-500/15 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-400/20">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
            Điều phối hệ thống
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Tổng quan vận hành
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Nắm bắt nhanh tình hình thi trực tuyến, mức độ an toàn ngân hàng câu hỏi và các cảnh báo phòng thi cần chú ý.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {lastUpdatedAt && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100/90 px-3 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-black/5 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-white/10">
              <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              <span className="tabular-nums">
                Cập nhật lúc{' '}
                {lastUpdatedAt.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-black/10 transition-[transform,background-color,box-shadow] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:bg-zinc-900 dark:text-zinc-200 dark:ring-white/15 dark:hover:bg-zinc-800"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
            <span>{isRefreshing ? 'Đang cập nhật...' : 'Làm mới số liệu'}</span>
          </button>

          <Link
            href="/admin/users"
            className="group inline-flex items-center gap-2.5 rounded-full bg-zinc-900 py-1.5 pl-4 pr-1.5 text-sm font-medium text-white shadow-sm transition-[transform,background-color] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            <span>Quản lý tài khoản</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none">
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </header>

      {/* Inline non-duplicate error banner */}
      {errorMessage && (
        <div role="alert">
          <BentoCard innerClassName="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between bg-amber-50/70 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <p className="text-sm text-amber-900 dark:text-amber-200">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Thử lại ngay
            </button>
          </BentoCard>
        </div>
      )}

      {/* Initial Loading Skeleton */}
      {isLoading && !stats ? (
        <DashboardSkeleton />
      ) : !stats ? (
        <BentoCard innerClassName="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            <Shield className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Chưa có dữ liệu hiển thị
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Hệ thống tạm thời chưa lấy được báo cáo tổng quan. Hãy bấm nút bên dưới để tải lại số liệu mới nhất.
          </p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tải lại bảng số liệu
          </button>
        </BentoCard>
      ) : (
        <>
          {/* Row 1: 4 Headline KPIs (2x2 on mobile, 4 cols on desktop) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard
              title="Cộng đồng người dùng"
              value={formatNumber(stats.totalUsers)}
              unit="tài khoản"
              icon={Users}
              iconWrapClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
              badgeText={
                stats.newUsersLast7Days > 0
                  ? `+${formatNumber(stats.newUsersLast7Days)} trong 7 ngày`
                  : 'Ổn định tuần này'
              }
              badgeTone="neutral"
              footerLeft={`${formatNumber(stats.totalStudents)} học viên · ${formatNumber(stats.totalTeachers)} giáo viên`}
              footerRight={`${formatNumber(stats.activeUsers)} hoạt động`}
            />

            <KpiCard
              title="Kho đề và câu hỏi"
              value={formatNumber(stats.totalExams)}
              unit="đề thi"
              icon={BookOpen}
              iconWrapClass="bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400"
              badgeText={`${formatNumber(stats.publishedExams)} đang mở thi`}
              badgeTone="info"
              footerLeft={`${formatNumber(stats.totalQuestions)} câu hỏi trong kho`}
              footerRight={`${formatNumber(stats.draftExams)} bản nháp`}
            />

            <KpiCard
              title="Hoạt động làm bài"
              value={formatNumber(stats.totalAttempts)}
              unit="lượt tham gia"
              icon={FileText}
              iconWrapClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
              badgeText={
                stats.inProgressAttempts > 0
                  ? `${formatNumber(stats.inProgressAttempts)} đang thi trực tiếp`
                  : 'Chưa có ca thi mở'
              }
              badgeTone={stats.inProgressAttempts > 0 ? 'live' : 'neutral'}
              footerLeft={`Điểm TB: ${stats.averageScore > 0 ? stats.averageScore.toFixed(1) : '—'}`}
              footerRight={`${formatNumber(stats.awaitingGradingAttempts)} chờ chấm`}
            />

            <KpiCard
              title="An toàn phòng thi"
              value={formatNumber(stats.totalViolations)}
              unit="cảnh báo"
              icon={AlertTriangle}
              iconWrapClass={
                stats.totalViolations > 0
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              }
              badgeText={
                stats.disqualifiedAttempts > 0
                  ? `Đình chỉ ${formatNumber(stats.disqualifiedAttempts)} bài`
                  : 'Chưa có trường hợp đình chỉ'
              }
              badgeTone={stats.disqualifiedAttempts > 0 ? 'danger' : 'positive'}
              footerLeft={
                stats.unreviewedQuestions > 0
                  ? `${formatNumber(stats.unreviewedQuestions)} câu chờ kiểm duyệt`
                  : 'Câu hỏi đã kiểm duyệt đủ'
              }
              footerRight={`${formatNumber(stats.unsafeQuestions)} cần sửa`}
            />
          </div>

          {/* Row 2: Asymmetrical Bento Charts (8:4 on large screens) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Primary 7-day trend chart */}
            <BentoCard className="lg:col-span-8" innerClassName="flex flex-col justify-between p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
                    Nhịp độ làm bài và cảnh báo 7 ngày qua
                  </h2>
                  <p className="text-xs leading-relaxed text-zinc-500 sm:text-sm dark:text-zinc-400">
                    {trendSummary.insight}
                  </p>
                </div>

                {/* Segmented view switch */}
                <div
                  role="group"
                  aria-label="Chế độ xem xu hướng 7 ngày"
                  className="inline-flex max-w-full flex-wrap self-start rounded-full bg-zinc-100 p-1 ring-1 ring-black/5 dark:bg-zinc-800/80 dark:ring-white/10"
                >
                  {(
                    [
                      { id: 'all', label: 'Tất cả' },
                      { id: 'attempts', label: 'Lượt làm bài' },
                      { id: 'violations', label: 'Cảnh báo' },
                    ] as const
                  ).map((option) => {
                    const active = trendMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTrendMode(option.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                          active
                            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <figure className="relative mt-5 w-full min-w-0 overflow-hidden">
                <div
                  className="h-[260px] w-full min-w-0 text-zinc-500 sm:h-[300px] dark:text-zinc-400"
                  role="img"
                  aria-label={`Biểu đồ 7 ngày qua: ${formatNumber(trendSummary.weeklyAttempts)} lượt tham gia, ${formatNumber(trendSummary.weeklySubmitted)} bài hoàn thành và ${formatNumber(trendSummary.weeklyViolations)} cảnh báo.`}
                >
                  {hasMounted ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <ComposedChart
                        data={trendSummary.series}
                        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="adminAttemptsFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="adminSubmittedFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke="currentColor"
                          strokeOpacity={0.14}
                          strokeDasharray="4 4"
                        />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'currentColor', fontSize: 12 }}
                          dy={8}
                        />
                        <YAxis
                          width={34}
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'currentColor', fontSize: 12 }}
                        />
                        <Tooltip
                          cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                          content={({ active, payload, label }) => (
                            <TrendChartTooltip
                              active={active}
                              label={label}
                              payload={payload}
                            />
                          )}
                        />

                        {(trendMode === 'all' || trendMode === 'attempts') && (
                          <>
                            <Area
                              type="monotone"
                              dataKey="attemptsCount"
                              name="Lượt tham gia"
                              stroke="#4f46e5"
                              strokeWidth={2.5}
                              fill="url(#adminAttemptsFill)"
                              activeDot={{ r: 5, strokeWidth: 0, fill: '#4f46e5' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="submittedCount"
                              name="Đã hoàn thành"
                              stroke="#10b981"
                              strokeWidth={2}
                              strokeDasharray="4 3"
                              fill="url(#adminSubmittedFill)"
                              activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
                            />
                          </>
                        )}

                        {(trendMode === 'all' || trendMode === 'violations') && (
                          <Bar
                            dataKey="violationsCount"
                            name="Cảnh báo"
                            fill="#e11d48"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={26}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/60" />
                  )}
                </div>
                <figcaption className="sr-only">{trendSummary.insight}</figcaption>
                <table className="sr-only">
                  <caption>Số liệu làm bài và cảnh báo phòng thi theo từng ngày trong 7 ngày qua</caption>
                  <thead>
                    <tr>
                      <th scope="col">Ngày</th>
                      <th scope="col">Lượt tham gia</th>
                      <th scope="col">Đã hoàn thành</th>
                      <th scope="col">Cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendSummary.series.map((point) => (
                      <tr key={point.date}>
                        <td>{point.label}</td>
                        <td>{point.attemptsCount}</td>
                        <td>{point.submittedCount}</td>
                        <td>{point.violationsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>

              {/* Accessible numerical summary bar below chart */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" aria-hidden="true" />
                    Lượt tham gia: <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(trendSummary.weeklyAttempts)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    Đã nộp bài: <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(trendSummary.weeklySubmitted)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" aria-hidden="true" />
                    Cảnh báo: <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(trendSummary.weeklyViolations)}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Số liệu gộp theo ngày trong 7 ngày gần nhất
                </span>
              </div>
            </BentoCard>

            {/* Secondary Breakdown Donut Chart */}
            <BentoCard className="lg:col-span-4" innerClassName="flex flex-col justify-between p-5 sm:p-6">
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
                    Cơ cấu vận hành hiện tại
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {breakdownData.insight}
                  </p>
                </div>

                {/* Segmented category switcher */}
                <div
                  role="group"
                  aria-label="Chọn nhóm dữ liệu phân bổ"
                  className="grid grid-cols-3 rounded-full bg-zinc-100 p-1 ring-1 ring-black/5 dark:bg-zinc-800/80 dark:ring-white/10"
                >
                  {(
                    [
                      { id: 'attempts', label: 'Bài làm' },
                      { id: 'exams', label: 'Đề thi' },
                      { id: 'violations', label: 'Cảnh báo' },
                    ] as const
                  ).map((tab) => {
                    const active = breakdownMode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setBreakdownMode(tab.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                          active
                            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {breakdownData.total === 0 ? (
                <div className="my-6 flex flex-col items-center justify-center rounded-2xl bg-zinc-50/80 px-4 py-10 text-center dark:bg-zinc-800/40">
                  <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" aria-hidden="true" />
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {breakdownMode === 'violations'
                      ? 'Chưa ghi nhận cảnh báo phòng thi nào.'
                      : 'Chưa có dữ liệu trong mục này.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative mx-auto mt-3 h-[185px] w-full min-w-0 max-w-[230px]">
                    {hasMounted ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie
                            data={breakdownData.slices.filter((slice) => slice.value > 0)}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={56}
                            outerRadius={78}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {breakdownData.slices
                              .filter((slice) => slice.value > 0)
                              .map((slice) => (
                                <Cell key={slice.key} fill={slice.color} />
                              ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => (
                              <DonutChartTooltip active={active} payload={payload} />
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full animate-pulse rounded-full bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/60" />
                    )}

                    {/* Center Donut Summary */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                        {formatNumber(breakdownData.total)}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        {breakdownData.centerLabel}
                      </span>
                    </div>
                  </div>

                  {/* Accessible percentage breakdown list */}
                  <ul className="mt-2 space-y-2.5">
                    {breakdownData.slices.slice(0, 5).map((slice) => (
                      <li key={slice.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-300">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: slice.color }}
                              aria-hidden="true"
                            />
                            <span className="truncate">{slice.label}</span>
                          </span>
                          <span className="ml-2 shrink-0 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                            {formatNumber(slice.value)}{' '}
                            <span className="text-zinc-400 dark:text-zinc-500">({slice.percent}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                            style={{
                              width: `${Math.max(slice.percent, slice.value > 0 ? 4 : 0)}%`,
                              backgroundColor: slice.color,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </BentoCard>
          </div>

          {/* Row 3: Recent Violations + Moderation Progress & Quick Access (7:5 Bento) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left (7 cols): Recent Violations */}
            <BentoCard className="lg:col-span-7" innerClassName="flex flex-col justify-between p-5 sm:p-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
                      Cảnh báo phòng thi mới ghi nhận
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
                      Những dấu hiệu cần người coi thi hoặc quản trị viên kiểm tra sớm.
                    </p>
                  </div>

                  <Link
                    href="/admin/media"
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Kho ảnh giám sát</span>
                  </Link>
                </div>

                {stats.recentViolations.length === 0 ? (
                  <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 px-6 py-12 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <ShieldCheck className="mb-3 h-10 w-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Các phòng thi đang diễn ra nghiêm túc
                    </h3>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Hệ thống chưa phát hiện hành vi bất thường nào gần đây. Mọi thông số đang ở ngưỡng an toàn.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {stats.recentViolations.slice(0, 6).map((item) => {
                      const violationInfo = formatViolationType(item.violationType);
                      return (
                        <li
                          key={item.id}
                          className="flex flex-col gap-2 py-3.5 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/15 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/20">
                              {formatCandidateInitials(item.candidateName || item.candidateIdentifier)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                  {item.candidateName || item.candidateIdentifier || 'Thí sinh'}
                                </span>
                                <span className="inline-flex max-w-full items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-500/15 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/20">
                                  {violationInfo.label}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                                {item.examTitle || 'Bài thi'}
                                {item.description ? ` · ${item.description}` : ''}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 pl-12 text-xs tabular-nums text-zinc-400 sm:pl-0 dark:text-zinc-500">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Hiển thị tối đa 6 cảnh báo gần nhất trong toàn hệ thống
                </span>
                <Link
                  href="/admin/logs"
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  <span>Xem nhật ký hệ thống</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </BentoCard>

            {/* Right (5 cols): Question Moderation + Quick Access Grid */}
            <BentoCard className="lg:col-span-5" innerClassName="flex flex-col justify-between p-5 sm:p-6">
              <div className="space-y-5">
                {/* Question Bank Safety Progress */}
                <div className="rounded-2xl bg-zinc-50/90 p-4 ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Độ an toàn kho câu hỏi
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {stats.totalQuestions > 0
                          ? `Đã xác minh ${formatNumber(stats.safeQuestions)} trên ${formatNumber(stats.totalQuestions)} câu hỏi (${moderationStats.safePercent}%).`
                          : 'Chưa có câu hỏi nào trong ngân hàng đề.'}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {moderationStats.safePercent}%
                    </span>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-700/70">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 motion-reduce:transition-none"
                      style={{ width: `${moderationStats.safePercent}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">
                      Chờ kiểm duyệt: <strong className="tabular-nums">{formatNumber(stats.unreviewedQuestions)}</strong>
                      {' · '}
                      Cần chỉnh sửa: <strong className="tabular-nums text-amber-700 dark:text-amber-300">{formatNumber(stats.unsafeQuestions)}</strong>
                    </span>

                    {moderationStats.pendingCount > 0 && (
                      <Link
                        href="/admin/moderation"
                        className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:underline dark:text-indigo-400"
                      >
                        <span>Kiểm duyệt ngay</span>
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Quick Governance Destinations */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      Điều phối nhanh
                    </h2>
                    <Link
                      href="/admin/settings"
                      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Cài đặt</span>
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-2">
                    {QUICK_DESTINATIONS.map((dest) => {
                      const Icon = dest.icon;
                      return (
                        <Link
                          key={dest.href}
                          href={dest.href}
                          className="group flex min-w-0 items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white p-3 transition-[transform,border-color,box-shadow] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-indigo-500/40"
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${dest.accentClass}`}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                              {dest.title}
                            </p>
                            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                              {dest.description}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>
        </>
      )}
    </div>
  );
}

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

/**
 * Double-Bezel structural shell enclosing dashboard sections.
 * Includes physical CSS borders alongside shadows for Forced Colors Mode resilience.
 */
function BentoCard({ children, className = '', innerClassName = '' }: BentoCardProps) {
  return (
    <article
      className={`min-w-0 w-full rounded-3xl border border-zinc-200/80 bg-zinc-200/45 p-1 sm:rounded-[2rem] sm:p-1.5 dark:border-white/10 dark:bg-zinc-800/45 ${className}`}
    >
      <div
        className={`h-full min-w-0 rounded-[calc(1.5rem-0.25rem)] border border-zinc-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.18)] sm:rounded-[calc(2rem-0.375rem)] dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] ${innerClassName}`}
      >
        {children}
      </div>
    </article>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  iconWrapClass: string;
  badgeText: string;
  badgeTone: 'neutral' | 'info' | 'live' | 'positive' | 'danger';
  footerLeft: string;
  footerRight: string;
}

const KPI_BADGE_CLASSES: Record<KpiCardProps['badgeTone'], string> = {
  neutral:
    'bg-zinc-100 text-zinc-700 ring-black/5 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10',
  info: 'bg-sky-50 text-sky-700 ring-sky-500/15 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-400/20',
  live: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20',
  positive:
    'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20',
  danger:
    'bg-rose-50 text-rose-700 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-400/20',
};

function KpiCard({
  title,
  value,
  unit,
  icon: Icon,
  iconWrapClass,
  badgeText,
  badgeTone,
  footerLeft,
  footerRight,
}: KpiCardProps) {
  return (
    <BentoCard innerClassName="flex flex-col justify-between p-3.5 sm:p-5">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-xs font-semibold leading-snug text-zinc-600 sm:text-sm dark:text-zinc-300">
            {title}
          </h2>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${iconWrapClass}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {value}
          </span>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{unit}</span>
        </div>

        <div className="mt-2.5">
          <span
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${KPI_BADGE_CLASSES[badgeTone]}`}
          >
            {badgeTone === 'live' && (
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
            )}
            <span className="truncate">{badgeText}</span>
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex min-w-0 flex-col gap-0.5 border-t border-zinc-100 pt-2.5 text-[11px] text-zinc-500 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-1 dark:border-zinc-800 dark:text-zinc-400">
        <span className="min-w-0 break-words">{footerLeft}</span>
        <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">{footerRight}</span>
      </div>
    </BentoCard>
  );
}

interface TooltipPayloadItem {
  name?: string | number;
  value?: number | string | ReadonlyArray<string | number>;
  color?: string;
}

function formatTooltipValue(value: TooltipPayloadItem['value']): string {
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  if (Array.isArray(value)) {
    return value.join(' - ');
  }
  return String(value ?? 0);
}

function TrendChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/10 dark:bg-zinc-900/95 dark:ring-white/15">
      <p className="mb-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-50">
        Ngày {String(label ?? '')}
      </p>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={`${String(entry.name)}-${idx}`} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || '#4f46e5' }}
                aria-hidden="true"
              />
              {String(entry.name ?? '')}
            </span>
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatTooltipValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0];
  return (
    <div className="rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg ring-1 ring-black/10 dark:bg-zinc-900/95 dark:ring-white/15">
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{String(item.name ?? '')}</p>
      <p className="mt-0.5 tabular-nums text-zinc-600 dark:text-zinc-300">
        Số lượng: <strong>{formatTooltipValue(item.value)}</strong>
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[1, 2, 3, 4].map((index) => (
          <BentoCard key={index} innerClassName="p-3.5 sm:p-5">
            <div className="h-4 w-full max-w-[7rem] animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
            <div className="mt-4 h-8 w-full max-w-[5rem] animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
            <div className="mt-3 h-5 w-full max-w-[8rem] animate-pulse rounded-full bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/70" />
          </BentoCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <BentoCard className="lg:col-span-8" innerClassName="p-5 sm:p-6">
          <div className="h-5 w-full max-w-[14rem] animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
          <div className="mt-5 h-[280px] w-full animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/60" />
        </BentoCard>
        <BentoCard className="lg:col-span-4" innerClassName="p-5 sm:p-6">
          <div className="h-5 w-full max-w-[10rem] animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
          <div className="mt-5 h-[280px] w-full animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/60" />
        </BentoCard>
      </div>
    </div>
  );
}
