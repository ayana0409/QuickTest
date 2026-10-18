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
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { studentService } from '@/services/student.service';
import { candidateSessionService } from '@/services/candidateSession.service';
import type { StudentDashboardResponse, StudentExamCardDto } from '@/types/exam';
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

/**
 * Vietnamese human-readable labels for candidate attempt statuses.
 */
const ATTEMPT_STATUS_MAP: Record<string, string> = {
  IN_PROGRESS: 'Đang làm bài',
  SUBMITTED: 'Đã hoàn thành',
  AWAITING_MANUAL_GRADING: 'Chờ chấm tự luận',
  DISQUALIFIED: 'Bị đình chỉ thi',
  AUTO_GRADED: 'Đã chấm điểm',
};

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
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = card.title?.toLowerCase().includes(q);
        const matchesCode = card.accessCode?.toLowerCase().includes(q);
        const matchesTeacher = card.teacherName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesTeacher) return false;
      }

      // Status filter
      if (statusFilter === 'OPEN') {
        return card.isOpen;
      }
      if (statusFilter === 'CLOSED') {
        return !card.isOpen;
      }
      if (statusFilter === 'ACTIVE_SESSION') {
        return card.hasActiveSession;
      }

      return true;
    });
  }, [dashboardData, activeTab, searchQuery, statusFilter]);

  // First active in-progress attempt to spotlight at top banner
  const activeSpotlightExam = useMemo(() => {
    return dashboardData?.myExams?.find((e) => e.hasActiveSession && e.activeAttemptId);
  }, [dashboardData]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Welcome Banner & Quick Access */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-900/10 border border-indigo-500/20">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-indigo-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Cổng Khảo thí & Luyện thi Trực tuyến QuickTest</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Xin chào, {user?.fullName || user?.username || 'Thí sinh'}! 👋
            </h1>
            <p className="text-indigo-100/90 text-sm sm:text-base leading-relaxed">
              Theo dõi tiến độ, kiểm tra số lượt làm bài còn lại và tiếp tục các phiên thi dở dang một cách thuận tiện nhất.
            </p>
          </div>

          {/* Quick Access Code Input Box */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl lg:w-96 shrink-0 shadow-lg">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-2.5 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-300" />
              <span>Vào thi bằng mã phòng</span>
            </h2>
            <form onSubmit={handleJoinByCode} className="space-y-2.5">
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Nhập Access Code (VD: JAVA-2026)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/95 text-zinc-900 placeholder:text-zinc-400 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white uppercase tracking-wider"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                isLoading={isSubmittingCode}
                className="w-full font-bold shadow-sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Vào phòng thi ngay
              </Button>
            </form>
          </div>
        </div>

        {/* Decorative background glow circles */}
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-20 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Global In-Progress Session Alert Banner */}
      {activeSpotlightExam && (
        <div className="relative overflow-hidden rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500/40 p-5 text-amber-950 dark:text-amber-100 shadow-md animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 shadow-sm animate-pulse">
                <Flame className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    Phiên thi đang làm dở
                  </span>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                    {activeSpotlightExam.accessCode}
                  </span>
                </div>
                <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
                  {activeSpotlightExam.title}
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Bạn có một bài làm đang diễn ra. Hãy tiếp tục hoàn thành trước khi hết thời gian làm bài!
                </p>
              </div>
            </div>

            <Button
              onClick={() => router.push(`/exam/${activeSpotlightExam.activeAttemptId}`)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 shadow-sm"
              size="md"
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Tiếp tục thi ngay
            </Button>
          </div>
        </div>
      )}

      {/* Real-time KPI Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Bài thi đã làm
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
            {loading ? '—' : String(dashboardData?.totalExamsAttempted ?? 0).padStart(2, '0')}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Các bài thi bạn đã từng tham gia</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Kỳ thi đang mở
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {loading ? '—' : String(dashboardData?.openExamsCount ?? 0).padStart(2, '0')}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Đang mở trong thời hạn cho phép</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Phiên thi dở dang
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
            {loading ? '—' : String(dashboardData?.activeSessionsCount ?? 0).padStart(2, '0')}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Bài thi đang làm chưa nộp</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Điểm trung bình
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
            {loading ? '—' : dashboardData?.averageScore != null ? `${dashboardData.averageScore} / 10` : '—'}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {dashboardData?.completedAttemptsCount
              ? `Tính trên ${dashboardData.completedAttemptsCount} bài đã nộp`
              : 'Chưa có bài thi hoàn thành'}
          </p>
        </div>
      </div>

      {/* Main Section Header with Tabs, Search, and Refresh */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Danh sách bài thi của bạn
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Xem chi tiết số lượt thi còn lại, trạng thái mở đóng và kết quả bài làm
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDashboard(true)}
              isLoading={refreshing}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
              className="font-medium"
            >
              Làm mới
            </Button>
            <Link href="/student/history">
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                className="font-semibold"
              >
                Xem toàn bộ lịch sử thi
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Selection & Filtering Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          {/* Main Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 w-fit">
            <button
              onClick={() => setActiveTab('MY_EXAMS')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'MY_EXAMS'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
              <span>Bài thi đã tham gia</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/10 font-mono">
                {dashboardData?.myExams?.length ?? 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('EXPLORE')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'EXPLORE'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
              <Compass className="w-3.5 h-3.5 text-indigo-500" />
              <span>Khám phá</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-700 font-mono">
                {dashboardData?.exploreExams?.length ?? 0}
              </span>
            </button>
          </div>

          {/* Search Box & Status Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc mã đề..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="OPEN">Đang mở thi</option>
              <option value="CLOSED">Đã đóng</option>
              <option value="ACTIVE_SESSION">Có phiên dở</option>
            </select>
          </div>
        </div>

        {/* Discovery Notification Bar */}
        {activeTab === 'EXPLORE' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Mục <strong>Khám phá</strong> gợi ý ngẫu nhiên đề thi công khai từ cộng đồng. Nhấn <strong>Đổi đề khác</strong> để làm mới danh sách gợi ý!
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDashboard(true)}
              isLoading={refreshing}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
              className="font-semibold shrink-0 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/50"
            >
              Đổi đề khác
            </Button>
          </div>
        )}

        {/* Exam Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="w-20 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                  <div className="w-16 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                </div>
                <div className="w-3/4 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                <div className="w-1/2 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                <div className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              {activeTab === 'MY_EXAMS' ? <GraduationCap className="w-6 h-6" /> : <Compass className="w-6 h-6" />}
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              {activeTab === 'MY_EXAMS'
                ? 'Bạn chưa tham gia bài thi nào'
                : 'Chưa có đề thi công khai nào trong mục Khám phá'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
              {activeTab === 'MY_EXAMS'
                ? 'Hãy nhập mã phòng thi do giảng viên cung cấp ở ô phía trên để bắt đầu bài kiểm tra đầu tiên của bạn.'
                : 'Các giảng viên có thể tắt tùy chọn "Đề thi riêng tư" khi tạo đề để chia sẻ bài thi công khai cho cộng đồng luyện tập tại đây.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-3">
            {currentList.map((card) => {
              const isStartingThis = startingExamCode === card.accessCode;

              return (
                <div
                  key={card.examId}
                  className={`group relative flex flex-col justify-between rounded-3xl p-1 transition-all duration-300 ${card.hasActiveSession
                    ? 'bg-gradient-to-b from-amber-400/40 via-amber-500/10 to-transparent shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                    : 'bg-gradient-to-b from-zinc-200/80 via-zinc-100/50 to-transparent dark:from-zinc-800/80 dark:via-zinc-900/50 hover:shadow-lg'
                    }`}
                >
                  {/* Inner Content Card (Double-Bezel concentric architecture) */}
                  <div className="flex flex-col justify-between h-full bg-white dark:bg-zinc-900 rounded-[calc(1.5rem-4px)] p-5 border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-4">
                    {/* Header: Access Code & Live Exam Status */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                          {card.accessCode}
                        </span>

                        {card.hasActiveSession ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Đang làm dở
                          </span>
                        ) : card.isOpen ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            Đang mở
                          </span>
                        ) : card.examTimeStatus === 'UPCOMING' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                            Sắp diễn ra
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                            Đã đóng
                          </span>
                        )}
                      </div>

                      {/* Title & Teacher */}
                      <div>
                        <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                          {card.title}
                        </h3>
                        {card.teacherName && (
                          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Giảng viên: {card.teacherName}</span>
                          </p>
                        )}
                      </div>

                      {/* Meta Grid: Duration, Questions */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{card.durationMinutes} phút</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{card.questionCount} câu hỏi</span>
                        </div>
                      </div>

                      {/* Attempt Quotas Indicator (User Specific Requirement) */}
                      <div className="rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-zinc-500 dark:text-zinc-400">Lượt thi của bạn:</span>
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {card.attemptsUsed} / {card.maxAttempts} lần
                          </span>
                        </div>

                        {/* Progress Bar of attempts used */}
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${card.remainingAttempts > 0
                              ? 'bg-indigo-600 dark:bg-indigo-500'
                              : 'bg-zinc-400 dark:bg-zinc-500'
                              }`}
                            style={{
                              width: `${Math.min(100, (card.attemptsUsed / Math.max(1, card.maxAttempts)) * 100)}%`,
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          {card.remainingAttempts > 0 ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Còn {card.remainingAttempts} lượt thi
                            </span>
                          ) : (
                            <span className="font-bold text-zinc-400 dark:text-zinc-500">
                              Đã hết lượt thi
                            </span>
                          )}

                          {card.highestScore != null && (
                            <span className="font-semibold text-purple-600 dark:text-purple-400">
                              Cao nhất: {card.highestScore} đ
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Active Session Warning Sub-card */}
                      {card.hasActiveSession && (
                        <div className="rounded-xl p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                            <span>Có phiên thi dở dang</span>
                          </div>
                          {card.activeAttemptStartTime && (
                            <span className="font-mono text-[10px] text-amber-700/80 dark:text-amber-400/80">
                              Bắt đầu: {formatDateTime(card.activeAttemptStartTime)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions (Button-in-Button agency tier) */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                      {card.hasActiveSession ? (
                        <Button
                          onClick={() => handleStartExam(card)}
                          className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                          size="sm"
                          leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          Tiếp tục làm bài
                        </Button>
                      ) : card.isOpen && card.remainingAttempts > 0 ? (
                        <Button
                          onClick={() => handleStartExam(card)}
                          isLoading={isStartingThis}
                          className="w-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                          size="sm"
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          {card.attemptsUsed > 0 ? 'Thi tiếp lượt mới' : 'Bắt đầu làm bài'}
                        </Button>
                      ) : card.latestAttemptId ? (
                        <Link href={`/student/history/${card.latestAttemptId}`} className="block w-full">
                          <Button
                            variant="secondary"
                            className="w-full font-semibold"
                            size="sm"
                            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                          >
                            Xem kết quả bài làm
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          disabled
                          variant="secondary"
                          className="w-full font-semibold opacity-60"
                          size="sm"
                        >
                          {!card.isOpen ? 'Bài thi đã đóng' : 'Đã hết lượt thi'}
                        </Button>
                      )}
                    </div>
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
