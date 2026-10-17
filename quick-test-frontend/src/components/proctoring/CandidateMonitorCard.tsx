import React from 'react';
import {
  Clock,
  AlertTriangle,
  UserX,
  ExternalLink,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AttemptMonitorItem } from '@/types/proctoring';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';

interface CandidateMonitorCardProps {
  candidate: AttemptMonitorItem;
  maxViolations?: number;
  onInspect: (attemptId: string) => void;
  onDisqualify: (candidate: AttemptMonitorItem) => void;
}

/**
 * Candidate Telemetry Card for Grid View on Teacher Live Proctoring Dashboard.
 * Designed with a double-bezel monitor aesthetic, dynamic violation warning badges, and online heartbeat indicators.
 */
export const CandidateMonitorCard: React.FC<CandidateMonitorCardProps> = ({
  candidate,
  maxViolations = 3,
  onInspect,
  onDisqualify,
}) => {
  const isDisqualified = candidate.isDisqualified || candidate.status === 'DISQUALIFIED';
  const isInProgress = candidate.status === 'IN_PROGRESS';
  const violationPercent = Math.min(
    100,
    Math.round((candidate.violationCount / (maxViolations || 1)) * 100)
  );

  // Determine card warning level
  const hasHighViolations = candidate.violationCount >= maxViolations;
  const hasWarnings = candidate.violationCount > 0 && !hasHighViolations;

  const initials = candidate.candidateName
    ? candidate.candidateName
      .split(' ')
      .map((w) => w[0])
      .slice(-2)
      .join('')
      .toUpperCase()
    : 'U';

  return (
    <div
      className={cn(
        'group rounded-2xl p-1 transition-all duration-300 relative',
        'bg-zinc-100/80 dark:bg-zinc-900/60 border',
        isDisqualified
          ? 'border-rose-400/80 dark:border-rose-800/80'
          : hasHighViolations
            ? 'border-red-400/80 dark:border-red-800/80'
            : hasWarnings
              ? 'border-amber-300/80 dark:border-amber-700/80'
              : 'border-zinc-200/80 dark:border-zinc-800/80',
        'hover:shadow-lg hover:scale-[1.01]'
      )}
    >
      {/* Inner Screen Core */}
      <div className="rounded-xl p-4 bg-white dark:bg-zinc-950 flex flex-col justify-between h-full border border-zinc-200/40 dark:border-zinc-800/50">
        <div>
          {/* Top Row: Online status & Badge */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs">
              {candidate.isOnline ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Wifi className="w-3 h-3" />
                  <span>Online</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px] bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </span>
              )}
            </div>

            <Badge variant={candidate.status} size="sm">
              {candidate.status}
            </Badge>
          </div>

          {/* Candidate Profile Info */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border transition-transform duration-300 group-hover:scale-105',
                isDisqualified
                  ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800'
                  : hasHighViolations
                    ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800'
                    : hasWarnings
                      ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50'
              )}
            >
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {candidate.candidateName || 'Anonymous Candidate'}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {candidate.candidateIdentifier || 'No identifier recorded'}
              </p>
            </div>
          </div>

          {/* Violation Meter */}
          <div className="mb-4 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-400">
                <AlertTriangle
                  className={cn(
                    'w-3.5 h-3.5',
                    candidate.violationCount > 0
                      ? 'text-amber-500'
                      : 'text-zinc-400'
                  )}
                />
                <span>Violations</span>
              </span>
              <span
                className={cn(
                  'font-bold text-xs',
                  candidate.violationCount >= maxViolations
                    ? 'text-rose-600 dark:text-rose-400'
                    : candidate.violationCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-zinc-500'
                )}
              >
                {candidate.violationCount} / {maxViolations}
              </span>
            </div>

            {/* Progress track */}
            <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-500 rounded-full',
                  candidate.violationCount >= maxViolations
                    ? 'bg-rose-500'
                    : candidate.violationCount > 0
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                )}
                style={{ width: `${Math.max(5, violationPercent)}%` }}
              />
            </div>
          </div>

          {/* Timing details */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mb-3 px-1">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>
                Bắt đầu:{' '}
                {candidate.startTime
                  ? new Date(candidate.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  : '--:--'}
              </span>
            </div>
            {candidate.submitTime && (
              <span>
                Nộp bài:{' '}
                {new Date(candidate.submitTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
          <button
            onClick={() => onInspect(candidate.attemptId)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:text-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Theo dõi</span>
          </button>

          {isInProgress && !isDisqualified && (
            <button
              onClick={() => onDisqualify(candidate)}
              className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 transition-colors"
              title="Disqualify this candidate"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Đình chỉ</span>
            </button>
          )}

          {isDisqualified && (
            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 px-2 py-1 bg-rose-50 dark:bg-rose-950/30 rounded-lg">
              Bị đình chỉ
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
