import React from 'react';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  UserX,
  ExternalLink,
  Clock,
  ArrowUpDown,
} from 'lucide-react';
import type { AttemptMonitorItem } from '@/types/proctoring';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';

interface CandidateMonitorTableProps {
  candidates: AttemptMonitorItem[];
  maxViolations?: number;
  onInspect: (attemptId: string) => void;
  onDisqualify: (candidate: AttemptMonitorItem) => void;
}

/**
 * High-density Table View for Teacher Live Proctoring Dashboard.
 */
export const CandidateMonitorTable: React.FC<CandidateMonitorTableProps> = ({
  candidates,
  maxViolations = 3,
  onInspect,
  onDisqualify,
}) => {
  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50">
        <AlertTriangle className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
        <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">
          No candidates found
        </h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Try adjusting your search query or status filter.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[11px]">
              <th className="py-3.5 px-4">Candidate</th>
              <th className="py-3.5 px-4">Connection</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Violations</th>
              <th className="py-3.5 px-4">Start Time</th>
              <th className="py-3.5 px-4">Submit Time</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {candidates.map((candidate) => {
              const isDisqualified =
                candidate.isDisqualified || candidate.status === 'DISQUALIFIED';
              const isInProgress = candidate.status === 'IN_PROGRESS';
              const hasHighViolations = candidate.violationCount >= maxViolations;

              const initials = candidate.candidateName
                ? candidate.candidateName
                    .split(' ')
                    .map((w) => w[0])
                    .slice(-2)
                    .join('')
                    .toUpperCase()
                : 'U';

              return (
                <tr
                  key={candidate.attemptId}
                  className={cn(
                    'group hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors',
                    isDisqualified && 'bg-rose-50/20 dark:bg-rose-950/10'
                  )}
                >
                  {/* Candidate Info */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0',
                          isDisqualified
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                        )}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                          {candidate.candidateName || 'Anonymous Candidate'}
                        </div>
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[180px]">
                          {candidate.candidateIdentifier || 'No identifier'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Connection */}
                  <td className="py-3 px-4">
                    {candidate.isOnline ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <Wifi className="w-3.5 h-3.5" />
                        <span>Online</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                        <WifiOff className="w-3.5 h-3.5" />
                        <span>Offline</span>
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <Badge variant={candidate.status} size="sm">
                      {candidate.status}
                    </Badge>
                  </td>

                  {/* Violations */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px]',
                          hasHighViolations
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                            : candidate.violationCount > 0
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        )}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>
                          {candidate.violationCount} / {maxViolations}
                        </span>
                      </span>
                    </div>
                  </td>

                  {/* Start Time */}
                  <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                    {candidate.startTime
                      ? new Date(candidate.startTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '--:--'}
                  </td>

                  {/* Submit Time */}
                  <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                    {candidate.submitTime
                      ? new Date(candidate.submitTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '--:--'}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onInspect(candidate.attemptId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
                        title="Inspect telemetry & violation history"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      {isInProgress && !isDisqualified && (
                        <button
                          onClick={() => onDisqualify(candidate)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 transition-colors"
                          title="Disqualify candidate"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Disqualify</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
