'use client';

import React from 'react';
import { Send, ListChecks, X } from 'lucide-react';
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
  onClose?: () => void;
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
  onClose,
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
      <div className="pb-3.5 mb-3.5 border-b border-[#30363D]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#E6EDF3]">
            <ListChecks className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Danh sách câu hỏi</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-zinc-400">
              <span className="hidden sm:inline text-zinc-400">Đã làm: </span>
              <strong className="text-emerald-400">{answeredCount}</strong>/{totalCount}{' '}
              <span className="text-zinc-400">({progressPercent}%)</span>
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#21262D] transition-colors cursor-pointer"
                aria-label="Đóng danh sách câu hỏi"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
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
        <div className="grid grid-cols-5 gap-2.5 p-1">
          {questions.map((q, index) => {
            const isCurrent = index === currentIndex;
            const isAnswered = isQuestionAnswered(q);

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelectQuestion(index)}
                className={cn(
                  'relative h-10 w-full rounded-xl text-xs font-semibold font-mono flex items-center justify-center transition-all duration-150 cursor-pointer focus:outline-none select-none',
                  isAnswered
                    ? isCurrent
                      ? 'bg-emerald-600 text-white font-bold border-2 border-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.5)] scale-[1.04] z-10'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 hover:bg-emerald-500/25 hover:border-emerald-500/60'
                    : isCurrent
                      ? 'bg-indigo-600 text-white font-bold border-2 border-indigo-300 shadow-[0_0_14px_rgba(99,102,241,0.5)] scale-[1.04] z-10'
                      : 'bg-[#0D1117] text-zinc-400 border border-[#30363D] hover:bg-[#21262D] hover:text-zinc-200 hover:border-zinc-500/50'
                )}
                aria-label={`Đi tới câu ${index + 1}`}
              >
                <span>{index + 1}</span>
                {isAnswered && !isCurrent && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Legend */}
      <div className="pt-3.5 mt-3.5 border-t border-[#30363D]">
        <div className="grid grid-cols-3 gap-1 py-2 px-2.5 rounded-xl bg-[#0D1117] border border-[#30363D]/60 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)] shrink-0" />
            <span className="truncate">Đã làm ({answeredCount})</span>
          </div>
          <div className="flex items-center gap-1.5 justify-center border-x border-[#30363D]/50 px-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)] shrink-0" />
            <span className="truncate">Đang xem</span>
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-600 border border-zinc-500/50 shrink-0" />
            <span className="truncate">Chưa làm ({totalCount - answeredCount})</span>
          </div>
        </div>
      </div>

      {/* Quick Submit Trigger */}
      <div className="mt-4 pt-3.5 border-t border-[#30363D] space-y-2">
        <button
          type="button"
          onClick={onSubmitClick}
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Nộp bài thi</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-black/25 text-emerald-100 font-mono font-bold">
            ({answeredCount}/{totalCount})
          </span>
        </button>
        {totalCount - answeredCount > 0 ? (
          <p className="text-[11px] text-amber-400/90 text-center font-medium">
            Còn {totalCount - answeredCount} câu hỏi chưa trả lời
          </p>
        ) : (
          <p className="text-[11px] text-emerald-400/90 text-center font-medium">
            Đã trả lời toàn bộ các câu hỏi
          </p>
        )}
      </div>
    </aside>
  );
};
