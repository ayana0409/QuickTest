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
  RefreshCw,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { studentService } from '@/services/student.service';
import type { StudentAttemptSummaryDto, PageResponse } from '@/types/exam';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';

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
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60 mb-1.5">
            <Clock className="w-3 h-3 text-indigo-500" />
            <span>Theo dõi tiến trình học tập</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Lịch sử làm bài
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Xem lại toàn bộ kết quả bài kiểm tra và nhật ký giám sát của bạn.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
            title="Làm mới danh sách"
          >
            <RefreshCw className={cn("w-4 h-4 text-zinc-600 dark:text-zinc-400", isRefreshing && "animate-spin text-indigo-600")} />
          </button>

          <Link href="/student">
            <Button
              variant="primary"
              size="sm"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-2xs font-semibold text-xs sm:text-sm h-9 px-3.5"
            >
              <BookOpen className="w-4 h-4" />
              <span>Vào phòng thi</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Metric Cards: 2x2 on Mobile, 4 columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Attempts */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">
              Tổng lượt thi
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
              {stats.total}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              Tất cả bài thi ghi nhận
            </p>
          </div>
        </div>

        {/* Completed */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 leading-snug">
              Đã hoàn thành
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {stats.completed}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              Đã nộp & có kết quả
            </p>
          </div>
        </div>

        {/* Average Score */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 leading-snug">
              Điểm trung bình
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 leading-tight">
              {stats.avgScore}
              {stats.avgScore !== '—' && <span className="text-xs font-medium text-zinc-400 ml-1">đ</span>}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              Trên các bài đã nộp
            </p>
          </div>
        </div>

        {/* Violations */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">
              Cảnh báo quy chế
            </span>
            <div
              className={cn(
                'flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center',
                stats.totalViolations > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
              )}
            >
              {stats.totalViolations > 0 ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
          </div>
          <div>
            <div
              className={cn(
                'text-xl sm:text-2xl font-bold tracking-tight leading-tight',
                stats.totalViolations > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'
              )}
            >
              {stats.totalViolations}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 truncate">
              {stats.totalViolations === 0 ? 'Không có vi phạm' : 'Ghi nhận giám sát'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bài kiểm tra..."
              className="w-full pl-8 pr-7 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc theo trạng thái bài thi"
              className="w-full sm:w-auto text-xs rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 py-2 px-3 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="SUBMITTED">Đã nộp bài</option>
              <option value="AWAITING_MANUAL_GRADING">Chờ chấm tự luận</option>
              <option value="IN_PROGRESS">Đang làm bài</option>
              <option value="DISQUALIFIED">Bị đình chỉ thi</option>
            </select>
          </div>
        </div>

        {/* Loading / Empty / Data Views */}
        {loading ? (
          <div className="p-4 sm:p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 animate-pulse flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-48" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800/60 rounded w-32" />
                </div>
                <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-24" />
              </div>
            ))}
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="py-16 px-4 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                Chưa có dữ liệu bài làm
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
                  : 'Bạn chưa tham gia bài thi nào. Hãy nhập mã phòng thi để bắt đầu làm bài!'}
              </p>
            </div>
            <Link href="/student">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs mt-2">
                Xem các đề thi mở
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile View: Responsive Attempt History Cards (< md) */}
            <div className="block md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredAttempts.map((attempt) => {
                const isInProgress = attempt.status === 'IN_PROGRESS';
                const isDisqualified = attempt.status === 'DISQUALIFIED';

                return (
                  <div key={attempt.attemptId} className="p-4 space-y-3">
                    {/* Top Row: Exam Title & Status Badge */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">
                          {attempt.examTitle || 'Bài kiểm tra không tên'}
                        </h4>
                        <span className="text-[11px] text-zinc-400 font-mono block mt-0.5">
                          #{attempt.attemptId.slice(0, 8)}
                        </span>
                      </div>
                      <div className="shrink-0">
                        <Badge variant={attempt.status} dot size="sm">
                          {STATUS_LABELS[attempt.status] || attempt.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Middle Row: 3-column metrics strip */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-center">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-400 font-medium block">Điểm số</span>
                        {attempt.awardedScore != null ? (
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {attempt.awardedScore}/{attempt.maxScore ?? 10}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">Chờ chấm</span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-400 font-medium block">Vi phạm</span>
                        {attempt.violationCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {attempt.violationCount}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">0</span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-400 font-medium block">Thời gian</span>
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-300 font-mono block truncate">
                          {formatDateTime(attempt.submitTime || attempt.startTime)}
                        </span>
                      </div>
                    </div>

                    {/* Action CTA */}
                    <div>
                      {isInProgress ? (
                        <Link href={`/exam/${attempt.attemptId}`} className="block w-full">
                          <Button
                            size="sm"
                            variant="primary"
                            className="w-full justify-center text-xs rounded-xl bg-amber-600 hover:bg-amber-700 text-white h-8"
                            rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                          >
                            Tiếp tục làm bài
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/student/history/${attempt.attemptId}`} className="block w-full">
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              'w-full justify-center text-xs rounded-xl h-8',
                              isDisqualified
                                ? 'border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400'
                                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                            )}
                            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            {isDisqualified ? 'Xem nhật ký vi phạm' : 'Xem kết quả bài làm'}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full 6-Column Data Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/30 text-[11px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
                    <th className="py-3.5 px-5">Bài kiểm tra</th>
                    <th className="py-3.5 px-5">Thời gian</th>
                    <th className="py-3.5 px-5">Trạng thái</th>
                    <th className="py-3.5 px-5 text-center">Điểm số</th>
                    <th className="py-3.5 px-5 text-center">Quy chế</th>
                    <th className="py-3.5 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredAttempts.map((attempt) => {
                    const isInProgress = attempt.status === 'IN_PROGRESS';
                    const isDisqualified = attempt.status === 'DISQUALIFIED';

                    return (
                      <tr
                        key={attempt.attemptId}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                      >
                        {/* Exam Title */}
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {attempt.examTitle || 'Bài kiểm tra không tên'}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                            #{attempt.attemptId.slice(0, 8)}
                          </div>
                        </td>

                        {/* Timing */}
                        <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-300">
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
                        <td className="py-3.5 px-5">
                          <Badge variant={attempt.status} dot size="sm">
                            {STATUS_LABELS[attempt.status] || attempt.status}
                          </Badge>
                        </td>

                        {/* Awarded Score */}
                        <td className="py-3.5 px-5 text-center">
                          {attempt.awardedScore != null ? (
                            <div className="inline-flex items-center gap-1 font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg text-xs">
                              <span className="text-indigo-600 dark:text-indigo-400">
                                {attempt.awardedScore}
                              </span>
                              <span className="text-zinc-400">/</span>
                              <span>{attempt.maxScore ?? 10}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">Chờ chấm</span>
                          )}
                        </td>

                        {/* Violation Count */}
                        <td className="py-3.5 px-5 text-center">
                          {attempt.violationCount > 0 ? (
                            <div
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/40"
                              title={`Hệ thống ghi nhận ${attempt.violationCount} lần vi phạm quy chế`}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{attempt.violationCount} lần</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Chuẩn mực</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right">
                          {isInProgress ? (
                            <Link href={`/exam/${attempt.attemptId}`}>
                              <Button
                                size="sm"
                                variant="primary"
                                className="text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-8 px-3 gap-1"
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
                                className={cn(
                                  'text-xs rounded-xl h-8 px-3 gap-1',
                                  isDisqualified
                                    ? 'border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                )}
                              >
                                <span>{isDisqualified ? 'Xem vi phạm' : 'Xem kết quả'}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {data && data.totalPages > 1 && (
          <div className="p-3.5 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <div>
              Trang <strong>{data.page + 1}</strong> / {data.totalPages} ({data.totalElements} bài)
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={data.isFirst || loading}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                className="h-8 px-2.5 text-xs rounded-xl gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Trước</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={data.isLast || loading}
                onClick={() => setCurrentPage((p) => Math.min(data.totalPages - 1, p + 1))}
                className="h-8 px-2.5 text-xs rounded-xl gap-1"
              >
                <span className="hidden sm:inline">Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
