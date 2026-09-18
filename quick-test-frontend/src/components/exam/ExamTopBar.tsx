'use client';

import React from 'react';
import {
  ShieldCheck,
  User,
  RefreshCw,
  Maximize2,
  Minimize2,
  Send,
} from 'lucide-react';
import { Timer } from './Timer';
import { cn } from '@/lib/utils';
import type { ProctoringSettings } from '@/types/proctoring';

interface ExamTopBarProps {
  examTitle: string;
  candidateName?: string | null;
  remainingSeconds: number;
  totalDurationSeconds?: number;
  isSaving: boolean;
  lastSavedAt: string | null;
  isSubmitting: boolean;
  onSubmitClick: () => void;
  onTimerExpire?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  proctoringSettings?: ProctoringSettings;
}

/**
 * Top Runner Header Bar for active exam session:
 * Displays exam title, candidate details, auto-save status indicator,
 * countdown timer, fullscreen toggle, proctoring indicator, and primary submit action.
 */
export const ExamTopBar: React.FC<ExamTopBarProps> = ({
  examTitle,
  candidateName,
  remainingSeconds,
  totalDurationSeconds,
  isSaving,
  lastSavedAt,
  isSubmitting,
  onSubmitClick,
  onTimerExpire,
  onToggleFullscreen,
  isFullscreen = false,
  proctoringSettings,
}) => {
  const isProctoringActive = proctoringSettings?.enabled ?? false;

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-[#161B22]/95 backdrop-blur-md border-b border-[#30363D] px-4 sm:px-6 flex items-center justify-between select-none">
      {/* Left Section: Exam Title, Candidate Info & Proctoring Badge */}
      <div className="flex items-center gap-4 min-w-0 max-w-[48%] sm:max-w-[45%]">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {/* Read-only Proctoring Indicator Capsule */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0 transition-all select-none',
                isProctoringActive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400'
              )}
              title={
                isProctoringActive
                  ? 'Đề thi được bảo vệ với tính năng giám sát trực tuyến từ giáo viên'
                  : 'Đề thi không kích hoạt chế độ giám sát'
              }
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isProctoringActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                )}
              />
              <span className="text-[11px] font-semibold">
                {isProctoringActive ? 'Giám sát: BẬT' : 'Giám sát: TẮT'}
              </span>
            </div>

            <h1
              className="text-sm sm:text-base font-bold text-[#E6EDF3] truncate tracking-tight"
              title={examTitle}
            >
              {examTitle}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate mt-0.5">
            <User className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            <span className="truncate">
              Thí sinh: <strong className="text-zinc-300">{candidateName || 'Khách dự thi'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Center/Right Section: Auto-Save Status, Timer, Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Auto-Save Indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400 bg-[#0D1117] border border-[#30363D] px-3 py-1.5 rounded-xl">
          {isSaving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span className="text-indigo-300 font-medium">Đang lưu...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>
                {lastSavedAt ? `Đã lưu: ${lastSavedAt}` : 'Tự động lưu'}
              </span>
            </>
          )}
        </div>

        {/* Countdown Timer */}
        <div className="shrink-0">
          <Timer
            remainingSeconds={remainingSeconds}
            totalDurationSeconds={totalDurationSeconds}
            onExpire={onTimerExpire}
            className="py-1 px-3 sm:px-4 text-xs sm:text-sm bg-[#0D1117] border-[#30363D]"
          />
        </div>

        {/* Fullscreen Toggle Button */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="hidden sm:inline-flex p-2 rounded-xl text-zinc-400 hover:text-zinc-200 bg-[#0D1117] hover:bg-[#21262D] border border-[#30363D] transition-colors focus:outline-none cursor-pointer"
            title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
            aria-label={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Header Submit Button */}
        <button
          type="button"
          onClick={onSubmitClick}
          disabled={isSubmitting}
          className="py-2 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all duration-150 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {isSubmitting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Nộp bài</span>
        </button>
      </div>
    </header>
  );
};
