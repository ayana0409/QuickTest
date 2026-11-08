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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Quản lý Ảnh giám sát
              </h1>
              <p className="text-sm text-zinc-400">
                Xem lại hình ảnh ghi nhận khi thí sinh vi phạm và dọn dẹp ảnh cũ để giải phóng dung lượng lưu trữ.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchMedia();
              toast.success('Đã cập nhật dữ liệu mới nhất');
            }}
            disabled={isLoading || isStatsLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCleanupModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white text-sm font-semibold shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Dọn dẹp ảnh cũ</span>
          </button>
        </div>
      </div>

      {/* 2. Background Task Progress Banner */}
      {cleanupStatus?.isRunning && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-indigo-200">
                Đang xử lý dọn dẹp ảnh cũ trong nền
              </h3>
              <p className="text-xs text-indigo-300/80">
                {cleanupStatus.message || 'Hệ thống đang gỡ bỏ ảnh cũ và dọn dẹp lưu trữ đám mây theo từng đợt...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="text-right">
              <div className="text-xs font-semibold text-indigo-200">
                Đã xóa: <span className="text-white font-bold">{cleanupStatus.totalDeleted}</span> ảnh
              </div>
              {cleanupStatus.estimatedRemaining > 0 && (
                <div className="text-[11px] text-indigo-300/70">
                  Ước tính còn khoảng {cleanupStatus.estimatedRemaining} ảnh
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Images */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Tổng số ảnh đang lưu</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {isStatsLoading ? '...' : stats?.totalMediaCount.toLocaleString('vi-VN') ?? 0}
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-zinc-300 font-medium">
              <ImageIcon className="w-3 h-3 text-indigo-400" />
              {stats?.singleSnapshotCount ?? 0} ảnh chụp
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-zinc-300 font-medium">
              <Film className="w-3 h-3 text-rose-400" />
              {stats?.burstAnimationCount ?? 0} ảnh động
            </span>
          </div>
        </div>

        {/* Card 2: Recent 7 Days */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Ảnh mới (7 ngày qua)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">
            {isStatsLoading ? '...' : stats?.recent7DaysCount.toLocaleString('vi-VN') ?? 0}
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Hình ảnh phát sinh từ các kỳ thi trong tuần
          </div>
        </div>

        {/* Card 3: Older than 30 Days */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Ảnh đã cũ (Quá 30 ngày)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400">
            {isStatsLoading ? '...' : stats?.olderThan30DaysCount.toLocaleString('vi-VN') ?? 0}
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
            <span>Chiếm dụng bộ nhớ đám mây</span>
            {stats && stats.olderThan30DaysCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCleanupDays(30);
                  setIsCleanupModalOpen(true);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline underline-offset-2"
              >
                Dọn dẹp ngay
              </button>
            )}
          </div>
        </div>

        {/* Card 4: Exams Count */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Kỳ thi có ghi nhận ảnh</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {isStatsLoading ? '...' : stats?.examsWithMediaCount.toLocaleString('vi-VN') ?? 0}
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Tổng số phòng thi có ảnh vi phạm
          </div>
        </div>
      </div>

      {/* 4. Filter & Action Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên thí sinh, email hoặc tên kỳ thi..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/70 transition-colors"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Violation Type dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedViolationType}
              onChange={(e) => {
                setSelectedViolationType(e.target.value);
                setCurrentPage(0);
              }}
              className="px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/70 cursor-pointer"
            >
              <option value="ALL">Tất cả tình huống</option>
              <option value="NO_FACE_DETECTED">Không thấy mặt thí sinh (Ảnh chụp)</option>
              <option value="MULTIPLE_FACES">Nhiều người trong camera (Ảnh động 3s)</option>
            </select>

            {/* Time Preset dropdown */}
            <select
              value={selectedTimePreset}
              onChange={(e) => {
                setSelectedTimePreset(e.target.value);
                setCurrentPage(0);
              }}
              className="px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/70 cursor-pointer"
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
                className="px-3 py-2.5 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0"
                title="Đặt lại bộ lọc"
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {/* Multi-selection Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAllCurrentPage}
              className="flex items-center gap-1.5 font-medium hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  isAllCurrentPageSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                {isAllCurrentPageSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span>Chọn tất cả trên trang này</span>
            </button>

            {selectedIds.size > 0 && (
              <span className="text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-full">
                Đã chọn {selectedIds.size} ảnh
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setIsBatchDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa các ảnh đã chọn ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Photo Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Đang tải danh sách ảnh giám sát...</p>
        </div>
      ) : mediaList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/40 rounded-3xl border border-zinc-800/80 text-zinc-400 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500">
            <Camera className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200">Không tìm thấy ảnh giám sát nào</h3>
          <p className="text-xs text-zinc-500 max-w-sm text-center">
            {searchKeyword || selectedViolationType !== 'ALL' || selectedTimePreset !== 'ALL'
              ? 'Không có ảnh nào khớp với bộ lọc hiện tại. Thử đổi tiêu chí hoặc xóa bộ lọc.'
              : 'Hiện tại hệ thống chưa ghi nhận hình ảnh vi phạm nào từ camera của thí sinh.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {mediaList.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isBurst = item.isAnimatedBurst;

            return (
              <div
                key={item.id}
                className={`group relative rounded-2xl bg-zinc-900/90 border transition-all duration-200 overflow-hidden flex flex-col ${
                  isSelected
                    ? 'border-indigo-500 shadow-lg shadow-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-zinc-800/90 hover:border-zinc-700 hover:shadow-xl'
                }`}
              >
                {/* Media Thumbnail Container */}
                <div className="relative aspect-[4/3] bg-black/80 overflow-hidden">
                  {/* Select Checkbox at top-left */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectOne(item.id);
                    }}
                    className="absolute top-2.5 left-2.5 z-20 w-6 h-6 rounded-lg bg-zinc-900/80 backdrop-blur-md border border-zinc-700/80 flex items-center justify-center cursor-pointer transition-all hover:scale-105"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-zinc-500/60 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Violation Type Badge at top-right */}
                  <div className="absolute top-2.5 right-2.5 z-20">
                    {isBurst ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/90 backdrop-blur-md text-white shadow-md">
                        <Film className="w-3 h-3" />
                        Ảnh động 3s
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-500/90 backdrop-blur-md text-white shadow-md">
                        <ImageIcon className="w-3 h-3" />
                        Ảnh chụp
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 pointer-events-none">
                    <button
                      type="button"
                      onClick={() => setSelectedMedia(item)}
                      className="pointer-events-auto p-2 rounded-xl bg-zinc-900/90 text-white hover:bg-zinc-800 transition-colors shadow-lg cursor-pointer"
                      title="Xem phóng to"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="pointer-events-auto p-2 rounded-xl bg-rose-600/90 text-white hover:bg-rose-500 transition-colors shadow-lg cursor-pointer"
                      title="Xóa ảnh này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Card Content Information */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    {/* Candidate Name */}
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100 truncate">
                      <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate" title={item.studentName}>
                        {item.studentName}
                      </span>
                    </div>

                    {/* Candidate Email / ID */}
                    {item.studentEmail && (
                      <div className="text-xs text-zinc-500 truncate pl-5">
                        {item.studentEmail}
                      </div>
                    )}

                    {/* Exam Title */}
                    <div className="mt-2 text-xs text-zinc-300 truncate" title={item.examTitle}>
                      <span className="text-zinc-500">Kỳ thi: </span>
                      <span className="font-medium text-zinc-200">{item.examTitle}</span>
                    </div>
                  </div>

                  {/* Card Footer: Timestamp & Violation Type */}
                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="text-zinc-400 font-medium truncate max-w-[120px]">
                      {getViolationFriendlyName(item.violationType)}
                    </span>
                    <span className="shrink-0" title={new Date(item.timestamp).toLocaleString('vi-VN')}>
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Pagination & Page Size Control */}
      {!isLoading && (totalElements > 0 || mediaList.length > 0) && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-5 pb-2 border-t border-zinc-800 text-xs text-zinc-400">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              Đang hiển thị{' '}
              <span className="font-semibold text-zinc-200">
                {mediaList.length > 0 ? currentPage * pageSize + 1 : 0}
              </span>{' '}
              -{' '}
              <span className="font-semibold text-zinc-200">
                {Math.min((currentPage + 1) * pageSize, totalElements)}
              </span>{' '}
              trong tổng số{' '}
              <span className="font-bold text-indigo-400">
                {totalElements.toLocaleString('vi-VN')}
              </span>{' '}
              ảnh giám sát
            </div>

            <div className="flex items-center gap-1.5 pl-3 border-l border-zinc-800">
              <span>Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(0);
                }}
                className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value={12}>12 ảnh / trang</option>
                <option value={24}>24 ảnh / trang</option>
                <option value={48}>48 ảnh / trang</option>
                <option value={96}>96 ảnh / trang</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 0 || isLoading}
              onClick={() => setCurrentPage(0)}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition-colors"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === 0 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition-colors"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i)
                .filter((p) => {
                  if (totalPages <= 7) return true;
                  if (p === 0 || p === totalPages - 1) return true;
                  return Math.abs(p - currentPage) <= 1;
                })
                .map((p, idx, arr) => {
                  const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsisBefore && (
                        <span className="px-1 text-zinc-600">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          currentPage === p
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {p + 1}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              type="button"
              disabled={currentPage >= totalPages - 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition-colors"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1 || isLoading}
              onClick={() => setCurrentPage(totalPages - 1)}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 transition-colors"
              title="Trang cuối"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 7. Detail Media Lightbox Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Chi tiết hình ảnh vi phạm</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  {selectedMedia.studentName} • {selectedMedia.examTitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: EvidenceMediaViewer */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <EvidenceMediaViewer
                evidenceUrl={selectedMedia.evidenceUrl}
                violationType={selectedMedia.violationType}
                candidateName={selectedMedia.studentName}
                timestamp={selectedMedia.timestamp}
              />

              {/* Information Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                  <span className="text-zinc-500">Tình huống ghi nhận</span>
                  <div className="font-semibold text-zinc-200">
                    {getViolationFriendlyName(selectedMedia.violationType)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                  <span className="text-zinc-500">Thời điểm chụp</span>
                  <div className="font-semibold text-zinc-200">
                    {new Date(selectedMedia.timestamp).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              {selectedMedia.description && (
                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-xs text-zinc-300">
                  <span className="text-zinc-500 block mb-0.5">Ghi chú tự động:</span>
                  {selectedMedia.description}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/50">
              <button
                type="button"
                onClick={() => {
                  setItemToDelete(selectedMedia);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa ảnh này</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Conditional Batch Cleanup Modal */}
      {isCleanupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-950/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Dọn dẹp ảnh giám sát cũ</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Giải phóng bộ nhớ lưu trữ đám mây theo điều kiện
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCleanupModalOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <div className="p-6 space-y-5 text-sm">
              {/* Retention Condition: Days */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-zinc-300 block">
                  1. Thời gian lưu trữ (Xóa các ảnh chụp cách đây hơn):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Quá 7 ngày', days: 7 },
                    { label: 'Quá 30 ngày', days: 30 },
                    { label: 'Quá 90 ngày', days: 90 },
                    { label: 'Tất cả ảnh', days: 0 },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setCleanupDays(preset.days)}
                      className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        cleanupDays === preset.days
                          ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-zinc-400">Hoặc nhập số ngày cụ thể:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      value={cleanupDays}
                      onChange={(e) => setCleanupDays(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      className="w-20 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                    />
                    <span className="text-xs text-zinc-400">ngày</span>
                  </div>
                </div>
              </div>

              {/* Violation Type Filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  2. Loại ảnh vi phạm:
                </label>
                <select
                  value={cleanupViolationType}
                  onChange={(e) => setCleanupViolationType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả hình ảnh vi phạm</option>
                  <option value="NO_FACE_DETECTED">Chỉ ảnh Không thấy mặt thí sinh</option>
                  <option value="MULTIPLE_FACES">Chỉ ảnh Có nhiều người trong khung hình</option>
                </select>
              </div>

              {/* Safe Mode Switch: Only Finished Exams */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Chỉ dọn dẹp các kỳ thi đã kết thúc
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Bảo đảm không xóa nhầm ảnh của các kỳ thi đang diễn ra
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={cleanupOnlyFinished}
                  onChange={(e) => setCleanupOnlyFinished(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
              </div>

              {/* Real-time Matching Preview Banner */}
              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20 text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-rose-300 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Dự kiến dọn dẹp:</span>
                </div>
                <p className="text-zinc-300">
                  {isPreviewLoading ? (
                    <span className="inline-flex items-center gap-1.5 text-zinc-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tính toán số lượng ảnh...
                    </span>
                  ) : (
                    <span>
                      Hệ thống tìm thấy{' '}
                      <strong className="text-rose-400 font-bold text-sm">
                        {cleanupPreviewCount ?? 0}
                      </strong>{' '}
                      hình ảnh khớp với điều kiện trên.
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-400 pt-1 border-t border-rose-500/10">
                  Lưu ý: Tác vụ chỉ gỡ bỏ tệp ảnh để giải phóng bộ nhớ. Bản ghi vi phạm và kết quả thi của thí sinh vẫn được giữ nguyên vẹn 100%.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950/50">
              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                disabled={isTriggeringCleanup || (cleanupPreviewCount ?? 0) === 0}
                onClick={handleTriggerCleanup}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/40 cursor-pointer"
              >
                {isTriggeringCleanup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang kích hoạt...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Bắt đầu dọn dẹp chạy nền</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Single Image Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Xác nhận xóa ảnh này?</h4>
                <p className="text-xs text-zinc-400">
                  Thí sinh: {itemToDelete.studentName}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Tệp hình ảnh sẽ được xóa khỏi đám mây. Bản ghi vi phạm trong bài thi vẫn được lưu lại để đảm bảo tính minh bạch.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Không xóa
              </button>
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={handleSingleDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
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

      {/* 10. Batch Delete Confirmation Modal */}
      {isBatchDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Xóa các ảnh đã chọn?</h4>
                <p className="text-xs text-zinc-400">
                  Tổng số ảnh chọn: <strong className="text-rose-400">{selectedIds.size}</strong> ảnh
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Toàn bộ {selectedIds.size} tệp hình ảnh đã chọn sẽ được xóa vĩnh viễn để giải phóng bộ nhớ. Lịch sử bài thi của thí sinh vẫn được giữ nguyên.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
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

