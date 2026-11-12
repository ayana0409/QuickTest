'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  KeyRound,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import {
  ActivityTrendChartCard,
  BentoCard,
  BreakdownDonutChartCard,
  BreakdownSlice,
  DashboardDailyActivityPoint,
  DashboardErrorBanner,
  DashboardSkeleton,
  formatDashboardNumber,
  formatRelativeTime,
  KpiCard,
  subscribeNoop,
} from '@/components/dashboard/DashboardPrimitives';
import { formatViolationType } from '@/lib/formatters/statusFormatter';
import { useAuthStore } from '@/stores/authStore';
import { studentService } from '@/services/student.service';
import { candidateSessionService } from '@/services/candidateSession.service';
import type { StudentDashboardResponse, StudentExamCardDto } from '@/types/exam';
import { cn } from '@/lib/utils';

type StudentBreakdownMode = 'attempts' | 'exams' | 'violations';
type ExamStatusFilter = 'ALL' | 'OPEN' | 'CLOSED' | 'ACTIVE_SESSION';

const VIOLATION_SLICE_COLORS = ['#e11d48', '#f59e0b', '#4f46e5', '#0284c7', '#64748b'];

interface RawBreakdownItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Normalize slice percentages with largest-remainder rounding so positive slices always sum to 100%.
 */
function normalizeBreakdownSlices(items: RawBreakdownItem[]): { total: number; slices: BreakdownSlice[] } {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return {
      total: 0,
      slices: items.map((item) => ({ ...item, percent: 0 })),
    };
  }

  const exactParts = items.map((item) => {
    const exact = (item.value / total) * 100;
    const floorVal = Math.floor(exact);
    return {
      ...item,
      floorVal,
      remainder: exact - floorVal,
    };
  });

  const remainderPoints = 100 - exactParts.reduce((sum, part) => sum + part.floorVal, 0);
  const orderedIndices = exactParts
    .map((part, index) => ({ index, remainder: part.remainder, value: part.value }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.remainder - a.remainder);

  const percents = exactParts.map((part) => part.floorVal);
  for (let i = 0; i < remainderPoints && orderedIndices.length > 0; i++) {
    const target = orderedIndices[i % orderedIndices.length];
    percents[target.index] += 1;
  }

  return {
    total,
    slices: items.map((item, index) => ({
      ...item,
      percent: percents[index],
    })),
  };
}

/**
 * Format numeric score cleanly without trailing zeroes (up to 2 decimal places).
 */
function formatScoreValue(score?: number | null): string {
  if (score == null || Number.isNaN(score)) {
    return '—';
  }
  return Number.isInteger(score) ? String(score) : Number(score.toFixed(2)).toString();
}

/**
 * Format remaining seconds into concise Vietnamese countdown label.
 */
function formatRemainingDuration(seconds?: number | null): string | null {
  if (seconds == null || seconds <= 0) {
    return null;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `Còn ${hours} giờ ${remMins} phút`;
  }
  if (mins > 0) {
    return `Còn ${mins} phút ${secs} giây`;
  }
  return `Còn ${secs} giây`;
}

/**
 * Progressive scroll-reveal wrapper using IntersectionObserver with transform and opacity only.
 */
