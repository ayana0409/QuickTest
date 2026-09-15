'use client';

import React, { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Send,
  X,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubmitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalQuestions: number;
  answeredCount: number;
  unansweredIndices: number[]; // 0-indexed
  onJumpToQuestion: (index: number) => void;
  isSubmitting?: boolean;
}

/**
 * Confirmation dialog shown before final exam submission.
 * Warns candidate about any unanswered questions and provides direct jump-to links.
 */
export const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  totalQuestions,
  answeredCount,
  unansweredIndices,
  onJumpToQuestion,
  isSubmitting = false,
}) => {
  // ESC key handler to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const unansweredCount = unansweredIndices.length;
  const isAllAnswered = unansweredCount === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#161B22] border border-[#30363D] shadow-2xl p-6 text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 mb-4 border-b border-[#30363D]">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                isAllAnswered
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              )}
            >
              {isAllAnswered ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3
                id="submit-modal-title"
                className="text-lg font-bold text-[#E6EDF3] tracking-tight"
              >
                Xác nhận nộp bài thi
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Vui lòng kiểm tra lại số lượng câu hỏi trước khi hoàn tất
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#21262D] transition-colors focus:outline-none"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress summary stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-[#30363D] text-center">
            <div className="text-xs text-zinc-400 mb-1">Đã trả lời</div>
            <div className="text-xl font-mono font-bold text-emerald-400">
              {answeredCount} / {totalQuestions}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-[#30363D] text-center">
            <div className="text-xs text-zinc-400 mb-1">Chưa hoàn thành</div>
            <div
              className={cn(
                'text-xl font-mono font-bold',
                unansweredCount > 0 ? 'text-amber-400' : 'text-zinc-400'
              )}
            >
              {unansweredCount} câu
            </div>
          </div>
        </div>

        {/* Unanswered warning banner & jump buttons */}
        {!isAllAnswered && (
          <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
              <HelpCircle className="w-4 h-4" />
              <span>Các câu hỏi chưa có câu trả lời:</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {unansweredIndices.map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onJumpToQuestion(idx);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#161B22] hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                  title={`Chuyển tới câu ${idx + 1}`}
                >
                  <span>Câu {idx + 1}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              ))}
            </div>

            <div className="text-[11px] text-zinc-400 mt-2.5">
              Bạn có thể bấm vào số câu trên để hoàn thiện trước khi nộp.
            </div>
          </div>
        )}

        {/* Caution text */}
        <p className="text-xs text-zinc-400 leading-relaxed mb-6">
          Sau khi bấm <strong>&ldquo;Xác nhận nộp bài&rdquo;</strong>, bài thi sẽ được khóa ngay lập tức và
          bạn sẽ không thể thay đổi bất kỳ đáp án nào nữa.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#30363D]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="py-2.5 px-4 rounded-xl bg-[#0D1117] hover:bg-[#21262D] text-zinc-300 border border-[#30363D] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            Tiếp tục làm bài
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all duration-150 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Xác nhận nộp bài</span>
          </button>
        </div>
      </div>
    </div>
  );
};
