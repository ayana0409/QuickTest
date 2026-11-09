'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Database,
  Layers,
  Shield,
  Eye,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Terminal,
  Calendar,
  User,
  Globe,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminLogService } from '@/services/adminLogService';
import type {
  AdminSystemLog,
  AdminSystemLogDetail,
  AdminSystemLogStats,
  AdminSystemLogMetadata,
  SystemLogCleanupStatus,
  LogLevel,
  LogStatus,
} from '@/types/systemLog';

export default function AdminSystemLogsPage() {
  // Main Data States
  const [logs, setLogs] = useState<AdminSystemLog[]>([]);
  const [stats, setStats] = useState<AdminSystemLogStats | null>(null);
  const [metadata, setMetadata] = useState<AdminSystemLogMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);

  // Filter States
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals States
  const [detailModalLog, setDetailModalLog] = useState<AdminSystemLogDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'OVERVIEW' | 'PAYLOAD' | 'ERROR'>('OVERVIEW');

  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState<boolean>(false);
  const [cleanupDays, setCleanupDays] = useState<number>(30);
  const [isCleaningUp, setIsCleaningUp] = useState<boolean>(false);
  const [cleanupStatus, setCleanupStatus] = useState<SystemLogCleanupStatus | null>(null);

  // Search Debouncer
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
      setCurrentPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Load Metadata & Initial Stats
  const loadMetadata = useCallback(async () => {
    try {
      const meta = await adminLogService.getMetadata();
      setMetadata(meta);
    } catch (err) {
      console.error('Failed to load log metadata:', err);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const data = await adminLogService.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load log stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Fetch Logs with Active Filters
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminLogService.searchLogs({
        page: currentPage,
        size: pageSize,
        search: debouncedSearch || undefined,
        level: selectedLevel !== 'ALL' ? selectedLevel : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        module: selectedModule !== 'ALL' ? selectedModule : undefined,
        action: selectedAction !== 'ALL' ? selectedAction : undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });

      setLogs(data.content || []);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalElements || 0);
    } catch (err) {
      console.error('Failed to fetch system logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    debouncedSearch,
    selectedLevel,
    selectedStatus,
    selectedModule,
    selectedAction,
    startDate,
    endDate,
  ]);

  const pollCleanupStatus = useCallback(() => {
    const interval = setInterval(async () => {
      try {
        const status = await adminLogService.getCleanupStatus();
        setCleanupStatus(status);
        if (!status.running) {
          clearInterval(interval);
          if (status.status === 'COMPLETED') {
            fetchLogs();
            loadStats();
          }
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
  }, [fetchLogs, loadStats]);

  const checkInitialCleanupStatus = useCallback(async () => {
    try {
      const status = await adminLogService.getCleanupStatus();
      setCleanupStatus(status);
      if (status.running) {
        pollCleanupStatus();
      }
    } catch {
      // Ignore background check failure
    }
  }, [pollCleanupStatus]);

  useEffect(() => {
    loadMetadata();
    loadStats();
    checkInitialCleanupStatus();
  }, [loadMetadata, loadStats, checkInitialCleanupStatus]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Open Log Detail Modal
  const handleOpenDetail = async (logId: string) => {
    setIsDetailLoading(true);
    setActiveDetailTab('OVERVIEW');
    try {
      const detail = await adminLogService.getLogDetail(logId);
      setDetailModalLog(detail);
      if (detail.errorMessage) {
        setActiveDetailTab('OVERVIEW');
      }
    } catch (err) {
      console.error('Failed to load log detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Copy to Clipboard Helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Đã sao chép vào bộ nhớ tạm');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Trigger Cleanup Action
  const handleExecuteCleanup = async () => {
    if (cleanupDays < 1) {
      return;
    }

    setIsCleaningUp(true);
    try {
      const status = await adminLogService.cleanupOldLogs(cleanupDays);
      setCleanupStatus(status);
      setIsCleanupModalOpen(false);
      pollCleanupStatus();
    } catch {
      // Handled automatically by apiClient interceptor
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchKeyword('');
    setSelectedLevel('ALL');
    setSelectedStatus('ALL');
    setSelectedModule('ALL');
    setSelectedAction('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(0);
  };

  // Helpers for Badges
  const renderLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
            <XCircle className="w-3 h-3 text-rose-500" />
            Lỗi
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Cảnh báo
          </span>
        );
      case 'DEBUG':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
            <Terminal className="w-3 h-3 text-purple-500" />
            Gỡ lỗi
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
            <CheckCircle2 className="w-3 h-3 text-sky-500" />
            Thông tin
          </span>
        );
    }
  };

  const renderStatusBadge = (status: LogStatus) => {
    if (status === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          Thành công
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
        <XCircle className="w-3 h-3 text-rose-500" />
        Thất bại
      </span>
    );
  };

  const formatExecutionTime = (ms?: number | null) => {
    if (ms == null) return '-';
    let colorClass = 'text-emerald-600 dark:text-emerald-400 font-mono';
    if (ms > 500) {
      colorClass = 'text-rose-600 dark:text-rose-400 font-mono font-bold';
    } else if (ms > 150) {
      colorClass = 'text-amber-600 dark:text-amber-400 font-mono font-medium';
    }
    return <span className={colorClass}>{ms}ms</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5 pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Nhật ký Hệ thống
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lưu vết thao tác và giám sát vận hành
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => {
              fetchLogs();
              loadStats();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
            title="Làm mới dữ liệu"
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
            <span>Dọn dẹp</span>
          </button>
        </div>
      </div>

      {/* Progress banner for active cleanup */}
      {cleanupStatus?.running && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Đang dọn dẹp nhật ký cũ</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-medium">
                  {cleanupStatus.totalDeleted.toLocaleString()} bản ghi
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Tiến trình chạy nền, hệ thống vẫn hoạt động bình thường.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Analytical Interactive KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Logs */}
        <button
          type="button"
          onClick={() => {
            setSelectedLevel('ALL');
            setSelectedStatus('ALL');
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedLevel === 'ALL' && selectedStatus === 'ALL'
              ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">
              Tổng số nhật ký
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Database className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              {isStatsLoading ? '...' : (stats?.totalLogs ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
              Tất cả bản ghi
            </div>
          </div>
        </button>

        {/* Card 2: Success Rate */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatus((prev) => (prev === 'SUCCESS' ? 'ALL' : 'SUCCESS'));
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedStatus === 'SUCCESS'
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-300 dark:hover:border-emerald-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              Thành công
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {isStatsLoading ? '...' : `${(100 - (stats?.errorRate ?? 0)).toFixed(1)}%`}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
              {(stats?.successCount ?? 0).toLocaleString()} đạt
            </div>
          </div>
        </button>

        {/* Card 3: Failure & Errors */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatus((prev) => (prev === 'FAILURE' ? 'ALL' : 'FAILURE'));
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedStatus === 'FAILURE' || selectedLevel === 'ERROR'
              ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 ring-2 ring-rose-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-rose-300 dark:hover:border-rose-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400 truncate">
              Lỗi & Thất bại
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
              {isStatsLoading ? '...' : (stats?.failureCount ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
              {(stats?.errorRate ?? 0).toFixed(1)}% tỉ lệ lỗi
            </div>
          </div>
        </button>

        {/* Card 4: Latency */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">
              Độ trễ trung bình
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              {isStatsLoading ? '...' : `${stats?.averageExecutionTimeMs ?? 0}ms`}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
              Tốc độ phản hồi
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Search */}
      <div className="bg-white dark:bg-zinc-900 p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-2.5">
        {/* Row 1: Search Bar */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm theo chức năng, người dùng, IP, nội dung..."
            className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 2: 4 Quick Filter Selects (2x2 on mobile, 4-col on tablet/desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
          {/* Level */}
          <select
            value={selectedLevel}
            onChange={(e) => {
              setSelectedLevel(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full px-2.5 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Mức độ: Tất cả</option>
            <option value="INFO">Thông tin (INFO)</option>
            <option value="WARN">Cảnh báo (WARN)</option>
            <option value="ERROR">Lỗi (ERROR)</option>
            <option value="DEBUG">Gỡ lỗi (DEBUG)</option>
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full px-2.5 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Trạng thái: Tất cả</option>
            <option value="SUCCESS">Thành công</option>
            <option value="FAILURE">Thất bại</option>
          </select>

          {/* Module */}
          <select
            value={selectedModule}
            onChange={(e) => {
              setSelectedModule(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full px-2.5 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Chức năng: Tất cả</option>
            {metadata?.modules?.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Action */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full px-2.5 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Thao tác: Tất cả</option>
            {metadata?.actions?.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Row 3: Date Range & Reset Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full sm:w-auto px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="relative w-full sm:w-auto">
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full sm:w-auto px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {(searchKeyword ||
              selectedLevel !== 'ALL' ||
              selectedStatus !== 'ALL' ||
              selectedModule !== 'ALL' ||
              selectedAction !== 'ALL' ||
              startDate ||
              endDate) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}

            <div className="text-[11px] text-zinc-400 font-mono ml-auto sm:ml-0">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{logs.length}</span> /{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalElements}</span> bản ghi
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main Content: Desktop Table + Mobile Card List */}
      {isLoading ? (
        <div className="py-20 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-2" />
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Đang tải dữ liệu nhật ký...
          </p>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Không tìm thấy nhật ký nào
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
              Hãy thử điều chỉnh từ khóa tìm kiếm hoặc đặt lại các tiêu chí bộ lọc.
            </p>
          </div>
          {(searchKeyword || selectedLevel !== 'ALL' || selectedStatus !== 'ALL') && (
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
        <>
          {/* 1. Mobile Card List (Hidden on desktop) */}
          <div className="block md:hidden space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2.5"
              >
                {/* Top Row: Level + Status + Time */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {renderLevelBadge(log.level)}
                    {renderStatusBadge(log.status)}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString('vi-VN')}
                  </div>
                </div>

                {/* Action & Module */}
                <div>
                  <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    {log.action}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {log.module}
                  </div>
                </div>

                {/* Actor & Latency */}
                <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200 truncate">
                      {log.actorUsername || 'Hệ thống'}
                    </span>
                    {log.actorRole && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono shrink-0">
                        {log.actorRole}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] shrink-0 font-mono">
                    {formatExecutionTime(log.executionTimeMs)}
                  </div>
                </div>

                {/* Endpoint */}
                {log.endpoint && (
                  <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded-lg">
                    {log.httpMethod && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold mr-1">
                        {log.httpMethod}
                      </span>
                    )}
                    {log.endpoint}
                  </div>
                )}

                {/* Detail Action */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(log.id)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem chi tiết</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 2. Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-3">Mức độ</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-4">Chức năng & Thao tác</th>
                  <th className="py-3 px-4">Người thực hiện</th>
                  <th className="py-3 px-4">Đường dẫn API</th>
                  <th className="py-3 px-3">Địa chỉ IP</th>
                  <th className="py-3 px-3">Độ trễ</th>
                  <th className="py-3 px-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-sans">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors group"
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">
                      <div>{new Date(log.createdAt).toLocaleDateString('vi-VN')}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {new Date(log.createdAt).toLocaleTimeString('vi-VN')}
                      </div>
                    </td>

                    {/* Level */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderLevelBadge(log.level)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderStatusBadge(log.status)}
                    </td>

                    {/* Module & Action */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                        {log.action}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {log.module}
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="py-3 px-4">
                      {log.actorUsername ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {log.actorUsername.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200 truncate">
                            {log.actorUsername}
                          </span>
                          {log.actorRole && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono shrink-0">
                              {log.actorRole}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Hệ thống</span>
                      )}
                    </td>

                    {/* Endpoint & HTTP Method */}
                    <td className="py-3 px-4 max-w-[200px] truncate">
                      {log.endpoint ? (
                        <div className="text-xs font-mono truncate">
                          {log.httpMethod && (
                            <span className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400 mr-1.5">
                              {log.httpMethod}
                            </span>
                          )}
                          <span className="text-zinc-700 dark:text-zinc-300" title={log.endpoint}>
                            {log.endpoint}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">-</span>
                      )}
                    </td>

                    {/* IP */}
                    <td className="py-3 px-3 whitespace-nowrap text-xs font-mono text-zinc-500">
                      {log.ipAddress || '-'}
                    </td>

                    {/* Latency */}
                    <td className="py-3 px-3 whitespace-nowrap text-xs">
                      {formatExecutionTime(log.executionTimeMs)}
                    </td>

                    {/* Action Detail */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(log.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 5. Pagination Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(0);
            }}
            className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-hidden"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>bản ghi / trang</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0 || isLoading}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Trang đầu"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0 || isLoading}
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
            onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage >= totalPages - 1 || isLoading}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Trang sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1 || isLoading}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Trang cuối"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 6. Detail Modal */}
      {detailModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3 shrink-0">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Chi tiết nhật ký hoạt động
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {renderLevelBadge(detailModalLog.level)}
                    {renderStatusBadge(detailModalLog.status)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                  <span className="truncate">ID: {detailModalLog.id}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(detailModalLog.id, 'id')}
                    className="p-1 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors shrink-0"
                    title="Sao chép ID"
                  >
                    {copiedKey === 'id' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailModalLog(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Segmented Tabs */}
            <div className="p-3 sm:px-5 sm:py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-zinc-200/50 dark:bg-zinc-800/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('OVERVIEW')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    activeDetailTab === 'OVERVIEW'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Tổng quan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('PAYLOAD')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    activeDetailTab === 'PAYLOAD'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Dữ liệu JSON
                </button>
                {detailModalLog.errorMessage && (
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('ERROR')}
                    className={`col-span-2 sm:col-span-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      activeDetailTab === 'ERROR'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-rose-500 hover:text-rose-600'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Lỗi hệ thống
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {activeDetailTab === 'OVERVIEW' && (
                <div className="space-y-3.5">
                  {/* Grid Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-400 font-medium">Chức năng & Thao tác:</span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {detailModalLog.module} - {detailModalLog.action}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-400 font-medium">Thời gian:</span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {new Date(detailModalLog.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-400 font-medium">Người thực hiện:</span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {detailModalLog.actorUsername || 'Hệ thống'} {detailModalLog.actorRole ? `(${detailModalLog.actorRole})` : ''}
                      </p>
                      {detailModalLog.actorId && (
                        <p className="text-[10px] font-mono text-zinc-400 mt-0.5">ID: {detailModalLog.actorId}</p>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-400 font-medium">Thời gian xử lý:</span>
                      <p className="mt-0.5 font-mono">{formatExecutionTime(detailModalLog.executionTimeMs)}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-400 font-medium">API Endpoint:</span>
                      <p className="font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">
                        {detailModalLog.httpMethod} {detailModalLog.endpoint || 'Tác vụ nội bộ'}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-400 font-medium">Địa chỉ IP:</span>
                      <p className="font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">
                        {detailModalLog.ipAddress || 'Nội bộ'}
                      </p>
                    </div>
                  </div>

                  {/* Error Callout */}
                  {detailModalLog.errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Thông báo lỗi:</span>
                      </div>
                      <p className="font-mono text-xs text-rose-700 dark:text-rose-300 whitespace-pre-wrap leading-relaxed">
                        {detailModalLog.errorMessage}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'PAYLOAD' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500">
                      Dữ liệu JSON chi tiết:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(detailModalLog.details || '{}', 'payload')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                      {copiedKey === 'payload' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Sao chép JSON</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed border border-zinc-800">
                    {(() => {
                      if (!detailModalLog.details) return '// Không có dữ liệu bổ sung';
                      try {
                        const parsed = JSON.parse(detailModalLog.details);
                        return JSON.stringify(parsed, null, 2);
                      } catch {
                        return detailModalLog.details;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {activeDetailTab === 'ERROR' && detailModalLog.errorMessage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5" />
                      Chi tiết mã lỗi & Stacktrace:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(detailModalLog.errorMessage || '', 'error')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                      {copiedKey === 'error' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Sao chép lỗi</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-950 text-rose-300 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed border border-zinc-800 whitespace-pre-wrap">
                    {detailModalLog.errorMessage}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setDetailModalLog(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Retention Cleanup Modal */}
      {isCleanupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Dọn dẹp nhật ký cũ
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Giải phóng dung lượng các bản ghi quá hạn
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

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Các bản ghi trước thời hạn sẽ bị xóa vĩnh viễn và <strong className="text-rose-600 dark:text-rose-400 font-semibold">không thể khôi phục</strong>.
            </p>

            {/* Retention Days Selector */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Giữ lại nhật ký trong vòng:
              </label>

              {/* 3 Quick Chips Full Width */}
              <div className="grid grid-cols-3 gap-2">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCleanupDays(d)}
                    className={`py-2 px-3 text-xs rounded-xl border font-semibold transition-all text-center ${
                      cleanupDays === d
                        ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {d} ngày
                  </button>
                ))}
              </div>

              {/* Custom Number Input */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-zinc-500">Hoặc tùy chỉnh:</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(Math.max(1, Number(e.target.value)))}
                  className="w-20 px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-mono text-center"
                />
                <span className="text-xs text-zinc-400">ngày</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(false)}
                disabled={isCleaningUp}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExecuteCleanup}
                disabled={isCleaningUp}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isCleaningUp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận dọn dẹp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
