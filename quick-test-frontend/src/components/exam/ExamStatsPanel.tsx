'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Award,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Timer,
  Users,
  CheckCircle2,
  Edit3,
  Activity,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { gradingService, type ExamAttemptStatsDto } from '@/services/grading.service';
import toast from 'react-hot-toast';

interface ExamStatsPanelProps {
  examId: string;
  totalPoints?: number;
  /** When true the panel will re-fetch stats (e.g. after a grading action) */
  refreshTrigger?: number;
}

/**
 * Formats seconds into a human-readable duration string.
 * e.g. 3723 → "1g 2p 3s"
 */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}g`);
  if (m > 0) parts.push(`${m}p`);
  if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(' ');
}

/**
 * Formats a score value with 2 decimal places, or returns "—" for null.
 */
function formatScore(value: number | null | undefined, totalPoints: number): string {
  if (value == null) return '—';
  return `${value.toFixed(2)} / ${totalPoints}`;
}

// ─── Internal Stat Card ─────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  colorClass: string;   // e.g. "indigo"
  iconBg: string;       // Tailwind bg/text class pair
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, iconBg }) => (
  <div className="flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs min-w-0">
    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{label}</p>
      <p className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-0.5 leading-tight">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{sub}</p>
      )}
    </div>
  </div>
);

// ─── Attempt Distribution Bar ────────────────────────────────────────────────

interface DistBarProps {
  stats: ExamAttemptStatsDto;
}

const AttemptDistributionBar: React.FC<DistBarProps> = ({ stats }) => {
  const total = stats.totalAttempts;
  if (total === 0) return null;

  const segments = [
    {
      label: 'Hoàn thành',
      count: stats.completedAttempts,
      color: 'bg-emerald-500 dark:bg-emerald-400',
    },
    {
      label: 'Chờ chấm',
      count: stats.pendingGradingAttempts,
      color: 'bg-amber-400 dark:bg-amber-300',
    },
    {
      label: 'Đang làm',
      count: stats.inProgressAttempts,
      color: 'bg-indigo-400 dark:bg-indigo-300',
    },
    {
      label: 'Bị đình chỉ',
      count: stats.disqualifiedAttempts,
      color: 'bg-rose-500 dark:bg-rose-400',
    },
  ].filter((s) => s.count > 0);

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">
          Phân bổ trạng thái
        </p>
        <span className="text-xs text-zinc-400">{total} phiên</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: `${(seg.count / total) * 100}%` }}
            title={`${seg.label}: ${seg.count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${seg.color}`} />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {seg.label}{' '}
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{seg.count}</span>
              <span className="text-zinc-400 dark:text-zinc-500">
                {' '}({((seg.count / total) * 100).toFixed(0)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const ExamStatsPanel: React.FC<ExamStatsPanelProps> = ({
  examId,
  totalPoints = 10,
  refreshTrigger = 0,
}) => {
  const [stats, setStats] = useState<ExamAttemptStatsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(
    async (silent = false) => {
      if (!examId) return;
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const data = await gradingService.getExamAttemptStats(examId);
        setStats(data);
        setLastUpdated(new Date());
      } catch {
        if (!silent) {
          toast.error('Không thể tải thống kê đề thi.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [examId]
  );

  // Fetch on mount and whenever the parent signals a refresh
  useEffect(() => {
    fetchStats(false);
  }, [fetchStats, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const hasAttempts = stats.totalAttempts > 0;

  return (
    <section aria-label="Thống kê đề thi" className="space-y-4 pt-1">
      {/* Top status bar: Last updated & quick refresh */}
      {lastUpdated && (
        <div className="flex items-center justify-end gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
          <span>
            <Clock className="w-3 h-3 inline mr-1 -mt-px" />
            Cập nhật lúc: {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 ml-1"
            title="Làm mới thống kê"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      )}

      {/* Attempt distribution bar */}
      <AttemptDistributionBar stats={stats} />

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Total attempts */}
        <StatCard
          label="Tổng phiên thi"
          value={stats.totalAttempts}
          sub={`${stats.completedAttempts} hoàn thành`}
          icon={<Users className="w-5 h-5" />}
          colorClass="indigo"
          iconBg="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
        />

        {/* Graded count */}
        <StatCard
          label="Đã có điểm"
          value={`${stats.gradedCount} / ${stats.totalAttempts}`}
          sub={stats.pendingGradingAttempts > 0 ? `${stats.pendingGradingAttempts} chờ chấm` : 'Tất cả đã có điểm'}
          icon={<CheckCircle2 className="w-5 h-5" />}
          colorClass="emerald"
          iconBg="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
        />

        {/* Average score */}
        <StatCard
          label="Điểm trung bình"
          value={hasAttempts && stats.gradedCount > 0 ? formatScore(stats.averageScore, totalPoints) : '—'}
          sub={stats.gradedCount > 0 ? `Trên ${stats.gradedCount} phiên đã chấm` : 'Chưa có điểm'}
          icon={<Activity className="w-5 h-5" />}
          colorClass="violet"
          iconBg="bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
        />

        {/* Highest score */}
        <StatCard
          label="Điểm cao nhất"
          value={formatScore(stats.highestScore, totalPoints)}
          icon={<TrendingUp className="w-5 h-5" />}
          colorClass="emerald"
          iconBg="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
        />

        {/* Lowest score */}
        <StatCard
          label="Điểm thấp nhất"
          value={formatScore(stats.lowestScore, totalPoints)}
          icon={<TrendingDown className="w-5 h-5" />}
          colorClass="rose"
          iconBg="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
        />

        {/* Total violations */}
        <StatCard
          label="Tổng vi phạm"
          value={stats.totalViolations}
          sub={
            stats.attemptsWithViolations > 0
              ? `${stats.attemptsWithViolations} thí sinh vi phạm · Cao nhất: ${stats.maxViolations}`
              : 'Không có vi phạm'
          }
          icon={<ShieldAlert className="w-5 h-5" />}
          colorClass="rose"
          iconBg="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
        />

        {/* Average duration */}
        <StatCard
          label="Thời gian TB"
          value={formatDuration(stats.averageDurationSeconds)}
          sub="Tính từ lúc bắt đầu → nộp bài"
          icon={<Timer className="w-5 h-5" />}
          colorClass="amber"
          iconBg="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
        />

        {/* Fastest / Slowest */}
        <StatCard
          label="Nhanh / Chậm nhất"
          value={
            <span className="text-base font-bold">
              <span className="text-emerald-600 dark:text-emerald-400">
                {formatDuration(stats.minDurationSeconds)}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500 font-normal mx-1">/</span>
              <span className="text-amber-600 dark:text-amber-400">
                {formatDuration(stats.maxDurationSeconds)}
              </span>
            </span>
          }
          sub="Min / Max thời gian làm bài"
          icon={<Award className="w-5 h-5" />}
          colorClass="amber"
          iconBg="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
        />

        {/* Pending manual grading */}
        {stats.pendingGradingAttempts > 0 && (
          <StatCard
            label="Chờ chấm tự luận"
            value={stats.pendingGradingAttempts}
            sub="Cần chấm điểm thủ công"
            icon={<Edit3 className="w-5 h-5" />}
            colorClass="amber"
            iconBg="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
          />
        )}
      </div>

      {/* Empty state */}
      {!hasAttempts && (
        <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm">
          Chưa có thí sinh nào tham gia đề thi này.
        </div>
      )}
    </section>
  );
};
