'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Eye,
  RefreshCw,
  ShieldAlert,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Inbox,
  Award,
} from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { gradingService } from '@/services/grading.service';
import type { AttemptSummaryDto, AttemptStatus, PageResponse } from '@/types/exam';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ExamAttemptsTabProps {
  examId: string;
  totalPoints?: number;
}

const STATUS_FILTERS: { label: string; value: AttemptStatus | 'ALL' }[] = [
  { label: 'Tất cả trạng thái', value: 'ALL' },
  { label: 'Chờ chấm tự luận', value: 'AWAITING_MANUAL_GRADING' },
  { label: 'Đã hoàn thành (Chấm xong)', value: 'SUBMITTED' },
  { label: 'Đang làm bài', value: 'IN_PROGRESS' },
  { label: 'Bị đình chỉ / Vi phạm', value: 'DISQUALIFIED' },
];

export const ExamAttemptsTab: React.FC<ExamAttemptsTabProps> = ({ examId, totalPoints = 10 }) => {
  const [attemptsData, setAttemptsData] = useState<PageResponse<AttemptSummaryDto> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter and Pagination state
  const [selectedStatus, setSelectedStatus] = useState<AttemptStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(0);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch attempts from server
  const fetchAttempts = useCallback(
    async (showLoadingSpinner = true) => {
      if (!examId) return;
      if (showLoadingSpinner) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const response = await gradingService.getExamAttempts(examId, {
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          search: debouncedSearch || undefined,
          page: currentPage,
          size: pageSize,
          sort: 'submitTime,desc',
        });
        setAttemptsData(response);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Không thể tải danh sách phiên thi.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [examId, selectedStatus, debouncedSearch, currentPage, pageSize]
  );

  useEffect(() => {
    fetchAttempts(true);
  }, [fetchAttempts]);

  // Aggregate metrics from current content
  const totalAttemptsCount = attemptsData?.totalElements ?? 0;
  const attemptsList = attemptsData?.content || [];

  // Helper status label
  const renderStatusBadge = (status: AttemptStatus) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <Badge variant="SUBMITTED" size="sm" dot>
            Đã hoàn thành
          </Badge>
        );
      case 'AWAITING_MANUAL_GRADING':
        return (
          <Badge variant="AWAITING_MANUAL_GRADING" size="sm" dot>
            Chờ chấm tự luận
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge variant="IN_PROGRESS" size="sm" dot>
            Đang làm bài
          </Badge>
        );
      case 'DISQUALIFIED':
        return (
          <Badge variant="DISQUALIFIED" size="sm" dot>
            Bị đình chỉ
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tổng số phiên thi</p>
            <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {totalAttemptsCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Chờ chấm tự luận</p>
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {attemptsList.filter((a) => a.status === 'AWAITING_MANUAL_GRADING').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Edit3 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Đã hoàn thành điểm</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {attemptsList.filter((a) => a.status === 'SUBMITTED').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Phiên có vi phạm</p>
            <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {attemptsList.filter((a) => (a.violationCount || 0) > 0).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên thí sinh, email hoặc MSSV..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as AttemptStatus | 'ALL');
                setCurrentPage(0);
              }}
              className="px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 cursor-pointer font-medium"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action / Refresh */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAttempts(false)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Attempts Table Container */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : attemptsList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Chưa có phiên thi nào phù hợp
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              {debouncedSearch || selectedStatus !== 'ALL'
                ? 'Không tìm thấy phiên thi nào khớp với điều kiện lọc hiện tại. Vui lòng thử xóa bộ lọc tìm kiếm.'
                : 'Thí sinh sau khi tham gia bài thi sẽ được ghi nhận và hiển thị đầy đủ tiến độ tại danh sách này.'}
            </p>
            {(debouncedSearch || selectedStatus !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedStatus('ALL');
                }}
              >
                Xóa tất cả bộ lọc
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Thí sinh</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Điểm số</th>
                  <th className="py-3.5 px-4">Vi phạm</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                {attemptsList.map((attempt) => {
                  const hasViolations = (attempt.violationCount || 0) > 0;
                  const isGradable =
                    attempt.status === 'AWAITING_MANUAL_GRADING' ||
                    attempt.status === 'SUBMITTED' ||
                    attempt.hasPendingEssay;

                  return (
                    <tr
                      key={attempt.attemptId}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Candidate Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {attempt.candidateName?.slice(0, 1).toUpperCase() || 'U'}
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                              {attempt.candidateName}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono line-clamp-1">
                              {attempt.candidateIdentifier || 'Thí sinh tự do (Guest)'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {renderStatusBadge(attempt.status)}
                          {attempt.hasPendingEssay && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                              <Edit3 className="w-3 h-3" />
                              <span>Còn {attempt.pendingEssayCount} câu tự luận</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Score Column */}
                      <td className="py-3.5 px-4">
                        {attempt.totalScore !== null && attempt.totalScore !== undefined ? (
                          <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                            <Award className="w-4 h-4 text-amber-500" />
                            <span className="text-sm">
                              {attempt.totalScore}
                              <span className="text-xs font-normal text-zinc-400">/{totalPoints} đ</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Đang chờ chấm</span>
                        )}
                      </td>

                      {/* Violations Column */}
                      <td className="py-3.5 px-4">
                        {hasViolations ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60 shadow-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            <span>{attempt.violationCount} lần</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>0</span>
                          </span>
                        )}
                      </td>

                      {/* Timestamp Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {attempt.submitTime ? (
                            <>
                              <div className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                                <Clock className="w-3 h-3" />
                                <span>{formatDateTime(attempt.submitTime)}</span>
                              </div>
                              <p className="text-[11px] text-zinc-400">Nộp bài</p>
                            </>
                          ) : attempt.startTime ? (
                            <>
                              <div className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                                <Clock className="w-3 h-3" />
                                <span>{formatDateTime(attempt.startTime)}</span>
                              </div>
                              <p className="text-[11px] text-sky-500">Bắt đầu làm</p>
                            </>
                          ) : (
                            <span>-</span>
                          )}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/teacher/grading/attempts/${attempt.attemptId}`}>
                            <Button
                              variant={attempt.status === 'AWAITING_MANUAL_GRADING' ? 'primary' : 'outline'}
                              size="sm"
                              className={
                                attempt.status === 'AWAITING_MANUAL_GRADING'
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : ''
                              }
                              leftIcon={
                                attempt.status === 'AWAITING_MANUAL_GRADING' ? (
                                  <Edit3 className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )
                              }
                            >
                              {attempt.status === 'AWAITING_MANUAL_GRADING'
                                ? 'Chấm điểm'
                                : isGradable
                                ? 'Chấm lại / Xem'
                                : 'Xem chi tiết'}
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {attemptsData && attemptsData.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            <div>
              Hiển thị{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {attemptsData.page * attemptsData.size + 1}
              </span>{' '}
              đến{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {Math.min((attemptsData.page + 1) * attemptsData.size, attemptsData.totalElements)}
              </span>{' '}
              trên tổng số{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {attemptsData.totalElements}
              </span>{' '}
              phiên thi
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={attemptsData.isFirst}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Trang trước
              </Button>

              <span className="px-3 py-1 font-medium text-zinc-900 dark:text-zinc-100">
                Trang {attemptsData.page + 1} / {attemptsData.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={attemptsData.isLast}
                onClick={() => setCurrentPage((p) => p + 1)}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
