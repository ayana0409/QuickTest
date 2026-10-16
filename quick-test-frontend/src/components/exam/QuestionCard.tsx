'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  CircleDot,
  Hash,
  FileText,
  X,
  Maximize2,
} from 'lucide-react';
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const isMultiple = question.questionType === 'MULTIPLE_CHOICE';
  const isSingle = question.questionType === 'SINGLE_CHOICE';
  const isNumeric = question.questionType === 'NUMERIC';
  const isEssay = question.questionType === 'ESSAY_TEXT';

  const getTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'SINGLE_CHOICE':
        return {
          label: 'Chọn 1 đáp án',
          icon: <CircleDot className="w-3.5 h-3.5" />,
          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        };
      case 'MULTIPLE_CHOICE':
        return {
          label: 'Chọn nhiều đáp án',
          icon: <CheckSquare className="w-3.5 h-3.5" />,
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-semibold ring-1 ring-purple-500/30',
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
      style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
      className={cn(
        'bg-[#161B22] border border-[#30363D] rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl transition-all duration-200 select-none w-full max-w-full overflow-hidden',
        className
      )}
    >
      {/* Question Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-[#30363D]">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="font-bold text-base sm:text-lg text-white font-mono">
            Câu {questionNumber}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border',
              badge.color
            )}
          >
            {badge.icon}
            {badge.label}
          </span>
        </div>

        <div className="text-[11px] sm:text-xs font-semibold text-zinc-400 bg-zinc-800/80 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-zinc-700/60 shrink-0">
          {question.points} điểm
        </div>
      </div>

      {/* Question Content */}
      <div className="text-zinc-100 text-sm sm:text-base lg:text-lg leading-relaxed mb-4 sm:mb-6 font-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-hidden">
        {question.content}
      </div>

      {/* Optional Question Image */}
      {question.imageUrl && (
        <div className="mb-4 sm:mb-6 rounded-xl overflow-hidden border border-zinc-800 w-full max-w-xl bg-zinc-950/60 p-1 group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.imageUrl}
            alt={`Ảnh minh họa câu hỏi ${questionNumber}`}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onClick={() => setZoomedImage(question.imageUrl!)}
            className="w-full h-auto object-contain max-h-[280px] sm:max-h-[380px] rounded-lg select-none cursor-zoom-in hover:opacity-95 transition-opacity"
            title="Click để phóng to ảnh đề bài"
          />
          <button
            type="button"
            onClick={() => setZoomedImage(question.imageUrl!)}
            className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-black/70 hover:bg-black/90 text-zinc-300 hover:text-white backdrop-blur-sm border border-zinc-700 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Phóng to</span>
          </button>
        </div>
      )}

      {/* Visual Instruction Banner for Choice Questions */}
      {isMultiple && (
        <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs sm:text-sm font-medium mb-3 sm:mb-4">
          <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            Thí sinh có thể chọn một hoặc nhiều phương án đúng.
          </span>
        </div>
      )}

      {isSingle && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-3 sm:mb-4 w-fit">
          <CircleDot className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Chỉ chọn 1 đáp án duy nhất</span>
        </div>
      )}

      {/* Choice Options (Single & Multiple Choice) */}
      {(isSingle || isMultiple) && question.options && (
        <div className="space-y-2.5 sm:space-y-3">
          {question.options.map((option, index) => {
            const isSelected = selectedOptionIds.includes(option.id);
            const letterLabel = String.fromCharCode(65 + index); // A, B, C, D...

            return (
              <label
                key={option.id}
                onClick={() => onOptionSelect(option.id, isMultiple)}
                className={cn(
                  'flex items-start gap-2.5 sm:gap-3.5 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all duration-150 select-none group max-w-full overflow-hidden',
                  isMultiple
                    ? isSelected
                      ? 'border-purple-500 bg-purple-950/40 text-purple-100 ring-1 ring-purple-500/50 shadow-sm shadow-purple-900/30'
                      : 'border-[#30363D] hover:border-purple-500/40 bg-zinc-900/50 hover:bg-zinc-850/60 text-zinc-300'
                    : isSelected
                      ? 'border-blue-500 bg-blue-950/40 text-blue-100 ring-1 ring-blue-500/50 shadow-sm shadow-blue-900/30'
                      : 'border-[#30363D] hover:border-blue-500/40 bg-zinc-900/50 hover:bg-zinc-850/60 text-zinc-300'
                )}
              >
                {/* Front Option Selector Badge: Circle (rounded-full) for Single Choice, Square (rounded-lg) for Multiple Choice */}
                <div
                  className={cn(
                    'shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-150',
                    isSingle ? 'rounded-full' : 'rounded-lg',
                    isMultiple
                      ? isSelected
                        ? 'bg-purple-600 text-white border border-purple-400 shadow-md shadow-purple-600/30 ring-2 ring-purple-500/25'
                        : 'bg-zinc-850 text-zinc-300 border border-zinc-600 group-hover:border-purple-400 group-hover:text-purple-300'
                      : isSelected
                        ? 'bg-blue-600 text-white border border-blue-400 shadow-md shadow-blue-600/30 ring-2 ring-blue-500/25'
                        : 'bg-zinc-850 text-zinc-300 border border-zinc-600 group-hover:border-blue-400 group-hover:text-blue-300'
                  )}
                >
                  {letterLabel}
                </div>

                {/* Option text & optional option image */}
                <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
                  {option.content && (
                    <div className="text-xs sm:text-base leading-snug break-words [overflow-wrap:anywhere]">
                      {option.content}
                    </div>
                  )}
                  {option.imageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden w-full max-w-xs border border-zinc-700/80 bg-zinc-950/70 p-1 relative group/optImg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={option.imageUrl}
                        alt={`Ảnh đáp án ${letterLabel}`}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedImage(option.imageUrl!);
                        }}
                        className="w-full h-auto object-contain max-h-40 sm:max-h-48 rounded select-none cursor-zoom-in hover:opacity-95 transition-opacity"
                        title="Click để phóng to ảnh đáp án"
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

      {/* Image Lightbox Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute -top-11 right-0 text-white/80 hover:text-white bg-zinc-800/90 hover:bg-zinc-700 p-2 rounded-full transition-colors cursor-pointer border border-zinc-700"
              title="Đóng xem ảnh"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomedImage}
              alt="Ảnh phóng to"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-zinc-700 select-none"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

