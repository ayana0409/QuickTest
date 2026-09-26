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
      toast.error('Không thể tải danh sách nhật ký hệ thống');
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

  useEffect(() => {
    loadMetadata();
    loadStats();
  }, [loadMetadata, loadStats]);

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
      toast.error('Không thể tải chi tiết nhật ký');
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
      toast.error('Số ngày lưu trữ phải lớn hơn 0');
      return;
    }

    setIsCleaningUp(true);
    try {
      await adminLogService.cleanupOldLogs(cleanupDays);
      setIsCleanupModalOpen(false);
      fetchLogs();
      loadStats();
    } catch {
      // Error is handled automatically by common axios interceptor
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            WARN
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
            INFO
          </span>
        );
    }
  };

  const renderStatusBadge = (status: LogStatus) => {
    if (status === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          SUCCESS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50">
        <XCircle className="w-3 h-3 text-red-500" />
        FAILURE
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
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Nhật ký Hệ thống (System Logs)
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Truy vết kiểm toán tập trung, giám sát lỗi vận hành và tìm kiếm Full-Text Search PostgreSQL
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchLogs();
              loadStats();
              toast.success('Đã làm mới dữ liệu');
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          <button
            onClick={() => setIsCleanupModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-900/60 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Dọn dẹp Log cũ
          </button>
        </div>
      </div>

      {/* 2. Analytical KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Logs */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Tổng số Nhật ký
            </span>
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {isStatsLoading ? '...' : (stats?.totalLogs ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">bản ghi</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <span>INFO: {stats?.infoCount ?? 0}</span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400">WARN: {stats?.warnCount ?? 0}</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Tỉ lệ Thành công
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {isStatsLoading
                ? '...'
                : `${(
                  100 - (stats?.errorRate ?? 0)
                ).toFixed(1)}%`}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              ({stats?.successCount ?? 0} thành công)
            </span>
          </div>
          <div className="mt-3 w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(100, 100 - (stats?.errorRate ?? 0)))}%`,
              }}
            />
          </div>
        </div>

        {/* Failure & Errors */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Lỗi & Thất bại
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {isStatsLoading ? '...' : (stats?.failureCount ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-rose-600/80 dark:text-rose-400/80">
              ({(stats?.errorRate ?? 0).toFixed(1)}% tỉ lệ lỗi)
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
            <span>ERROR Severity: {stats?.errorCount ?? 0}</span>
          </div>
        </div>

        {/* Average Latency */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Độ trễ Trung bình
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              {isStatsLoading ? '...' : `${stats?.averageExecutionTimeMs ?? 0}ms`}
            </span>
          </div>
          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Đo lường thời gian thực thi AOP</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & FTS Search */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* PostgreSQL FTS Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Full-Text Search: module, action, actor, username, IP, UUID, error, details..."
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Level */}
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setCurrentPage(0);
              }}
              className="px-3 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">Mức độ: Tất cả</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="DEBUG">DEBUG</option>
            </select>

            {/* Status */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(0);
              }}
              className="px-3 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">Trạng thái: Tất cả</option>
              <option value="SUCCESS">Thành công (SUCCESS)</option>
              <option value="FAILURE">Thất bại (FAILURE)</option>
            </select>

            {/* Module */}
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(0);
              }}
              className="px-3 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[160px]"
            >
              <option value="ALL">Module: Tất cả</option>
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
              className="px-3 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[170px]"
            >
              <option value="ALL">Hành động: Tất cả</option>
              {metadata?.actions?.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range & Reset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Khoảng thời gian:
            </span>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(0);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            />
            <span className="text-xs text-zinc-400">đến</span>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(0);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            />
          </div>

          <div className="flex items-center gap-2">
            {(searchKeyword ||
              selectedLevel !== 'ALL' ||
              selectedStatus !== 'ALL' ||
              selectedModule !== 'ALL' ||
              selectedAction !== 'ALL' ||
              startDate ||
              endDate) && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
                >
                  Xóa tất cả bộ lọc
                </button>
              )}

            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Hiển thị <span className="font-semibold text-zinc-900 dark:text-zinc-100">{logs.length}</span> /{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalElements}</span> bản ghi
            </div>
          </div>
        </div>
      </div>

      {/* 4. Log Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/80 dark:bg-zinc-800/40 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Thời gian</th>
                <th className="py-3.5 px-3">Mức độ</th>
                <th className="py-3.5 px-3">Trạng thái</th>
                <th className="py-3.5 px-4">Module & Hành động</th>
                <th className="py-3.5 px-4">Người thực hiện</th>
                <th className="py-3.5 px-4">Endpoint</th>
                <th className="py-3.5 px-3">IP Address</th>
                <th className="py-3.5 px-3">Độ trễ</th>
                <th className="py-3.5 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-sans">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-28" /></td>
                    <td className="py-4 px-3"><div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full w-16" /></td>
                    <td className="py-4 px-3"><div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-36" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-32" /></td>
                    <td className="py-4 px-3"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-20" /></td>
                    <td className="py-4 px-3"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-12" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                        <Database className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">Không tìm thấy bản ghi log nào</p>
                      <p className="text-xs text-zinc-500">
                        Hãy thử điều chỉnh từ khóa tìm kiếm FTS hoặc các tiêu chí bộ lọc thời gian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors group"
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
                        {log.module}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        {log.action}
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="py-3 px-4">
                      {log.actorUsername ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200">
                            {log.actorUsername}
                          </span>
                          {log.actorRole && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                              {log.actorRole}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">SYSTEM / GUEST</span>
                      )}
                    </td>

                    {/* Endpoint & HTTP Method */}
                    <td className="py-3 px-4 max-w-[200px] truncate">
                      {log.endpoint ? (
                        <div className="text-xs font-mono">
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
                    <td className="py-3 px-3 whitespace-nowrap text-xs font-mono text-zinc-600 dark:text-zinc-400">
                      {log.ipAddress || '-'}
                    </td>

                    {/* Latency */}
                    <td className="py-3 px-3 whitespace-nowrap text-xs">
                      {formatExecutionTime(log.executionTimeMs)}
                    </td>

                    {/* Action Detail */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenDetail(log.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Bar */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(0);
              }}
              className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
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
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0 || isLoading}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0 || isLoading}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 font-medium">
              Trang <span className="font-bold text-zinc-900 dark:text-zinc-100">{currentPage + 1}</span> /{' '}
              {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage >= totalPages - 1 || isLoading}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1 || isLoading}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Trang cuối"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Detail Modal */}
      {detailModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Chi tiết Nhật ký Kiểm toán
                  </h3>
                  {renderLevelBadge(detailModalLog.level)}
                  {renderStatusBadge(detailModalLog.status)}
                </div>
                <p className="text-xs text-zinc-500 font-mono">
                  ID: {detailModalLog.id}
                </p>
              </div>

              <button
                onClick={() => setDetailModalLog(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-5 gap-4 bg-zinc-50/50 dark:bg-zinc-800/30 text-xs font-medium">
              <button
                onClick={() => setActiveDetailTab('OVERVIEW')}
                className={`py-3 border-b-2 transition-colors ${activeDetailTab === 'OVERVIEW'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
              >
                Tổng quan & Ngữ cảnh
              </button>
              <button
                onClick={() => setActiveDetailTab('PAYLOAD')}
                className={`py-3 border-b-2 transition-colors ${activeDetailTab === 'PAYLOAD'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
              >
                Dữ liệu Payload (JSON)
              </button>
              {detailModalLog.errorMessage && (
                <button
                  onClick={() => setActiveDetailTab('ERROR')}
                  className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${activeDetailTab === 'ERROR'
                    ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                    : 'border-transparent text-rose-500 hover:text-rose-700'
                    }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Thông báo Lỗi / Stack Trace
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {activeDetailTab === 'OVERVIEW' && (
                <div className="space-y-6">
                  {/* Grid Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-zinc-400 font-medium">Module & Hành động:</span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {detailModalLog.module} - {detailModalLog.action}
                      </p>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-zinc-400 font-medium">Thời gian ghi nhận:</span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {new Date(detailModalLog.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-zinc-400 font-medium">Người thực hiện (Actor):</span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {detailModalLog.actorUsername || 'SYSTEM'} (Vai trò: {detailModalLog.actorRole || 'N/A'})
                      </p>
                      {detailModalLog.actorId && (
                        <p className="text-[11px] font-mono text-zinc-500">ID: {detailModalLog.actorId}</p>
                      )}
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-zinc-400 font-medium">Độ trễ thực thi (Latency):</span>
                      <p className="text-sm">{formatExecutionTime(detailModalLog.executionTimeMs)}</p>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-zinc-400 font-medium">HTTP Endpoint:</span>
                      <p className="font-mono text-zinc-800 dark:text-zinc-200">
                        {detailModalLog.httpMethod} {detailModalLog.endpoint || 'Internal Job'}
                      </p>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-zinc-400 font-medium">Địa chỉ IP:</span>
                      <p className="font-mono text-zinc-800 dark:text-zinc-200">
                        {detailModalLog.ipAddress || 'Internal / N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Inline Error Callout */}
                  {detailModalLog.errorMessage && (
                    <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/60 space-y-2">
                      <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Thông báo Lỗi ghi nhận:</span>
                      </div>
                      <p className="font-mono text-xs text-rose-900 dark:text-rose-200 whitespace-pre-wrap">
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
                      Chi tiết tham số & kết quả thực thi (đã che các trường nhạy cảm):
                    </span>
                    <button
                      onClick={() => handleCopy(detailModalLog.details || '{}', 'payload')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                      {copiedKey === 'payload' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      Sao chép JSON
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed border border-zinc-800">
                    {(() => {
                      if (!detailModalLog.details) return '// Không có chi tiết bổ sung';
                      try {
                        const parsed = JSON.parse(detailModalLog.details);
                        return JSON.stringify(parsed, null, 2);
                      } catch (e) {
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
                      Chi tiết Exception / Stack trace:
                    </span>
                    <button
                      onClick={() => handleCopy(detailModalLog.errorMessage || '', 'error')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                      {copiedKey === 'error' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      Sao chép Trace
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-950 text-rose-300 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed border border-zinc-800 whitespace-pre-wrap">
                    {detailModalLog.errorMessage}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setDetailModalLog(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Retention Cleanup Modal */}
      {isCleanupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Dọn dẹp Nhật ký Cũ
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Xóa bỏ các bản ghi kiểm toán hết hạn lưu trữ
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa tất cả các bản ghi nhật ký hệ thống cũ hơn số ngày chỉ định không?
              Hành động này sẽ giải phóng dung lượng cơ sở dữ liệu và{' '}
              <strong className="text-rose-600 dark:text-rose-400 font-semibold">không thể hoàn tác</strong>.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Giữ lại nhật ký trong vòng (ngày):
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(Math.max(1, Number(e.target.value)))}
                  className="w-24 px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
                <div className="flex gap-1.5">
                  {[7, 14, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCleanupDays(d)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${cleanupDays === d
                        ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                      {d} ngày
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(false)}
                disabled={isCleaningUp}
                className="px-4 py-2 text-sm font-medium rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteCleanup}
                disabled={isCleaningUp}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                {isCleaningUp && <RefreshCw className="w-4 h-4 animate-spin" />}
                Xác nhận dọn dẹp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
