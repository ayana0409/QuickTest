'use client';

import React from 'react';
import { CheckCircle2, Send, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuestionInPaper } from '@/types/exam';
import type { CandidateAnswerState } from '@/stores/examStore';

interface QuestionNavigatorProps {
  questions: QuestionInPaper[];
  currentIndex: number;
  answers: Record<string, CandidateAnswerState>;
  onSelectQuestion: (index: number) => void;
  onSubmitClick: () => void;
  isSubmitting?: boolean;
  className?: string;
}

/**
 * Question Navigator component providing an interactive 5-column grid of questions,
 * showing completion status (answered, unanswered, currently viewing), overall progress,
 * and quick-jump navigation.
 */
export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  questions,
  currentIndex,
  answers,
  onSelectQuestion,
  onSubmitClick,
  isSubmitting = false,
  className,
}) => {
  const isQuestionAnswered = (question: QuestionInPaper): boolean => {
    const ans = answers[question.id];
    if (!ans) return false;

    if (
      question.questionType === 'SINGLE_CHOICE' ||
      question.questionType === 'MULTIPLE_CHOICE'
    ) {
      return Boolean(ans.selectedOptionIds && ans.selectedOptionIds.length > 0);
    }

    if (
      question.questionType === 'NUMERIC' ||
      question.questionType === 'ESSAY_TEXT'
    ) {
      return Boolean(ans.textAnswer && ans.textAnswer.trim().length > 0);
    }

    return false;
  };

  const answeredCount = questions.filter(isQuestionAnswered).length;
  const totalCount = questions.length;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <aside
      className={cn(
        'w-full bg-[#161B22] border border-[#30363D] rounded-2xl p-5 flex flex-col shadow-xl select-none',
        className
      )}
    >
      {/* Header & Progress Info */}
      <div className="pb-4 mb-4 border-b border-[#30363D]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#E6EDF3]">
            <ListChecks className="w-4 h-4 text-indigo-400" />
            <span>Mục lục câu hỏi</span>
          </div>
          <span className="text-xs font-mono font-medium text-zinc-400">
            {answeredCount}/{totalCount} ({progressPercent}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-[#0D1117] rounded-full overflow-hidden border border-[#30363D]">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 5-Column Question Grid */}
      <div className="flex-1 overflow-y-auto pr-1 max-h-[360px] custom-scrollbar">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, index) => {
            const isCurrent = index === currentIndex;
            const isAnswered = isQuestionAnswered(q);

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelectQuestion(index)}
                className={cn(
                  'relative h-10 w-full rounded-xl text-xs font-semibold font-mono flex items-center justify-center transition-all duration-150 cursor-pointer focus:outline-none',
                  isCurrent &&
                    'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#161B22] font-bold z-10 scale-105',
                  isAnswered
                    ? isCurrent
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : isCurrent
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-[#0D1117] text-zinc-400 border border-[#30363D] hover:bg-[#21262D] hover:text-zinc-200'
                )}
                aria-label={`Đi tới câu ${index + 1}`}
              >
                <span>{index + 1}</span>
                {isAnswered && !isCurrent && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Legend */}
      <div className="pt-4 mt-4 border-t border-[#30363D] grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-md bg-emerald-500/30 border border-emerald-500/50 inline-block shrink-0" />
          <span>Đã làm</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-md bg-indigo-600 border border-indigo-400 inline-block shrink-0" />
          <span>Đang xem</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-md bg-[#0D1117] border border-[#30363D] inline-block shrink-0" />
          <span>Chưa làm</span>
        </div>
      </div>

      {/* Quick Submit Trigger */}
      <div className="mt-5 pt-4 border-t border-[#30363D]">
        <button
          type="button"
          onClick={onSubmitClick}
          disabled={isSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#161B22]"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Nộp bài thi ({answeredCount}/{totalCount})</span>
        </button>
      </div>
    </aside>
  );
};
