'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  HelpCircle,
  Hash,
  Layers,
  Sparkles,
  Bot,
  History,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '@/services/admin.service';
import type {
  AdminModerationQuestion,
  AdminModerationStats,
  ModerationFilterParams,
  AiModerationJobStatusResponse,
} from '@/types/admin';
import type { QuestionType } from '@/types/exam';

interface LightboxState {
  isOpen: boolean;
  imageUrl: string;
  title: string;
}

interface DeleteModalState {
  isOpen: boolean;
  question: AdminModerationQuestion | null;
  isDeleting: boolean;
}

export default function AdminContentModerationPage() {
  // Moderation questions state
  const [questions, setQuestions] = useState<AdminModerationQuestion[]>([]);
  const [stats, setStats] = useState<AdminModerationStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);
  const pageSize = 8;

  // Filter state
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [filterWithImagesOnly, setFilterWithImagesOnly] = useState<boolean>(false);
  const [filterSafetyStatus, setFilterSafetyStatus] = useState<'ALL' | 'UNSAFE' | 'SAFE'>('ALL');
  const [filterQuestionType, setFilterQuestionType] = useState<QuestionType | 'ALL'>('ALL');

  // Debounce search input for real-time querying
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
      setCurrentPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Interactive Modals state
  const [lightbox, setLightbox] = useState<LightboxState>({
    isOpen: false,
    imageUrl: '',
    title: '',
  });

  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    question: null,
    isDeleting: false,
  });

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // AI Moderation state
  const [aiJobStatus, setAiJobStatus] = useState<AiModerationJobStatusResponse | null>(null);
  const [isTriggeringAi, setIsTriggeringAi] = useState<boolean>(false);
  const [showResetCursorModal, setShowResetCursorModal] = useState<boolean>(false);
  const [isResettingCursor, setIsResettingCursor] = useState<boolean>(false);

  // Load KPI Stats
  const loadStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const data = await adminService.getModerationStats();
      setStats(data);
    } catch {
      // Handled by global axios interceptor
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Load Questions Feed
  const loadQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: ModerationFilterParams = {
        page: currentPage,
        size: pageSize,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (filterWithImagesOnly) {
        params.hasImage = true;
      }

      if (filterSafetyStatus === 'UNSAFE') {
        params.isSafe = false;
      } else if (filterSafetyStatus === 'SAFE') {
        params.isSafe = true;
      }

      if (filterQuestionType !== 'ALL') {
        params.questionType = filterQuestionType;
      }

      const res = await adminService.getModerationQuestions(params);

      // Auto-fallback: If current page has no content but earlier pages exist
      if ((!res.content || res.content.length === 0) && currentPage > 0 && (res.totalElements || 0) > 0) {
        setCurrentPage((prev) => Math.max(0, prev - 1));
        return;
      }

      setQuestions(res.content || []);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || 0);
    } catch {
      // Handled by global axios interceptor
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, filterWithImagesOnly, filterSafetyStatus, filterQuestionType]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Check AI Moderation status
  const checkAiStatus = useCallback(async () => {
    try {
      const status = await adminService.getAiModerationStatus();
      setAiJobStatus(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    checkAiStatus();
  }, [checkAiStatus]);

  // Polling when AI moderation background job is running
  useEffect(() => {
    if (!aiJobStatus?.running) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const status = await adminService.getAiModerationStatus();
        if (!isMounted) return;
        setAiJobStatus(status);
        if (!status.running) {
          clearInterval(interval);
          loadQuestions();
          loadStats();
          toast.success(
            `Kiểm duyệt AI hoàn tất: Đã đánh giá ${status.processedCount} câu hỏi (${status.safeCount} an toàn, ${status.unsafeCount} nghi vấn).`,
            { id: 'ai-moderation-complete' }
          );
        }
      } catch {
        // Silently continue polling
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [aiJobStatus?.running, loadQuestions, loadStats]);

  // Trigger AI Moderation background job
  const handleTriggerAiModeration = async () => {
    try {
      setIsTriggeringAi(true);
      const res = await adminService.triggerAiModeration();
      setAiJobStatus(res);
      toast.success('Đã kích hoạt tác vụ kiểm duyệt AI trong nền');
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsTriggeringAi(false);
    }
  };

  // Reset AI Moderation Cursor
  const handleConfirmResetCursor = async () => {
    try {
      setIsResettingCursor(true);
      await adminService.resetAiModerationCursor();
      setShowResetCursorModal(false);
      const updatedStatus = await adminService.getAiModerationStatus();
      setAiJobStatus(updatedStatus);
      toast.success('Đã đặt lại con trỏ AI về đầu danh sách');
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsResettingCursor(false);
    }
  };

  // Handle Search Input Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchKeyword);
    setCurrentPage(0);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchKeyword('');
    setDebouncedSearch('');
    setFilterWithImagesOnly(false);
    setFilterSafetyStatus('ALL');
    setFilterQuestionType('ALL');
    setCurrentPage(0);
  };

  // Toggle Safety Flag
  const handleToggleSafety = async (question: AdminModerationQuestion) => {
    const nextSafeStatus = !question.isSafe;
    try {
      setTogglingId(question.id);
      const updated = await adminService.updateQuestionSafety(question.id, nextSafeStatus);
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? updated : q))
      );
      loadStats();
      toast.success(nextSafeStatus ? 'Đã xác minh câu hỏi an toàn' : 'Đã gắn cờ câu hỏi cần xem xét');
    } catch {
      // Error toast is automatically handled by apiClient interceptor
    } finally {
      setTogglingId(null);
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (question: AdminModerationQuestion) => {
    setDeleteModal({
      isOpen: true,
      question,
      isDeleting: false,
    });
  };

  // Confirm Delete Question
  const handleConfirmDelete = async () => {
    if (!deleteModal.question) return;
    try {
      setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
      await adminService.deleteModerationQuestion(deleteModal.question.id);
      setDeleteModal({ isOpen: false, question: null, isDeleting: false });
      toast.success('Đã xóa vĩnh viễn câu hỏi thành công');

      if (questions.length <= 1 && currentPage > 0) {
        setCurrentPage((prev) => Math.max(0, prev - 1));
      } else {
        loadQuestions();
      }
      loadStats();
    } catch {
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Open Lightbox
  const handleOpenLightbox = (imageUrl: string, title: string) => {
    setLightbox({
      isOpen: true,
      imageUrl,
      title,
    });
  };

  const getQuestionTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'SINGLE_CHOICE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50">
            <CheckCircle2 className="w-3.5 h-3.5" /> Trắc nghiệm 1 đáp án
          </span>
        );
      case 'MULTIPLE_CHOICE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
            <Layers className="w-3.5 h-3.5" /> Trắc nghiệm nhiều đáp án
          </span>
        );
      case 'NUMERIC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900/50">
            <Hash className="w-3.5 h-3.5" /> Điền số
          </span>
        );
      case 'ESSAY_TEXT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
            <FileText className="w-3.5 h-3.5" /> Tự luận
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" /> Quản trị kiểm duyệt
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Kiểm duyệt Nội dung Câu hỏi
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Giám sát toàn bộ ngân hàng câu hỏi, kiểm tra hình ảnh trực tiếp, phát hiện nội dung độc hại và gỡ bỏ vi phạm
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* AI Auto-Moderation Button */}
          <button
            type="button"
            onClick={handleTriggerAiModeration}
            disabled={aiJobStatus?.running || isTriggeringAi}
            className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-75 disabled:cursor-not-allowed border border-violet-400/30 group"
          >
            <Sparkles className={`w-4 h-4 ${aiJobStatus?.running ? 'animate-spin text-amber-300' : 'text-violet-200 group-hover:scale-110 transition-transform'}`} />
            <span>{aiJobStatus?.running ? 'AI đang duyệt...' : 'Chạy kiểm duyệt AI'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadQuestions();
              loadStats();
              checkAiStatus();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-all duration-200 disabled:opacity-60 shadow-sm"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* AI Moderation Interactive Hub */}
      {aiJobStatus && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-500/5 via-indigo-500/5 to-purple-500/5 border border-violet-200 dark:border-violet-800/50 shadow-sm transition-all duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Status info */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-violet-600/10 dark:bg-violet-400/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center shrink-0">
                {aiJobStatus.running ? (
                  <Sparkles className="w-5 h-5 animate-spin" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Hệ thống AI Kiểm duyệt Nội dung (Gemini)
                  </span>
                  {aiJobStatus.running ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                      Đang xử lý theo lô
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      <Check className="w-3 h-3 text-emerald-500" /> Sẵn sàng
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Đánh giá toàn diện nội dung, phương án đáp án và hình ảnh để phát hiện ngôn từ thù địch, gian lận hoặc vi phạm chính sách
                </p>
              </div>
            </div>

            {/* Right: Actions and Metrics */}
            <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
              {aiJobStatus.processedCount > 0 && (
                <div className="text-xs bg-white/80 dark:bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-violet-200/60 dark:border-violet-800/40 text-zinc-700 dark:text-zinc-300 shadow-sm flex items-center gap-2">
                  <span>Lần chạy gần nhất:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {aiJobStatus.safeCount} an toàn
                  </strong>
                  <span>/</span>
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">
                    {aiJobStatus.unsafeCount} nghi vấn
                  </strong>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowResetCursorModal(true)}
                disabled={aiJobStatus.running}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-sm"
                title="Đặt lại con trỏ duyệt về đầu danh sách"
              >
                <History className="w-3.5 h-3.5 text-zinc-500" />
                <span>Đặt lại con trỏ AI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats Grid (Đồng bộ chuẩn 3 card thống kê của Dashboard) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Total Questions */}
        <div
          onClick={() => {
            setFilterSafetyStatus('ALL');
            setCurrentPage(0);
          }}
          className={`p-6 rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-200 shadow-sm cursor-pointer group ${
            filterSafetyStatus === 'ALL'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Tổng số câu hỏi
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">
            {isStatsLoading ? '...' : (stats?.totalQuestions ?? 0)}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Toàn bộ câu hỏi trong hệ thống</p>
        </div>

        {/* Needs Review / Unsafe Questions */}
        <div
          onClick={() => {
            setFilterSafetyStatus((prev) => (prev === 'UNSAFE' ? 'ALL' : 'UNSAFE'));
            setCurrentPage(0);
          }}
          className={`p-6 rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-200 shadow-sm cursor-pointer group ${
            filterSafetyStatus === 'UNSAFE'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/10'
              : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-800/80'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Cần kiểm duyệt
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {isStatsLoading ? '...' : (stats?.unreviewedQuestions ?? 0)}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {filterSafetyStatus === 'UNSAFE' ? 'Đang lọc câu cần duyệt (Click để bỏ lọc)' : 'Chưa được duyệt hoặc bị gắn cờ'}
          </p>
        </div>

        {/* Verified Safe */}
        <div
          onClick={() => {
            setFilterSafetyStatus((prev) => (prev === 'SAFE' ? 'ALL' : 'SAFE'));
            setCurrentPage(0);
          }}
          className={`p-6 rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-200 shadow-sm cursor-pointer group ${
            filterSafetyStatus === 'SAFE'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10'
              : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-800/80'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Đã xác minh an toàn
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {isStatsLoading ? '...' : (stats?.safeQuestions ?? 0)}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {filterSafetyStatus === 'SAFE' ? 'Đang lọc câu an toàn (Click để bỏ lọc)' : 'Đã đạt tiêu chuẩn an toàn'}
          </p>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo tiêu đề kỳ thi, mã truy cập (ví dụ: VF4TKH), nội dung câu hỏi hoặc đáp án..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword('');
                  setDebouncedSearch('');
                  setCurrentPage(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md"
                title="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Quick Toggle: Has Image Button */}
          <button
            type="button"
            onClick={() => {
              setFilterWithImagesOnly((prev) => !prev);
              setCurrentPage(0);
            }}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
              filterWithImagesOnly
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Chỉ câu có hình ảnh</span>
            {filterWithImagesOnly && (
              <span className="w-2 h-2 rounded-full bg-white ml-0.5" />
            )}
          </button>
        </div>

        {/* Secondary Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {/* Safety Status Segmented Control */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setFilterSafetyStatus('ALL');
                setCurrentPage(0);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterSafetyStatus === 'ALL'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Tất cả trạng thái
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterSafetyStatus('UNSAFE');
                setCurrentPage(0);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterSafetyStatus === 'UNSAFE'
                  ? 'bg-amber-500 text-white font-semibold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Cần kiểm duyệt
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterSafetyStatus('SAFE');
                setCurrentPage(0);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterSafetyStatus === 'SAFE'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Đã xác minh an toàn
            </button>
          </div>

          {/* Question Type Filter & Reset Button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 hidden sm:inline">
                Loại câu:
              </span>
              <select
                value={filterQuestionType}
                onChange={(e) => {
                  setFilterQuestionType(e.target.value as any);
                  setCurrentPage(0);
                }}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">Tất cả loại câu hỏi</option>
                <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
                <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều đáp án</option>
                <option value="NUMERIC">Điền số</option>
                <option value="ESSAY_TEXT">Tự luận</option>
              </select>
            </div>

            {(searchKeyword || filterWithImagesOnly || filterSafetyStatus !== 'ALL' || filterQuestionType !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 transition-colors"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <RotateCcw className="w-8 h-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-3" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Đang tải danh sách câu hỏi kiểm duyệt...
          </p>
        </div>
      ) : questions.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Không tìm thấy câu hỏi nào
            </h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Không có câu hỏi nào khớp với tiêu chí tìm kiếm hoặc toàn bộ ngân hàng câu hỏi đã được kiểm duyệt an toàn.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            Đặt lại tất cả bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {questions.map((question) => {
            const isProcessing = togglingId === question.id;
            return (
              <div
                key={question.id}
                className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 space-y-5"
              >
                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getQuestionTypeBadge(question.questionType)}

                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      {question.points} {question.points === 1 ? 'điểm' : 'điểm'}
                    </span>

                    {/* Safety Flag Badge */}
                    {question.isSafe ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Đã xác minh an toàn
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Cần kiểm duyệt
                      </span>
                    )}

                    {/* Submissions Badge */}
                    {question.attemptsCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                        {question.attemptsCount} lượt làm bài
                      </span>
                    )}
                  </div>

                  {/* Exam and Teacher Metadata */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    {question.exam && (
                      <span className="font-medium bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80">
                        Đề thi:{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          {question.exam.title}
                        </strong>{' '}
                        ({question.exam.accessCode})
                      </span>
                    )}
                    {question.teacher && (
                      <span className="font-medium bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80">
                        Giáo viên:{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          {question.teacher.fullName || question.teacher.username}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Content & Direct Visible Image */}
                <div className="space-y-4">
                  {question.content ? (
                    <div className="text-base text-zinc-900 dark:text-zinc-100 font-medium leading-relaxed break-words whitespace-pre-line">
                      {question.content}
                    </div>
                  ) : (
                    <div className="text-sm italic text-zinc-400">
                      (Không có nội dung văn bản - câu hỏi sử dụng hình ảnh làm đề bài)
                    </div>
                  )}

                  {/* Question Image Attachment: DIRECTLY VISIBLE ON CARD */}
                  {question.imageUrl && (
                    <div className="mt-3 max-w-lg rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-1.5 relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={question.imageUrl}
                        alt="Hình ảnh đính kèm câu hỏi"
                        onClick={() =>
                          handleOpenLightbox(question.imageUrl!, 'Hình ảnh đính kèm câu hỏi')
                        }
                        className="w-full h-auto object-contain max-h-[340px] rounded-lg cursor-zoom-in transition-all duration-200 hover:opacity-95"
                        loading="lazy"
                      />
                      <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenLightbox(question.imageUrl!, 'Hình ảnh đính kèm câu hỏi')
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/80 hover:bg-black/95 text-white backdrop-blur-md border border-white/20 transition-all shadow-md active:scale-95"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Phóng to</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Answer Options & Rubric Display */}
                <div className="p-4 sm:p-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Cấu hình đáp án & Tiêu chí chấm
                  </div>

                  {/* Choice Types (SINGLE_CHOICE / MULTIPLE_CHOICE) */}
                  {(question.questionType === 'SINGLE_CHOICE' ||
                    question.questionType === 'MULTIPLE_CHOICE') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {question.options?.map((option, idx) => {
                        const optionLabel = String.fromCharCode(65 + idx);
                        const isCorrect = option.isCorrect;
                        return (
                          <div
                            key={option.id || idx}
                            className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                              isCorrect
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500/50 text-emerald-950 dark:text-emerald-200'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              {optionLabel}
                            </span>

                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="text-sm font-medium break-words leading-snug">
                                {option.content || (
                                  <span className="italic text-zinc-400">
                                    (Đáp án chỉ có hình ảnh)
                                  </span>
                                )}
                              </div>

                              {/* Option Image: DIRECTLY VISIBLE IN OPTION BOX */}
                              {option.imageUrl && (
                                <div className="mt-2 relative inline-block rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 p-1 group/opt">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={option.imageUrl}
                                    alt={`Hình ảnh đáp án ${optionLabel}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenLightbox(
                                        option.imageUrl!,
                                        `Hình ảnh đáp án ${optionLabel}`
                                      );
                                    }}
                                    className="w-full h-auto object-contain max-h-36 max-w-[200px] rounded cursor-zoom-in transition-all hover:opacity-95"
                                    loading="lazy"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenLightbox(
                                        option.imageUrl!,
                                        `Hình ảnh đáp án ${optionLabel}`
                                      );
                                    }}
                                    className="absolute bottom-2 right-2 p-1 rounded-md bg-black/70 hover:bg-black/90 text-white backdrop-blur-sm transition-all"
                                    title="Phóng to"
                                  >
                                    <Maximize2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {isCorrect && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Numeric Type */}
                  {question.questionType === 'NUMERIC' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <span className="text-xs text-zinc-500 font-semibold uppercase">
                          Đáp án số mục tiêu:
                        </span>
                        <div className="text-base font-bold text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                          {question.sampleAnswer || 'N/A'}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <span className="text-xs text-zinc-500 font-semibold uppercase">
                          Biên độ dung sai cho phép (±):
                        </span>
                        <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                          {question.numericTolerance ?? 0.0}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Essay Type */}
                  {question.questionType === 'ESSAY_TEXT' && (
                    <div className="space-y-2.5">
                      {question.gradingRubric && (
                        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                          <span className="text-xs text-zinc-500 font-semibold uppercase">
                            Tiêu chí chấm điểm (Rubric / Context Prompt):
                          </span>
                          <div className="text-sm text-zinc-800 dark:text-zinc-200 mt-1 whitespace-pre-line leading-relaxed">
                            {question.gradingRubric}
                          </div>
                        </div>
                      )}
                      {question.sampleAnswer && (
                        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                          <span className="text-xs text-zinc-500 font-semibold uppercase">
                            Bài giải / Đáp án tham khảo:
                          </span>
                          <div className="text-sm text-zinc-800 dark:text-zinc-200 mt-1 whitespace-pre-line leading-relaxed">
                            {question.sampleAnswer}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500">
                    {question.isSafe && question.reviewedByName ? (
                      <span>
                        Xác nhận an toàn bởi{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">
                          {question.reviewedByName}
                        </strong>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Chưa kiểm duyệt hoặc mới chỉnh sửa
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    {/* Safety Flag Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleSafety(question)}
                      disabled={isProcessing}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm disabled:opacity-60 active:scale-[0.98] ${
                        question.isSafe
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isProcessing ? (
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : question.isSafe ? (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>{question.isSafe ? 'Bỏ đánh dấu an toàn' : 'Đánh dấu an toàn'}</span>
                    </button>

                    {/* Delete Question Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(question)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 transition-colors"
                      title="Xóa vĩnh viễn câu hỏi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa câu hỏi</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">
            Hiển thị trang{' '}
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{currentPage + 1}</strong> trên{' '}
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{totalPages}</strong> ({totalElements} câu hỏi)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0 || isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Trang trước
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage >= totalPages - 1 || isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-sm"
            >
              Trang sau <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightbox.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightbox({ isOpen: false, imageUrl: '', title: '' })}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Lightbox Bar */}
            <div className="w-full flex items-center justify-between text-white pb-3">
              <span className="text-sm font-semibold truncate">{lightbox.title}</span>
              <div className="flex items-center gap-2.5">
                <a
                  href={lightbox.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Mở ảnh gốc trong tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setLightbox({ isOpen: false, imageUrl: '', title: '' })}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Preview Box */}
            <div className="relative w-full max-h-[75vh] rounded-2xl overflow-hidden bg-black/90 border border-white/15 flex items-center justify-center p-2 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.imageUrl}
                alt={lightbox.title}
                className="max-h-[72vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.question && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!deleteModal.isDeleting) {
              setDeleteModal({ isOpen: false, question: null, isDeleting: false });
            }
          }}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 px-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Xác nhận xóa câu hỏi
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Thao tác này sẽ xóa vĩnh viễn câu hỏi khỏi ngân hàng đề thi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, question: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>ID: {deleteModal.question.id.substring(0, 8)}...</span>
                  {getQuestionTypeBadge(deleteModal.question.questionType)}
                </div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 line-clamp-3">
                  {deleteModal.question.content || '(Câu hỏi sử dụng hình ảnh làm đề bài)'}
                </p>
                {deleteModal.question.imageUrl && (
                  <div className="relative max-w-xs rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={deleteModal.question.imageUrl}
                      alt="Ảnh xem trước"
                      className="w-full h-auto max-h-32 object-contain"
                    />
                  </div>
                )}
              </div>

              {deleteModal.question.attemptsCount > 0 ? (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800/60 text-xs sm:text-sm text-rose-900 dark:text-rose-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">CẢNH BÁO QUAN TRỌNG:</strong>
                    <p className="mt-1 leading-relaxed">
                      Câu hỏi này đã có <strong>{deleteModal.question.attemptsCount}</strong> lượt làm bài của thí sinh. Khi xóa, hệ thống sẽ tự động dọn dẹp các câu trả lời liên quan để tránh lỗi toàn vẹn dữ liệu.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Nội dung câu hỏi và hình ảnh Cloudinary liên kết sẽ bị xóa vĩnh viễn.</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 px-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, question: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteModal.isDeleting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {deleteModal.isDeleting ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa vĩnh viễn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset AI Cursor Modal */}
      {showResetCursorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Đặt lại con trỏ duyệt AI
                </h3>
                <p className="text-xs text-zinc-500">
                  Đưa điểm đánh dấu duyệt AI về đầu danh sách câu hỏi
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Việc đặt lại con trỏ sẽ xóa vị trí lưu vết hiện tại ({aiJobStatus?.lastProcessedId ? `đang ở ID: ${aiJobStatus.lastProcessedId.substring(0, 8)}...` : 'chưa thiết lập'}). Lần chạy kiểm duyệt AI tiếp theo sẽ quét lại từ câu hỏi đầu tiên.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetCursorModal(false)}
                disabled={isResettingCursor}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResetCursor}
                disabled={isResettingCursor}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {isResettingCursor ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang đặt lại...</span>
                  </>
                ) : (
                  <>
                    <History className="w-3.5 h-3.5" />
                    <span>Xác nhận đặt lại</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
