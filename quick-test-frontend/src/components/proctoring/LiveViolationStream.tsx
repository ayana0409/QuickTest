import React from 'react';
import {
  ShieldAlert,
  Clock,
  ArrowRight,
  Trash2,
  AlertTriangle,
  MonitorX,
  Maximize2,
  Terminal,
  Copy,
  UserX,
} from 'lucide-react';
import type { CandidateViolationEvent, ViolationType } from '@/types/proctoring';
import { cn } from '@/lib/utils';

interface LiveViolationStreamProps {
  events: CandidateViolationEvent[];
  onInspectCandidate: (attemptId: string) => void;
  onClearStream?: () => void;
}

/**
 * Format violation type into human-friendly badge and icon.
 */
export function getViolationMeta(type: ViolationType) {
  switch (type) {
    case 'TAB_SWITCH':
      return {
        label: 'Tab Switch',
        icon: MonitorX,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      };
    case 'EXIT_FULLSCREEN':
      return {
        label: 'Exit Fullscreen',
        icon: Maximize2,
        color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20',
      };
    case 'DEVTOOLS_OPEN':
      return {
        label: 'DevTools Opened',
        icon: Terminal,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
      };
    case 'COPY_PASTE_ATTEMPT':
      return {
        label: 'Copy / Paste Blocked',
        icon: Copy,
        color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
      };
    case 'TEACHER_DISQUALIFY':
      return {
        label: 'Disqualified by Proctor',
        icon: UserX,
        color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20',
      };
    default:
      return {
        label: type,
        icon: AlertTriangle,
        color: 'text-zinc-600 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
      };
  }
}

/**
 * Live Violation Feed / Stream component for real-time STOMP telemetry broadcast.
 */
export const LiveViolationStream: React.FC<LiveViolationStreamProps> = ({
  events,
  onInspectCandidate,
  onClearStream,
}) => {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 p-4">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Giám sát vi phạm:
            </span>
            <span>Chưa có vi phạm nào được ghi nhận.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 p-4 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-200/50 dark:border-rose-900/40">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <div className="flex items-center gap-1.5 font-bold text-sm text-rose-800 dark:text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Giám sát vi phạm</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-200/60 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300">
              {events.length}
            </span>
          </div>
        </div>

        {onClearStream && (
          <button
            onClick={onClearStream}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 transition-colors"
            title="Clear stream list"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Dọn</span>
          </button>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {events.slice(0, 10).map((evt, idx) => {
          const meta = getViolationMeta(evt.violationType);
          const Icon = meta.icon;
          const timeStr = evt.timestamp
            ? new Date(evt.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            : '';

          return (
            <div
              key={`${evt.attemptId}-${evt.timestamp}-${idx}`}
              className={cn(
                'min-w-[280px] max-w-[320px] rounded-xl p-3 border transition-all duration-200 shrink-0',
                'bg-white dark:bg-zinc-900/90 shadow-sm hover:shadow',
                evt.disqualified
                  ? 'border-rose-400 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/40'
                  : 'border-zinc-200/80 dark:border-zinc-800/80 hover:border-amber-400'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border',
                    meta.color
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{meta.label}</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                  <Clock className="w-3 h-3" />
                  <span>{timeStr}</span>
                </span>
              </div>

              <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                {evt.candidateName || 'Thí sinh ẩn danh'}
              </div>

              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {evt.description || 'Phát hiện vi phạm trong quá trình làm bài thi'}
              </div>

              <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Số lần vi phạm: {evt.violationCount}
                </span>

                <button
                  onClick={() => onInspectCandidate(evt.attemptId)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  <span>Xem</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
