'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock,
  Copy,
  Eye,
  FileCheck,
  GraduationCap,
  Layers,
  PencilLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { examService } from '@/services/exam.service';
import type { TeacherDashboardStats, TeacherPriorityExamItem } from '@/types/exam';
import { formatCandidateInitials, formatViolationType } from '@/lib/formatters/statusFormatter';
import {
  ActivityTrendChartCard,
  BentoCard,
  BreakdownDonutChartCard,
  BreakdownSlice,
  DashboardErrorBanner,
  DashboardSkeleton,
  formatDashboardNumber,
  formatRelativeTime,
  KpiCard,
  subscribeNoop,
} from '@/components/dashboard/DashboardPrimitives';

type TeacherBreakdownMode = 'attempts' | 'exams' | 'questions';

interface QuickDestination {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}

const TEACHER_QUICK_DESTINATIONS: QuickDestination[] = [
  {
    title: 'Soạn bài kiểm tra',
    description: 'Thiết lập câu hỏi & lịch mở phòng',
    href: '/teacher/exams/create',
    icon: Plus,
    accentClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  },
  {
    title: 'Chấm tự luận',
    description: 'Xem bài nộp & gửi nhận xét',
    href: '/teacher/grading',
    icon: FileCheck,
    accentClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  },
  {
    title: 'Tác vụ tự động',
    description: 'Theo dõi tiến trình xử lý đề',
    href: '/teacher/ai-tasks',
    icon: Sparkles,
    accentClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  {
    title: 'Kho đề thi',
    description: 'Mở phòng thi, đóng & nhân bản',
    href: '/teacher/exams',
    icon: BookOpen,
    accentClass: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  },
];

const EXAM_STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  PUBLISHED: {
    label: 'Đang mở',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20',
  },
  DRAFT: {
    label: 'Bản nháp',
    className:
      'bg-zinc-100 text-zinc-700 ring-black/5 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10',
  },
  CLOSED: {
    label: 'Đã đóng',
    className:
      'bg-sky-50 text-sky-700 ring-sky-500/20 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-400/20',
  },
};

