import React, { useState } from 'react';
import { BookOpen, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GradingSplitPaneProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  className?: string;
}

/**
 * Split-pane workspace layout for Question-Centric Grading.
 * Provides a responsive 4-column (left reference) and 8-column (right submissions) split on desktop,
 * and a tabbed switcher on mobile to eliminate vertical context loss.
 */
export const GradingSplitPane: React.FC<GradingSplitPaneProps> = ({
  leftPanel,
  rightPanel,
  className,
}) => {
  const [mobileTab, setMobileTab] = useState<'info' | 'submissions'>('submissions');

  return (
    <div className={cn('w-full', className)}>
      {/* Mobile Tab Switcher (< lg screens) */}
      <div className="lg:hidden mb-4">
        <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
          <button
            type="button"
            onClick={() => setMobileTab('submissions')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
              mobileTab === 'submissions'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            <UserCheck className="w-4 h-4" />
            <span>Bài làm thí sinh</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('info')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
              mobileTab === 'info'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            <BookOpen className="w-4 h-4" />
            <span>Đề bài & Tiêu chí</span>
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Question Context & Rubric (4 cols) */}
        <div
          className={cn(
            'lg:col-span-4 transition-all',
            mobileTab === 'info' ? 'block' : 'hidden lg:block'
          )}
        >
          {leftPanel}
        </div>

        {/* Right Side: Candidate Submissions & Grading Cards (8 cols) */}
        <div
          className={cn(
            'lg:col-span-8 space-y-6',
            mobileTab === 'submissions' ? 'block' : 'hidden lg:block'
          )}
        >
          {rightPanel}
        </div>
      </div>
    </div>
  );
};
