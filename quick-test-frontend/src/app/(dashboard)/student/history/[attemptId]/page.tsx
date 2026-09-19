'use client';

import React, { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Calendar,
  Layers,
  HelpCircle,
  RefreshCw,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { studentService } from '@/services/student.service';
import type { StudentAttemptDetailResponse, AttemptStatus } from '@/types/exam';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';

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
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format duration in seconds to friendly Vietnamese string (e.g. 14 phút 25 giây).
 */
function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} giây`;
  return `${m} phút ${s > 0 ? `${s} giây` : ''}`;
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
  SINGLE_CHOICE: 'Trắc nghiệm 1 đáp án',
  MULTIPLE_CHOICE: 'Trắc nghiệm nhiều đáp án',
  NUMERIC: 'Điền số',
  ESSAY_TEXT: 'Tự luận',
};

export default function StudentAttemptDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const attemptId = resolvedParams.attemptId;

  const [data, setData] = useState<StudentAttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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

  /**
   * Filter questions based on selected tab.
   */
  const filteredQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions.filter((q) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'ESSAY') return q.questionType === 'ESSAY_TEXT';
      const isCorrect = (q.awardedScore ?? 0) >= (q.points ?? 1.0);
      if (activeFilter === 'CORRECT') return isCorrect;
      if (activeFilter === 'INCORRECT') return !isCorrect && q.questionType !== 'ESSAY_TEXT';
      return true;
    });
  }, [data?.questions, activeFilter]);

  /**
   * Calculate overview statistics.
   */
  const overviewStats = useMemo(() => {
    if (!data?.questions) {
      return { totalQuestions: 0, correctCount: 0, percentage: 0 };
    }
    const totalQuestions = data.questions.length;
    const correctCount = data.questions.filter(
      (q) => (q.awardedScore ?? 0) >= (q.points ?? 1.0)
    ).length;
    const percentage =
      data.maxScore && data.maxScore > 0 && data.awardedScore != null
        ? Math.round((data.awardedScore / data.maxScore) * 100)
        : 0;

    return { totalQuestions, correctCount, percentage };
  }, [data]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-zinc-500 font-medium">Đang tải chi tiết bài làm & điểm số...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
          <XCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Không tìm thấy bài làm
          </h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            {error || 'Bài thi không tồn tại hoặc phiên làm việc đã hết hạn.'}
          </p>
        </div>
        <Link href="/student/history">
          <Button variant="outline" className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại Lịch sử làm bài</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/student/history"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại Lịch sử làm bài</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono">ID: {data.attemptId.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-zinc-900 border border-indigo-900/40 p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phòng thi: {data.accessCode || 'N/A'}
              </span>
              <Badge variant={data.status} dot size="sm">
                {STATUS_LABELS[data.status] || data.status}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {data.examTitle}
            </h1>

            <p className="text-xs sm:text-sm text-zinc-400">
              Chi tiết đánh giá kết quả bài thi, đáp án thí sinh và nhật ký giám sát quy chế.
            </p>
          </div>

          {/* Big Score Card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 sm:p-6 text-center shrink-0 min-w-[200px] backdrop-blur-md">
            <span className="text-xs uppercase tracking-wider text-indigo-200/80 font-semibold block mb-1">
              Điểm Đạt Được
            </span>
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              <span className="text-emerald-400">{data.awardedScore ?? 0}</span>
              <span className="text-white/40 text-xl font-normal mx-1">/</span>
              <span className="text-white/80 text-2xl">{data.maxScore ?? 10}</span>
            </div>
            <div className="text-xs text-zinc-400 mt-2 font-medium">
              Đạt {overviewStats.percentage}% tổng điểm
            </div>
          </div>
        </div>
      </div>

      {/* Overview Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Timing */}
        <div className="p-1 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between h-full shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500">Thời gian làm bài</span>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {formatDuration(data.durationSeconds)}
              </div>
              <p className="text-[11px] text-zinc-400">
                Nộp lúc {formatDateTime(data.submitTime)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Questions answered */}
        <div className="p-1 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between h-full shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500">Số câu đúng</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {overviewStats.correctCount} / {overviewStats.totalQuestions}
              </div>
              <p className="text-[11px] text-zinc-400">Câu đạt điểm tối đa</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Timing - Start Time */}
        <div className="p-1 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between h-full shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500">Thời điểm bắt đầu</span>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {formatDateTime(data.startTime)}
              </div>
              <p className="text-[11px] text-zinc-400">Khởi tạo bài thi</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Violations */}
        <div className="p-1 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-between h-full shadow-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500">Giám sát quy chế</span>
              <div className={`text-lg font-bold ${data.violationCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {data.violationCount > 0 ? `${data.violationCount} lần vi phạm` : 'Chuẩn mực'}
              </div>
              <p className="text-[11px] text-zinc-400">
                {data.violationCount > 0 ? 'Có cảnh báo được lưu' : 'Không có vi phạm'}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${data.violationCount > 0 ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'}`}>
              {data.violationCount > 0 ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </div>

      {/* Proctoring Log Section */}
      <div className="rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 p-1 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Nhật ký Giám sát & Cảnh báo Vi phạm
              </h2>
            </div>
            <span className="text-xs text-zinc-500">
              Tổng cộng: <strong>{data.violations.length}</strong> sự kiện ghi nhận
            </span>
          </div>

          {data.violations.length === 0 ? (
            <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-xs">
                Tuyệt vời! Bạn đã tuân thủ nghiêm túc 100% quy chế phòng thi trong suốt quá trình làm bài. Không có bất kỳ cảnh báo vi phạm nào.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400">
                    <th className="py-2.5 px-3">Thời gian</th>
                    <th className="py-2.5 px-3">Loại vi phạm</th>
                    <th className="py-2.5 px-3">Chi tiết cảnh báo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.violations.map((v, i) => (
                    <tr key={v.id || `viol-${i}`} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <td className="py-2.5 px-3 font-mono text-zinc-500">
                        {formatDateTime(v.timestamp)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
                          {v.violationType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">
                        {v.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Questions Breakdown Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span>Chi tiết từng câu hỏi & Đáp án</span>
            </h2>
            <p className="text-xs text-zinc-500">
              Kiểm tra chi tiết bài làm của bạn so với đáp án chuẩn và điểm số đạt được từng câu.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-500">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'ALL' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              Tất cả ({data.questions.length})
            </button>
            <button
              onClick={() => setActiveFilter('CORRECT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'CORRECT' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              Đúng ({overviewStats.correctCount})
            </button>
            <button
              onClick={() => setActiveFilter('INCORRECT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeFilter === 'INCORRECT' ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm' : 'hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              Sai ({data.questions.length - overviewStats.correctCount})
            </button>
          </div>
        </div>

        {/* Question Cards List */}
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 text-xs">
              Không có câu hỏi nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isCorrect = (q.awardedScore ?? 0) >= (q.points ?? 1.0);
              const isPartiallyGraded = (q.awardedScore ?? 0) > 0 && (q.awardedScore ?? 0) < (q.points ?? 1.0);

              return (
                <div
                  key={q.questionId || `q-${idx}`}
                  className="rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 p-1 border border-zinc-200/80 dark:border-zinc-800 shadow-sm transition-all"
                >
                  <div className="rounded-xl bg-white dark:bg-zinc-900 p-6 space-y-4">
                    {/* Header: Question Number, Type, Points */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                          {q.orderIndex != null ? q.orderIndex + 1 : idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                          {QUESTION_TYPE_LABELS[q.questionType] || q.questionType}
                        </span>
                      </div>

                      {/* Score Badge */}
                      <div className="flex items-center gap-2">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                            isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                              : isPartiallyGraded
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {q.awardedScore ?? 0} / {q.points ?? 1.0} điểm
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
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
                      <div className="space-y-2 pt-2">
                        <div className="text-xs font-semibold text-zinc-400 mb-2">Các đáp án lựa chọn:</div>
                        <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = opt.isSelected;
                            const isCorrectOpt = opt.isCorrect;

                            // Determine option styling
                            let optClass = 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 text-zinc-800 dark:text-zinc-200';
                            if (isCorrectOpt) {
                              optClass = 'border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium';
                            } else if (isSelected && !isCorrectOpt) {
                              optClass = 'border-rose-500/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200';
                            }

                            return (
                              <div
                                key={opt.id || `opt-${optIdx}`}
                                className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all ${optClass}`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <span className="w-5 h-5 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <div className="space-y-1">
                                    <span>{opt.content}</span>
                                    {opt.imageUrl && (
                                      <div className="mt-2 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 max-w-xs">
                                        <img src={opt.imageUrl} alt="Option illustration" className="w-full h-auto" />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isSelected && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                      Đáp án bạn chọn
                                    </span>
                                  )}
                                  {isCorrectOpt && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Đáp án đúng</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* Numeric or Essay Text Response */
                      <div className="space-y-3 pt-2">
                        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-4 space-y-1.5">
                          <span className="text-xs font-semibold text-zinc-500">Bài làm của bạn:</span>
                          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                            {q.textAnswer || <span className="italic text-zinc-400">Thí sinh để trống</span>}
                          </p>
                        </div>

                        {q.sampleAnswer && (
                          <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 p-4 space-y-1.5">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              Đáp án chuẩn / Hướng dẫn giải:
                            </span>
                            <p className="text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap">
                              {q.sampleAnswer}
                            </p>
                          </div>
                        )}

                        {q.teacherFeedback && (
                          <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-4 space-y-1.5">
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                              Nhận xét của giáo viên:
                            </span>
                            <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                              {q.teacherFeedback}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
