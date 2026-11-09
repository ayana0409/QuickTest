'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Eye,
  X,
  Check,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User,
  Film,
  Image as ImageIcon,
  Calendar,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminProctoringMediaService } from '@/services/adminProctoringMediaService';
import { EvidenceMediaViewer } from '@/components/proctoring/EvidenceMediaViewer';
import type {
  AdminProctoringMedia,
  AdminProctoringMediaStats,
  ProctoringMediaCleanupStatus,
  ProctoringViolationType,
} from '@/types/proctoringMedia';

export default function AdminProctoringMediaPage() {
  // Main Data States
  const [mediaList, setMediaList] = useState<AdminProctoringMedia[]>([]);
  const [stats, setStats] = useState<AdminProctoringMediaStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(24);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);

  // Filter States
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedViolationType, setSelectedViolationType] = useState<string>('ALL');
  const [selectedTimePreset, setSelectedTimePreset] = useState<string>('ALL');

  // Selection States for Batch Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBatch, setIsDeletingBatch] = useState<boolean>(false);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState<boolean>(false);

  // Detail Modal State
  const [selectedMedia, setSelectedMedia] = useState<AdminProctoringMedia | null>(null);

  // Conditional Cleanup Modal & Status States
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState<boolean>(false);
  const [cleanupDays, setCleanupDays] = useState<number>(30);
  const [cleanupViolationType, setCleanupViolationType] = useState<string>('ALL');
  const [cleanupOnlyFinished, setCleanupOnlyFinished] = useState<boolean>(true);
  const [cleanupPreviewCount, setCleanupPreviewCount] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isTriggeringCleanup, setIsTriggeringCleanup] = useState<boolean>(false);
  const [cleanupStatus, setCleanupStatus] = useState<ProctoringMediaCleanupStatus | null>(null);

  // Single Deletion State
  const [itemToDelete, setItemToDelete] = useState<AdminProctoringMedia | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const handleCopyLink = useCallback((url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success('Đã sao chép liên kết');
    setTimeout(() => setCopiedUrl(false), 2000);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
      setCurrentPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Compute date range from time preset
  const dateRange = useMemo(() => {
    const now = new Date();
    if (selectedTimePreset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { startDate: start.toISOString(), endDate: undefined };
    }
    if (selectedTimePreset === '7_DAYS') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString(), endDate: undefined };
    }
    if (selectedTimePreset === 'OLDER_30') {
      const end = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: undefined, endDate: end.toISOString() };
    }
    if (selectedTimePreset === 'OLDER_90') {
      const end = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { startDate: undefined, endDate: end.toISOString() };
    }
    return { startDate: undefined, endDate: undefined };
  }, [selectedTimePreset]);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const res = await adminProctoringMediaService.getStats();
      setStats(res);
    } catch {
      // Handled silently
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Fetch Media List
  const fetchMedia = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminProctoringMediaService.searchMedia({
        violationType: selectedViolationType !== 'ALL' ? selectedViolationType : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        search: debouncedSearch || undefined,
        page: currentPage,
        size: pageSize,
      });

      setMediaList(res?.content || []);
      setTotalPages(res?.totalPages || 1);
      setTotalElements(res?.totalElements || 0);
    } catch {
      toast.error('Không thể tải danh sách ảnh giám sát');
    } finally {
      setIsLoading(false);
    }
  }, [selectedViolationType, dateRange, debouncedSearch, currentPage, pageSize]);

  // Initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Poll background cleanup status
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        const res = await adminProctoringMediaService.getCleanupStatus();
        setCleanupStatus(res);
        if (!res?.isRunning && interval) {
          clearInterval(interval);
          interval = null;
          fetchStats();
          fetchMedia();
        }
      } catch {
        // Silent
      }
    };

    checkStatus();

    if (cleanupStatus?.isRunning) {
      interval = setInterval(checkStatus, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cleanupStatus?.isRunning, fetchStats, fetchMedia]);

  // Live preview for cleanup modal
  useEffect(() => {
    if (!isCleanupModalOpen) return;

    let isMounted = true;
    setIsPreviewLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await adminProctoringMediaService.getCleanupPreview(
          cleanupDays,
          cleanupViolationType,
          undefined,
          cleanupOnlyFinished
        );
        if (isMounted) {
          setCleanupPreviewCount(res.matchingCount);
        }
      } catch {
        if (isMounted) setCleanupPreviewCount(0);
      } finally {
        if (isMounted) setIsPreviewLoading(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isCleanupModalOpen, cleanupDays, cleanupViolationType, cleanupOnlyFinished]);

  // Toggle selection
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllCurrentPageSelected = useMemo(() => {
    if (mediaList.length === 0) return false;
    return mediaList.every((item) => selectedIds.has(item.id));
  }, [mediaList, selectedIds]);

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        mediaList.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        mediaList.forEach((item) => next.add(item.id));
        return next;
      });
    }
  };

  // Delete selected batch
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeletingBatch(true);
    try {
      await adminProctoringMediaService.deleteSelectedMedia(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsBatchDeleteModalOpen(false);
      fetchStats();
      fetchMedia();
    } catch {
      // Handled automatically by axios interceptor
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Delete single media
  const handleSingleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeletingSingle(true);
    try {
      await adminProctoringMediaService.deleteSingleMedia(itemToDelete.id);
      if (selectedMedia?.id === itemToDelete.id) {
        setSelectedMedia(null);
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemToDelete.id);
        return next;
      });
      setItemToDelete(null);
      fetchStats();
      fetchMedia();
    } catch {
      // Handled automatically by axios interceptor
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Trigger conditional background cleanup
  const handleTriggerCleanup = async () => {
    setIsTriggeringCleanup(true);
    try {
      const res = await adminProctoringMediaService.triggerBatchCleanup({
        days: cleanupDays,
        violationType: cleanupViolationType !== 'ALL' ? cleanupViolationType : undefined,
        onlyFinishedExams: cleanupOnlyFinished,
        batchSize: 100,
      });
      setCleanupStatus(res);
      setIsCleanupModalOpen(false);
    } catch {
      // Handled automatically by axios interceptor
    } finally {
      setIsTriggeringCleanup(false);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchKeyword('');
    setSelectedViolationType('ALL');
    setSelectedTimePreset('ALL');
    setCurrentPage(0);
  };

  // Format relative time in Vietnamese
  const formatRelativeTime = (timestampStr: string) => {
    try {
      const date = new Date(timestampStr);
      const diffMs = Date.now() - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return 'Vừa xong';
      if (diffMinutes < 60) return `${diffMinutes} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 30) return `${diffDays} ngày trước`;
      return date.toLocaleDateString('vi-VN');
    } catch {
      return '';
    }
  };

  // Violation human title
  const getViolationFriendlyName = (type: ProctoringViolationType) => {
    switch (type) {
      case 'NO_FACE_DETECTED':
        return 'Không thấy mặt thí sinh';
      case 'MULTIPLE_FACES':
        return 'Nhiều người trong khung hình';
      case 'TAB_SWITCH':
        return 'Chuyển tab trình duyệt';
      case 'WINDOW_BLUR':
        return 'Rời cửa sổ bài thi';
      case 'EXIT_FULLSCREEN':
        return 'Thoát toàn màn hình';
      case 'MULTI_SCREEN':
        return 'Dùng nhiều màn hình';
      default:
        return 'Vi phạm quy chế thi';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5 pb-12">
      {/* 1. Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Ảnh Giám sát Vi phạm
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lưu vết hình ảnh vi phạm và giải phóng dung lượng lưu trữ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchMedia();
              toast.success('Đã làm mới dữ liệu ảnh giám sát');
            }}
            disabled={isLoading || isStatsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCleanupModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-900/60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Dọn dẹp ảnh cũ</span>
          </button>
        </div>
      </div>

      {/* 2. Background Task Progress Banner */}
      {cleanupStatus?.isRunning && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Đang xử lý dọn dẹp ảnh cũ trong nền</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-medium">
                  Đã xóa: {cleanupStatus.totalDeleted} ảnh
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {cleanupStatus.message || 'Hệ thống đang giải phóng lưu trữ đám mây theo từng đợt...'}
              </p>
            </div>
          </div>

          {cleanupStatus.estimatedRemaining > 0 && (
            <div className="text-xs text-indigo-600 dark:text-indigo-400 self-end sm:self-auto font-mono">
              Ước tính còn: ~{cleanupStatus.estimatedRemaining} ảnh
            </div>
          )}
        </div>
      )}

      {/* 3. Overview KPI Cards (2x2 on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Images */}
        <button
          type="button"
          onClick={() => {
            setSelectedTimePreset('ALL');
            setSelectedViolationType('ALL');
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedTimePreset === 'ALL' && selectedViolationType === 'ALL'
              ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">
              Tổng số ảnh lưu
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              {isStatsLoading ? '...' : (stats?.totalMediaCount ?? 0).toLocaleString('vi-VN')}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
              {stats?.singleSnapshotCount ?? 0} chụp • {stats?.burstAnimationCount ?? 0} động
            </div>
          </div>
        </button>

        {/* Card 2: Recent 7 Days */}
        <button
          type="button"
          onClick={() => {
            setSelectedTimePreset((prev) => (prev === '7_DAYS' ? 'ALL' : '7_DAYS'));
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedTimePreset === '7_DAYS'
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-300 dark:hover:border-emerald-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              Ảnh mới (7 ngày)
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {isStatsLoading ? '...' : (stats?.recent7DaysCount ?? 0).toLocaleString('vi-VN')}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
              Trong tuần gần nhất
            </div>
          </div>
        </button>

        {/* Card 3: Older than 30 Days */}
        <button
          type="button"
          onClick={() => {
            setSelectedTimePreset((prev) => (prev === 'OLDER_30' ? 'ALL' : 'OLDER_30'));
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedTimePreset === 'OLDER_30'
              ? 'border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 ring-2 ring-amber-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-amber-300 dark:hover:border-amber-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400 truncate">
              Ảnh cũ (&gt; 30 ngày)
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
              {isStatsLoading ? '...' : (stats?.olderThan30DaysCount ?? 0).toLocaleString('vi-VN')}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
              Nên dọn dẹp bộ nhớ
            </div>
          </div>
        </button>

        {/* Card 4: Exams Count */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">
              Kỳ thi có vi phạm
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              {isStatsLoading ? '...' : (stats?.examsWithMediaCount ?? 0).toLocaleString('vi-VN')}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
              Phòng thi ghi nhận ảnh
            </div>
          </div>
        </div>
      </div>

      {/* 4. Filter & Action Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-2.5">
        {/* Row 1: Search Box */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên thí sinh, email hoặc tên kỳ thi..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: 2 Filter Selects (50% each on mobile, auto on desktop) */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full">
          {/* Violation Type dropdown */}
          <select
            value={selectedViolationType}
            onChange={(e) => {
              setSelectedViolationType(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full sm:w-auto px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tất cả tình huống</option>
            <option value="NO_FACE_DETECTED">Không thấy mặt thí sinh</option>
            <option value="MULTIPLE_FACES">Nhiều người trong camera</option>
          </select>

          {/* Time Preset dropdown */}
          <select
            value={selectedTimePreset}
            onChange={(e) => {
              setSelectedTimePreset(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full sm:w-auto px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tất cả thời gian</option>
            <option value="TODAY">Hôm nay</option>
            <option value="7_DAYS">7 ngày qua</option>
            <option value="OLDER_30">Cũ hơn 30 ngày</option>
            <option value="OLDER_90">Cũ hơn 90 ngày</option>
          </select>

          {(searchKeyword || selectedViolationType !== 'ALL' || selectedTimePreset !== 'ALL') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1 ml-auto"
            >
              Đặt lại
            </button>
          )}
        </div>

        {/* Row 3: Multi-selection Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleSelectAllCurrentPage}
              className="flex items-center gap-1.5 font-medium hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  isAllCurrentPageSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'
                }`}
              >
                {isAllCurrentPageSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span className="text-xs">Chọn tất cả</span>
            </button>

            {selectedIds.size > 0 && (
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-full text-[11px]">
                Đã chọn {selectedIds.size} ảnh
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setIsBatchDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Xóa các ảnh đã chọn ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Photo Grid (2-cols on mobile, 4-cols on xl) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Đang tải danh sách ảnh giám sát...
          </p>
        </div>
      ) : mediaList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 text-center">
              Không tìm thấy ảnh giám sát nào
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm text-center mt-1">
              {searchKeyword || selectedViolationType !== 'ALL' || selectedTimePreset !== 'ALL'
                ? 'Không có ảnh nào khớp với bộ lọc hiện tại. Thử đổi tiêu chí hoặc đặt lại bộ lọc.'
                : 'Hiện tại hệ thống chưa ghi nhận hình ảnh vi phạm nào từ camera thí sinh.'}
            </p>
          </div>
          {(searchKeyword || selectedViolationType !== 'ALL' || selectedTimePreset !== 'ALL') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {mediaList.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isBurst = item.isAnimatedBurst;

            return (
              <div
                key={item.id}
                className={`group relative rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-200 overflow-hidden flex flex-col ${
                  isSelected
                    ? 'border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs'
                }`}
              >
                {/* Media Thumbnail Container */}
                <div className="relative aspect-[4/3] bg-zinc-950 overflow-hidden">
                  {/* Select Checkbox at top-left */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectOne(item.id);
                    }}
                    className="absolute top-2 left-2 z-20 w-6 h-6 rounded-lg bg-black/60 backdrop-blur-xs border border-white/20 flex items-center justify-center transition-all hover:scale-105"
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-white/60 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Violation Type Badge at top-right */}
                  <div className="absolute top-2 right-2 z-20">
                    {isBurst ? (
                      <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-600/90 backdrop-blur-xs text-white shadow-xs">
                        <Film className="w-3 h-3" />
                        <span className="hidden sm:inline">Ảnh động 3s</span>
                        <span className="sm:hidden">3s</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-600/90 backdrop-blur-xs text-white shadow-xs">
                        <ImageIcon className="w-3 h-3" />
                        <span>Chụp</span>
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Image */}
                  <img
                    src={item.evidenceUrl}
                    alt={item.description || 'Ảnh giám sát'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                    onClick={() => setSelectedMedia(item)}
                    loading="lazy"
                  />

                  {/* Hover Overlay with actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2.5 pointer-events-none">
                    <button
                      type="button"
                      onClick={() => setSelectedMedia(item)}
                      className="pointer-events-auto p-1.5 rounded-xl bg-white/90 text-zinc-900 hover:bg-white transition-colors shadow-md"
                      title="Xem phóng to"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="pointer-events-auto p-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-md"
                      title="Xóa ảnh này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Content Information */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5">
                  <div>
                    {/* Candidate Name */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      <User className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="truncate" title={item.studentName}>
                        {item.studentName}
                      </span>
                    </div>

                    {/* Exam Title */}
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={item.examTitle}>
                      {item.examTitle}
                    </div>
                  </div>

                  {/* Card Footer: Timestamp & Violation Type */}
                  <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-400">
                    <span className="truncate max-w-[90px] sm:max-w-[120px] font-medium text-zinc-600 dark:text-zinc-300">
                      {getViolationFriendlyName(item.violationType)}
                    </span>
                    <span className="shrink-0 font-mono" title={new Date(item.timestamp).toLocaleString('vi-VN')}>
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Pagination Bar */}
      {!isLoading && (totalElements > 0 || mediaList.length > 0) && (
        <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(0);
              }}
              className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-hidden"
            >
              <option value={12}>12 ảnh / trang</option>
              <option value={24}>24 ảnh / trang</option>
              <option value={48}>48 ảnh / trang</option>
            </select>
            <span className="text-[11px] text-zinc-400 font-mono">
              ({totalElements.toLocaleString('vi-VN')} ảnh)
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 0 || isLoading}
              onClick={() => setCurrentPage(0)}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === 0 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 font-medium text-xs">
              Trang <span className="font-bold text-zinc-900 dark:text-zinc-100">{currentPage + 1}</span> /{' '}
              {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages - 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1 || isLoading}
              onClick={() => setCurrentPage(totalPages - 1)}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Trang cuối"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 7. Modal 1: Detail Media Lightbox Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Unified Lightbox Header */}
            <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 shrink-0">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {selectedMedia.studentName}
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 shrink-0">
                    {getViolationFriendlyName(selectedMedia.violationType)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {selectedMedia.examTitle} • {new Date(selectedMedia.timestamp).toLocaleString('vi-VN')}
                </p>
              </div>

              {/* Quick Action Toolbar */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyLink(selectedMedia.evidenceUrl)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Sao chép liên kết ảnh"
                >
                  {copiedUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>

                <a
                  href={selectedMedia.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Mở ảnh gốc trong tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={() => setItemToDelete(selectedMedia)}
                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                  title="Xóa tệp này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMedia(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ml-1"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Focus on Evidence Media Viewer */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1">
              <EvidenceMediaViewer
                evidenceUrl={selectedMedia.evidenceUrl}
                violationType={selectedMedia.violationType}
                candidateName={selectedMedia.studentName}
                timestamp={selectedMedia.timestamp}
                hideHeader={true}
                hideFooter={true}
              />

              {/* Description / Note */}
              {selectedMedia.description && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="text-zinc-400 shrink-0 font-medium text-[11px]">Ghi chú:</span>
                  <span className="text-[11px] leading-relaxed">{selectedMedia.description}</span>
                </div>
              )}
            </div>

            {/* Modal Slim Footer */}
            <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/60 text-[11px] text-zinc-400 shrink-0">
              <div className="font-mono text-[10px] text-zinc-400 truncate pr-2">
                ID: {selectedMedia.id.slice(0, 8)}... • {selectedMedia.storageType}
              </div>

              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal 2: Conditional Batch Cleanup Modal */}
      {isCleanupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Dọn dẹp ảnh giám sát cũ
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Giải phóng dung lượng lưu trữ đám mây
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-4 text-xs">
              {/* Retention Condition: Days */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Thời gian lưu trữ (Xóa các ảnh chụp cách đây hơn):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '&gt; 7 ngày', days: 7 },
                    { label: '&gt; 30 ngày', days: 30 },
                    { label: '&gt; 90 ngày', days: 90 },
                    { label: 'Tất cả ảnh', days: 0 },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setCleanupDays(preset.days)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                        cleanupDays === preset.days
                          ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-zinc-500">Hoặc số ngày cụ thể:</span>
                  <input
                    type="number"
                    min={0}
                    max={3650}
                    value={cleanupDays}
                    onChange={(e) => setCleanupDays(Math.max(0, parseInt(e.target.value || '0', 10)))}
                    className="w-20 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                  <span className="text-xs text-zinc-400">ngày</span>
                </div>
              </div>

              {/* Violation Type Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Loại ảnh vi phạm cần dọn:
                </label>
                <select
                  value={cleanupViolationType}
                  onChange={(e) => setCleanupViolationType(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  <option value="ALL">Tất cả hình ảnh vi phạm</option>
                  <option value="NO_FACE_DETECTED">Chỉ ảnh Không thấy mặt thí sinh</option>
                  <option value="MULTIPLE_FACES">Chỉ ảnh Nhiều người trong camera</option>
                </select>
              </div>

              {/* Safe Mode Switch */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Chỉ dọn các kỳ thi đã kết thúc
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Bảo đảm không xóa nhầm ảnh của kỳ thi đang diễn ra
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={cleanupOnlyFinished}
                  onChange={(e) => setCleanupOnlyFinished(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
              </div>

              {/* Preview Banner */}
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Dự kiến dọn dẹp:</span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300">
                  {isPreviewLoading ? (
                    <span className="inline-flex items-center gap-1.5 text-zinc-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tính toán...
                    </span>
                  ) : (
                    <span>
                      Hệ thống tìm thấy{' '}
                      <strong className="text-rose-600 dark:text-rose-400 font-bold text-sm">
                        {cleanupPreviewCount ?? 0}
                      </strong>{' '}
                      hình ảnh khớp với điều kiện.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                disabled={isTriggeringCleanup || (cleanupPreviewCount ?? 0) === 0}
                onClick={handleTriggerCleanup}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isTriggeringCleanup ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kích hoạt...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận dọn dẹp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal 3: Single Image Delete Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Xóa ảnh giám sát này?
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Thí sinh: {itemToDelete.studentName}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Tệp hình ảnh sẽ được xóa khỏi lưu trữ. Bản ghi vi phạm trong bài thi vẫn được lưu lại để đảm bảo tính minh bạch.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
              >
                Không xóa
              </button>
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={handleSingleDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isDeletingSingle ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Xóa vĩnh viễn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Modal 4: Batch Delete Modal */}
      {isBatchDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Xóa các ảnh đã chọn?
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Tổng số lượng: <strong className="text-rose-600 dark:text-rose-400">{selectedIds.size}</strong> ảnh
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Toàn bộ {selectedIds.size} tệp hình ảnh đã chọn sẽ được xóa vĩnh viễn để giải phóng bộ nhớ. Lịch sử bài thi của thí sinh vẫn được giữ nguyên.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={handleBatchDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isDeletingBatch ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Xóa {selectedIds.size} ảnh</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

