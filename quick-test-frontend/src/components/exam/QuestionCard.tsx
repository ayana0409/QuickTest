'use client';

import React, { useState } from 'react';
import { HelpCircle, CheckSquare, Hash, FileText, X, Maximize2 } from 'lucide-react';
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
      style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
      className={cn(
        'bg-[#161B22] border border-[#30363D] rounded-2xl p-6 sm:p-8 shadow-xl transition-all duration-200 select-none',
        className
      )}
    >
      {/* Question Header */}
      <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-[#30363D]">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-white font-mono">
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

        <div className="text-xs font-semibold text-zinc-400 bg-zinc-800/80 px-3 py-1 rounded-full border border-zinc-700/60">
          {question.points} điểm
        </div>
      </div>

      {/* Question Content */}
      <div className="text-zinc-100 text-base sm:text-lg leading-relaxed mb-6 font-normal whitespace-pre-wrap">
        {question.content}
      </div>

      {/* Optional Question Image */}
      {question.imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-zinc-800 max-w-xl bg-zinc-950/60 p-1 group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.imageUrl}
            alt={`Ảnh minh họa câu hỏi ${questionNumber}`}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onClick={() => setZoomedImage(question.imageUrl!)}
            className="w-full h-auto object-contain max-h-[380px] rounded-lg select-none cursor-zoom-in hover:opacity-95 transition-opacity"
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
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-100 ring-1 ring-indigo-500/40'
                    : 'border-[#30363D] hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-850/60 text-zinc-300'
                )}
              >
                {/* Option Identifier Badge (A, B, C, D) */}
                <div
                  className={cn(
                    'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors',
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200'
                  )}
                >
                  {letterLabel}
                </div>

                {/* Option text & optional option image */}
                <div className="flex-1 min-w-0 pt-0.5">
                  {option.content && (
                    <div className="text-sm sm:text-base leading-snug break-words">
                      {option.content}
                    </div>
                  )}
                  {option.imageUrl && (
                    <div className="mt-2.5 rounded-lg overflow-hidden max-w-sm border border-zinc-700/80 bg-zinc-950/70 p-1 relative group/optImg">
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
                        className="w-full h-auto object-contain max-h-48 rounded select-none cursor-zoom-in hover:opacity-95 transition-opacity"
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

