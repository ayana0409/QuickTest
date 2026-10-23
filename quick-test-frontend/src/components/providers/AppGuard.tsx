'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Wrench, Clock, Sparkles, Moon, SunMedium } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Parses time string in 'HH:mm' format into total minutes from start of day.
 */
function timeToMinutes(timeStr: string): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  return hour * 60 + minute;
}

/**
 * Calculates remaining minutes until shutdown in current operating window.
 * Returns null if outside operating hours or hours not configured.
 */
function getMinutesUntilShutdown(
  currentMin: number,
  startMin: number | null,
  endMin: number | null
): number | null {
  if (startMin === null || endMin === null) return null;

  if (startMin <= endMin) {
    // Normal window within same day: e.g. 07:00 to 23:00
    if (currentMin >= startMin && currentMin < endMin) {
      return endMin - currentMin;
    }
    return null;
  } else {
    // Overnight window: e.g. 22:00 to 06:00
    if (currentMin >= startMin) {
      return 24 * 60 - currentMin + endMin;
    } else if (currentMin < endMin) {
      return endMin - currentMin;
    }
    return null;
  }
}

/**
 * Returns the current date and time components in Vietnam Time Zone (UTC+7).
 */
function getVietnamTime() {
  const now = new Date();

  // Extract accurate 24-hour time parts in Asia/Ho_Chi_Minh time zone
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);

  const hourFormatted = String(hour).padStart(2, '0');
  const minuteFormatted = String(minute).padStart(2, '0');
  const secondFormatted = String(second).padStart(2, '0');

  // Friendly human date string in Vietnamese
  const dateFormatted = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return {
    hour,
    minute,
    second,
    totalMinutes: hour * 60 + minute,
    currentTimeString: `${hourFormatted}:${minuteFormatted}`,
    secondsString: secondFormatted,
    dateFormatted,
  };
}

interface AppGuardProps {
  children: React.ReactNode;
}

