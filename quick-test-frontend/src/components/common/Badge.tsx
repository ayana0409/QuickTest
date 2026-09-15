import React from 'react';
import { cn } from '@/lib/utils';
import type { ExamStatus, AttemptStatus } from '@/types/exam';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | ExamStatus | AttemptStatus;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  ...props
}) => {
  const getVariantStyles = (v: string) => {
    switch (v) {
      case 'PUBLISHED':
      case 'SUBMITTED':
      case 'COMPLETED':
      case 'AUTO_GRADED':
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40';
      case 'DRAFT':
      case 'AWAITING_MANUAL_GRADING':
      case 'MANUAL_GRADING':
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40';
      case 'CLOSED':
      case 'DISQUALIFIED':
      case 'EXPIRED':
      case 'danger':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40';
      case 'ARCHIVED':
      case 'IN_PROGRESS':
      case 'info':
        return 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40';
      case 'neutral':
      case 'default':
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
    }
  };

  const getDotStyles = (v: string) => {
    switch (v) {
      case 'PUBLISHED':
      case 'SUBMITTED':
      case 'COMPLETED':
      case 'success':
        return 'bg-emerald-500 animate-pulse';
      case 'DRAFT':
      case 'AWAITING_MANUAL_GRADING':
      case 'MANUAL_GRADING':
      case 'warning':
        return 'bg-amber-500';
      case 'CLOSED':
      case 'DISQUALIFIED':
      case 'EXPIRED':
      case 'danger':
        return 'bg-rose-500';
      case 'ARCHIVED':
      case 'IN_PROGRESS':
      case 'info':
        return 'bg-sky-500 animate-pulse';
      default:
        return 'bg-zinc-400';
    }
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border tracking-wide transition-colors',
        getVariantStyles(variant),
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getDotStyles(variant))} />}
      {children}
    </span>
  );
};
