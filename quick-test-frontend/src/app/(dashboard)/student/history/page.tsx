'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  BookOpen,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  FileSpreadsheet,
} from 'lucide-react';
import { studentService } from '@/services/student.service';
import type { StudentAttemptSummaryDto, AttemptStatus, PageResponse } from '@/types/exam';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';

/**
 * Helper to format Vietnamese date string nicely.
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
 * Status labels in Vietnamese for student attempts.
 */
const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'Đang làm bài',
  SUBMITTED: 'Đã nộp bài',
  AWAITING_MANUAL_GRADING: 'Chờ chấm tự luận',
  DISQUALIFIED: 'Bị đình chỉ',
  AUTO_GRADED: 'Đã chấm tự động',
  MANUAL_GRADING: 'Đang chấm bài',
  COMPLETED: 'Hoàn thành',
  EXPIRED: 'Hết giờ',
};

export default function StudentAttemptHistoryPage() {
  const [data, setData] = useState<PageResponse<StudentAttemptSummaryDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  /**
   * Fetch attempts from Spring Boot API.
   */
  const loadAttempts = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const res = await studentService.getAttemptHistory({ page, size: pageSize });
      setData(res);
    } catch (err) {
      console.error('Failed to load student attempt history:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadAttempts(currentPage);
  }, [currentPage, loadAttempts]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAttempts(currentPage);
  };

  /**
   * Filter attempts client-side for immediate responsive search experience.
   */
  const filteredAttempts = useMemo(() => {
    if (!data?.content) return [];
    return data.content.filter((attempt) => {
      const matchQuery =
        searchQuery.trim() === '' ||
        attempt.examTitle?.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchStatus =
        statusFilter === 'ALL' ||
        attempt.status === statusFilter ||
        (statusFilter === 'COMPLETED_GROUP' &&
          (attempt.status === 'SUBMITTED' ||
            attempt.status === 'COMPLETED' ||
            attempt.status === 'AUTO_GRADED'));

      return matchQuery && matchStatus;
    });
  }, [data?.content, searchQuery, statusFilter]);

  /**
   * Calculate summary statistics for metric cards.
   */
  const stats = useMemo(() => {
    if (!data?.content) {
      return { total: 0, completed: 0, avgScore: '—', totalViolations: 0 };
    }

    const total = data.totalElements || data.content.length;
    const completedList = data.content.filter(
      (a) => a.status === 'SUBMITTED' || a.status === 'COMPLETED' || a.status === 'AUTO_GRADED'
    );
    const completed = completedList.length;

    const scoredList = completedList.filter((a) => a.awardedScore != null && a.maxScore != null);
    const avgScore =
      scoredList.length > 0
        ? (
            scoredList.reduce((acc, curr) => acc + (curr.awardedScore || 0), 0) / scoredList.length
          ).toFixed(1)
        : '—';

    const totalViolations = data.content.reduce(
      (acc, curr) => acc + (curr.violationCount || 0),
      0
    );

    return { total, completed, avgScore, totalViolations };
  }, [data]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-8 text-white shadow-xl">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-medium text-indigo-200">
              <Clock className="w-3.5 h-3.5" />
              <span>Theo dõi tiến trình học tập</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Lịch sử làm bài & Điểm số
            </h1>
            <p className="text-sm sm:text-base text-indigo-200/90 max-w-2xl">
              Xem lại toàn bộ kết quả bài kiểm tra, điểm số chi tiết và nhật ký giám sát quy chế thi của bạn.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white gap-2 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </Button>
            <Link href="/student">
              <Button size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white gap-1.5 shadow-lg shadow-indigo-500/30">
                <BookOpen className="w-4 h-4" />
                <span>Vào phòng thi</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Metric Cards (Bento Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Attempts */}
        <div className="p-1 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 transition-all">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between h-full shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Tổng lượt thi
              </span>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {stats.total}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Tất cả bài thi ghi nhận</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="p-1 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 transition-all">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between h-full shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Bài thi hoàn thành
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.completed}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Đã nộp & có kết quả</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div className="p-1 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 transition-all">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between h-full shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Điểm trung bình
              </span>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {stats.avgScore}
                {stats.avgScore !== '—' && <span className="text-sm font-normal text-zinc-400 ml-1">pts</span>}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Dựa trên các bài đã nộp</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Violations */}
        <div className="p-1 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 transition-all">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between h-full shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Cảnh báo quy chế
              </span>
              <div className={`text-2xl font-bold ${stats.totalViolations > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                {stats.totalViolations}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {stats.totalViolations === 0 ? 'Tuyệt vời! Không có vi phạm' : 'Ghi nhận bởi hệ thống giám sát'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stats.totalViolations > 0 ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
              {stats.totalViolations > 0 ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card (Double-Bezel Architecture) */}
      <div className="rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 p-1 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="rounded-xl bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Controls Bar */}
          <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên bài kiểm tra..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs text-zinc-500 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                <span>Trạng thái:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Lọc theo trạng thái bài thi"
                className="text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 py-2 px-3 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="SUBMITTED">Đã nộp bài</option>
                <option value="AWAITING_MANUAL_GRADING">Chờ chấm tự luận</option>
                <option value="IN_PROGRESS">Đang làm bài</option>
                <option value="DISQUALIFIED">Bị đình chỉ thi</option>
              </select>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/30 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <th className="py-3.5 px-6">Bài kiểm tra</th>
                  <th className="py-3.5 px-6">Thời gian làm bài</th>
                  <th className="py-3.5 px-6">Trạng thái</th>
                  <th className="py-3.5 px-6 text-center">Điểm số</th>
                  <th className="py-3.5 px-6 text-center">Cảnh báo quy chế</th>
                  <th className="py-3.5 px-6 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="py-4 px-6">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-48 mb-2" />
                        <div className="h-3 bg-zinc-100 dark:bg-zinc-800/60 rounded w-24" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-28" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full w-20" />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-16 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-12 mx-auto" />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-24 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="max-w-sm mx-auto space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
                          <FileSpreadsheet className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            Chưa có dữ liệu bài làm
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {searchQuery || statusFilter !== 'ALL'
                              ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
                              : 'Bạn chưa tham gia bài thi nào. Hãy nhập mã phòng thi để bắt đầu làm bài!'}
                          </p>
                        </div>
                        <Link href="/student">
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white mt-2">
                            Xem các đề thi mở
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAttempts.map((attempt) => {
                    const isSubmitted =
                      attempt.status === 'SUBMITTED' ||
                      attempt.status === 'COMPLETED' ||
                      attempt.status === 'AUTO_GRADED';
                    const isInProgress = attempt.status === 'IN_PROGRESS';
                    const isDisqualified = attempt.status === 'DISQUALIFIED';

                    return (
                      <tr
                        key={attempt.attemptId}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                      >
                        {/* Exam Title */}
                        <td className="py-4 px-6">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {attempt.examTitle || 'Bài kiểm tra không tên'}
                          </div>
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                            ID: {attempt.attemptId.slice(0, 8)}...
                          </div>
                        </td>

                        {/* Timing */}
                        <td className="py-4 px-6 text-zinc-600 dark:text-zinc-300">
                          <div className="flex flex-col text-xs space-y-0.5">
                            <span>Bắt đầu: {formatDateTime(attempt.startTime)}</span>
                            {attempt.submitTime && (
                              <span className="text-zinc-400 dark:text-zinc-500">
                                Nộp: {formatDateTime(attempt.submitTime)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-6">
                          <Badge
                            variant={attempt.status}
                            dot
                            size="sm"
                          >
                            {STATUS_LABELS[attempt.status] || attempt.status}
                          </Badge>
                        </td>

                        {/* Awarded Score / Max Score */}
                        <td className="py-4 px-6 text-center">
                          {attempt.awardedScore != null ? (
                            <div className="inline-flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg text-xs">
                              <span className="text-indigo-600 dark:text-indigo-400">
                                {attempt.awardedScore}
                              </span>
                              <span className="text-zinc-400">/</span>
                              <span>{attempt.maxScore ?? 10}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">Chưa có điểm</span>
                          )}
                        </td>

                        {/* Violation Count with Warning Indicator */}
                        <td className="py-4 px-6 text-center">
                          {attempt.violationCount > 0 ? (
                            <div
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/40"
                              title={`Hệ thống ghi nhận ${attempt.violationCount} lần vi phạm quy chế`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>{attempt.violationCount} lần</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Không có</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          {isInProgress ? (
                            <Link href={`/exam/${attempt.attemptId}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs border-sky-300 dark:border-sky-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 gap-1"
                              >
                                <span>Tiếp tục</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/student/history/${attempt.attemptId}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`text-xs gap-1 ${
                                  isDisqualified
                                    ? 'border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                    : 'border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                                }`}
                              >
                                <span>{isDisqualified ? 'Xem vi phạm' : 'Xem chi tiết'}</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {data && data.totalPages > 1 && (
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <div>
                Trang {data.page + 1} / {data.totalPages} ({data.totalElements} bài thi)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.isFirst || loading}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </Button>

                {Array.from({ length: data.totalPages }).map((_, i) => {
                  if (
                    i === 0 ||
                    i === data.totalPages - 1 ||
                    Math.abs(i - data.page) <= 1
                  ) {
                    return (
                      <button
                        key={`page-${i}`}
                        onClick={() => setCurrentPage(i)}
                        className={`w-8 h-8 rounded-lg font-medium transition-all ${
                          i === data.page
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  } else if (
                    (i === 1 && data.page > 2) ||
                    (i === data.totalPages - 2 && data.page < data.totalPages - 3)
                  ) {
                    return (
                      <span key={`ellipsis-${i}`} className="px-1 text-zinc-400">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.isLast || loading}
                  onClick={() => setCurrentPage((p) => Math.min(data.totalPages - 1, p + 1))}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