export function AppGuard({ children }: AppGuardProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [vnTime, setVnTime] = useState<{
    hour: number;
    minute: number;
    second: number;
    totalMinutes: number;
    currentTimeString: string;
    secondsString: string;
    dateFormatted: string;
  } | null>(null);

  // Configuration from environment variables
  const rawMaintainMode =
    process.env.NEXT_PUBLIC_MAINTAIN_MODE ||
    process.env.MAINTAIN_MODE ||
    '';
  const isMaintainMode =
    rawMaintainMode.trim().toLowerCase() === 'true' ||
    rawMaintainMode.trim() === '1';

  const startupStr = (
    process.env.NEXT_PUBLIC_STARTUP ||
    process.env.STARTUP ||
    ''
  ).trim();

  const shutdownStr = (
    process.env.NEXT_PUBLIC_SHUTDOWN ||
    process.env.SHUTDOWN ||
    ''
  ).trim();

  // Live timer tick every second for real-time human clock & schedule evaluation
  useEffect(() => {
    setMounted(true);
    setVnTime(getVietnamTime());

    const timer = setInterval(() => {
      setVnTime(getVietnamTime());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Operating hours calculation
  const operatingStatus = useMemo(() => {
    const startMin = timeToMinutes(startupStr);
    const endMin = timeToMinutes(shutdownStr);

    // If hours are not configured or invalid, system operates 24/7
    if (startMin === null || endMin === null) {
      return { isConfigured: false, isOpen: true };
    }

    // Default before client mount
    if (!vnTime) {
      return { isConfigured: true, isOpen: true };
    }

    const currentMin = vnTime.totalMinutes;

    let isOpen = false;
    if (startMin <= endMin) {
      // Normal daytime window (e.g., 07:00 to 23:00)
      isOpen = currentMin >= startMin && currentMin < endMin;
    } else {
      // Overnight window (e.g., 22:00 to 06:00 next day)
      isOpen = currentMin >= startMin || currentMin < endMin;
    }

    return {
      isConfigured: true,
      isOpen,
      startFormatted: startupStr,
      endFormatted: shutdownStr,
    };
  }, [startupStr, shutdownStr, vnTime]);

  const lastToastTimeRef = useRef<number>(0);

  // Periodic shutdown warning toast every 30 seconds when within 30 minutes of shutdown
  useEffect(() => {
    if (!mounted || !vnTime || isMaintainMode || !operatingStatus.isOpen) {
      toast.dismiss('system-shutdown-warning');
      return;
    }

    const startMin = timeToMinutes(startupStr);
    const endMin = timeToMinutes(shutdownStr);
    const remainingMinutes = getMinutesUntilShutdown(vnTime.totalMinutes, startMin, endMin);

    if (remainingMinutes !== null && remainingMinutes > 0 && remainingMinutes <= 30) {
      const now = Date.now();
      // Show warning every 30 seconds
      if (now - lastToastTimeRef.current >= 30000) {
        lastToastTimeRef.current = now;
        toast(
          `Hệ thống sẽ ngừng hoạt động sau ${remainingMinutes} phút. Vui lòng hoàn thành các công việc của bạn trong thời gian này.`,
          {
            id: 'system-shutdown-warning',
            duration: 8000,
            icon: '⚠️',
          }
        );
      }
    }
  }, [mounted, vnTime, isMaintainMode, operatingStatus.isOpen, startupStr, shutdownStr]);

  // Initial SSR mount guard - render dark backdrop to prevent layout flashing
  if (!mounted) {
    if (isMaintainMode) {
      // If maintenance mode is static true, render maintenance shell right away
      return <MaintenanceView timeString="--:--" dateString="" />;
    }
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Đang chuẩn bị không gian làm bài...</span>
        </div>
      </div>
    );
  }

  // PRIORITY 1: Maintenance Mode Block
  if (isMaintainMode) {
    return (
      <MaintenanceView
        timeString={vnTime ? `${vnTime.currentTimeString}:${vnTime.secondsString}` : ''}
        dateString={vnTime?.dateFormatted || ''}
      />
    );
  }

  // PRIORITY 2: Outside Operating Hours Block
  if (operatingStatus.isConfigured && !operatingStatus.isOpen) {
    return (
      <OffHoursView
        currentTime={vnTime?.currentTimeString || '--:--'}
        currentSeconds={vnTime?.secondsString || '00'}
        currentDate={vnTime?.dateFormatted || ''}
        startupTime={operatingStatus.startFormatted || '07:00'}
        shutdownTime={operatingStatus.endFormatted || '23:00'}
      />
    );
  }

  // Normal Application Flow - None of the background providers or API hooks are blocked
  return <>{children}</>;
}

/**
 * Human-centric, warm maintenance screen with Double-Bezel architecture.
 */
function MaintenanceView({
  timeString,
  dateString,
}: {
  timeString: string;
  dateString: string;
}) {
  return (
    <div className="fixed inset-0 z-[9999] min-h-[100dvh] w-full bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 md:p-8 select-none overflow-y-auto">
      {/* Ambient background glowing orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[340px] bg-gradient-to-tr from-amber-500/10 via-orange-500/15 to-transparent blur-3xl rounded-full opacity-70" />
        <div className="absolute bottom-1/4 right-1/3 w-[380px] h-[280px] bg-indigo-500/10 blur-3xl rounded-full opacity-50" />
      </div>

      {/* Double-Bezel (Doppelrand) container */}
      <div className="relative w-full max-w-xl mx-auto rounded-[2.5rem] p-2 bg-zinc-900/60 border border-zinc-800/80 shadow-2xl backdrop-blur-2xl">
        <div className="relative rounded-[2rem] bg-zinc-950/90 border border-white/5 p-7 sm:p-10 md:p-12 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden">
          {/* Subtle top decorative hairline */}
          <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide bg-amber-500/10 border border-amber-500/25 text-amber-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Nâng cấp hệ thống</span>
          </div>

          {/* Warm animated icon */}
          <div className="relative mx-auto mb-6 w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-3xl bg-amber-500/15 blur-xl animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800/90 flex items-center justify-center text-amber-400 shadow-lg">
              <Wrench className="w-8 h-8 animate-bounce" />
            </div>
          </div>

          {/* Friendly human message */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 mb-4">
            Hệ thống đang tạm nghỉ để bảo trì
          </h1>

          <div className="space-y-3 text-zinc-300 text-base sm:text-lg leading-relaxed max-w-md mx-auto">
            <p>
              Hệ thống đang bảo trì, vui lòng quay lại sau.
            </p>
            <p className="text-zinc-400 text-sm sm:text-base">
              Đội ngũ đang hoàn thiện để mang đến trải nghiệm tốt nhất cho bạn. Xin lỗi vì sự bất tiện này!
            </p>
          </div>

          {/* Live time card */}
          {timeString && (
            <div className="mt-8 pt-6 border-t border-zinc-900 flex flex-col items-center justify-center text-xs text-zinc-400 gap-1.5">
              <div className="flex items-center gap-2 font-mono text-zinc-300 bg-zinc-900/80 px-3.5 py-1.5 rounded-full border border-zinc-800">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Giờ Việt Nam (UTC+7): </span>
                <strong className="text-amber-300 font-semibold">{timeString}</strong>
              </div>
              {dateString && <span className="text-zinc-400 text-[13px]">{dateString}</span>}
            </div>
          )}

          {/* Heartfelt note */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Cảm ơn bạn đã luôn đồng hành cùng Quick Test.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Human-centric, soothing outside operating hours screen with Double-Bezel architecture.
 */
function OffHoursView({
  currentTime,
  currentSeconds,
  currentDate,
  startupTime,
  shutdownTime,
}: {
  currentTime: string;
  currentSeconds: string;
  currentDate: string;
  startupTime: string;
  shutdownTime: string;
}) {
  return (
    <div className="fixed inset-0 z-[9999] min-h-[100dvh] w-full bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 md:p-8 select-none overflow-y-auto">
      {/* Ambient glowing orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[360px] bg-gradient-to-tr from-indigo-500/15 via-sky-500/10 to-transparent blur-3xl rounded-full opacity-60" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-purple-500/10 blur-3xl rounded-full opacity-40" />
      </div>

      {/* Double-Bezel (Doppelrand) container */}
      <div className="relative w-full max-w-xl mx-auto rounded-[2.5rem] p-2 bg-zinc-900/60 border border-zinc-800/80 shadow-2xl backdrop-blur-2xl">
        <div className="relative rounded-[2rem] bg-zinc-950/90 border border-white/5 p-7 sm:p-10 md:p-12 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden">
          {/* Subtle top decorative hairline */}
          <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />

          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 mb-6">
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ngoài giờ mở cửa</span>
          </div>

          {/* Center Clock Icon */}
          <div className="relative mx-auto mb-6 w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-3xl bg-indigo-500/15 blur-xl animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800/90 flex items-center justify-center text-indigo-400 shadow-lg">
              <Clock className="w-8 h-8" />
            </div>
          </div>

          {/* Main Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 mb-4">
            Hẹn gặp lại bạn vào giờ hoạt động nhé!
          </h1>

          {/* Primary human explanation requested by user */}
          <div className="space-y-4 text-zinc-200 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-left space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Hiện tại đang là:
                </span>
                <span className="font-mono font-bold text-indigo-300 text-base">
                  {currentTime}:{currentSeconds} (UTC+7)
                </span>
              </div>

              <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-800/60">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <SunMedium className="w-4 h-4 text-amber-400" />
                  Giờ hoạt động là:
                </span>
                <span className="font-semibold text-emerald-400 text-base">
                  {startupTime} — {shutdownTime}
                </span>
              </div>
            </div>

            <p className="text-zinc-300 text-sm sm:text-base text-center">
              Vui lòng quay lại vào khung giờ <strong className="text-indigo-300">{startupTime} – {shutdownTime}</strong> để sử dụng hệ thống nhé.
            </p>

            <p className="text-zinc-400 text-xs sm:text-sm text-center">
              Xin lỗi vì sự bất tiện này! Chúc bạn một ngày tốt lành.
            </p>
          </div>

          {/* Date information */}
          {currentDate && (
            <div className="mt-8 pt-6 border-t border-zinc-900 flex items-center justify-center text-xs text-zinc-400">
              <span>{currentDate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
