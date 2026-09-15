'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Award,
  Save,
  FileText,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { gradingService } from '@/services/grading.service';
import type {
  AttemptGradingDetailResponse,
  GradeEssayItemRequest,
} from '@/types/candidateAnswer';
import type { AttemptStatus } from '@/types/exam';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface AttemptGradingPageProps {
  params: Promise<{
    attemptId: string;
  }>;
}

interface EssayFormState {
  candidateAnswerId: string;
  awardedScore: number;
  teacherFeedback: string;
}

export default function AttemptGradingPage({ params }: AttemptGradingPageProps) {
  const resolvedParams = use(params);
  const attemptId = resolvedParams.attemptId;
  const router = useRouter();

  const [detail, setDetail] = useState<AttemptGradingDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAutoGraded, setShowAutoGraded] = useState(false);

  // Form state for essay grades
  const [essayGrades, setEssayGrades] = useState<Record<string, EssayFormState>>({});

  useEffect(() => {
    let isMounted = true;

    const loadAttemptDetail = async () => {
      try {
        setIsLoading(true);
        const data = await gradingService.getAttemptDetailForGrading(attemptId);
        if (isMounted) {
          setDetail(data);

          // Initialize form state
          const initialForms: Record<string, EssayFormState> = {};
          data.essayQuestions?.forEach((q) => {
            initialForms[q.candidateAnswerId] = {
              candidateAnswerId: q.candidateAnswerId,
              awardedScore: q.awardedScore ?? 0,
              teacherFeedback: q.teacherFeedback || '',
            };
          });
          setEssayGrades(initialForms);
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Không thể tải chi tiết bài làm của thí sinh.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAttemptDetail();

    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  const handleScoreChange = (candidateAnswerId: string, value: number, maxPoints: number) => {
    const sanitized = isNaN(value) ? 0 : Math.max(0, Math.min(value, maxPoints));
    setEssayGrades((prev) => ({
      ...prev,
      [candidateAnswerId]: {
        ...prev[candidateAnswerId],
        awardedScore: sanitized,
      },
    }));
  };

  const handleFeedbackChange = (candidateAnswerId: string, feedback: string) => {
    setEssayGrades((prev) => ({
      ...prev,
      [candidateAnswerId]: {
        ...prev[candidateAnswerId],
        teacherFeedback: feedback,
      },
    }));
  };

  // Submit manual essay grades
  const handleSaveGrades = async () => {
    if (!detail) return;

    const gradesPayload: GradeEssayItemRequest[] = Object.values(essayGrades).map((item) => ({
      candidateAnswerId: item.candidateAnswerId,
      awardedScore: Number(item.awardedScore),
      teacherFeedback: item.teacherFeedback.trim() || undefined,
    }));

    if (gradesPayload.length === 0) {
      toast('Bài thi không có câu tự luận nào cần lưu điểm.', { icon: 'ℹ️' });
      return;
    }

    setIsSaving(true);
    try {
      const result = await gradingService.submitEssayGrades({
        attemptId: detail.attemptId,
        grades: gradesPayload,
      });

      toast.success(result.message || 'Lưu điểm bài thi thành công!');

      // Refresh detail
      const updated = await gradingService.getAttemptDetailForGrading(attemptId);
      setDetail(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi lưu điểm bài thi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-zinc-500">Đang tải chi tiết bài làm của thí sinh...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Không tìm thấy bài làm
        </h2>
        <p className="text-sm text-zinc-500">
          Phiên thi không tồn tại hoặc bạn không có quyền chấm điểm cho đề thi này.
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          Quay lại
        </Button>
      </div>
    );
  }

  // Calculate current projected total score
  const autoScore = detail.autoGradedScore || 0;
  const essaySum = Object.values(essayGrades).reduce((acc, curr) => acc + (Number(curr.awardedScore) || 0), 0);
  const projectedTotalScore = Number((autoScore + essaySum).toFixed(2));
  const hasViolations = (detail.violationCount || 0) > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28">
      {/* Top Breadcrumbs & Back Navigation */}
      <div>
        <Link
          href={`/teacher/exams/${detail.examId}/edit`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại Quản lý đề thi: {detail.examTitle}</span>
        </Link>

        {/* Candidate Profile and Session Header Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-sm">
                {detail.candidateName?.slice(0, 1).toUpperCase() || 'U'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {detail.candidateName}
                  </h1>
                  <Badge variant={detail.status as AttemptStatus} size="sm" dot>
                    {detail.status === 'SUBMITTED'
                      ? 'Đã chấm xong'
                      : detail.status === 'AWAITING_MANUAL_GRADING'
                      ? 'Chờ chấm tự luận'
                      : detail.status === 'DISQUALIFIED'
                      ? 'Bị đình chỉ'
                      : detail.status}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {detail.candidateIdentifier || 'Thí sinh tự do (Không đăng nhập)'}
                </p>
              </div>
            </div>

            {/* Live Score Summary Chip */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-right">
                <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                  Điểm tổng kết
                </p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                  {projectedTotalScore}
                  <span className="text-xs font-normal text-indigo-400 dark:text-indigo-500">
                    /{detail.maxTotalPoints} đ
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Violation Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-zinc-400 text-[11px]">Trắc nghiệm tự động</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                {detail.autoGradedScore ?? 0} điểm
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-zinc-400 text-[11px]">Câu hỏi tự luận</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                {detail.essayQuestions?.length || 0} câu
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-zinc-400 text-[11px]">Thời gian nộp bài</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                {detail.submitTime ? formatDateTime(detail.submitTime) : 'Chưa nộp'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-zinc-400 text-[11px]">Ghi nhận vi phạm</span>
              {hasViolations ? (
                <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{detail.violationCount} lần cảnh báo</span>
                </p>
              ) : (
                <p className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Không vi phạm</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Violation Alert Callout if Any */}
      {hasViolations && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-xs sm:text-sm text-rose-800 dark:text-rose-300">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Hệ thống giám sát phát hiện {detail.violationCount} lần vi phạm</p>
            <p className="text-xs text-rose-700/80 dark:text-rose-400">
              Thí sinh đã có hành vi chuyển tab, rời khỏi màn hình làm bài hoặc phát hiện cửa sổ khác.
              Thầy/cô vui lòng đối chiếu kỹ câu trả lời trước khi cho điểm.
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Essay Questions Grading Canvas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            <span>Chấm điểm câu hỏi tự luận ({detail.essayQuestions?.length || 0})</span>
          </h2>
          <span className="text-xs text-zinc-500">
            Điểm tự luận tối đa: {detail.essayQuestions?.reduce((acc, q) => acc + (q.points || 0), 0) || 0} điểm
          </span>
        </div>

        {detail.essayQuestions?.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 text-xs">
            Bài thi này không có câu hỏi tự luận nào cần chấm thủ công.
          </div>
        ) : (
          <div className="space-y-4">
            {detail.essayQuestions.map((q, index) => {
              const form = essayGrades[q.candidateAnswerId] || {
                candidateAnswerId: q.candidateAnswerId,
                awardedScore: 0,
                teacherFeedback: '',
              };

              return (
                <div
                  key={q.candidateAnswerId}
                  className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden"
                >
                  {/* Question Header */}
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                        {q.orderIndex || index + 1}
                      </span>
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Câu hỏi tự luận #{q.orderIndex || index + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                        Tối đa {q.points} điểm
                      </span>
                    </div>
                  </div>

                  {/* Question Content Body */}
                  <div className="p-5 space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Đề bài
                      </p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                        {q.content}
                      </p>
                    </div>

                    {/* Rubric / Sample Answer (if present) */}
                    {(q.gradingRubric || q.sampleAnswer) && (
                      <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-2">
                        {q.gradingRubric && (
                          <div>
                            <span className="font-semibold text-amber-800 dark:text-amber-400 block">
                              Tiêu chí chấm điểm (Rubric):
                            </span>
                            <p className="text-zinc-700 dark:text-zinc-300 mt-0.5 whitespace-pre-wrap">
                              {q.gradingRubric}
                            </p>
                          </div>
                        )}
                        {q.sampleAnswer && (
                          <div>
                            <span className="font-semibold text-amber-800 dark:text-amber-400 block">
                              Đáp án mẫu tham khảo:
                            </span>
                            <p className="text-zinc-700 dark:text-zinc-300 mt-0.5 italic whitespace-pre-wrap">
                              {q.sampleAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Candidate Text Answer Box */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Bài làm của thí sinh
                      </p>
                      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-sm text-zinc-900 dark:text-zinc-100 font-sans leading-relaxed whitespace-pre-wrap">
                        {q.textAnswer ? (
                          q.textAnswer
                        ) : (
                          <span className="italic text-zinc-400">
                            (Thí sinh không nhập câu trả lời cho câu này)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Grading Form Controls */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                      {/* Score Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Điểm chấm đạt được
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={q.points}
                            step="0.25"
                            value={form.awardedScore}
                            onChange={(e) =>
                              handleScoreChange(
                                q.candidateAnswerId,
                                parseFloat(e.target.value),
                                q.points
                              )
                            }
                            className="w-28 px-3 py-1.5 text-sm font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="text-xs text-zinc-400 font-medium">/ {q.points} đ</span>
                        </div>

                        {/* Quick Score Helper Buttons */}
                        <div className="flex items-center gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => handleScoreChange(q.candidateAnswerId, 0, q.points)}
                            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                          >
                            0 đ
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleScoreChange(
                                q.candidateAnswerId,
                                Number((q.points * 0.5).toFixed(2)),
                                q.points
                              )
                            }
                            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScoreChange(q.candidateAnswerId, q.points, q.points)}
                            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 transition-colors font-bold"
                          >
                            Tối đa
                          </button>
                        </div>
                      </div>

                      {/* Feedback Textarea */}
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Nhận xét / Ghi chú của giáo viên (tùy chọn)
                        </label>
                        <textarea
                          rows={2}
                          value={form.teacherFeedback}
                          onChange={(e) =>
                            handleFeedbackChange(q.candidateAnswerId, e.target.value)
                          }
                          placeholder="Nhập lời nhận xét hoặc giải thích lý do trừ điểm..."
                          className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Auto-Graded Questions Toggle */}
      {detail.autoGradedQuestions && detail.autoGradedQuestions.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAutoGraded(!showAutoGraded)}
            className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Câu hỏi trắc nghiệm tự động ({detail.autoGradedQuestions.length} câu - {detail.autoGradedScore} điểm)
              </span>
            </div>
            {showAutoGraded ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {showAutoGraded && (
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              {detail.autoGradedQuestions.map((item, idx) => (
                <div
                  key={item.questionId}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-xs sm:text-sm"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">
                      Câu {item.orderIndex || idx + 1}: {item.content}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Loại câu: {item.questionType}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-bold ${
                        item.awardedScore > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      +{item.awardedScore} / {item.points} đ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Save Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shadow-lg z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <span className="text-xs text-zinc-500 block">Tổng điểm sau khi chấm:</span>
              <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                {projectedTotalScore} / {detail.maxTotalPoints} điểm
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push(`/teacher/exams/${detail.examId}/edit`)}
            >
              Hủy / Quay lại
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={isSaving}
              onClick={handleSaveGrades}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
              leftIcon={<Save className="w-4 h-4" />}
            >
              Lưu kết quả chấm điểm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