function RevealSection({
  children,
  delayMs = 0,
  className = '',
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={cn(
        'transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, isLoggedIn } = useAuthStore();

  // Client mount guard prevents Recharts responsive container -1 sizing warnings during SSR
  const hasMounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const [dashboardData, setDashboardData] = useState<StudentDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [accessCode, setAccessCode] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [startingExamCode, setStartingExamCode] = useState<string | null>(null);

  const [breakdownMode, setBreakdownMode] = useState<StudentBreakdownMode>('attempts');
  const [activeTab, setActiveTab] = useState<'MY_EXAMS' | 'EXPLORE'>('MY_EXAMS');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamStatusFilter>('ALL');

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated && !isLoggedIn) {
      router.replace('/login');
      return;
    }

    let isActive = true;

    async function loadInitialDashboard() {
      try {
        const data = await studentService.getStudentDashboard(false);
        if (!isActive) return;
        setDashboardData(data);
        setErrorMessage(null);
        setLastUpdatedAt(new Date());
      } catch {
        if (!isActive) return;
        setErrorMessage('Chưa thể tải bảng tổng hợp học tập lúc này. Bạn hãy thử lại sau ít phút nhé.');
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
  }, [isInitialized, isAuthenticated, isLoggedIn, router]);

  /**
   * Bypass short-lived cache and pull fresh dashboard metrics.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const freshData = await studentService.getStudentDashboard(true);
      setDashboardData(freshData);
      setErrorMessage(null);
      setLastUpdatedAt(new Date());
    } catch {
      setErrorMessage('Chưa thể làm mới số liệu lúc này. Thông tin bên dưới giữ nguyên ở lần tải trước.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Join an exam room immediately by access code.
   */
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim().toUpperCase();

    if (!cleanCode) {
      toast.error('Vui lòng nhập mã phòng thi để vào làm bài');
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
      // Axios interceptor handles API error notifications
    } finally {
      setIsSubmittingCode(false);
    }
  };

  /**
   * Start or resume an exam directly from a card.
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
      // Axios interceptor handles API error notifications
    } finally {
      setStartingExamCode(null);
    }
  };

  const activeSpotlightExam = useMemo(() => {
    return dashboardData?.myExams?.find((exam) => exam.hasActiveSession && exam.activeAttemptId);
  }, [dashboardData]);

  const totalAttempts = dashboardData?.totalAttemptsCount ?? dashboardData?.completedAttemptsCount ?? 0;
  const submittedAttempts = dashboardData?.submittedAttemptsCount ?? dashboardData?.completedAttemptsCount ?? 0;
  const inProgressAttempts = dashboardData?.inProgressAttemptsCount ?? dashboardData?.activeSessionsCount ?? 0;
  const awaitingGrading = dashboardData?.awaitingGradingCount ?? 0;
  const disqualifiedAttempts = dashboardData?.disqualifiedAttemptsCount ?? 0;
  const totalViolations = dashboardData?.totalViolations ?? 0;
  const attemptsWithViolations = dashboardData?.attemptsWithViolations ?? 0;
  const recentViolations = dashboardData?.recentViolations ?? [];

  const activitySeries: DashboardDailyActivityPoint[] = useMemo(() => {
    return (dashboardData?.dailyActivities ?? []).map((point) => ({
      date: point.date,
      label: point.label,
      attemptsCount: point.attemptsCount,
      submittedCount: point.submittedCount,
      violationsCount: point.violationsCount ?? 0,
    }));
  }, [dashboardData?.dailyActivities]);

  const breakdownData = useMemo(() => {
    if (!dashboardData) {
      return {
        total: 0,
        centerLabel: 'Lượt làm bài',
        insight: 'Chưa ghi nhận lượt làm bài nào.',
        emptyMessage: 'Bạn chưa có dữ liệu làm bài nào.',
        slices: [] as BreakdownSlice[],
      };
    }

    if (breakdownMode === 'attempts') {
      const { total, slices } = normalizeBreakdownSlices([
        { key: 'submitted', label: 'Đã hoàn thành', value: submittedAttempts, color: '#10b981' },
        { key: 'inProgress', label: 'Đang làm dở', value: inProgressAttempts, color: '#f59e0b' },
        { key: 'awaiting', label: 'Chờ chấm điểm', value: awaitingGrading, color: '#8b5cf6' },
        { key: 'disqualified', label: 'Bị đình chỉ', value: disqualifiedAttempts, color: '#e11d48' },
      ]);
      const completionRate = total > 0 ? Math.round((submittedAttempts / total) * 100) : 0;
      return {
        total,
        centerLabel: 'Tổng lượt thi',
        insight:
          total > 0
            ? `${completionRate}% lượt làm bài của bạn đã hoàn tất nộp bài.`
            : 'Bạn chưa có lượt làm bài nào.',
        emptyMessage: 'Hãy nhập mã phòng thi hoặc chọn đề công khai để bắt đầu lượt thi đầu tiên.',
        slices,
      };
    }

    if (breakdownMode === 'violations') {
      const sortedEntries = Object.entries(dashboardData.violationByTypes ?? {})
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a);

      const rawViolationItems: RawBreakdownItem[] = [];
      if (sortedEntries.length <= 5) {
        sortedEntries.forEach(([type, count], index) => {
          rawViolationItems.push({
            key: type,
            label: formatViolationType(type).shortLabel,
            value: count,
            color: VIOLATION_SLICE_COLORS[index % VIOLATION_SLICE_COLORS.length],
          });
        });
      } else {
        sortedEntries.slice(0, 4).forEach(([type, count], index) => {
          rawViolationItems.push({
            key: type,
            label: formatViolationType(type).shortLabel,
            value: count,
            color: VIOLATION_SLICE_COLORS[index],
          });
        });
        const otherTotal = sortedEntries.slice(4).reduce((sum, [, count]) => sum + count, 0);
        rawViolationItems.push({
          key: 'other',
          label: 'Lưu ý khác',
          value: otherTotal,
          color: VIOLATION_SLICE_COLORS[4],
        });
      }

      const { total, slices } = normalizeBreakdownSlices(rawViolationItems);
      const topSlice = slices[0];
      return {
        total,
        centerLabel: 'Tổng lưu ý',
        insight:
          total > 0 && topSlice
            ? `Phổ biến nhất là ${topSlice.label.toLowerCase()} (${topSlice.percent}%).`
            : 'Bạn chưa ghi nhận lưu ý quy chế nào trong phòng thi.',
        emptyMessage: 'Tuyệt vời! Bạn chưa có lưu ý phòng thi nào.',
        slices,
      };
    }

    const totalExams = dashboardData.totalExamsAttempted ?? 0;
    const openCount = dashboardData.openExamsCount ?? 0;
    const closedCount = Math.max(0, totalExams - openCount);
    const { total, slices } = normalizeBreakdownSlices([
      { key: 'open', label: 'Đang mở thi', value: openCount, color: '#4f46e5' },
      { key: 'closed', label: 'Đã đóng phòng', value: closedCount, color: '#94a3b8' },
    ]);
    return {
      total,
      centerLabel: 'Đề đã tham gia',
      insight:
        total > 0
          ? `${formatDashboardNumber(openCount)} đề vẫn đang mở để bạn làm tiếp hoặc xem lại.`
          : 'Bạn chưa tham gia đề thi nào.',
      emptyMessage: 'Danh sách đề bạn đã tham gia hiện đang trống.',
      slices,
    };
  }, [dashboardData, breakdownMode, submittedAttempts, inProgressAttempts, awaitingGrading, disqualifiedAttempts]);

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

  const studentName = user?.fullName || user?.username || 'bạn';

  const heroSubtitle = useMemo(() => {
    if (!dashboardData) {
      return 'Nhập mã phòng thi để vào làm bài ngay hoặc theo dõi tiến độ học tập của bạn tại một nơi.';
    }
    if (dashboardData.activeSessionsCount > 0) {
      return `Bạn đang có ${formatDashboardNumber(dashboardData.activeSessionsCount)} bài làm dở chưa nộp. Hãy tiếp tục để không mất tiến độ nhé.`;
    }
    if (dashboardData.openExamsCount > 0) {
      return `Hiện có ${formatDashboardNumber(dashboardData.openExamsCount)} bài thi của bạn vẫn đang mở phòng để thi tiếp hoặc ôn luyện.`;
    }
    return 'Sẵn sàng chinh phục bài kiểm tra mới hoặc khám phá các đề luyện tập từ thầy cô.';
  }, [dashboardData]);

  const averageScoreBadge = useMemo(() => {
    const avg = dashboardData?.averageScore;
    if (avg == null) {
      return { text: 'Chưa có bài chấm điểm', tone: 'neutral' as const };
    }
    if (avg >= 8) {
      return { text: 'Phong độ rất tốt', tone: 'positive' as const };
    }
    if (avg >= 6.5) {
      return { text: 'Kết quả ổn định', tone: 'info' as const };
    }
    return { text: 'Đang tích lũy tiến bộ', tone: 'neutral' as const };
  }, [dashboardData?.averageScore]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <GraduationCap className="h-8 w-8 animate-pulse text-indigo-600 motion-reduce:animate-none" />
          <p className="text-sm font-medium">Đang chuẩn bị góc học tập của bạn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 overflow-x-clip pb-12">
      {/* Header Welcome & Quick Access Code (Double-Bezel Soft Structuralism) */}
      <BentoCard innerClassName="p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-500/15 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-400/20">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                Cổng thi QuickTest
              </span>
              {lastUpdatedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <Clock className="h-3 w-3 text-zinc-400" aria-hidden="true" />
                  Cập nhật {lastUpdatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              Xin chào, {studentName}
            </h1>
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {heroSubtitle}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2.5 lg:w-[27rem] lg:shrink-0">
            <form
              onSubmit={handleJoinByCode}
              className="flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-1.5 dark:border-zinc-700/80 dark:bg-zinc-800/60"
            >
              <div className="relative min-w-0 flex-1">
                <KeyRound
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Nhập mã phòng (VD: JAVA26)..."
                  aria-label="Mã phòng thi"
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs font-bold uppercase tracking-wider text-zinc-900 placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingCode}
                className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-indigo-600 py-1.5 pl-4 pr-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <span>{isSubmittingCode ? 'Đang vào...' : 'Vào thi'}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </button>
            </form>

            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Nhập mã từ giáo viên để mở đề ngay
              </span>
              <button
                type="button"
                disabled={isRefreshing || isLoading}
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <RefreshCw
                  className={cn('h-3 w-3', isRefreshing && 'animate-spin motion-reduce:animate-none')}
                  aria-hidden="true"
                />
                <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới số liệu'}</span>
              </button>
            </div>
          </div>
        </div>
      </BentoCard>

      {/* Active In-Progress Spotlight Banner */}
      {activeSpotlightExam && (
        <BentoCard
          className="border-amber-300/70 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-500/10"
          innerClassName="flex flex-col justify-between gap-3 bg-amber-50/75 p-4 sm:flex-row sm:items-center sm:p-5 dark:bg-amber-950/35"
        >
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Flame className="h-5 w-5 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Đang làm dở
                </span>
                <span className="rounded-md bg-white/80 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  #{activeSpotlightExam.accessCode}
                </span>
                {formatRemainingDuration(activeSpotlightExam.activeAttemptRemainingSeconds) && (
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    {formatRemainingDuration(activeSpotlightExam.activeAttemptRemainingSeconds)}
                  </span>
                )}
              </div>
              <h2 className="truncate text-sm font-bold text-zinc-900 sm:text-base dark:text-zinc-50">
                {activeSpotlightExam.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/exam/${activeSpotlightExam.activeAttemptId}`)}
            className="group inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-amber-600 py-1.5 pl-4 pr-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-amber-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:self-auto"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span>Tiếp tục làm bài</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105">
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>
        </BentoCard>
      )}

      {/* Non-blocking Inline Error State */}
      {errorMessage && (
        <DashboardErrorBanner
          message={errorMessage}
          isRetrying={isRefreshing}
          onRetry={() => void handleRefresh()}
        />
      )}

      {/* Initial Loading Skeleton or Empty Fallback */}
      {isLoading && !dashboardData ? (
        <DashboardSkeleton />
      ) : !dashboardData ? (
        <BentoCard innerClassName="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Chưa thể hiển thị bảng tổng hợp
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Hệ thống tạm thời chưa tải được kết quả của bạn. Hãy bấm nút bên dưới để thử lại nhé.
          </p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tải lại dữ liệu
          </button>
        </BentoCard>
      ) : (
        <>
          {/* Level 1 Headline KPIs (2x2 mobile, 4 cols desktop) */}
          <RevealSection delayMs={0}>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <KpiCard
                title="Bài thi đã tham gia"
                value={formatDashboardNumber(dashboardData.totalExamsAttempted)}
                unit="đề thi"
                icon={BookOpen}
                iconWrapClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                badgeText={
                  dashboardData.openExamsCount > 0
                    ? `${formatDashboardNumber(dashboardData.openExamsCount)} đề đang mở`
                    : 'Chưa có đề đang mở'
                }
                badgeTone={dashboardData.openExamsCount > 0 ? 'info' : 'neutral'}
                footerLeft={`${formatDashboardNumber(totalAttempts)} lượt làm bài`}
                footerRight={`${formatDashboardNumber(submittedAttempts)} đã nộp`}
              />

              <KpiCard
                title="Lưu ý phòng thi"
                value={formatDashboardNumber(totalViolations)}
                unit="lưu ý"
                icon={totalViolations > 0 ? AlertTriangle : ShieldCheck}
                iconWrapClass={
                  totalViolations > 0
                    ? disqualifiedAttempts > 0
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                }
                badgeText={
                  totalViolations === 0
                    ? 'Tuân thủ tốt quy chế'
                    : disqualifiedAttempts > 0
                      ? `${formatDashboardNumber(disqualifiedAttempts)} bài bị đình chỉ`
                      : `${formatDashboardNumber(attemptsWithViolations)} lượt thi có lưu ý`
                }
                badgeTone={
                  totalViolations === 0
                    ? 'positive'
                    : disqualifiedAttempts > 0
                      ? 'danger'
                      : 'warning'
                }
                footerLeft={`${formatDashboardNumber(disqualifiedAttempts)} bị đình chỉ`}
                footerRight={`${formatDashboardNumber(dashboardData.activeSessionsCount)} đang làm dở`}
              />

              <KpiCard
                title="Điểm trung bình"
                value={formatScoreValue(dashboardData.averageScore)}
                unit={dashboardData.averageScore != null ? 'điểm' : ''}
                icon={Award}
                iconWrapClass="bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"
                badgeText={averageScoreBadge.text}
                badgeTone={averageScoreBadge.tone}
                footerLeft="Tính trên bài đã có điểm"
                footerRight={`${formatDashboardNumber(submittedAttempts)} bài hoàn tất`}
              />

              <KpiCard
                title="Điểm cao nhất"
                value={formatScoreValue(dashboardData.bestScore)}
                unit={dashboardData.bestScore != null ? 'điểm' : ''}
                icon={Trophy}
                iconWrapClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                badgeText={dashboardData.bestScore != null ? 'Thành tích nổi bật' : 'Chưa có kỷ lục'}
                badgeTone={dashboardData.bestScore != null ? 'positive' : 'neutral'}
                footerLeft="Kỷ lục cá nhân cao nhất"
                footerRight={dashboardData.bestScore != null ? 'Đã ghi nhận' : 'Sẵn sàng thi'}
              />
            </div>
          </RevealSection>

          {/* Level 2 Recharts Analytics Bento (8:4 on desktop, 1 col on mobile) */}
          <RevealSection delayMs={90}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <ActivityTrendChartCard
                title="Nhịp độ làm bài 7 ngày qua"
                series={activitySeries}
                hasMounted={hasMounted}
                gradientPrefix="student"
                footerNote="Số lượt thi, bài hoàn tất và lưu ý phòng thi trong 7 ngày gần nhất"
              />

              <BreakdownDonutChartCard
                title="Phân bổ kết quả & quy chế"
                insight={breakdownData.insight}
                tabs={[
                  { id: 'attempts', label: 'Lượt làm bài' },
                  { id: 'exams', label: 'Phòng thi' },
                  { id: 'violations', label: 'Lưu ý thi' },
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
          </RevealSection>

          {/* Level 2.5 Proctoring Notices & Learning Progress Bento (7:5) */}
          <RevealSection delayMs={140}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <BentoCard className="lg:col-span-7" innerClassName="flex flex-col justify-between p-5 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
                        Lưu ý phòng thi gần đây
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
                        Theo dõi các nhắc nhở quy chế trong những lượt làm bài vừa qua để giữ tập trung tốt hơn.
                      </p>
                    </div>

                    {totalViolations > 0 && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-400/20">
                        {formatDashboardNumber(totalViolations)} tổng lưu ý
                      </span>
                    )}
                  </div>

                  {recentViolations.length === 0 ? (
                    <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 px-5 py-8 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
                      <ShieldCheck className="mb-2.5 h-9 w-9 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Tuyệt vời! Chưa ghi nhận vi phạm nào
                      </h3>
                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        Các bài thi gần đây của bạn đều tuân thủ tốt quy chế phòng thi. Hãy tiếp tục phát huy nhé.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {recentViolations.slice(0, 5).map((item) => {
                        const violationInfo = formatViolationType(item.violationType);
                        const ViolationIcon = violationInfo.icon;

                        return (
                          <li
                            key={item.id}
                            className="flex flex-col justify-between gap-2.5 py-3 first:pt-1 last:pb-1 sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <div
                                className={cn(
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                                  violationInfo.color
                                )}
                                aria-hidden="true"
                              >
                                <ViolationIcon className="h-4 w-4" />
                              </div>

                              <div className="min-w-0 space-y-0.5">
                                <p className="truncate text-xs font-semibold text-zinc-900 sm:text-sm dark:text-zinc-50">
                                  {item.examTitle || 'Bài kiểm tra trực tuyến'}
                                </p>
                                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {item.description?.trim() || 'Phát sinh trong quá trình làm bài trực tuyến'}
                                </p>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center justify-between gap-2 pl-12 sm:justify-end sm:pl-0">
                              <div className="flex flex-col items-start sm:items-end">
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                                    violationInfo.color
                                  )}
                                >
                                  {violationInfo.label}
                                </span>
                                <span className="mt-0.5 text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                                  {formatRelativeTime(item.timestamp)}
                                </span>
                              </div>

                              {item.attemptId && (
                                <Link
                                  href={`/student/history/${item.attemptId}`}
                                  aria-label={`Xem chi tiết bài thi ${item.examTitle}`}
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300"
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <span>
                    Có{' '}
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatDashboardNumber(attemptsWithViolations)}
                    </strong>{' '}
                    lượt thi ghi nhận lưu ý trên tổng{' '}
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatDashboardNumber(totalAttempts)}
                    </strong>{' '}
                    lượt làm bài
                  </span>
                  <Link
                    href="/student/history"
                    className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Xem chi tiết từng lượt →
                  </Link>
                </div>
              </BentoCard>

              <BentoCard className="lg:col-span-5" innerClassName="flex flex-col justify-between p-5 sm:p-6">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
                      Tóm tắt tiến độ học tập
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Ảnh nhanh tình hình phòng thi mở và các bài cần theo dõi.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                        Đang mở thi
                      </span>
                      <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatDashboardNumber(dashboardData.openExamsCount)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
                        Bài hoàn tất
                      </span>
                      <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatDashboardNumber(submittedAttempts)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        <Flame className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                        Đang làm dở
                      </span>
                      <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatDashboardNumber(dashboardData.activeSessionsCount)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" aria-hidden="true" />
                        Chờ chấm điểm
                      </span>
                      <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatDashboardNumber(awaitingGrading)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center dark:border-zinc-800">
                  <Link
                    href="/student/history"
                    className="group inline-flex flex-1 items-center justify-between rounded-full border border-zinc-200 bg-zinc-50 py-1.5 pl-4 pr-1.5 text-xs font-semibold text-zinc-700 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-zinc-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <span>Xem lịch sử thi</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-2xs transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 dark:bg-zinc-900">
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('EXPLORE');
                      document.getElementById('student-exam-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="group inline-flex flex-1 items-center justify-between rounded-full border border-indigo-200 bg-indigo-50/70 py-1.5 pl-4 pr-1.5 text-xs font-semibold text-indigo-700 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-indigo-100/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                      Luyện đề mới
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 dark:bg-indigo-900/60">
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                </div>
              </BentoCard>
            </div>
          </RevealSection>

          {/* Level 3 Exam List & Explore Section */}
          <RevealSection delayMs={180} className="space-y-4">
            <div id="student-exam-list" className="scroll-mt-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl dark:text-zinc-50">
                  Danh sách bài thi
                </h2>
                <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
                  Kiểm tra số lượt thi còn lại, tình trạng mở phòng và điểm số từng bài
                </p>
              </div>
            </div>

            {/* Filter Toolbar */}
            <BentoCard innerClassName="flex flex-col items-stretch justify-between gap-3 p-3 sm:p-4 md:flex-row md:items-center">
              <div className="flex w-full items-center rounded-xl border border-zinc-200/70 bg-zinc-100 p-1 md:w-auto dark:border-zinc-700/60 dark:bg-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setActiveTab('MY_EXAMS')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:flex-initial',
                    activeTab === 'MY_EXAMS'
                      ? 'bg-white text-indigo-600 shadow-sm dark:bg-zinc-900 dark:text-indigo-400'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  )}
                >
                  <span>Đã tham gia</span>
                  <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {dashboardData.myExams?.length ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('EXPLORE')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:flex-initial',
                    activeTab === 'EXPLORE'
                      ? 'bg-white text-indigo-600 shadow-sm dark:bg-zinc-900 dark:text-indigo-400'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  )}
                >
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Khám phá</span>
                  <span className="rounded-full bg-zinc-200/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {dashboardData.exploreExams?.length ?? 0}
                  </span>
                </button>
              </div>

              <div className="flex flex-1 items-center gap-2 md:max-w-md">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên đề, mã phòng hoặc giáo viên..."
                    aria-label="Tìm bài thi"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-7 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700/80 dark:bg-zinc-800/60 dark:text-zinc-100"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Xóa từ khóa tìm kiếm"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ExamStatusFilter)}
                  aria-label="Lọc theo trạng thái bài thi"
                  className="shrink-0 cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700/80 dark:bg-zinc-800/60 dark:text-zinc-200"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="OPEN">Đang mở</option>
                  <option value="CLOSED">Đã đóng</option>
                  <option value="ACTIVE_SESSION">Làm dở</option>
                </select>
              </div>
            </BentoCard>

            {/* Explore Prompt */}
            {activeTab === 'EXPLORE' && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200/70 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
                <div className="flex min-w-0 items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  <span className="truncate">Đề thi công khai gợi ý ngẫu nhiên để bạn luyện tập thêm.</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={isRefreshing}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-600 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-indigo-50 active:scale-[0.98] disabled:opacity-60 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-400"
                >
                  <RefreshCw
                    className={cn('h-3 w-3', isRefreshing && 'animate-spin motion-reduce:animate-none')}
                    aria-hidden="true"
                  />
                  <span>Đổi đề</span>
                </button>
              </div>
            )}

            {/* Cards Grid or Empty State */}
            {currentList.length === 0 ? (
              <BentoCard innerClassName="px-6 py-14 text-center space-y-2.5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  {activeTab === 'MY_EXAMS' ? (
                    <GraduationCap className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Compass className="h-6 w-6" aria-hidden="true" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-zinc-900 sm:text-base dark:text-zinc-100">
                  {activeTab === 'MY_EXAMS'
                    ? 'Chưa tìm thấy bài thi bạn đã tham gia'
                    : 'Chưa có đề thi công khai phù hợp'}
                </h3>
                <p className="mx-auto max-w-md text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {activeTab === 'MY_EXAMS'
                    ? 'Hãy nhập mã phòng thi từ giáo viên ở phía trên hoặc chuyển sang mục Khám phá để luyện đề.'
                    : 'Bạn hãy thử đổi từ khóa tìm kiếm hoặc bấm Đổi đề để xem gợi ý khác nhé.'}
                </p>
              </BentoCard>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {currentList.map((card) => {
                  const isStartingThis = startingExamCode === card.accessCode;

                  return (
                    <BentoCard
                      key={card.examId}
                      className={cn(
                        'transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5',
                        card.hasActiveSession && 'border-amber-300/80 dark:border-amber-500/40'
                      )}
                      innerClassName="group flex h-full flex-col justify-between space-y-4 p-4 sm:p-5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-lg border border-zinc-200/70 bg-zinc-100 px-2 py-0.5 font-mono text-xs font-bold text-zinc-700 dark:border-zinc-700/70 dark:bg-zinc-800 dark:text-zinc-300">
                            #{card.accessCode}
                          </span>

                          {card.hasActiveSession ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-500 motion-reduce:animate-none" />
                              Đang làm dở
                            </span>
                          ) : card.isOpen ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Đang mở
                            </span>
                          ) : card.examTimeStatus === 'UPCOMING' ? (
                            <span className="inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
                              Sắp mở
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                              Đã đóng
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-900 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-indigo-600 sm:text-base dark:text-zinc-100 dark:group-hover:text-indigo-400">
                            {card.title}
                          </h3>
                          {card.teacherName && (
                            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                              <User className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                              <span className="truncate">Giáo viên: {card.teacherName}</span>
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2.5 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                            <span>{card.durationMinutes} phút</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                            <span>{card.questionCount} câu</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 rounded-xl border border-zinc-200/70 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-zinc-500 dark:text-zinc-400">Lượt thi:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                {card.attemptsUsed}/{card.maxAttempts}
                              </span>
                              {card.highestScore != null && (
                                <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                                  Cao nhất: {formatScoreValue(card.highestScore)}đ
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                            <div
                              className={cn(
                                'h-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
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

                      <div className="border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                        {card.hasActiveSession ? (
                          <button
                            type="button"
                            onClick={() => void handleStartExam(card)}
                            className="group/btn inline-flex h-10 w-full items-center justify-between rounded-full bg-amber-600 pl-4 pr-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-amber-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                              Tiếp tục thi
                            </span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/btn:translate-x-0.5 group-hover/btn:scale-105">
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          </button>
                        ) : card.isOpen && card.remainingAttempts > 0 ? (
                          <button
                            type="button"
                            disabled={isStartingThis}
                            onClick={() => void handleStartExam(card)}
                            className="group/btn inline-flex h-10 w-full items-center justify-between rounded-full bg-indigo-600 pl-4 pr-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            <span>
                              {isStartingThis
                                ? 'Đang mở đề...'
                                : card.attemptsUsed > 0
                                  ? 'Thi tiếp lượt mới'
                                  : 'Bắt đầu thi'}
                            </span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/btn:translate-x-0.5 group-hover/btn:scale-105">
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          </button>
                        ) : card.latestAttemptId ? (
                          <Link href={`/student/history/${card.latestAttemptId}`} className="block w-full">
                            <Button
                              variant="secondary"
                              className="h-10 w-full rounded-full text-xs font-semibold"
                              size="sm"
                              rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                            >
                              Xem kết quả
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            disabled
                            variant="secondary"
                            className="h-10 w-full rounded-full text-xs font-semibold opacity-60"
                            size="sm"
                          >
                            {!card.isOpen ? 'Đã đóng' : 'Hết lượt thi'}
                          </Button>
                        )}
                      </div>
                    </BentoCard>
                  );
                })}
              </div>
            )}
          </RevealSection>
        </>
      )}
    </div>
  );
}
