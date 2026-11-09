'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  BookOpen,
  Clock,
  Layers,
  FileEdit,
  Trash2,
  Copy,
  Check,
  Globe,
  Lock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Calendar,
  X,
  ShieldAlert,
  BarChart3,
  Sparkles,
  HelpCircle,
  GraduationCap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { examService } from '@/services/exam.service';
import { connectWebSocket, subscribeTopic } from '@/lib/socket';
import { formatDateTime, formatDateTimeForPayload } from '@/lib/utils';
import type { ExamSummaryResponse, ExamStatus, PageResponse } from '@/types/exam';
import toast from 'react-hot-toast';

interface StatusCounts {
  total: number;
  draft: number;
  published: number;
  closed: number;
}

export default function TeacherExamsPage() {
  const router = useRouter();
  const { isAuthenticated, user, token, isLoggedIn } = useAuthStore();

  const [exams, setExams] = useState<ExamSummaryResponse[]>([]);
  const [pageMeta, setPageMeta] = useState<PageResponse<ExamSummaryResponse> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExamStatus>('ALL');
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals & Action States
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamSummaryResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Republish Modal States
  const [republishTarget, setRepublishTarget] = useState<ExamSummaryResponse | null>(null);
  const [republishEndTime, setRepublishEndTime] = useState<string>('');
  const [republishStartTime, setRepublishStartTime] = useState<string>('');
  const [republishDuration, setRepublishDuration] = useState<number>(45);
  const [isRepublishing, setIsRepublishing] = useState(false);

  // Duplicate Modal States
  const [duplicateTarget, setDuplicateTarget] = useState<ExamSummaryResponse | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState<string>('');
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Debounce search input to avoid spamming the backend
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch status counts for KPI cards
  const fetchStatusCounts = useCallback(async () => {
    try {
      const [allRes, draftRes, pubRes, closedRes] = await Promise.all([
        examService.getTeacherExams({ page: 0, size: 1, status: 'ALL' }),
        examService.getTeacherExams({ page: 0, size: 1, status: 'DRAFT' }),
        examService.getTeacherExams({ page: 0, size: 1, status: 'PUBLISHED' }),
        examService.getTeacherExams({ page: 0, size: 1, status: 'CLOSED' }),
      ]);
      setStatusCounts({
        total: allRes.totalElements,
        draft: draftRes.totalElements,
        published: pubRes.totalElements,
        closed: closedRes.totalElements,
      });
    } catch {
      // Non-critical, fail silently
    }
  }, []);

  // Fetch exams from real backend API with search and status filters
  const fetchExams = useCallback(
    async (
      pageIndex = 0,
      searchVal = debouncedSearch,
      statusVal = statusFilter
    ) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await examService.getTeacherExams({
          page: pageIndex,
          size: pageSize,
          sort: 'createdAt,desc',
          search: searchVal || undefined,
          status: statusVal,
        });
        setExams(res.content || []);
        setPageMeta(res);
        setCurrentPage(pageIndex);
      } catch (err: any) {
        console.error('Failed to fetch exams from backend:', err);
        setLoadError(
          err?.response?.data?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, debouncedSearch, statusFilter]
  );

  // Fetch when debouncedSearch or statusFilter changes
  useEffect(() => {
    if (isAuthenticated || isLoggedIn()) {
      fetchExams(0, debouncedSearch, statusFilter);
      fetchStatusCounts();
    }
  }, [isAuthenticated, isLoggedIn, debouncedSearch, statusFilter, fetchExams, fetchStatusCounts]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchTerm.trim();
      setDebouncedSearch(trimmed);
      fetchExams(0, trimmed, statusFilter);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    fetchExams(0, '', statusFilter);
  };

  // Copy access code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã đề: ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Publish exam directly
  const handlePublishExam = async (exam: ExamSummaryResponse) => {
    if (exam.totalQuestions === 0) {
      toast.error('Đề thi chưa có câu hỏi nào. Vui lòng vào Soạn thảo để thêm câu hỏi trước.');
      router.push(`/teacher/exams/${exam.id}/edit`);
      return;
    }

    setActionInProgressId(exam.id);
    try {
      await examService.publishExam(exam.id);
      fetchExams(currentPage);
      fetchStatusCounts();
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setActionInProgressId(null);
    }
  };

  // Close exam directly
  const handleCloseExam = async (exam: ExamSummaryResponse) => {
    setActionInProgressId(exam.id);
    try {
      await examService.closeExam(exam.id);
      fetchExams(currentPage);
      fetchStatusCounts();
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setActionInProgressId(null);
    }
  };

  // Open modal to configure and republish a closed exam
  const handleOpenRepublishModal = (exam: ExamSummaryResponse) => {
    setRepublishTarget(exam);
    setRepublishDuration(exam.durationMinutes || 45);

    // Suggest new end time 24 hours from now
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTomorrow = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setRepublishEndTime(localISOTomorrow);

    const now = new Date();
    const localISONow = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setRepublishStartTime(localISONow);
  };

  // Confirm republish exam with updated schedule
  const handleConfirmRepublish = async () => {
    if (!republishTarget) return;

    if (republishEndTime) {
      const endTimestamp = new Date(republishEndTime).getTime();
      if (endTimestamp <= Date.now()) {
        toast.error('Thời gian kết thúc phải sau thời điểm hiện tại.');
        return;
      }
    }

    setIsRepublishing(true);
    try {
      await examService.republishExam(republishTarget.id, {
        startTime: republishStartTime ? formatDateTimeForPayload(republishStartTime) : null,
        endTime: republishEndTime ? formatDateTimeForPayload(republishEndTime) : null,
        durationMinutes: Number(republishDuration) || undefined,
      });
      setRepublishTarget(null);
      fetchExams(currentPage);
      fetchStatusCounts();
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsRepublishing(false);
    }
  };

  // Open modal to duplicate an exam
  const handleOpenDuplicateModal = (exam: ExamSummaryResponse) => {
    setDuplicateTarget(exam);
    const titleBase = exam.title.replace(/^\[Bản sao\]\s*/, '');
    setDuplicateTitle(`[Bản sao] ${titleBase}`);
  };

  // Confirm exam duplication
  const handleConfirmDuplicate = async () => {
    if (!duplicateTarget) return;
    setIsDuplicating(true);
    try {
      await examService.duplicateExam(duplicateTarget.id, {
        title: duplicateTitle.trim() || undefined,
      });
      setDuplicateTarget(null);
      fetchExams(currentPage);
      fetchStatusCounts();
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsDuplicating(false);
    }
  };

  // Stable refs for fetchExams and currentPage to prevent unnecessary re-subscribing
  const fetchExamsRef = useRef(fetchExams);
  useEffect(() => {
    fetchExamsRef.current = fetchExams;
  }, [fetchExams]);

  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Real-time WebSocket listener for completed background image duplication
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let isMounted = true;
    let sub: any = null;

    connectWebSocket(token, () => {
      if (!isMounted) return;
      if (sub) {
        sub.unsubscribe();
        sub = null;
      }
      sub = subscribeTopic(`/topic/teachers/${user.id}/notifications`, (message) => {
        try {
          const payload = JSON.parse(message.body);
          if (payload.type === 'EXAM_CLONED') {
            const toastKey = payload.examId ? `exam-cloned-${payload.examId}` : 'exam-cloned';
            toast.success(payload.message || 'Đề thi đã được nhân bản hoàn tất!', {
              id: toastKey,
            });
            fetchExamsRef.current(currentPageRef.current);
            fetchStatusCounts();
          }
        } catch (e) {
          console.error('Failed to parse teacher notification payload:', e);
        }
      });
    });

    return () => {
      isMounted = false;
      if (sub) {
        sub.unsubscribe();
        sub = null;
      }
    };
  }, [isAuthenticated, user?.id, token, fetchStatusCounts]);

  // Delete draft exam
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await examService.deleteExam(deleteTarget.id);
      setDeleteTarget(null);
      fetchExams(currentPage);
      fetchStatusCounts();
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-12">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Quản lý đề thi
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Khởi tạo, xuất bản và theo dõi giám sát kết quả thi
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Link href="/teacher/grading" className="flex-1 sm:flex-initial">
            <button
              type="button"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Chấm tự luận
            </button>
          </Link>
          <Link href="/teacher/exams/create" className="flex-1 sm:flex-initial">
            <button
              type="button"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo đề mới</span>
            </button>
          </Link>
        </div>
      </div>

      {/* 2. Interactive KPI Cards (1-touch filtering, 2x2 grid on mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        
        {/* Total Exams Card */}
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
            statusFilter === 'ALL'
              ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Tổng đề thi
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {statusCounts?.total ?? (statusFilter === 'ALL' ? (pageMeta?.totalElements ?? '—') : '—')}
          </div>
          <span className="text-[10px] text-zinc-400 truncate">
            Tất cả đề đã tạo
          </span>
        </button>

        {/* Published Exams Card */}
        <button
          type="button"
          onClick={() => setStatusFilter('PUBLISHED')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
            statusFilter === 'PUBLISHED'
              ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Đang mở
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {statusCounts?.published ?? (statusFilter === 'PUBLISHED' ? (pageMeta?.totalElements ?? '—') : '—')}
          </div>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 truncate">
            Thí sinh có thể thi
          </span>
        </button>

        {/* Draft Exams Card */}
        <button
          type="button"
          onClick={() => setStatusFilter('DRAFT')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
            statusFilter === 'DRAFT'
              ? 'bg-amber-50/40 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Bản nháp
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileEdit className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {statusCounts?.draft ?? (statusFilter === 'DRAFT' ? (pageMeta?.totalElements ?? '—') : '—')}
          </div>
          <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 truncate">
            Đang soạn thảo
          </span>
        </button>

        {/* Closed Exams Card */}
        <button
          type="button"
          onClick={() => setStatusFilter('CLOSED')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
            statusFilter === 'CLOSED'
              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 ring-2 ring-zinc-400/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Đã đóng
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {statusCounts?.closed ?? (statusFilter === 'CLOSED' ? (pageMeta?.totalElements ?? '—') : '—')}
          </div>
          <span className="text-[10px] text-zinc-400 truncate">
            Đã kết thúc làm bài
          </span>
        </button>

      </div>

      {/* 3. Search and Segmented Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        {/* Search input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Tìm theo tiêu đề hoặc mã đề thi..."
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              title="Xóa từ khóa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
          {(['ALL', 'PUBLISHED', 'DRAFT', 'CLOSED'] as const).map((status) => {
            const isSelected = statusFilter === status;
            const labels = {
              ALL: 'Tất cả',
              PUBLISHED: 'Đang mở',
              DRAFT: 'Bản nháp',
              CLOSED: 'Đã đóng',
            };

            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {labels[status]}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              fetchExams(currentPage);
              fetchStatusCounts();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-900/60 transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. Main Exam Cards List */}
      {loadError ? (
        <div className="p-8 text-center rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="font-semibold text-rose-900 dark:text-rose-300 text-base">
            Không thể tải danh sách đề thi
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-400 max-w-md mx-auto">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => fetchExams(currentPage)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      ) : isLoading ? (
        /* Loading Skeleton */
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 animate-pulse flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2.5 flex-1">
                <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-2/5" />
                <div className="flex gap-3">
                  <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded w-16" />
                  <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded w-28" />
                  <div className="h-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded w-20" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-24" />
                <div className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-8" />
                <div className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-8" />
              </div>
            </div>
          ))}
        </div>
      ) : exams.length === 0 ? (
        /* Empty State */
        <div className="p-12 sm:p-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-100 dark:border-indigo-900/60">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 mb-1">
            {debouncedSearch || statusFilter !== 'ALL'
              ? 'Không có đề thi phù hợp với bộ lọc'
              : 'Chưa có đề thi nào'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-5">
            {debouncedSearch || statusFilter !== 'ALL'
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bấm tab "Tất cả" để xem toàn bộ.'
              : 'Bắt đầu khởi tạo kỳ thi đầu tiên để gửi mã thi cho học sinh của bạn.'}
          </p>
          <Link href="/teacher/exams/create">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo đề thi mới ngay</span>
            </button>
          </Link>
        </div>
      ) : (
        /* High-End Compact Exam Cards List */
        <div className="space-y-3">
          {exams.map((exam) => {
            const isDraft = exam.status === 'DRAFT';
            const isPublished = exam.status === 'PUBLISHED';
            const isClosed = exam.status === 'CLOSED';
            const isActionBusy = actionInProgressId === exam.id;

            return (
              <div
                key={exam.id}
                className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4"
              >
                {/* Left: Metadata & Title */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    {isPublished && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/60">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        Đang mở
                      </span>
                    )}

                    {isDraft && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60">
                        <FileEdit className="w-3 h-3" />
                        Bản nháp
                      </span>
                    )}

                    {isClosed && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700/80">
                        <Lock className="w-3 h-3" />
                        Đã đóng
                      </span>
                    )}

                    {/* Access code 1-click copy badge */}
                    <button
                      type="button"
                      onClick={() => handleCopyCode(exam.accessCode)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 transition-colors cursor-pointer"
                      title="Bấm để sao chép mã phòng thi"
                    >
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {exam.accessCode}
                      </span>
                      {copiedCode === exam.accessCode ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-400" />
                      )}
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    <Link href={`/teacher/exams/${exam.id}/edit`}>
                      {exam.title}
                    </Link>
                  </h3>

                  {/* Clean Metadata line */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{exam.durationMinutes}&apos;</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{exam.totalQuestions} câu • {exam.totalPoints}đ</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDateTime(exam.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions Cluster (1 Primary CTA + Compact Icon Buttons) */}
                <div className="flex items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 shrink-0">
                  
                  {/* Primary CTA depending on status */}
                  {isPublished && (
                    <Link href={`/teacher/exams/${exam.id}/proctoring?tab=live`}>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
                        title="Mở phòng giám sát thí sinh trực tiếp"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Giám sát</span>
                      </button>
                    </Link>
                  )}

                  {isClosed && (
                    <Link href={`/teacher/exams/${exam.id}/proctoring?tab=attempts`}>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        title="Xem danh sách bài thi và kết quả"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Xem kết quả</span>
                      </button>
                    </Link>
                  )}

                  {isDraft && (
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => handlePublishExam(exam)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
                      title="Xuất bản để thí sinh bắt đầu làm bài"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Xuất bản</span>
                    </button>
                  )}

                  {/* Secondary Action: Edit Icon Button */}
                  <Link href={`/teacher/exams/${exam.id}/edit`}>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                      title="Chỉnh sửa đề thi"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                    </button>
                  </Link>

                  {/* Secondary Action: Duplicate Icon Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenDuplicateModal(exam)}
                    className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                    title="Nhân bản đề thi này"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Secondary Action: Close Exam (when published) */}
                  {isPublished && (
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => handleCloseExam(exam)}
                      className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-700 dark:bg-zinc-800 dark:hover:bg-amber-950/40 dark:text-zinc-300 dark:hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer"
                      title="Đóng kỳ thi"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Secondary Action: Re-open Exam (when closed) */}
                  {isClosed && (
                    <button
                      type="button"
                      onClick={() => handleOpenRepublishModal(exam)}
                      className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 flex items-center justify-center transition-colors cursor-pointer"
                      title="Mở lại đề thi cho đợt thi mới"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Secondary Action: Delete Draft Exam (when draft) */}
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(exam)}
                      className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                      title="Xóa đề nháp"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                </div>
              </div>
            );
          })}

          {/* 5. Pagination Bar */}
          {pageMeta && pageMeta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 px-2">
              <span className="text-xs text-zinc-500 font-mono">
                Trang {pageMeta.page + 1} / {pageMeta.totalPages} ({pageMeta.totalElements} đề thi)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pageMeta.isFirst}
                  onClick={() => fetchExams(currentPage - 1)}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                </button>
                <button
                  type="button"
                  disabled={pageMeta.isLast}
                  onClick={() => fetchExams(currentPage + 1)}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Modal 1: Delete Draft Exam Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Xóa đề thi bản nháp
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Hành động này không thể hoàn tác
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-xs space-y-1">
              <span className="text-[11px] text-zinc-400 block">Đề thi sẽ bị gỡ bỏ:</span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {deleteTarget.title}
              </p>
              <p className="text-[11px] text-zinc-500 font-mono">
                Mã đề: {deleteTarget.accessCode} • {deleteTarget.totalQuestions} câu hỏi
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal 2: Republish Closed Exam Modal */}
      {republishTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Mở lại đợt thi mới
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Mã đề thi: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{republishTarget.accessCode}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRepublishTarget(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-xs">
              <span className="text-[11px] text-zinc-400 block mb-0.5">Tên đề thi:</span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {republishTarget.title}
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-emerald-500" />
                    Bắt đầu mở đề
                  </label>
                  <input
                    type="datetime-local"
                    value={republishStartTime}
                    onChange={(e) => setRepublishStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-rose-500" />
                    Hạn chót thi (Đóng đề) *
                  </label>
                  <input
                    type="datetime-local"
                    value={republishEndTime}
                    onChange={(e) => setRepublishEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" />
                  Thời lượng làm bài (Phút)
                </label>
                <input
                  type="number"
                  min={1}
                  value={republishDuration}
                  onChange={(e) => setRepublishDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setRepublishTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isRepublishing}
                onClick={handleConfirmRepublish}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isRepublishing ? 'Đang mở lại...' : 'Xác nhận mở lại'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal 3: Duplicate Exam Modal */}
      {duplicateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Nhân bản đề thi
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Tạo đề nháp mới sao chép toàn bộ câu hỏi và đáp án
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isDuplicating && setDuplicateTarget(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Tên đề thi bản sao *
                </label>
                <input
                  type="text"
                  value={duplicateTitle}
                  onChange={(e) => setDuplicateTitle(e.target.value)}
                  placeholder="Nhập tên đề thi mới..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  disabled={isDuplicating}
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Sao chép tự động</span>
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-900/80 dark:text-indigo-200/80">
                  Tất cả câu hỏi, điểm số và hình ảnh đính kèm sẽ được nhân bản thành một bản nháp mới với mã phòng ngẫu nhiên.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isDuplicating}
                onClick={() => setDuplicateTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDuplicating}
                onClick={handleConfirmDuplicate}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isDuplicating ? 'Đang nhân bản...' : 'Xác nhận nhân bản'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
