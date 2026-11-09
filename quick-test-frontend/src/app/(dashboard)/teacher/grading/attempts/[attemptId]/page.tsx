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
  FileSpreadsheet,
  Film,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { EvidenceMediaViewer } from '@/components/proctoring/EvidenceMediaViewer';
import { gradingService } from '@/services/grading.service';
import { teacherProctoringService } from '@/services/teacherProctoring.service';
import type {
  AttemptGradingDetailResponse,
  GradeEssayItemRequest,
} from '@/types/candidateAnswer';
import type { AttemptStatus } from '@/types/exam';
import type { ViolationLogEntry } from '@/types/proctoring';
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
  const [isExporting, setIsExporting] = useState(false);

  // Violation Audit & Evidence states
  const [violations, setViolations] = useState<ViolationLogEntry[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<ViolationLogEntry | null>(null);
  const [showViolationsList, setShowViolationsList] = useState(false);

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

          // Fetch violation audit logs if attempt has recorded violations
          if ((data.violationCount || 0) > 0) {
            try {
              const logs = await teacherProctoringService.getAttemptViolations(attemptId);
              if (isMounted) {
                setViolations(logs || []);
              }
            } catch {
              // Silently ignore violation log fetch error
            }
          }
        }
      } catch {
        // Error toast is handled automatically by axios interceptor
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
      await gradingService.submitEssayGrades({
        attemptId: detail.attemptId,
        grades: gradesPayload,
      });

      // Refresh detail
      const updated = await gradingService.getAttemptDetailForGrading(attemptId);
      setDetail(updated);
    } catch {
      // Error toast is handled automatically by axios interceptor
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = async () => {
    if (!attemptId) return;
    setIsExporting(true);
    try {
      const blob = await gradingService.exportSingleAttemptExcel(attemptId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const candidateSlug = (detail?.candidateName || 'Thi_Sinh').replace(/\s+/g, '_');
      link.download = `Bai_Lam_${candidateSlug}_${attemptId.slice(0, 8)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast.success('Xuất file Excel bài làm thành công!');
    } catch {
      // Error toast is handled automatically by axios interceptor
    } finally {
      setIsExporting(false);
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại: {detail.examTitle}</span>
        </Link>

        {/* Candidate Profile and Session Header Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
                {detail.candidateName?.slice(0, 1).toUpperCase() || 'U'}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
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
                  {detail.candidateIdentifier || 'Thí sinh tự do'}
                </p>
              </div>
            </div>

            {/* Actions & Live Score Summary Chip */}
            <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                isLoading={isExporting}
                leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                className="hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium text-xs"
              >
                Xuất Excel
              </Button>
              <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-right">
                <p className="text-[10px] uppercase font-semibold text-indigo-600 dark:text-indigo-400">
                  Điểm tổng kết
                </p>
                <p className="text-base sm:text-lg font-bold text-indigo-700 dark:text-indigo-300 leading-tight">
                  {projectedTotalScore}
                  <span className="text-xs font-normal text-indigo-400 dark:text-indigo-500">
                    /{detail.maxTotalPoints}đ
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Violation Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-zinc-400 text-[11px] block">Trắc nghiệm</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                {detail.autoGradedScore ?? 0} điểm
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-zinc-400 text-[11px] block">Câu tự luận</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                {detail.essayQuestions?.length || 0} câu
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-zinc-400 text-[11px] block">Nộp bài</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                {detail.submitTime ? formatDateTime(detail.submitTime) : 'Chưa nộp'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-zinc-400 text-[11px] block">Giám sát vi phạm</span>
              {hasViolations ? (
                <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{detail.violationCount} lần</span>
                </p>
              ) : (
                <p className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Không vi phạm</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Violation Alert Callout & Interactive Audit Table */}
      {hasViolations && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 overflow-hidden text-xs sm:text-sm text-rose-800 dark:text-rose-300 shadow-xs">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Hệ thống giám sát ghi nhận {detail.violationCount} lần vi phạm</p>
                <p className="text-xs text-rose-700/80 dark:text-rose-400">
                  Thí sinh có ghi nhận vi phạm quy chế (rời màn hình, phát hiện người lạ, v.v.). Thầy/cô có thể kiểm tra hình ảnh/video bằng chứng bên dưới.
                </p>
              </div>
            </div>

            {violations.length > 0 && (
              <button
                type="button"
                onClick={() => setShowViolationsList(!showViolationsList)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100/50 transition-colors cursor-pointer shrink-0 self-start sm:self-center"
              >
                <span>{showViolationsList ? 'Thu gọn danh sách' : `Xem chi tiết bằng chứng (${violations.length})`}</span>
                {showViolationsList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {showViolationsList && violations.length > 0 && (
            <div className="border-t border-rose-200/80 dark:border-rose-900/50 bg-white/70 dark:bg-zinc-900/70 p-3 sm:p-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold">
                    <th className="py-2 px-3">Thời gian</th>
                    <th className="py-2 px-3">Hành vi vi phạm</th>
                    <th className="py-2 px-3 text-right">Bằng chứng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                  {violations.map((v) => (
                    <tr key={v.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 px-3 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {v.timestamp ? new Date(v.timestamp).toLocaleTimeString('vi-VN') : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-zinc-800 dark:text-zinc-200">
                        {v.description}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {v.evidenceUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedEvidence(v)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-100/80 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60 hover:bg-rose-200 transition-colors cursor-pointer"
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
                        ) : (
                          <span className="text-zinc-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      {/* Floating Island Save Bar */}
      <div className="fixed bottom-3 sm:bottom-4 left-3 right-3 sm:left-4 sm:right-4 max-w-5xl mx-auto p-3 sm:p-3.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-xl z-30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">
              Tổng điểm
            </span>
            <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              {projectedTotalScore}
              <span className="text-xs font-normal text-zinc-400">/{detail.maxTotalPoints}đ</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/teacher/exams/${detail.examId}/edit`)}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSaving}
            onClick={handleSaveGrades}
            className="bg-indigo-600 hover:bg-indigo-500 shadow-xs text-xs font-semibold"
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            <span>Lưu kết quả</span>
          </Button>
        </div>
      </div>

      {/* Violation Evidence Modal */}
      {selectedEvidence && (
        <Modal
          isOpen={Boolean(selectedEvidence)}
          onClose={() => setSelectedEvidence(null)}
          title="Chi tiết hình ảnh vi phạm"
          size="lg"
        >
          <div className="p-2">
            <EvidenceMediaViewer
              evidenceUrl={selectedEvidence.evidenceUrl}
              violationType={selectedEvidence.violationType}
              candidateName={detail.candidateName}
              timestamp={selectedEvidence.timestamp}
              hideHeader={true}
              onClose={() => setSelectedEvidence(null)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