function resolveExamPrimaryAction(exam: TeacherPriorityExamItem) {
  if (exam.pendingGradingCount > 0) {
    return {
      label: 'Chấm ngay',
      href: `/teacher/grading/exams/${exam.id}`,
      icon: FileCheck,
      className:
        'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/60',
    };
  }
  if (exam.inProgressCount > 0 || exam.status === 'PUBLISHED') {
    return {
      label: 'Giám sát',
      href: `/teacher/exams/${exam.id}/proctoring`,
      icon: Eye,
      className:
        'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/70 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60',
    };
  }
  if (exam.status === 'DRAFT') {
    return {
      label: 'Soạn tiếp',
      href: `/teacher/exams/${exam.id}/edit`,
      icon: PencilLine,
      className:
        'border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
    };
  }
  return {
    label: 'Xem chi tiết',
    href: `/teacher/exams/${exam.id}/edit`,
    icon: ArrowUpRight,
    className:
      'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
  };
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, isLoggedIn } = useAuthStore();

  // Client mount guard prevents Recharts responsive container -1 sizing warnings on SSR
  const hasMounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const [stats, setStats] = useState<TeacherDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [breakdownMode, setBreakdownMode] = useState<TeacherBreakdownMode>('attempts');
  const [copiedExamId, setCopiedExamId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canAccessTeacher = useMemo(() => {
    const roles = user?.roles ?? [];
    return roles.some((role) => {
      const normalized = role.toUpperCase();
      return normalized.includes('TEACHER') || normalized.includes('ADMIN');
    });
  }, [user?.roles]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated && !isLoggedIn) {
      router.replace('/login');
      return;
    }

    if (!canAccessTeacher) {
      window.location.replace('/student');
      return;
    }

    let isActive = true;

    async function loadInitialDashboard() {
      try {
        const data = await examService.getTeacherDashboard(false);
        if (!isActive) return;
        setStats(data);
        setErrorMessage(null);
        setLastUpdatedAt(new Date());
      } catch {
        if (!isActive) return;
        setErrorMessage('Chưa thể kết nối để lấy bức tranh tổng quan lớp học. Vui lòng thử lại sau ít phút.');
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
  }, [isInitialized, isAuthenticated, isLoggedIn, canAccessTeacher, router]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const freshData = await examService.getTeacherDashboard(true);
      setStats(freshData);
      setErrorMessage(null);
      setLastUpdatedAt(new Date());
    } catch {
      setErrorMessage('Không thể làm mới số liệu lúc này. Dữ liệu bên dưới giữ nguyên ở lần tải trước.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleCopyAccessCode = useCallback(async (examId: string, accessCode: string) => {
    if (!accessCode || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(accessCode);
      setCopiedExamId(examId);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedExamId(null);
      }, 2000);
    } catch {
      // Clipboard access denied by browser permissions; keep button state silent
    }
  }, []);

  const breakdownData = useMemo(() => {
    if (!stats) {
      return {
        total: 0,
        centerLabel: 'Tổng cộng',
        insight: '',
        emptyMessage: 'Chưa có dữ liệu trong mục này.',
        slices: [] as BreakdownSlice[],
      };
    }

    let rawItems: Array<{ key: string; label: string; value: number; color: string }> = [];
    let centerLabel = 'Tổng cộng';
    let insight = '';
    let emptyMessage = 'Chưa có dữ liệu trong mục này.';

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
      insight =
        stats.totalAttempts > 0
          ? `${completionRate}% lượt tham gia đã hoàn tất nộp bài.`
          : 'Chưa có học sinh nào vào làm bài.';
      emptyMessage = 'Chưa có lượt làm bài nào trên các đề của Thầy/Cô.';
    } else if (breakdownMode === 'exams') {
      rawItems = [
        { key: 'published', label: 'Đang mở thi', value: stats.publishedExams, color: '#4f46e5' },
        { key: 'draft', label: 'Bản nháp', value: stats.draftExams, color: '#94a3b8' },
        { key: 'closed', label: 'Đã đóng', value: stats.closedExams, color: '#0284c7' },
      ];
      centerLabel = 'Tổng đề thi';
      insight = `${formatDashboardNumber(stats.publishedExams)} đề đang mở cho học sinh vào làm.`;
      emptyMessage = 'Kho đề của Thầy/Cô hiện đang trống.';
    } else {
      rawItems = [
        { key: 'single', label: 'Một lựa chọn', value: stats.singleChoiceQuestions, color: '#4f46e5' },
        { key: 'multiple', label: 'Nhiều lựa chọn', value: stats.multipleChoiceQuestions, color: '#0284c7' },
        { key: 'numeric', label: 'Điền số', value: stats.numericQuestions, color: '#0d9488' },
        { key: 'essay', label: 'Tự luận', value: stats.essayQuestions, color: '#f59e0b' },
      ];
      centerLabel = 'Tổng câu hỏi';
      insight =
        stats.totalQuestions > 0
          ? `Trong đó có ${formatDashboardNumber(stats.essayQuestions)} câu tự luận.`
          : 'Chưa có câu hỏi nào trong các đề thi.';
      emptyMessage = 'Chưa có câu hỏi nào được soạn.';
    }

    const total = rawItems.reduce((sum, item) => sum + item.value, 0);
    const slices: BreakdownSlice[] = rawItems.map((item) => ({
      ...item,
      percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
    }));

    return { total, centerLabel, insight, emptyMessage, slices };
  }, [stats, breakdownMode]);

  const teacherName = user?.fullName || user?.username || 'Thầy/Cô';

  const heroDescription = useMemo(() => {
    if (!stats) {
      return 'Theo dõi tình hình lớp học, các bài tự luận cần chấm và đề thi đang mở tại một nơi.';
    }
    if (stats.pendingManualAnswers > 0 || stats.inProgressAttempts > 0) {
      return `Hiện có ${formatDashboardNumber(stats.pendingManualAnswers)} câu tự luận đang chờ cho điểm và ${formatDashboardNumber(stats.inProgressAttempts)} học sinh đang làm bài trực tiếp.`;
    }
    if (stats.publishedExams > 0) {
      return 'Các phòng thi đang diễn ra ổn định, toàn bộ phần bài tự luận đã được chấm hoàn tất.';
    }
    return 'Sẵn sàng soạn đề thi mới, mở phòng thi cho lớp hoặc xem lại kết quả đã lưu.';
  }, [stats]);

  if (!isInitialized || !canAccessTeacher) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <GraduationCap className="h-8 w-8 animate-pulse text-indigo-600 motion-reduce:animate-none" />
          <p className="text-sm font-medium">Đang chuẩn bị góc giảng dạy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 overflow-x-clip pb-12">
      {/* Header Bar */}
      <header className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
        <div className="min-w-0 space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-indigo-700 ring-1 ring-indigo-500/15 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-400/20">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            Góc giảng dạy
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Xin chào, {teacherName}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {heroDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          {lastUpdatedAt && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              Cập nhật{' '}
              {lastUpdatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <button
            type="button"
            disabled={isRefreshing || isLoading}
            onClick={() => void handleRefresh()}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
            {isRefreshing ? 'Đang cập nhật...' : 'Làm mới số liệu'}
          </button>

          <Link
            href="/teacher/exams/create"
            className="group inline-flex items-center gap-2 rounded-full bg-indigo-600 py-1.5 pl-4 pr-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-indigo-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <span>Tạo đề mới</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105 group-hover:translate-x-0.5">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </header>

      {/* Non-blocking Inline Error State */}
      {errorMessage && (
        <DashboardErrorBanner
          message={errorMessage}
          isRetrying={isRefreshing}
          onRetry={() => void handleRefresh()}
        />
      )}

      {/* Initial Loading Skeleton or Empty Error State */}
      {isLoading && !stats ? (
        <DashboardSkeleton />
      ) : !stats ? (
        <BentoCard innerClassName="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Chưa thể hiển thị số liệu
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Hệ thống tạm thời chưa lấy được dữ liệu lớp học. Thầy/Cô hãy bấm nút bên dưới để tải lại nhé.
          </p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tải lại dữ liệu
          </button>
        </BentoCard>
      ) : (
        <>
          {/* Row 1: 4 Headline KPIs (2x2 mobile, 4 cols desktop) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard
              title="Kho đề của tôi"
              value={formatDashboardNumber(stats.totalExams)}
              unit="đề thi"
              icon={BookOpen}
              iconWrapClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
              badgeText={
                stats.publishedExams > 0
                  ? `${formatDashboardNumber(stats.publishedExams)} đang mở nhận bài`
                  : 'Chưa mở phòng thi'
              }
              badgeTone={stats.publishedExams > 0 ? 'info' : 'neutral'}
              footerLeft={`${formatDashboardNumber(stats.draftExams)} bản nháp`}
              footerRight={`${formatDashboardNumber(stats.closedExams)} đã đóng`}
            />

            <KpiCard
              title="Ngân hàng câu hỏi"
              value={formatDashboardNumber(stats.totalQuestions)}
              unit="câu hỏi"
              icon={Layers}
              iconWrapClass="bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400"
              badgeText={
                stats.essayQuestions > 0
                  ? `${formatDashboardNumber(stats.essayQuestions)} câu tự luận`
                  : 'Thuần trắc nghiệm'
              }
              badgeTone="neutral"
              footerLeft={`${formatDashboardNumber(stats.singleChoiceQuestions + stats.multipleChoiceQuestions)} trắc nghiệm`}
              footerRight={`${formatDashboardNumber(stats.numericQuestions)} điền số`}
            />

            <KpiCard
              title="Hoạt động làm bài"
              value={formatDashboardNumber(stats.totalAttempts)}
              unit="lượt tham gia"
              icon={Users}
              iconWrapClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
              badgeText={
                stats.inProgressAttempts > 0
                  ? `${formatDashboardNumber(stats.inProgressAttempts)} đang làm bài`
                  : 'Chưa có thí sinh làm bài'
              }
              badgeTone={stats.inProgressAttempts > 0 ? 'live' : 'neutral'}
              footerLeft={`Điểm TB: ${stats.averageScore > 0 ? stats.averageScore.toFixed(1) : '—'}`}
              footerRight={`${formatDashboardNumber(stats.submittedAttempts)} đã nộp`}
            />

            <KpiCard
              title="Chấm bài & Giám sát"
              value={formatDashboardNumber(stats.awaitingGradingAttempts)}
              unit="bài chờ chấm"
              icon={stats.pendingManualAnswers > 0 ? FileCheck : AlertTriangle}
              iconWrapClass={
                stats.pendingManualAnswers > 0
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              }
              badgeText={
                stats.pendingManualAnswers > 0
                  ? `${formatDashboardNumber(stats.pendingManualAnswers)} câu tự luận chưa chấm`
                  : 'Đã chấm xong tự luận'
              }
              badgeTone={stats.pendingManualAnswers > 0 ? 'warning' : 'positive'}
              footerLeft={`${formatDashboardNumber(stats.totalViolations)} cảnh báo phòng thi`}
              footerRight={`${formatDashboardNumber(stats.disqualifiedAttempts)} bị đình chỉ`}
            />
          </div>

          {/* Row 2: Recharts Analytics Bento (8:4) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <ActivityTrendChartCard
              title="Nhịp độ làm bài của học sinh 7 ngày qua"
              series={stats.dailyActivities}
              hasMounted={hasMounted}
              gradientPrefix="teacher"
            />

            <BreakdownDonutChartCard
              title="Cơ cấu bài làm & kho đề"
              insight={breakdownData.insight}
              tabs={[
                { id: 'attempts', label: 'Bài làm' },
                { id: 'exams', label: 'Đề thi' },
                { id: 'questions', label: 'Câu hỏi' },
              ]}
              activeTab={breakdownMode}
              onTabChange={setBreakdownMode}
              slices={breakdownData.slices}
              total={breakdownData.total}
              centerLabel={breakdownData.centerLabel}
              emptyMessage={breakdownData.emptyMessage}
              hasMounted={hasMounted}
            />
          </div>

          {/* Row 3: Priority Exams + Recent Violations & Quick Shortcuts (7:5 Bento) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left (7 cols): Priority Exams requiring action */}
            <BentoCard className="lg:col-span-7" innerClassName="flex flex-col justify-between p-5 sm:p-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
                      Đề thi cần chú ý
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
                      Ưu tiên bài còn tự luận chưa chấm điểm hoặc đang có học sinh làm trực tiếp.
                    </p>
                  </div>

                  <Link
                    href="/teacher/exams"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <span>Xem tất cả</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>

                {stats.priorityExams.length === 0 ? (
                  <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-800/30">
                    <BookOpen className="mb-3 h-9 w-9 text-indigo-500" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Thầy/Cô chưa tạo đề thi nào
                    </h3>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Hãy bắt đầu bằng việc tạo đề thi đầu tiên hoặc soạn nhanh từ tài liệu sẵn có.
                    </p>
                    <Link
                      href="/teacher/exams/create"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Tạo đề đầu tiên
                    </Link>
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {stats.priorityExams.map((exam) => {
                      const statusMeta = EXAM_STATUS_BADGE[exam.status] ?? {
                        label: exam.status,
                        className: 'bg-zinc-100 text-zinc-700 ring-black/5 dark:bg-zinc-800 dark:text-zinc-300',
                      };
                      const action = resolveExamPrimaryAction(exam);
                      const ActionIcon = action.icon;
                      const isCopied = copiedExamId === exam.id;

                      return (
                        <li
                          key={exam.id}
                          className="flex flex-col justify-between gap-3 py-3.5 first:pt-1 last:pb-1 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusMeta.className}`}
                              >
                                {statusMeta.label}
                              </span>
                              <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                {exam.title}
                              </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                              {exam.accessCode && (
                                <button
                                  type="button"
                                  onClick={() => void handleCopyAccessCode(exam.id, exam.accessCode)}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                  title="Sao chép mã phòng thi"
                                >
                                  <span className="font-mono tracking-wide">{exam.accessCode}</span>
                                  {isCopied ? (
                                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                      <Check className="h-3 w-3" aria-hidden="true" />
                                      Đã chép
                                    </span>
                                  ) : (
                                    <Copy className="h-3 w-3 text-zinc-400" aria-hidden="true" />
                                  )}
                                </button>
                              )}

                              <span>{exam.durationMinutes} phút</span>
                              <span className="tabular-nums">
                                {formatDashboardNumber(exam.totalAttempts)} lượt
                              </span>

                              {exam.inProgressCount > 0 && (
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                  {formatDashboardNumber(exam.inProgressCount)} đang làm
                                </span>
                              )}

                              {exam.pendingGradingCount > 0 && (
                                <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                                  {formatDashboardNumber(exam.pendingGradingCount)} chờ chấm
                                </span>
                              )}

                              {exam.submittedCount > 0 && exam.averageScore > 0 && (
                                <span className="tabular-nums">
                                  TB {exam.averageScore.toFixed(1)} đ
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-end sm:pl-2">
                            <Link
                              href={action.href}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${action.className}`}
                            >
                              <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{action.label}</span>
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <span>
                  Tổng cộng{' '}
                  <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {formatDashboardNumber(stats.publishedExams)}
                  </strong>{' '}
                  đề đang mở và{' '}
                  <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {formatDashboardNumber(stats.draftExams)}
                  </strong>{' '}
                  bản nháp
                </span>
                <Link
                  href="/teacher/grading"
                  className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Đi tới khu vực chấm bài →
                </Link>
              </div>
            </BentoCard>

            {/* Right (5 cols): Recent Proctoring Alerts + 4 Quick Shortcuts */}
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
              {/* Recent Violations */}
              <BentoCard innerClassName="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
                      Cảnh báo mới ghi nhận
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Những lưu ý gần đây trong các ca thi của Thầy/Cô.
                    </p>
                  </div>

                  {stats.totalViolations > 0 && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-400/20">
                      {formatDashboardNumber(stats.totalViolations)} tổng
                    </span>
                  )}
                </div>

                {stats.recentViolations.length === 0 ? (
                  <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 px-5 py-8 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <ShieldCheck className="mb-2.5 h-9 w-9 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Phòng thi diễn ra nghiêm túc
                    </h3>
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Chưa phát hiện hành vi bất thường nào trong các bài thi gần đây của lớp.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-3.5 divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {stats.recentViolations.slice(0, 4).map((item) => {
                      const violationInfo = formatViolationType(item.violationType);
                      return (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2.5 py-2.5 first:pt-1 last:pb-1"
                        >
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-500/15 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/20"
                              aria-hidden="true"
                            >
                              {formatCandidateInitials(item.candidateName)}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <p className="truncate text-xs font-semibold text-zinc-900 sm:text-sm dark:text-zinc-50">
                                {item.candidateName || 'Thí sinh tự do'}
                              </p>
                              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                                {item.examTitle || 'Bài thi trực tuyến'}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${violationInfo.color}`}
                              >
                                {violationInfo.label}
                              </span>
                              {item.examId && (
                                <Link
                                  href={`/teacher/exams/${item.examId}/proctoring`}
                                  className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                                  aria-label={`Xem phòng giám sát ${item.examTitle}`}
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </Link>
                              )}
                            </div>
                            <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                              {formatRelativeTime(item.timestamp)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </BentoCard>

              {/* 4 Quick Destinations Grid */}
              <BentoCard innerClassName="p-5 sm:p-6">
                <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Lối tắt công việc
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Mở nhanh các khu vực thường dùng khi giảng dạy.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {TEACHER_QUICK_DESTINATIONS.map((dest) => {
                    const DestIcon = dest.icon;
                    return (
                      <Link
                        key={dest.href}
                        href={dest.href}
                        className="group flex min-w-0 items-center justify-between gap-2.5 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-indigo-900/60 dark:hover:bg-zinc-800/80"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${dest.accentClass}`}
                          >
                            <DestIcon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-zinc-900 sm:text-sm dark:text-zinc-50">
                              {dest.title}
                            </p>
                            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                              {dest.description}
                            </p>
                          </div>
                        </div>

                        <ArrowUpRight
                          className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}
                </div>
              </BentoCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
