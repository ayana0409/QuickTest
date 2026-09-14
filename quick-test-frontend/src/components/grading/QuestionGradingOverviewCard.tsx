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
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-5 group">
      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-100 dark:border-indigo-900/50">
              #{(question.orderIndex ?? 0) + 1}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Câu hỏi tự luận
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm">
              {question.maxPoints} Điểm
            </Badge>
            {isCompleted ? (
              <Badge variant="success" size="sm" dot>
                Hoàn tất
              </Badge>
            ) : pending > 0 ? (
              <Badge variant="warning" size="sm" dot>
                {pending} bài chờ chấm
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Chưa có bài nộp
              </Badge>
            )}
          </div>
        </div>

        {/* Content Snippet */}
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-3 leading-relaxed">
          {question.content}
        </p>
      </div>

      {/* Progress & Metrics */}
      <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs font-medium mb-1.5">
            <span className="text-zinc-500 dark:text-zinc-400">Tiến độ chấm</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
              {graded} / {total} bài ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
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
        <div className="pt-2">
          <Link
            href={`/teacher/grading/questions/${question.questionId}${examId ? `?examId=${examId}` : ''}`}
            className="w-full inline-flex items-center justify-center font-medium rounded-xl text-sm px-4 py-2.5 transition-all duration-200 select-none bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white group-hover:shadow-md"
          >
            <span>{isCompleted ? 'Xem lại bài chấm' : 'Bắt đầu chấm bài'}</span>
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

      </div>
    </div>
  );
};
