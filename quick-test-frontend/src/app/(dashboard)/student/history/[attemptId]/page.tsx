'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Calendar,
  RefreshCw,
  Lock,
  Film,
  Image as ImageIcon,
} from 'lucide-react';
import { studentService } from '@/services/student.service';
import type { StudentAttemptDetailResponse, StudentViolationItemDto } from '@/types/exam';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { EvidenceMediaViewer } from '@/components/proctoring/EvidenceMediaViewer';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

/**
 * Format date string to Vietnamese local format.
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
 * Format duration in seconds to friendly Vietnamese string.
 */
function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}p ${s > 0 ? `${s}s` : ''}`;
}

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'Đang làm bài',
  SUBMITTED: 'Đã nộp bài',
  AWAITING_MANUAL_GRADING: 'Chờ chấm tự luận',
  DISQUALIFIED: 'Bị đình chỉ thi',
  AUTO_GRADED: 'Đã chấm tự động',
  MANUAL_GRADING: 'Đang chấm bài',
  COMPLETED: 'Hoàn thành',
  EXPIRED: 'Hết thời gian',
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: 'Trắc nghiệm',
  MULTIPLE_CHOICE: 'Nhiều đáp án',
  NUMERIC: 'Điền số',
  ESSAY_TEXT: 'Tự luận',
};

export default function StudentAttemptDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const attemptId = resolvedParams.attemptId;

  const [data, setData] = useState<StudentAttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<StudentViolationItemDto | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CORRECT' | 'INCORRECT' | 'ESSAY'>('ALL');

  useEffect(() => {
    let isMounted = true;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await studentService.getAttemptDetail(attemptId);
        if (isMounted) {
          setData(res);
        }
      } catch (err: unknown) {
        console.error('Failed to load attempt detail:', err);
        if (isMounted) {
          setError('Không thể tải thông tin bài thi hoặc bạn không có quyền xem bài làm này.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  const showResults = data?.showResultsToStudents ?? true;

  /**
   * Filter questions based on selected tab.
   */
  const filteredQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions.filter((q) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'ESSAY') return q.questionType === 'ESSAY_TEXT';
      if (!showResults) return true;
      const isCorrect = (q.awardedScore ?? 0) >= (q.points ?? 1.0);
      if (activeFilter === 'CORRECT') return isCorrect;
      if (activeFilter === 'INCORRECT') return !isCorrect && q.questionType !== 'ESSAY_TEXT';
      return true;
    });
  }, [data?.questions, activeFilter, showResults]);

  /**
   * Calculate overview statistics.
   */
  const overviewStats = useMemo(() => {
    if (!data?.questions) {
      return { totalQuestions: 0, correctCount: 0, percentage: 0 };
    }
    const totalQuestions = data.questions.length;
    const correctCount = showResults
      ? data.questions.filter((q) => (q.awardedScore ?? 0) >= (q.points ?? 1.0)).length
      : 0;
    const percentage =
      showResults && data.maxScore && data.maxScore > 0 && data.awardedScore != null
        ? Math.round((data.awardedScore / data.maxScore) * 100)
        : 0;

    return { totalQuestions, correctCount, percentage };
  }, [data, showResults]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs sm:text-sm text-zinc-500 font-medium">Đang tải chi tiết bài làm & điểm số...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
          <XCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Không tìm thấy bài làm
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
            {error || 'Bài thi không tồn tại hoặc phiên làm việc đã hết hạn.'}
          </p>
        </div>
        <Link href="/student/history">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs">
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại Lịch sử</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-16">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/student/history"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại Lịch sử thi</span>
        </Link>

        <span className="text-xs text-zinc-400 font-mono">#{data.attemptId.slice(0, 8)}</span>
      </div>

      {/* Security Privacy Alert When showResults is false */}
      {!showResults && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3.5 sm:p-4 flex items-start gap-3 shadow-2xs">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h3 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
              Chế độ bảo mật đề thi
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
              Giảng viên đã ẩn điểm số chi tiết và đáp án đúng. Bạn chỉ có thể xem lại câu hỏi và phương án đã chọn.
            </p>
          </div>
        </div>
      )}

      {/* Header & Score Summary Card */}
      <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700">
              #{data.accessCode || 'N/A'}
            </span>
            <Badge variant={data.status} dot size="sm">
              {STATUS_LABELS[data.status] || data.status}
            </Badge>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 leading-snug">
            {data.examTitle}
          </h1>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {showResults
              ? 'Tổng hợp điểm số, kết quả chi tiết từng câu hỏi và nhật ký giám sát.'
              : 'Xem lại bài làm của bạn. Điểm số và đáp án đang được bảo mật.'}
          </p>
        </div>

        {/* Compact Score Box */}
        <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 p-4 text-center shrink-0 sm:min-w-[170px]">
          <span className="text-[11px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold block mb-0.5">
            {showResults ? 'Điểm đạt được' : 'Trạng thái'}
          </span>
          {showResults ? (
            <>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                <span className="text-indigo-600 dark:text-indigo-400">{data.awardedScore ?? 0}</span>
                <span className="text-zinc-400 text-lg font-normal mx-1">/</span>
                <span className="text-zinc-600 dark:text-zinc-300 text-xl">{data.maxScore ?? 10}</span>
              </div>
              <span className="inline-block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                Đạt {overviewStats.percentage}% tổng điểm
              </span>
            </>
          ) : (
            <div className="py-1 space-y-0.5">
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Bảo mật điểm</span>
              </div>
              <span className="text-[11px] text-zinc-400 block">Chưa công bố</span>
            </div>
          )}
        </div>
      </div>

      {/* Overview Metrics: 2x2 on Mobile, 4 columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Duration */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">
              Thời gian làm
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
              {formatDuration(data.durationSeconds)}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 mt-1 truncate">
              Nộp: {formatDateTime(data.submitTime)}
            </p>
          </div>
        </div>

        {/* Correct count */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 leading-snug">
              {showResults ? 'Số câu đúng' : 'Tổng số câu'}
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {showResults
                ? `${overviewStats.correctCount} / ${overviewStats.totalQuestions}`
                : `${overviewStats.totalQuestions} câu`}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 mt-1 truncate">
              {showResults ? 'Đạt điểm tối đa' : 'Đã nộp bài làm'}
            </p>
          </div>
        </div>

        {/* Start Time */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">
              Bắt đầu lúc
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
              {formatDateTime(data.startTime)}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 mt-1 truncate">
              Thời điểm mở đề
            </p>
          </div>
        </div>

        {/* Violations */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">
              Giám sát quy chế
            </span>
            <div
              className={cn(
                'flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center',
                data.violationCount > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
              )}
            >
              {data.violationCount > 0 ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
          </div>
          <div>
            <div
              className={cn(
                'text-lg sm:text-xl font-bold tracking-tight leading-tight',
                data.violationCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {data.violationCount > 0 ? `${data.violationCount} lần` : 'Chuẩn mực'}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 mt-1 truncate">
              {data.violationCount > 0 ? 'Có cảnh báo lưu lại' : 'Không có vi phạm'}
            </p>
          </div>
        </div>
      </div>

      {/* Proctoring Log Section */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Nhật ký giám sát
            </h2>
          </div>
          <span className="text-xs text-zinc-500">
            <strong>{data.violations.length}</strong> sự kiện
          </span>
        </div>

        {data.violations.length === 0 ? (
          <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 p-3.5 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xs">
              Bạn đã tuân thủ 100% quy chế phòng thi. Không có bất kỳ cảnh báo vi phạm nào.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.violations.map((v, i) => (
              <div
                key={v.id || `viol-${i}`}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
                      {v.violationType}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {formatDateTime(v.timestamp)}
                    </span>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-snug">
                    {v.description}
                  </p>
                </div>

                {v.evidenceUrl && (
                  <button
                    type="button"
                    onClick={() => setSelectedEvidence(v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 transition-colors cursor-pointer shrink-0 w-fit"
                  >
                    {v.violationType === 'MULTIPLE_FACES' ? (
                      <>
                        <Film className="w-3.5 h-3.5 text-rose-500" />
                        <span>Xem video</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Xem ảnh</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Questions Breakdown Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Chi tiết từng câu hỏi</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {showResults
                ? 'Kiểm tra đáp án và điểm số đạt được từng câu.'
                : 'Xem lại nội dung các câu hỏi và phương án đã chọn.'}
            </p>
          </div>

          {/* Apple Segmented Control for Question Filters */}
          {showResults && (
            <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={cn(
                  'flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  activeFilter === 'ALL'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                Tất cả ({data.questions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('CORRECT')}
                className={cn(
                  'flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  activeFilter === 'CORRECT'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                Đúng ({overviewStats.correctCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('INCORRECT')}
                className={cn(
                  'flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  activeFilter === 'INCORRECT'
                    ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                Sai ({data.questions.length - overviewStats.correctCount})
              </button>
            </div>
          )}
        </div>

        {/* Question Cards List */}
        <div className="space-y-3.5">
          {filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 text-xs">
              Không có câu hỏi nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isCorrect = (q.awardedScore ?? 0) >= (q.points ?? 1.0);
              const isPartiallyGraded = (q.awardedScore ?? 0) > 0 && (q.awardedScore ?? 0) < (q.points ?? 1.0);

              return (
                <div
                  key={q.questionId || `q-${idx}`}
                  className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs space-y-3.5"
                >
                  {/* Header: Question Number, Type, Points */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                        {q.orderIndex != null ? q.orderIndex + 1 : idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        {QUESTION_TYPE_LABELS[q.questionType] || q.questionType}
                      </span>
                    </div>

                    {/* Score Badge */}
                    <div>
                      {showResults ? (
                        <div
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border',
                            isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                              : isPartiallyGraded
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                          )}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {q.awardedScore ?? 0} / {q.points ?? 1.0}đ
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                          <Lock className="w-3 h-3" />
                          <span>Ẩn điểm</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="space-y-2.5">
                    <p className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
                      {q.content}
                    </p>

                    {q.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 max-w-md">
                        <img
                          src={q.imageUrl}
                          alt="Question illustration"
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Question Answers / Options */}
                  {q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTIPLE_CHOICE' ? (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = opt.isSelected;
                        const isCorrectOpt = opt.isCorrect;

                        let optClass =
                          'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 text-zinc-800 dark:text-zinc-200';
                        if (showResults && isCorrectOpt) {
                          optClass =
                            'border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium';
                        } else if (showResults && isSelected && !isCorrectOpt) {
                          optClass =
                            'border-rose-500/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200';
                        } else if (!showResults && isSelected) {
                          optClass =
                            'border-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200 font-medium';
                        }

                        return (
                          <div
                            key={opt.id || `opt-${optIdx}`}
                            className={cn(
                              'p-2.5 sm:p-3 rounded-xl border flex items-start justify-between gap-2.5 text-xs transition-all',
                              optClass
                            )}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <div className="space-y-1 min-w-0">
                                <span className="leading-snug block">{opt.content}</span>
                                {opt.imageUrl && (
                                  <div className="mt-1.5 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 max-w-xs">
                                    <img src={opt.imageUrl} alt="Option illustration" className="w-full h-auto" />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSelected && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  Đã chọn
                                </span>
                              )}
                              {showResults && isCorrectOpt && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Numeric or Essay Text Response */
                    <div className="space-y-2.5 pt-1">
                      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-3 space-y-1">
                        <span className="text-[11px] font-semibold text-zinc-500">Bài làm của bạn:</span>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                          {q.textAnswer || <span className="italic text-zinc-400">Để trống</span>}
                        </p>
                      </div>

                      {showResults && q.sampleAnswer && (
                        <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 p-3 space-y-1">
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            Đáp án chuẩn:
                          </span>
                          <p className="text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap">
                            {q.sampleAnswer}
                          </p>
                        </div>
                      )}

                      {showResults && q.teacherFeedback && (
                        <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-3 space-y-1">
                          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            Nhận xét giảng viên:
                          </span>
                          <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                            {q.teacherFeedback}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Evidence Viewer Sub-Modal */}
      {selectedEvidence && (
        <Modal
          isOpen={Boolean(selectedEvidence)}
          onClose={() => setSelectedEvidence(null)}
          title="Bằng chứng vi phạm camera"
          size="lg"
        >
          <div className="p-1">
            <EvidenceMediaViewer
              evidenceUrl={selectedEvidence.evidenceUrl}
              violationType={selectedEvidence.violationType}
              candidateName={data?.accessCode}
              timestamp={selectedEvidence.timestamp}
              onClose={() => setSelectedEvidence(null)}
              hideHeader={true}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
