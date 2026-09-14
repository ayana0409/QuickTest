import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonGradingCardProps {
  className?: string;
}

/**
 * Skeleton placeholder displaying a realistic loading state for candidate submission cards.
 */
export const SkeletonGradingCard: React.FC<SkeletonGradingCardProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 p-6 shadow-xs animate-pulse',
        className
      )}
    >
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-3 w-28 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
        </div>
        <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
      </div>

      {/* Answer Body Skeleton */}
      <div className="my-5 space-y-2.5">
        <div className="h-3.5 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
        <div className="h-3.5 w-11/12 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
        <div className="h-3.5 w-4/5 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
      </div>

      {/* Grading Controls Skeleton */}
      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/60 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-xl" />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
