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
  BookOpen,
  User,
  AlertCircle,
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
            `Kiểm duyệt AI hoàn tất: ${status.processedCount} câu hỏi (${status.safeCount} an toàn, ${status.unsafeCount} nghi vấn).`,
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
      toast.success('Đã bắt đầu tiến trình kiểm tra AI tự động!');
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
      toast.success('Đã đặt lại con trỏ duyệt toàn bộ câu hỏi!');
      const updatedStatus = await adminService.getAiModerationStatus();
      setAiJobStatus(updatedStatus);
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
      toast.success(nextSafeStatus ? 'Đã xác nhận an toàn!' : 'Đã gắn cờ cần duyệt!');
      loadStats();
    } catch {
      // Error toast handled by apiClient interceptor
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
      toast.success('Đã xóa câu hỏi thành công!');
      setDeleteModal({ isOpen: false, question: null, isDeleting: false });

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

  // Compact Question Type Badge
  const getQuestionTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'SINGLE_CHOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/40 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" /> Trắc nghiệm 1 đáp án
          </span>
        );
      case 'MULTIPLE_CHOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-900/40 whitespace-nowrap">
            <Layers className="w-3 h-3" /> Nhiều đáp án
          </span>
        );
      case 'NUMERIC':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-900/40 whitespace-nowrap">
            <Hash className="w-3 h-3" /> Điền số
          </span>
        );
      case 'ESSAY_TEXT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/40 whitespace-nowrap">
            <FileText className="w-3 h-3" /> Tự luận
          </span>
        );
      default:
        return null;
    }
  };

  const isFiltered = searchKeyword || filterWithImagesOnly || filterSafetyStatus !== 'ALL' || filterQuestionType !== 'ALL';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 font-sans">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Kiểm duyệt Câu hỏi
            </h1>
            {stats && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                {stats.totalQuestions} câu hỏi
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Giám sát ngân hàng câu hỏi, phát hiện và xử lý nội dung không phù hợp
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* AI Trigger Button */}
          <button
            type="button"
            onClick={handleTriggerAiModeration}
            disabled={aiJobStatus?.running || isTriggeringAi}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
            title="Tự động kiểm tra câu hỏi bằng AI"
          >
            <Sparkles className={`w-3.5 h-3.5 ${aiJobStatus?.running ? 'animate-spin' : ''}`} />
            <span>{aiJobStatus?.running ? 'Đang quét...' : 'Quét AI'}</span>
          </button>

          {/* Reset Cursor Button */}
          <button
            type="button"
            onClick={() => setShowResetCursorModal(true)}
            disabled={aiJobStatus?.running}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            title="Duyệt lại toàn bộ câu hỏi từ đầu"
          >
            <History className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden md:inline">Duyệt lại</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              loadQuestions();
              loadStats();
              checkAiStatus();
            }}
            disabled={isLoading}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
            title="Làm mới dữ liệu"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-zinc-500 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden md:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* AI Moderation Live Status Bar (Compact and lightweight) */}
      {aiJobStatus && (aiJobStatus.running || aiJobStatus.processedCount > 0) && (
        <div className="px-4 py-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Kiểm tra AI:
            </span>
            {aiJobStatus.running ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                Đang quét câu hỏi...
              </span>
            ) : (
              <span className="text-zinc-600 dark:text-zinc-400">
                Lần quét gần nhất: <strong className="text-emerald-600 dark:text-emerald-400">{aiJobStatus.safeCount} an toàn</strong>,{' '}
                <strong className="text-rose-600 dark:text-rose-400">{aiJobStatus.unsafeCount} nghi vấn</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Interactive Metric Filter Tabs (3 in 1: KPI Cards + Filter Tabs) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Tab 1: All Questions */}
        <button
          type="button"
          onClick={() => {
            setFilterSafetyStatus('ALL');
            setCurrentPage(0);
          }}
          className={`p-3 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            filterSafetyStatus === 'ALL'
              ? 'border-indigo-600 bg-white dark:bg-zinc-900 ring-2 ring-indigo-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
              Tất cả
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 sm:mt-2">
            <span className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {isStatsLoading ? '...' : (stats?.totalQuestions ?? 0)}
            </span>
          </div>
        </button>

        {/* Tab 2: Needs Review (Unsafe) */}
        <button
          type="button"
          onClick={() => {
            setFilterSafetyStatus('UNSAFE');
            setCurrentPage(0);
          }}
          className={`p-3 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            filterSafetyStatus === 'UNSAFE'
              ? 'border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 ring-2 ring-amber-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-amber-300 dark:hover:border-amber-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400 truncate">
              Cần duyệt
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 sm:mt-2">
            <span className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
              {isStatsLoading ? '...' : (stats?.unreviewedQuestions ?? 0)}
            </span>
          </div>
        </button>

        {/* Tab 3: Verified Safe */}
        <button
          type="button"
          onClick={() => {
            setFilterSafetyStatus('SAFE');
            setCurrentPage(0);
          }}
          className={`p-3 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            filterSafetyStatus === 'SAFE'
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-300 dark:hover:border-emerald-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              An toàn
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 sm:mt-2">
            <span className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {isStatsLoading ? '...' : (stats?.safeQuestions ?? 0)}
            </span>
          </div>
        </button>
      </div>

      {/* Filter Toolbar (Search + Quick filters) */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm theo nội dung, mã đề thi, đáp án..."
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/50 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => {
                setSearchKeyword('');
                setDebouncedSearch('');
                setCurrentPage(0);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Secondary Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Has Image Filter */}
          <button
            type="button"
            onClick={() => {
              setFilterWithImagesOnly((prev) => !prev);
              setCurrentPage(0);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
              filterWithImagesOnly
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-zinc-50 dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Có ảnh</span>
          </button>

          {/* Question Type Select */}
          <select
            value={filterQuestionType}
            onChange={(e) => {
              setFilterQuestionType(e.target.value as any);
              setCurrentPage(0);
            }}
            className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tất cả loại câu</option>
            <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
            <option value="MULTIPLE_CHOICE">Nhiều đáp án</option>
            <option value="NUMERIC">Điền số</option>
            <option value="ESSAY_TEXT">Tự luận</option>
          </select>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-rose-600 transition-colors whitespace-nowrap underline"
            >
              Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* Main Questions List */}
      {isLoading ? (
        <div className="py-20 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <RotateCcw className="w-7 h-7 animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-2" />
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Đang tải danh sách câu hỏi...
          </p>
        </div>
      ) : questions.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Không có câu hỏi nào
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
              Không tìm thấy câu hỏi phù hợp với bộ lọc hoặc toàn bộ câu hỏi đã an toàn.
            </p>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => {
            const isProcessing = togglingId === question.id;
            return (
              <div
                key={question.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-3.5 hover:shadow-xs transition-shadow"
              >
                {/* Header: Metadata Badges + Exam & Teacher Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                  {/* Left: Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getQuestionTypeBadge(question.questionType)}

                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {question.points}đ
                    </span>

                    {/* Safety Badge */}
                    {question.isSafe ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        An toàn
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Cần duyệt
                      </span>
                    )}

                    {question.attemptsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {question.attemptsCount} lượt làm
                      </span>
                    )}
                  </div>

                  {/* Right: Exam & Teacher breadcrumb */}
                  <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                    {question.exam && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[200px]" title={question.exam.title}>
                        <BookOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                          {question.exam.title}
                        </span>
                      </span>
                    )}
                    {question.teacher && (
                      <span className="inline-flex items-center gap-1 text-zinc-400">
                        <span>•</span>
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {question.teacher.fullName || question.teacher.username}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Body */}
                <div className="space-y-3">
                  {question.content ? (
                    <p className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-line">
                      {question.content}
                    </p>
                  ) : (
                    <p className="text-xs italic text-zinc-400">
                      (Câu hỏi không có nội dung chữ - dùng hình ảnh bên dưới làm đề bài)
                    </p>
                  )}

                  {/* Question Image Attachment */}
                  {question.imageUrl && (
                    <div className="relative inline-block max-w-sm rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-1 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={question.imageUrl}
                        alt="Đề bài"
                        onClick={() => handleOpenLightbox(question.imageUrl!, 'Hình ảnh câu hỏi')}
                        className="w-full h-auto max-h-56 object-contain rounded-lg cursor-zoom-in"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={() => handleOpenLightbox(question.imageUrl!, 'Hình ảnh câu hỏi')}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white backdrop-blur-xs transition-colors"
                        title="Phóng to"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Options / Answers Flat Grid */}
                {(question.questionType === 'SINGLE_CHOICE' || question.questionType === 'MULTIPLE_CHOICE') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {question.options?.map((option, idx) => {
                      const optionLabel = String.fromCharCode(65 + idx);
                      const isCorrect = option.isCorrect;
                      return (
                        <div
                          key={option.id || idx}
                          className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
                            isCorrect
                              ? 'bg-emerald-500/5 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
                              : 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200/70 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {optionLabel}
                          </span>

                          <div className="flex-1 min-w-0">
                            <span className="leading-snug break-words">
                              {option.content || <span className="italic text-zinc-400">(Xem hình ảnh)</span>}
                            </span>

                            {option.imageUrl && (
                              <div className="mt-1.5 relative inline-block rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={option.imageUrl}
                                  alt={`Đáp án ${optionLabel}`}
                                  onClick={() => handleOpenLightbox(option.imageUrl!, `Đáp án ${optionLabel}`)}
                                  className="h-20 w-auto object-contain rounded cursor-zoom-in"
                                  loading="lazy"
                                />
                              </div>
                            )}
                          </div>

                          {isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Numeric Answer */}
                {question.questionType === 'NUMERIC' && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs flex items-center justify-between">
                    <span className="text-zinc-500 font-medium">Đáp án số:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono text-sm">
                      {question.sampleAnswer || 'N/A'} (±{question.numericTolerance ?? 0})
                    </span>
                  </div>
                )}

                {/* Essay Answer */}
                {question.questionType === 'ESSAY_TEXT' && (question.gradingRubric || question.sampleAnswer) && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-1.5">
                    {question.gradingRubric && (
                      <div>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Tiêu chí: </span>
                        <span className="text-zinc-600 dark:text-zinc-400">{question.gradingRubric}</span>
                      </div>
                    )}
                    {question.sampleAnswer && (
                      <div>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Bài giải mẫu: </span>
                        <span className="text-zinc-600 dark:text-zinc-400">{question.sampleAnswer}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Card Action Footer */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex-wrap sm:flex-nowrap">
                  <div className="text-xs text-zinc-400">
                    {question.isSafe && question.reviewedByName ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Duyệt bởi {question.reviewedByName}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Chưa duyệt
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-auto">
                    {/* Toggle Safe Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleSafety(question)}
                      disabled={isProcessing}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-2xs active:scale-95 ${
                        question.isSafe
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isProcessing ? (
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : question.isSafe ? (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>{question.isSafe ? 'Bỏ an toàn' : 'Duyệt an toàn'}</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(question)}
                      disabled={isProcessing}
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Xóa câu hỏi này"
                    >
                      <Trash2 className="w-4 h-4" />
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
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-800 flex-wrap">
          <div className="text-xs text-zinc-400">
            Trang <strong className="text-zinc-800 dark:text-zinc-200">{currentPage + 1}</strong> / {totalPages} ({totalElements} câu hỏi)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" /> Trước
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage >= totalPages - 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-2xs"
            >
              Sau <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightbox.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setLightbox({ isOpen: false, imageUrl: '', title: '' })}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white pb-2.5">
              <span className="text-xs sm:text-sm font-semibold truncate">{lightbox.title}</span>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Mở ảnh gốc"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setLightbox({ isOpen: false, imageUrl: '', title: '' })}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative w-full max-h-[75vh] rounded-2xl overflow-hidden bg-black/90 border border-white/10 flex items-center justify-center p-2 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.imageUrl}
                alt={lightbox.title}
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => {
            if (!deleteModal.isDeleting) {
              setDeleteModal({ isOpen: false, question: null, isDeleting: false });
            }
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Xác nhận xóa câu hỏi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, question: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                {deleteModal.question.content || '(Câu hỏi hình ảnh)'}
              </p>

              {deleteModal.question.attemptsCount > 0 ? (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    Câu hỏi đã có <strong>{deleteModal.question.attemptsCount}</strong> lượt làm bài. Khi xóa, các bài làm liên quan sẽ được tự động xử lý.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Câu hỏi sẽ bị xóa vĩnh viễn khỏi ngân hàng đề thi.</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, question: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteModal.isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs disabled:opacity-60"
              >
                {deleteModal.isDeleting ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa câu hỏi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset AI Cursor Modal */}
      {showResetCursorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                Duyệt lại toàn bộ câu hỏi
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Hệ thống sẽ quét lại toàn bộ ngân hàng câu hỏi thay vì chỉ quét các câu hỏi mới thêm để bảo đảm mọi nội dung đều tuân thủ quy định.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowResetCursorModal(false)}
                disabled={isResettingCursor}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetCursor}
                disabled={isResettingCursor}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs disabled:opacity-60"
              >
                {isResettingCursor ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang đặt lại...</span>
                  </>
                ) : (
                  <>
                    <History className="w-3.5 h-3.5" />
                    <span>Xác nhận</span>
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
