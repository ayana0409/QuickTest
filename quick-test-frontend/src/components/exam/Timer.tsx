'use client';

import React, { useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { formatSeconds, cn } from '@/lib/utils';

interface TimerProps {
  remainingSeconds: number;
  totalDurationSeconds?: number;
  onExpire?: () => void;
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({
  remainingSeconds,
  totalDurationSeconds,
  onExpire,
  className,
}) => {
  const isExpired = remainingSeconds <= 0;
  const isCritical = remainingSeconds > 0 && remainingSeconds <= 60; // under 1 minute
  const isWarning = remainingSeconds > 60 && remainingSeconds <= 300; // under 5 minutes

  // Trigger onExpire callback when timer hits 0
  useEffect(() => {
    if (isExpired && onExpire) {
      onExpire();
    }
  }, [isExpired, onExpire]);

  // Calculate percentage of time elapsed if total duration is provided
  const progressPercent = totalDurationSeconds
    ? Math.max(0, Math.min(100, ((totalDurationSeconds - remainingSeconds) / totalDurationSeconds) * 100))
    : 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl border transition-all duration-300 backdrop-blur-md select-none',
        isExpired && 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
        isCritical &&
          'bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400 animate-pulse ring-2 ring-red-500/20',
        isWarning && 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
        !isCritical &&
          !isWarning &&
          !isExpired &&
          'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200',
        className
      )}
    >
      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        <div className="flex items-center gap-1 sm:gap-2">
          {isCritical ? (
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 animate-bounce shrink-0" />
          ) : (
            <Clock className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0', isWarning ? 'text-amber-500' : 'text-indigo-500')} />
          )}
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider opacity-80 hidden sm:inline">
            {isExpired ? 'Hết giờ' : 'Thời gian còn lại'}
          </span>
        </div>

        <span className="font-mono text-xs sm:text-base lg:text-lg font-bold tracking-tight shrink-0">
          {formatSeconds(remainingSeconds)}
        </span>
      </div>

      {totalDurationSeconds && totalDurationSeconds > 0 && (
        <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out',
              isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-600'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};
