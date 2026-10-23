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
const OVERLOAD_TIMEOUT_SECONDS = 180; // 180s overload threshold

export function ServerWakeupProvider({ children }: { children: React.ReactNode }) {
  const [isServerAwake, setIsServerAwake] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isWakingUp, setIsWakingUp] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState<boolean>(true);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(RETRY_INTERVAL_SECONDS);
  const [wakeSuccess, setWakeSuccess] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef<boolean>(false);
  const elapsedSecondsRef = useRef<number>(0);

  // Keep elapsedSecondsRef synchronized with state
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

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
   * Periodic polling worker running every 20s until the backend wakes up or times out at 180s.
   */
  const startWakingUpSequence = useCallback(() => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsWakingUp(true);
    setShowModal(true);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setCountdownSeconds(RETRY_INTERVAL_SECONDS);
    setAttemptCount(1);
    setWakeSuccess(false);

    // 1-second interval timer for elapsed & 20s countdown
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        // If exceeded 180s overload threshold, cease automatic polling
        if (next >= OVERLOAD_TIMEOUT_SECONDS) {
          if (pollingRef.current) clearTimeout(pollingRef.current);
        }
        return next;
      });
      setCountdownSeconds((prev) => (prev > 1 ? prev - 1 : RETRY_INTERVAL_SECONDS));
    }, 1000);

    // Polling function
    const runPolling = async () => {
      // If already past overload threshold, do not send more probes
      if (elapsedSecondsRef.current >= OVERLOAD_TIMEOUT_SECONDS) {
        return;
      }

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
        if (elapsedSecondsRef.current < OVERLOAD_TIMEOUT_SECONDS) {
          setAttemptCount((prev) => prev + 1);
          setCountdownSeconds(RETRY_INTERVAL_SECONDS);
          pollingRef.current = setTimeout(runPolling, RETRY_INTERVAL_MS);
        }
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

    // Reset overtime clock if retrying after overload
    if (elapsedSeconds >= OVERLOAD_TIMEOUT_SECONDS) {
      setElapsedSeconds(0);
      elapsedSecondsRef.current = 0;
    }
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
      // Resume 20s polling cycle if within 180s threshold
      if (elapsedSecondsRef.current < OVERLOAD_TIMEOUT_SECONDS) {
        pollingRef.current = setTimeout(async () => {
          if (elapsedSecondsRef.current >= OVERLOAD_TIMEOUT_SECONDS) return;
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
    }
  };

  // Initial probe on mount: strictly ping before allowing any children to render
  useEffect(() => {
    let isMounted = true;

    // Grace period timer: if ping takes > 400ms or fails, show wakeup modal
    const graceTimer = setTimeout(() => {
      if (isMounted) {
        startWakingUpSequence();
      }
    }, 400);

    pingServer().then((isWarm) => {
      if (!isMounted) return;
      clearTimeout(graceTimer);

      if (isWarm) {
        setIsServerAwake(true);
        setShowModal(false);
        setIsWakingUp(false);
      } else {
        // Server down or cold starting!
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

    // Overload state when waiting more than 180 seconds
    const isOverloaded = elapsedSeconds >= OVERLOAD_TIMEOUT_SECONDS && !wakeSuccess;

    return (
      <ServerWakeupContext.Provider
        value={{
          isServerAwake,
          isChecking: isWakingUp,
          checkServerHealth: pingServer,
        }}
      >
        {/* Strictly ping first: only mount and render children when server is awake */}
        {isServerAwake ? children : null}

        {/* Initial lightweight screen while waiting for the first ping */}
        {!isServerAwake && !showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm select-none">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
              <span>Đang kiểm tra kết nối hệ thống...</span>
            </div>
          </div>
        )}

        {/* Modern Enforced Server Wake-up Modal Overlay */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg select-none animate-in fade-in duration-300">
            <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden text-center">
              {/* Top glowing ambient gradient */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 transition-all duration-500 ${
                  wakeSuccess
                    ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]'
                    : isOverloaded
                    ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.7)]'
                    : 'bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-500 animate-pulse'
                }`}
              />

              {/* Animated Status Icon */}
              <div className="relative mx-auto my-4 w-20 h-20 flex items-center justify-center">
                {wakeSuccess ? (
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 animate-in zoom-in-75 duration-300">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                ) : isOverloaded ? (
                  <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20">
                    <AlertTriangle className="w-8 h-8 text-rose-400" />
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
                {wakeSuccess
                  ? 'Kết nối thành công!'
                  : isOverloaded
                  ? 'Hệ thống đang quá tải'
                  : 'Đang chuẩn bị hệ thống...'}
              </h3>

              <div className="mt-2 text-sm text-zinc-300 leading-relaxed">
                {wakeSuccess ? (
                  <span className="text-emerald-400 font-medium">
                    Đã sẵn sàng! Đang chuyển bạn vào ứng dụng...
                  </span>
                ) : isOverloaded ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-zinc-200">
                      Hệ thống đang quá tải, vui lòng quay lại sau.
                    </p>
                    <p className="text-zinc-400 text-xs">
                      Lượng truy cập hiện đang vượt quá công suất phục vụ. Xin lỗi bạn vì sự bất tiện này!
                    </p>
                  </div>
                ) : (
                  <>
                    Hệ thống đang khởi động lại sau thời gian nghỉ.
                    <br />
                    <span className="text-zinc-300 font-medium">
                      Bạn đợi một chút nhé, hệ thống sẽ tự động kết nối lại sau vài giây.
                    </span>
                  </>
                )}
              </div>

              {/* Metrics & Countdown Progress Bar */}
              {!wakeSuccess && !isOverloaded && (
                <div className="mt-6 space-y-2.5">
                  <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5 text-xs text-zinc-400 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isPinging ? 'animate-spin' : ''}`} />
                      <span>
                        {isPinging ? (
                          <strong className="text-indigo-400">Đang kiểm tra kết nối...</strong>
                        ) : (
                          <span>
                            Tự động thử lại sau: <strong className="text-zinc-200">{countdownSeconds}s</strong>
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="font-mono text-zinc-300">
                      Đã đợi: <strong className="text-amber-400">{elapsedSeconds}s</strong>
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

              {/* Overload notification box */}
              {isOverloaded && (
                <div className="mt-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Đã tạm dừng tự động kết nối</span>
                  </div>
                  <span className="font-mono text-zinc-300">
                    Đã đợi: <strong className="text-rose-300">{elapsedSeconds}s</strong>
                  </span>
                </div>
              )}

              {/* Overtime notice if elapsed > 60s but not yet 180s */}
              {elapsedSeconds > 60 && !isOverloaded && !wakeSuccess && (
                <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 text-left">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Hệ thống đang tải dữ liệu đề thi. Vui lòng giữ nguyên màn hình hoặc bấm nút bên dưới để thử lại.
                  </span>
                </div>
              )}

              {/* Action button */}
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
                      : isOverloaded
                      ? 'bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white shadow-lg shadow-rose-600/30'
                      : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-lg shadow-indigo-600/30'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
                  {wakeSuccess
                    ? 'Đã kết nối thành công'
                    : isPinging
                    ? 'Đang kết nối...'
                    : 'Thử lại ngay'}
                </button>
              </div>
          </div>
        </div>
      )}
    </ServerWakeupContext.Provider>
  );
}
