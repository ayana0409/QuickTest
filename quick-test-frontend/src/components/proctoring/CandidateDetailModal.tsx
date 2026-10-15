import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  UserX,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Calendar,
  Layers,
  FileCheck,
} from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';
import { teacherProctoringService } from '@/services/teacherProctoring.service';
import type {
  AttemptRealtimeStatusDetail,
  ViolationLogEntry,
  ViolationType,
} from '@/types/proctoring';
import { getViolationMeta } from './LiveViolationStream';
import { cn } from '@/lib/utils';

interface CandidateDetailModalProps {
  isOpen: boolean;
  attemptId: string | null;
  maxViolations?: number;
  onClose: () => void;
  onDisqualifyClick?: (attemptId: string, candidateName: string) => void;
}

/**
 * Candidate Telemetry Inspector Modal for Teacher Live Proctoring.
 * Fetches and displays granular heartbeat telemetry, violation breakdown, and full audit logs.
 */
export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({
  isOpen,
  attemptId,
  maxViolations = 3,
  onClose,
  onDisqualifyClick,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [statusDetail, setStatusDetail] = useState<AttemptRealtimeStatusDetail | null>(null);
  const [violationLogs, setViolationLogs] = useState<ViolationLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !attemptId) {
      setStatusDetail(null);
      setViolationLogs([]);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      teacherProctoringService.getAttemptStatus(attemptId),
      teacherProctoringService.getAttemptViolations(attemptId),
    ])
      .then(([status, logs]) => {
        if (!isMounted) return;
        setStatusDetail(status);
        setViolationLogs(logs || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load candidate proctoring telemetry:', err);
        setError('Failed to load telemetry data. Please try again.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, attemptId]);

  if (!isOpen) return null;

  const isDisqualified =
    statusDetail?.isDisqualified || statusDetail?.status === 'DISQUALIFIED';
  const isInProgress = statusDetail?.status === 'IN_PROGRESS';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Candidate Telemetry Inspector</span>
        </div>
      }
      description="Real-time candidate telemetry status, connection heartbeat, and complete violation audit trail."
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Fetching candidate telemetry & violation records...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p>{error}</p>
        </div>
      ) : statusDetail ? (
        <div className="space-y-6">
          {/* Top Identity & Status Banner */}
          <div className="rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-base flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                  {statusDetail.candidateName
                    ? statusDetail.candidateName
                        .split(' ')
                        .map((w) => w[0])
                        .slice(-2)
                        .join('')
                        .toUpperCase()
                    : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    {statusDetail.candidateName || 'Anonymous Candidate'}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {statusDetail.candidateIdentifier || 'No identifier recorded'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {statusDetail.isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Connected Online</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Disconnected Offline</span>
                  </span>
                )}

                <Badge variant={statusDetail.status} size="md">
                  {statusDetail.status}
                </Badge>
              </div>
            </div>

            {/* Sub-bar stats */}
            <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span>
                  Last Heartbeat:{' '}
                  {statusDetail.lastHeartbeat
                    ? new Date(statusDetail.lastHeartbeat).toLocaleTimeString()
                    : 'No telemetry pulse'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span>Total Violations:</span>
                <span
                  className={cn(
                    'font-bold px-2 py-0.5 rounded-full text-xs',
                    statusDetail.violationCount >= maxViolations
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                      : statusDetail.violationCount > 0
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  )}
                >
                  {statusDetail.violationCount} / {maxViolations} Allowed
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Section */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2.5">
              Violation Breakdown by Category
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  'TAB_SWITCH',
                  'EXIT_FULLSCREEN',
                  'DEVTOOLS_OPEN',
                  'COPY_PASTE_ATTEMPT',
                ] as ViolationType[]
              ).map((type) => {
                const meta = getViolationMeta(type);
                const Icon = meta.icon;
                const count = statusDetail.violationBreakdown?.[type] || 0;

                return (
                  <div
                    key={type}
                    className="rounded-xl p-3 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                        {meta.label}
                      </span>
                      <Icon className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chronological Audit Log Trail */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Complete Audit Trail ({violationLogs.length} Records)
              </h4>
            </div>

            {violationLogs.length === 0 ? (
              <div className="py-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
                <ShieldCheck className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <span>No violation incidents recorded for this attempt.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                {violationLogs.map((log, idx) => {
                  const meta = getViolationMeta(log.violationType);
                  const Icon = meta.icon;
                  const time = log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '--:--:--';

                  return (
                    <div
                      key={log.id || idx}
                      className="rounded-xl p-3 bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/80 flex items-start gap-3"
                    >
                      <div
                        className={cn(
                          'p-1.5 rounded-lg border shrink-0 mt-0.5',
                          meta.color
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                            {meta.label}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {time}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {log.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {!isInProgress && statusDetail.status !== 'DISQUALIFIED' && (
                <Link
                  href={`/teacher/grading/attempts/${statusDetail.attemptId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 active:scale-[0.98] transition-all"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Xem bài làm & Chấm điểm</span>
                </Link>
              )}

              {isInProgress && !isDisqualified && onDisqualifyClick && (
                <button
                  onClick={() => {
                    onClose();
                    onDisqualifyClick(
                      statusDetail.attemptId,
                      statusDetail.candidateName
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/20 active:scale-[0.98] transition-all"
                >
                  <UserX className="w-4 h-4" />
                  <span>Force Disqualify Candidate</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
