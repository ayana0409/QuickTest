import React, { useState } from 'react';
import {
  Check,
  Copy,
  Clock,
  User,
  AlertCircle,
  Save,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';
import type { CandidateSubmissionItemDto, GradingStatus } from '@/types/candidateAnswer';
import type { AnswerDraft } from '@/stores/useGradingStore';

interface CandidateSubmissionCardProps {
  submission: CandidateSubmissionItemDto;
  maxPoints: number;
  draft?: AnswerDraft;
  isSaving?: boolean;
  isAiGrading?: boolean;
  onDraftChange: (awardedScore: number, teacherFeedback: string) => void;
  onSave: () => void;
  onAiGrade?: () => void;
}

/**
 * Interactive card component representing a single candidate's essay response.
 * Allows teachers to review the submitted response, assign scores, provide feedback, and save grades.
 */
export const CandidateSubmissionCard: React.FC<CandidateSubmissionCardProps> = ({
  submission,
  maxPoints,
  draft,
  isSaving = false,
  isAiGrading = false,
  onDraftChange,
  onSave,
  onAiGrade,
}) => {
  const [copied, setCopied] = useState(false);

  // Derived current values from draft or server submission state
  const currentScore = draft !== undefined ? draft.awardedScore : (submission.awardedScore ?? 0);
  const currentFeedback =
    draft !== undefined ? draft.teacherFeedback : (submission.teacherFeedback ?? '');
  const isDirty = draft?.isDirty ?? false;

  // Validation
  const isScoreValid = !isNaN(currentScore) && currentScore >= 0 && currentScore <= maxPoints;

  // Word count utility
  const wordCount = submission.textAnswer
    ? submission.textAnswer.trim().split(/\s+/).filter(Boolean).length
    : 0;

  // Format date helper
  const formattedDate = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Chưa có thông tin';

  // Handle copying candidate's essay text
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(submission.textAnswer || '');
      setCopied(true);
      toast.success('Đã sao chép nội dung bài làm vào bộ nhớ đệm!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép văn bản.');
    }
  };

  const getStatusBadge = (status: GradingStatus) => {
    switch (status) {
      case 'GRADED':
        return (
          <Badge variant="success" size="sm" dot>
            Đã chấm điểm
          </Badge>
        );
      case 'PENDING_AI':
        return (
          <Badge variant="info" size="sm" dot>
            Đang chấm tự động
          </Badge>
        );
      case 'AUTO_GRADED':
        return (
          <Badge variant="neutral" size="sm" dot>
            Tự động chấm (0 điểm)
          </Badge>
        );
      case 'PENDING_MANUAL':
      default:
        return (
          <Badge variant="warning" size="sm" dot>
            Chờ giáo viên chấm
          </Badge>
        );
    }
  };


  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200 bg-white dark:bg-zinc-900/90 shadow-xs overflow-hidden',
        isDirty
          ? 'border-amber-400/60 dark:border-amber-500/40 ring-2 ring-amber-400/10'
          : 'border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
      )}
    >
      {/* Top Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5 bg-zinc-50/40 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-xs sm:text-sm shrink-0">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                {submission.candidateName}
              </span>
              {submission.studentIdentifier && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                  {submission.studentIdentifier}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>Nộp: {formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Chưa lưu
            </span>
          )}
          {getStatusBadge(submission.gradingStatus)}
        </div>
      </div>

      {/* Candidate Essay Answer Body */}
      <div className="p-4 sm:p-6 space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Nội dung bài làm ({wordCount} từ)
          </span>
          {submission.textAnswer && submission.textAnswer.trim().length > 0 && (
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors py-1 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="Sao chép câu trả lời"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs sm:text-sm font-sans min-h-[80px]">
          {submission.textAnswer && submission.textAnswer.trim().length > 0 ? (
            <span className="text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap select-text selection:bg-indigo-100 dark:selection:bg-indigo-900/50">
              {submission.textAnswer}
            </span>
          ) : (
            <div className="flex items-start gap-2.5 text-zinc-500 dark:text-zinc-400 py-1">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-medium text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                  Thí sinh không làm câu hỏi này (để trống)
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Hệ thống đã tự động tính 0 điểm.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grading Controls Footer */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 bg-zinc-50/60 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-end">
          {/* Score Input */}
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Điểm số <span className="font-normal text-zinc-400">/{maxPoints}</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDraftChange(0, currentFeedback)}
                  className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-200/70 hover:bg-zinc-300/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => onDraftChange(Number((maxPoints * 0.5).toFixed(2)), currentFeedback)}
                  className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-200/70 hover:bg-zinc-300/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => onDraftChange(maxPoints, currentFeedback)}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 transition-colors"
                >
                  Max
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.25"
                min="0"
                max={maxPoints}
                value={currentScore}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onDraftChange(isNaN(val) ? 0 : val, currentFeedback);
                }}
                disabled={isSaving}
                className={cn(
                  'w-full px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors border',
                  'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100',
                  !isScoreValid
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-zinc-300 dark:border-zinc-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                )}
                placeholder="0.0"
              />
              <span className="absolute right-3 top-1.5 sm:top-2 text-xs font-medium text-zinc-400 pointer-events-none">
                / {maxPoints}
              </span>
            </div>
            {!isScoreValid && (
              <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Điểm từ 0 đến {maxPoints}
              </p>
            )}
          </div>

          {/* Teacher Feedback Input */}
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Nhận xét của giáo viên
            </label>
            <input
              type="text"
              value={currentFeedback}
              onChange={(e) => onDraftChange(currentScore, e.target.value)}
              disabled={isSaving || isAiGrading}
              placeholder="Nhập góp ý, lý giải điểm số..."
              className="w-full px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm transition-colors border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Action Buttons */}
          <div className="md:col-span-4 flex items-center justify-end gap-2 pt-1 md:pt-0">
            {onAiGrade && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold"
                isLoading={isAiGrading}
                disabled={isSaving || isAiGrading || !submission.textAnswer?.trim()}
                onClick={onAiGrade}
                title={!submission.textAnswer?.trim() ? 'Thí sinh không nộp câu trả lời' : 'Chấm điểm tự động cho bài này'}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
              >
                Chấm AI
              </Button>
            )}
            <Button
              variant={submission.gradingStatus === 'GRADED' && !isDirty ? 'secondary' : 'primary'}
              size="sm"
              className="flex-1 sm:flex-initial min-w-[95px] text-xs font-semibold"
              isLoading={isSaving}
              disabled={!isScoreValid || isSaving || isAiGrading}
              onClick={onSave}
              leftIcon={
                submission.gradingStatus === 'GRADED' && !isDirty ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )
              }
            >
              {submission.gradingStatus === 'GRADED' && !isDirty ? 'Đã lưu' : 'Lưu điểm'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
