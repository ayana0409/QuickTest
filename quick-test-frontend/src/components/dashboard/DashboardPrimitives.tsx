'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type TrendViewMode = 'all' | 'attempts' | 'violations';

export interface DashboardDailyActivityPoint {
  date: string;
  label: string;
  attemptsCount: number;
  submittedCount: number;
  violationsCount: number;
}

export interface BreakdownSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  percent: number;
}

export interface BreakdownTabOption<T extends string> {
  id: T;
  label: string;
}

export const subscribeNoop = () => () => { };

export function formatDashboardNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function formatRelativeTime(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'Vừa ghi nhận';
  }
  const diffMinutes = Math.floor((Date.now() - parsed.getTime()) / 60000);
  if (diffMinutes < 1) {
    return 'Vừa xong';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildWeeklyActivitySummary(series: DashboardDailyActivityPoint[]) {
  if (series.length === 0) {
    return {
      series,
      insight: 'Chưa ghi nhận hoạt động làm bài trong 7 ngày gần đây.',
      weeklyAttempts: 0,
      weeklySubmitted: 0,
      weeklyViolations: 0,
    };
  }

  let peak = series[0];
  let weeklyAttempts = 0;
  let weeklySubmitted = 0;
  let weeklyViolations = 0;

  for (const point of series) {
    weeklyAttempts += point.attemptsCount;
    weeklySubmitted += point.submittedCount;
    weeklyViolations += point.violationsCount;
    if (point.attemptsCount > peak.attemptsCount) {
      peak = point;
    }
  }

  const insight =
    weeklyAttempts === 0 && weeklyViolations === 0
      ? 'Trong 7 ngày gần nhất chưa phát sinh lượt tham gia hay cảnh báo nào.'
      : `Tổng ${formatDashboardNumber(weeklyAttempts)} lượt tham gia tuần qua · Cao điểm ngày ${peak.label} (${formatDashboardNumber(peak.attemptsCount)} lượt).`;

  return {
    series,
    insight,
    weeklyAttempts,
    weeklySubmitted,
    weeklyViolations,
  };
}

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

/**
 * Double-Bezel structural shell enclosing dashboard sections.
 * Pairs explicit CSS borders with subtle shadows for high-contrast and Forced Colors Mode support.
 */
export function BentoCard({ children, className = '', innerClassName = '' }: BentoCardProps) {
  return (
    <article
      className={`min-w-0 w-full rounded-3xl border border-zinc-200/80 bg-zinc-200/45 p-1 sm:rounded-[2rem] sm:p-1.5 dark:border-white/10 dark:bg-zinc-800/45 ${className}`}
    >
      <div
        className={`h-full min-w-0 rounded-[calc(1.5rem-0.25rem)] border border-zinc-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.18)] sm:rounded-[calc(2rem-0.375rem)] dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] ${innerClassName}`}
      >
        {children}
      </div>
    </article>
  );
}

export interface KpiCardProps {
  title: string;
  value: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  iconWrapClass: string;
  badgeText: string;
  badgeTone: 'neutral' | 'info' | 'live' | 'positive' | 'warning' | 'danger';
  footerLeft: string;
  footerRight: string;
}

const KPI_BADGE_CLASSES: Record<KpiCardProps['badgeTone'], string> = {
  neutral:
    'bg-zinc-100 text-zinc-700 ring-black/5 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10',
  info: 'bg-sky-50 text-sky-700 ring-sky-500/15 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-400/20',
  live: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20',
  positive:
    'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20',
  warning:
    'bg-amber-50 text-amber-800 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/25',
  danger:
    'bg-rose-50 text-rose-700 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-400/20',
};

export function KpiCard({
  title,
  value,
  unit,
  icon: Icon,
  iconWrapClass,
  badgeText,
  badgeTone,
  footerLeft,
  footerRight,
}: KpiCardProps) {
  return (
    <BentoCard innerClassName="flex flex-col justify-between p-3.5 sm:p-5">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-xs font-semibold leading-snug text-zinc-600 sm:text-sm dark:text-zinc-300">
            {title}
          </h2>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${iconWrapClass}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {value}
          </span>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{unit}</span>
        </div>

        <div className="mt-2.5">
          <span
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${KPI_BADGE_CLASSES[badgeTone]}`}
          >
            {badgeTone === 'live' && (
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
            )}
            <span className="truncate">{badgeText}</span>
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex min-w-0 flex-col gap-0.5 border-t border-zinc-100 pt-2.5 text-[11px] text-zinc-500 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-1 dark:border-zinc-800 dark:text-zinc-400">
        <span className="min-w-0 break-words">{footerLeft}</span>
        <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">{footerRight}</span>
      </div>
    </BentoCard>
  );
}

interface TooltipPayloadItem {
  name?: string | number;
  value?: number | string | ReadonlyArray<string | number>;
  color?: string;
}

function formatTooltipValue(value: TooltipPayloadItem['value']): string {
  if (typeof value === 'number') {
    return formatDashboardNumber(value);
  }
  if (Array.isArray(value)) {
    return value.join(' - ');
  }
  return String(value ?? 0);
}

export function TrendChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900/95">
      <p className="mb-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-50">
        Ngày {String(label ?? '')}
      </p>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={`${String(entry.name)}-${idx}`} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || '#4f46e5' }}
                aria-hidden="true"
              />
              {String(entry.name ?? '')}
            </span>
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatTooltipValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0];
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900/95">
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{String(item.name ?? '')}</p>
      <p className="mt-0.5 tabular-nums text-zinc-600 dark:text-zinc-300">
        Số lượng: <strong>{formatTooltipValue(item.value)}</strong>
      </p>
    </div>
  );
}

interface ActivityTrendChartCardProps {
  title: string;
  series: DashboardDailyActivityPoint[];
  hasMounted: boolean;
  gradientPrefix: string;
  footerNote?: string;
  className?: string;
}

/**
 * Primary 7-day Recharts ComposedChart card with interactive series filter and hidden data table.
 */
export function ActivityTrendChartCard({
  title,
  series,
  hasMounted,
  gradientPrefix,
  footerNote = 'Số liệu gộp theo ngày trong 7 ngày gần nhất',
  className = 'lg:col-span-8',
}: ActivityTrendChartCardProps) {
  const [trendMode, setTrendMode] = useState<TrendViewMode>('all');
  const trendSummary = useMemo(() => buildWeeklyActivitySummary(series), [series]);

  const attemptsGradientId = `${gradientPrefix}AttemptsFill`;
  const submittedGradientId = `${gradientPrefix}SubmittedFill`;

  return (
    <BentoCard className={className} innerClassName="flex flex-col justify-between p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
            {title}
          </h2>
          <p className="text-xs leading-relaxed text-zinc-500 sm:text-sm dark:text-zinc-400">
            {trendSummary.insight}
          </p>
        </div>

        <div
          role="group"
          aria-label="Chế độ xem xu hướng 7 ngày"
          className="inline-flex max-w-full flex-wrap self-start rounded-full bg-zinc-100 p-1 ring-1 ring-black/5 dark:bg-zinc-800/80 dark:ring-white/10"
        >
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'attempts', label: 'Lượt làm bài' },
              { id: 'violations', label: 'Cảnh báo' },
            ] as const
          ).map((option) => {
            const active = trendMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTrendMode(option.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <figure className="relative mt-5 w-full min-w-0 overflow-hidden">
        <div
          className="h-[260px] w-full min-w-0 text-zinc-500 sm:h-[300px] dark:text-zinc-400"
          role="img"
          aria-label={`Biểu đồ 7 ngày qua: ${formatDashboardNumber(trendSummary.weeklyAttempts)} lượt tham gia, ${formatDashboardNumber(trendSummary.weeklySubmitted)} bài hoàn thành và ${formatDashboardNumber(trendSummary.weeklyViolations)} cảnh báo.`}
        >
          {hasMounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart
                data={trendSummary.series}
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={attemptsGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id={submittedGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="currentColor"
                  strokeOpacity={0.14}
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  width={34}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                  content={({ active, payload, label }) => (
                    <TrendChartTooltip
                      active={active}
                      label={label}
                      payload={payload}
                    />
                  )}
                />

                {(trendMode === 'all' || trendMode === 'attempts') && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="attemptsCount"
                      name="Lượt tham gia"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fill={`url(#${attemptsGradientId})`}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#4f46e5' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="submittedCount"
                      name="Đã hoàn thành"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      fill={`url(#${submittedGradientId})`}
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
                    />
                  </>
                )}

                {(trendMode === 'all' || trendMode === 'violations') && (
                  <Bar
                    dataKey="violationsCount"
                    name="Cảnh báo"
                    fill="#e11d48"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={26}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/60" />
          )}
        </div>
        <figcaption className="sr-only">{trendSummary.insight}</figcaption>
        <table className="sr-only">
          <caption>Số liệu làm bài và cảnh báo phòng thi theo từng ngày trong 7 ngày qua</caption>
          <thead>
            <tr>
              <th scope="col">Ngày</th>
              <th scope="col">Lượt tham gia</th>
              <th scope="col">Đã hoàn thành</th>
              <th scope="col">Cảnh báo</th>
            </tr>
          </thead>
          <tbody>
            {trendSummary.series.map((point) => (
              <tr key={point.date}>
                <td>{point.label}</td>
                <td>{point.attemptsCount}</td>
                <td>{point.submittedCount}</td>
                <td>{point.violationsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" aria-hidden="true" />
            Lượt tham gia:{' '}
            <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatDashboardNumber(trendSummary.weeklyAttempts)}
            </strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Đã nộp bài:{' '}
            <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatDashboardNumber(trendSummary.weeklySubmitted)}
            </strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" aria-hidden="true" />
            Cảnh báo:{' '}
            <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatDashboardNumber(trendSummary.weeklyViolations)}
            </strong>
          </span>
        </div>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{footerNote}</span>
      </div>
    </BentoCard>
  );
}

interface BreakdownDonutChartCardProps<T extends string> {
  title: string;
  insight: string;
  tabs: ReadonlyArray<BreakdownTabOption<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  slices: BreakdownSlice[];
  total: number;
  centerLabel: string;
  emptyMessage: string;
  hasMounted: boolean;
  className?: string;
}

/**
 * Secondary Donut distribution chart card with category switcher, accessible table, and bar breakdown.
 */
export function BreakdownDonutChartCard<T extends string>({
  title,
  insight,
  tabs,
  activeTab,
  onTabChange,
  slices,
  total,
  centerLabel,
  emptyMessage,
  hasMounted,
  className = 'lg:col-span-4',
}: BreakdownDonutChartCardProps<T>) {
  const nonZeroSlices = useMemo(() => slices.filter((slice) => slice.value > 0), [slices]);

  return (
    <BentoCard className={className} innerClassName="flex flex-col justify-between p-5 sm:p-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg dark:text-zinc-50">
            {title}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {insight}
          </p>
        </div>

        <div
          role="group"
          aria-label="Chọn nhóm dữ liệu phân bổ"
          className="grid grid-cols-3 rounded-full bg-zinc-100 p-1 ring-1 ring-black/5 dark:bg-zinc-800/80 dark:ring-white/10"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => onTabChange(tab.id)}
                className={`rounded-full px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {total === 0 ? (
        <div className="my-6 flex flex-col items-center justify-center rounded-2xl bg-zinc-50/80 px-4 py-10 text-center dark:bg-zinc-800/40">
          <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <figure className="relative mx-auto mt-3 w-full min-w-0 max-w-[230px]">
            <div
              className="relative h-[185px] w-full min-w-0"
              role="img"
              aria-label={`${title}: tổng ${formatDashboardNumber(total)} ${centerLabel.toLowerCase()}.`}
            >
              {hasMounted ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={nonZeroSlices}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={78}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {nonZeroSlices.map((slice) => (
                        <Cell key={slice.key} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => (
                        <DonutChartTooltip active={active} payload={payload} />
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full animate-pulse rounded-full bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/60" />
              )}

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                  {formatDashboardNumber(total)}
                </span>
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {centerLabel}
                </span>
              </div>
            </div>

            <figcaption className="sr-only">{insight}</figcaption>
            <table className="sr-only">
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th scope="col">Nhóm</th>
                  <th scope="col">Số lượng</th>
                  <th scope="col">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((slice) => (
                  <tr key={slice.key}>
                    <td>{slice.label}</td>
                    <td>{slice.value}</td>
                    <td>{slice.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>

          <ul className="mt-2 space-y-2.5">
            {slices.slice(0, 5).map((slice) => (
              <li key={slice.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{slice.label}</span>
                  </span>
                  <span className="ml-2 shrink-0 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDashboardNumber(slice.value)}{' '}
                    <span className="text-zinc-400 dark:text-zinc-500">({slice.percent}%)</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                    style={{
                      width: `${Math.max(slice.percent, slice.value > 0 ? 4 : 0)}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </BentoCard>
  );
}

export function DashboardErrorBanner({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div role="alert">
      <BentoCard innerClassName="flex flex-col justify-between gap-3 bg-amber-50/70 p-4 sm:flex-row sm:items-center dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{message}</p>
        <button
          type="button"
          disabled={isRetrying}
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          Thử lại ngay
        </button>
      </BentoCard>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[1, 2, 3, 4].map((index) => (
          <BentoCard key={index} innerClassName="p-3.5 sm:p-5">
            <div className="h-4 w-full max-w-[7rem] animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
            <div className="mt-4 h-8 w-full max-w-[5rem] animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
            <div className="mt-3 h-5 w-full max-w-[8rem] animate-pulse rounded-full bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/70" />
          </BentoCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <BentoCard className="lg:col-span-8" innerClassName="p-5 sm:p-6">
          <div className="h-5 w-full max-w-[14rem] animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
          <div className="mt-5 h-[280px] w-full animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/60" />
        </BentoCard>
        <BentoCard className="lg:col-span-4" innerClassName="p-5 sm:p-6">
          <div className="h-5 w-full max-w-[10rem] animate-pulse rounded bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
          <div className="mt-5 h-[280px] w-full animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800/60" />
        </BentoCard>
      </div>
    </div>
  );
}

