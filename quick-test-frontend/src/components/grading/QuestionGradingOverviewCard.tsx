import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';
import type { QuestionGradingSummaryResponse } from '@/types/candidateAnswer';

interface QuestionGradingOverviewCardProps {
  question: QuestionGradingSummaryResponse;
  examId?: string;
}


/**
 * Card representing an essay question in the exam's grading overview dashboard.
 * Displays grading progress percentage, submission metrics, and a direct link to the grading split-pane.
 */
export const QuestionGradingOverviewCard: React.FC<QuestionGradingOverviewCardProps> = ({
  question,
  examId,
}) => {
  const total = question.totalSubmissions || 0;
  const graded = question.gradedCount || 0;
  const pending = question.pendingCount || 0;
  const progressPercent = total > 0 ? Math.round((graded / total) * 100) : 0;
  const isCompleted = total > 0 && graded === total;

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4 group">
      {/* Header Info */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-100 dark:border-indigo-900/50">
              #{(question.orderIndex ?? 0) + 1}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Tự luận
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="neutral" size="sm">
              {question.maxPoints}đ
            </Badge>
            {isCompleted ? (
              <Badge variant="success" size="sm" dot>
                Hoàn tất
              </Badge>
            ) : pending > 0 ? (
              <Badge variant="warning" size="sm" dot>
                {pending} chờ chấm
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Chưa có bài
              </Badge>
            )}
          </div>
        </div>

        {/* Content Snippet */}
        <p className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 sm:line-clamp-3 leading-relaxed">
          {question.content}
        </p>
      </div>

      {/* Progress & Metrics */}
      <div className="space-y-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs font-medium mb-1">
            <span className="text-zinc-500 dark:text-zinc-400">Tiến độ</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold text-[11px]">
              {graded} / {total} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                isCompleted
                  ? 'bg-emerald-500'
                  : progressPercent > 0
                  ? 'bg-indigo-600'
                  : 'bg-zinc-300 dark:bg-zinc-700'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-1">
          <Link
            href={`/teacher/grading/questions/${question.questionId}${examId ? `?examId=${examId}` : ''}`}
            className="w-full inline-flex items-center justify-center font-semibold rounded-xl text-xs sm:text-sm px-4 py-2 transition-all select-none bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white group-hover:shadow-xs cursor-pointer"
          >
            <span>{isCompleted ? 'Xem lại bài chấm' : 'Chấm câu hỏi này'}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

      </div>
    </div>
  );
};
