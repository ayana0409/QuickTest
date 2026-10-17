import React from 'react';
import { Users, AlertTriangle, UserX, CheckCircle2, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProctoringStats {
  total: number;
  online: number;
  inProgress: number;
  withViolations: number;
  disqualified: number;
  submitted: number;
}

interface ProctoringMetricCardsProps {
  stats: ProctoringStats;
  activeFilter?: string;
  onSelectFilter?: (filter: string) => void;
}

/**
 * Metric summary cards for Teacher Live Proctoring Dashboard.
 * Employs double-bezel card architecture with interactive filtering toggles.
 */
export const ProctoringMetricCards: React.FC<ProctoringMetricCardsProps> = ({
  stats,
  activeFilter = 'ALL',
  onSelectFilter,
}) => {
  const cards = [
    {
      id: 'IN_PROGRESS',
      label: 'Đang làm bài',
      sublabel: `${stats.online} online`,
      value: stats.inProgress,
      icon: Users,
      badgeIcon: Wifi,
      accentBorder: 'hover:border-sky-500/50',
      activeRing: 'ring-2 ring-sky-500/40 border-sky-500/50 bg-sky-50/50 dark:bg-sky-950/20',
      iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      dotColor: 'bg-emerald-500 animate-pulse',
    },
    {
      id: 'VIOLATION',
      label: 'Phát hiện vi phạm',
      sublabel: 'Bị phát hiện',
      value: stats.withViolations,
      icon: AlertTriangle,
      accentBorder: 'hover:border-amber-500/50',
      activeRing: 'ring-2 ring-amber-500/40 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      dotColor: stats.withViolations > 0 ? 'bg-amber-500 animate-ping' : 'bg-zinc-400',
    },
    {
      id: 'DISQUALIFIED',
      label: 'Đình chỉ',
      sublabel: 'Bị đình chỉ',
      value: stats.disqualified,
      icon: UserX,
      accentBorder: 'hover:border-rose-500/50',
      activeRing: 'ring-2 ring-rose-500/40 border-rose-500/50 bg-rose-50/50 dark:bg-rose-950/20',
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      dotColor: stats.disqualified > 0 ? 'bg-rose-500' : 'bg-zinc-400',
    },
    {
      id: 'SUBMITTED',
      label: 'Hoàn thành',
      sublabel: 'Đã nộp',
      value: stats.submitted,
      icon: CheckCircle2,
      accentBorder: 'hover:border-emerald-500/50',
      activeRing: 'ring-2 ring-emerald-500/40 border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      dotColor: 'bg-emerald-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.id;

        return (
          <div
            key={card.id}
            onClick={() => onSelectFilter?.(isActive ? 'ALL' : card.id)}
            className={cn(
              'group cursor-pointer rounded-2xl p-1 transition-all duration-300',
              'bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80',
              'hover:shadow-md hover:scale-[1.01]'
            )}
          >
            {/* Inner Core */}
            <div
              className={cn(
                'rounded-xl p-4 bg-white dark:bg-zinc-950/90 transition-all duration-300',
                'border border-zinc-200/50 dark:border-zinc-800/60',
                card.accentBorder,
                isActive && card.activeRing
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </span>
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110',
                    card.iconBg
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {card.value}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className={cn('w-2 h-2 rounded-full', card.dotColor)} />
                  <span className="truncate max-w-[110px]">{card.sublabel}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
