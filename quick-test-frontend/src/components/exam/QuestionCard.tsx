'use client';

import React from 'react';
import Image from 'next/image';
import { HelpCircle, CheckSquare, Hash, FileText } from 'lucide-react';
import type { QuestionInPaper, QuestionType } from '@/types/exam';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
  question: QuestionInPaper;
  questionNumber: number;
  selectedOptionIds?: string[];
  textAnswer?: string;
  onOptionSelect: (optionId: string, isMultipleChoice: boolean) => void;
  onTextChange: (text: string) => void;
  className?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionNumber,
  selectedOptionIds = [],
  textAnswer = '',
  onOptionSelect,
  onTextChange,
  className,
}) => {
  const isMultiple = question.questionType === 'MULTIPLE_CHOICE';
  const isSingle = question.questionType === 'SINGLE_CHOICE';
  const isNumeric = question.questionType === 'NUMERIC';
  const isEssay = question.questionType === 'ESSAY_TEXT';

  const getTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'SINGLE_CHOICE':
        return {
          label: 'Một đáp án',
          icon: <HelpCircle className="w-3.5 h-3.5" />,
          color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      case 'MULTIPLE_CHOICE':
        return {
          label: 'Nhiều đáp án',
          icon: <CheckSquare className="w-3.5 h-3.5" />,
          color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        };
      case 'NUMERIC':
        return {
          label: 'Số học',
          icon: <Hash className="w-3.5 h-3.5" />,
          color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'ESSAY_TEXT':
        return {
          label: 'Tự luận',
          icon: <FileText className="w-3.5 h-3.5" />,
          color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        };
    }
  };

  const badge = getTypeBadge(question.questionType);

  return (
    <div
      className={cn(
        'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm transition-all duration-200',
        className
      )}
    >
      {/* Header with question number, points and type badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center bg-indigo-600 text-white font-bold text-sm px-3 py-1 rounded-lg shadow-sm shadow-indigo-500/20">
            Câu {questionNumber}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border',
              badge.color
            )}
          >
            {badge.icon}
            {badge.label}
          </span>
        </div>

        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
          {question.points} {question.points === 1 ? 'điểm' : 'điểm'}
        </div>
      </div>

      {/* Question Content */}
      <div className="text-zinc-900 dark:text-zinc-100 text-base sm:text-lg leading-relaxed mb-6 font-normal whitespace-pre-wrap">
        {question.content}
      </div>

      {/* Optional Question Image */}
      {question.imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 max-w-xl bg-zinc-50 dark:bg-zinc-950">
          <Image
            src={question.imageUrl}
            alt={`Ảnh minh họa câu hỏi ${questionNumber}`}
            width={600}
            height={400}
            className="w-full h-auto object-contain max-h-[360px]"
          />
        </div>
      )}

      {/* Choice Options (Single & Multiple Choice) */}
      {(isSingle || isMultiple) && question.options && (
        <div className="space-y-3">
          {question.options.map((option, index) => {
            const isSelected = selectedOptionIds.includes(option.id);
            const letterLabel = String.fromCharCode(65 + index); // A, B, C, D...

            return (
              <label
                key={option.id}
                onClick={() => onOptionSelect(option.id, isMultiple)}
                className={cn(
                  'flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all duration-150 select-none group',
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 ring-1 ring-indigo-600/30'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                )}
              >
                {/* Option Identifier Badge (A, B, C, D) */}
                <div
                  className={cn(
                    'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors',
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700'
                  )}
                >
                  {letterLabel}
                </div>

                {/* Option text & optional option image */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="text-sm sm:text-base leading-snug break-words">
                    {option.content}
                  </div>
                  {option.imageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden max-w-sm border border-zinc-200 dark:border-zinc-700">
                      <Image
                        src={option.imageUrl}
                        alt={`Ảnh đáp án ${letterLabel}`}
                        width={300}
                        height={180}
                        className="w-full h-auto object-cover max-h-40"
                      />
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Numeric Question Input */}
      {isNumeric && (
        <div className="max-w-xs">
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Nhập kết quả số học:
          </label>
          <input
            type="number"
            step="any"
            value={textAnswer}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Ví dụ: 3.14 hoặc 42"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
          />
        </div>
      )}

      {/* Essay / Textarea Input */}
      {isEssay && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Câu trả lời tự luận:
            </label>
            <span className="text-xs text-zinc-400">
              {textAnswer.trim().length} ký tự
            </span>
          </div>
          <textarea
            rows={7}
            value={textAnswer}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Trình bày chi tiết câu trả lời của bạn tại đây..."
            className="w-full p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base leading-relaxed resize-y font-sans"
          />
        </div>
      )}
    </div>
  );
};
