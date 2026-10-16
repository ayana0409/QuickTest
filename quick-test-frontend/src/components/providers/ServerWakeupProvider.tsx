'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Server, Zap, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ServerWakeupContextType {
  isServerAwake: boolean;
  isChecking: boolean;
  checkServerHealth: () => Promise<boolean>;
}

const ServerWakeupContext = createContext<ServerWakeupContextType>({
  isServerAwake: true,
  isChecking: false,
  checkServerHealth: async () => true,
});

export const useServerWakeup = () => useContext(ServerWakeupContext);

const SESSION_STORAGE_KEY = 'quicktest_server_awake';
const PROBE_TIMEOUT_MS = 10000; // 10s timeout per probe for Java cold start
const RETRY_INTERVAL_SECONDS = 20; // 20s interval between auto pings as requested
const RETRY_INTERVAL_MS = RETRY_INTERVAL_SECONDS * 1000;

export function ServerWakeupProvider({ children }: { children: React.ReactNode }) {
  const [isServerAwake, setIsServerAwake] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isWakingUp, setIsWakingUp] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(RETRY_INTERVAL_SECONDS);
  const [wakeSuccess, setWakeSuccess] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef<boolean>(false);

  const getPingUrl = () => {
    const rawUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';
    const baseUrl = rawUrl.replace(/\/+$/, '');
    return baseUrl.endsWith('/api') ? `${baseUrl}/ping` : `${baseUrl}/api/ping`;
  };

  /**
   * Executes a single lightweight ping probe against the backend.
   */
  const pingServer = useCallback(async (): Promise<boolean> => {
    setIsPinging(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(getPingUrl(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setIsPinging(false);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      setIsPinging(false);
      return false;
    }
  }, []);

  /**
   * Periodic polling worker running every 20s until the backend wakes up.
   */
  const startWakingUpSequence = useCallback(() => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsWakingUp(true);
    setShowModal(true);
    setElapsedSeconds(0);
    setCountdownSeconds(RETRY_INTERVAL_SECONDS);
    setAttemptCount(1);
    setWakeSuccess(false);

    // 1-second interval timer for elapsed & 20s countdown
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : RETRY_INTERVAL_SECONDS));
    }, 1000);

    // Polling function
    const runPolling = async () => {
      const ok = await pingServer();
      if (ok) {
        // Success celebration
        setWakeSuccess(true);
        setIsServerAwake(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
        }

        // Cleanup timers
        if (timerRef.current) clearInterval(timerRef.current);
        if (pollingRef.current) clearTimeout(pollingRef.current);
        isCheckingRef.current = false;

        // Auto close modal smoothly after 1.2s
        setTimeout(() => {
          setShowModal(false);
          setIsWakingUp(false);
        }, 1200);
      } else {
        setAttemptCount((prev) => prev + 1);
        setCountdownSeconds(RETRY_INTERVAL_SECONDS);
        pollingRef.current = setTimeout(runPolling, RETRY_INTERVAL_MS);
      }
    };

    // Trigger initial polling attempt after 1.5s
    pollingRef.current = setTimeout(runPolling, 1500);
  }, [pingServer]);

  /**
   * Manual retry triggered by user button click without waiting for 20s countdown.
   */
  const handleManualRetry = async () => {
    if (wakeSuccess || isPinging) return;
    if (pollingRef.current) clearTimeout(pollingRef.current);

    setCountdownSeconds(RETRY_INTERVAL_SECONDS);
    const ok = await pingServer();
    if (ok) {
      setWakeSuccess(true);
      setIsServerAwake(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearTimeout(pollingRef.current);
      isCheckingRef.current = false;

      setTimeout(() => {
        setShowModal(false);
        setIsWakingUp(false);
      }, 1000);
    } else {
      setAttemptCount((prev) => prev + 1);
      setCountdownSeconds(RETRY_INTERVAL_SECONDS);
      // Resume 20s polling cycle
      pollingRef.current = setTimeout(async () => {
        const autoOk = await pingServer();
        if (autoOk) {
          setWakeSuccess(true);
          setIsServerAwake(true);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
          }
          if (timerRef.current) clearInterval(timerRef.current);
          isCheckingRef.current = false;
          setTimeout(() => {
            setShowModal(false);
            setIsWakingUp(false);
          }, 1000);
        } else {
          setAttemptCount((p) => p + 1);
          setCountdownSeconds(RETRY_INTERVAL_SECONDS);
        }
      }, RETRY_INTERVAL_MS);
    }
  };

  // Initial probe on mount
  useEffect(() => {
    let isMounted = true;

    // Check if session already verified server is warm
    const hasAwokenInSession = typeof window !== 'undefined' && sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';

    // Grace period check: if server responds quickly (< 800ms), don't show any modal
    const graceTimer = setTimeout(() => {
      if (isMounted && !hasAwokenInSession) {
        startWakingUpSequence();
      }
    }, 800);

    pingServer().then((isWarm) => {
      if (!isMounted) return;
      clearTimeout(graceTimer);

      if (isWarm) {
        setIsServerAwake(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
        }
      } else {
        // Cold start detected!
        startWakingUpSequence();
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(graceTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [pingServer, startWakingUpSequence]);

  return (
    <ServerWakeupContext.Provider
      value={{
        isServerAwake,
        isChecking: isWakingUp,
        checkServerHealth: pingServer,
      }}
    >
      {children}

      {/* Modern Enforced Server Wake-up Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg select-none animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden text-center">
            {/* Top glowing ambient gradient */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 transition-all duration-500 ${
                wakeSuccess
                  ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]'
                  : 'bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-500 animate-pulse'
              }`}
            />

            {/* Animated Server Icon & Radar */}
            <div className="relative mx-auto my-4 w-20 h-20 flex items-center justify-center">
              {wakeSuccess ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 animate-in zoom-in-75 duration-300">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
              ) : (
                <>
                  {/* Radar pulse rings */}
                  <span className="absolute w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/30 animate-ping opacity-75" />
                  <span className="absolute w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse" />
                  <div className="relative w-14 h-14 rounded-2xl bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-indigo-400 shadow-inner">
                    <Server className="w-7 h-7 animate-pulse text-indigo-400" />
                    <Zap className="w-3.5 h-3.5 absolute -top-1 -right-1 text-amber-400 animate-bounce" />
                  </div>
                </>
              )}
            </div>

            {/* Status Title & Message */}
            <h3 className="text-xl font-bold text-zinc-100 tracking-tight">
              {wakeSuccess ? 'Máy chủ đã sẵn sàng!' : 'Đang đánh thức máy chủ...'}
            </h3>

            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              {wakeSuccess ? (
                <span className="text-emerald-400 font-medium">
                  Kết nối thành công! Đang chuyển tiếp bạn vào ứng dụng...
                </span>
              ) : (
                <>
                  Hệ thống Backend (Java Spring Boot) đang khởi động từ chế độ ngủ.
                  <br />
                  <span className="text-zinc-300 font-medium">
                    Hệ thống tự động kiểm tra định kỳ mỗi 20s cho đến khi máy chủ sẵn sàng.
                  </span>
                </>
              )}
            </p>

            {/* Metrics & Countdown Progress Bar */}
            {!wakeSuccess && (
              <div className="mt-6 space-y-2.5">
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5 text-xs text-zinc-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isPinging ? 'animate-spin' : ''}`} />
                    <span>
                      {isPinging ? (
                        <strong className="text-indigo-400">Đang gửi tín hiệu ping...</strong>
                      ) : (
                        <span>
                          Tự động thử lại sau: <strong className="text-zinc-200">{countdownSeconds}s</strong>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="font-mono text-zinc-300">
                    Đã chờ: <strong className="text-amber-400">{elapsedSeconds}s</strong>
                  </div>
                </div>

                {/* Smooth 20s progress bar */}
                <div className="w-full bg-zinc-800/50 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.min(100, Math.max(0, ((RETRY_INTERVAL_SECONDS - countdownSeconds) / RETRY_INTERVAL_SECONDS) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Overtime notice if elapsed > 60s */}
            {elapsedSeconds > 60 && !wakeSuccess && (
              <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 text-left">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  Máy chủ Java đang tải cấu hình JPA &amp; Redis. Vui lòng giữ nguyên màn hình hoặc bấm nút bên dưới để ping lại.
                </span>
              </div>
            )}

            {/* Action button: Full-width Retry only */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleManualRetry}
                disabled={wakeSuccess || isPinging}
                className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  wakeSuccess
                    ? 'bg-emerald-600 text-white cursor-default'
                    : isPinging
                    ? 'bg-zinc-800 text-zinc-400 cursor-wait border border-zinc-700'
                    : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-lg shadow-indigo-600/30'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
                {wakeSuccess ? 'Đã kết nối thành công' : isPinging ? 'Đang ping máy chủ...' : 'Thử kết nối lại ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ServerWakeupContext.Provider>
  );
}
