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
        'flex flex-col gap-1.5 px-4 py-2.5 rounded-xl border transition-all duration-300 backdrop-blur-md select-none',
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce" />
          ) : (
            <Clock className={cn('w-4 h-4', isWarning ? 'text-amber-500' : 'text-indigo-500')} />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {isExpired ? 'Hết giờ thi' : 'Thời gian còn lại'}
          </span>
        </div>

        <span className="font-mono text-lg font-bold tracking-tight">
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
