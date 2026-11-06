'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { WifiOff, MonitorX, RefreshCw, LogOut } from 'lucide-react';
import { sendWebSocketMessage } from '@/lib/socket';
import { ProctoringRealtimeManager } from '@/lib/realtime/ProctoringRealtimeManager';
import { candidateSessionService } from '@/services/candidateSession.service';
import { getOrCreateExamSessionToken } from '@/lib/sessionFingerprint';
import type {
  ViolationType,
  ViolationTelemetryMessage,
  ViolationAlertResponse,
  HeartbeatMessage,
  ProctoringSettings,
  ProctoringEvent,
} from '@/types/proctoring';
import { DEFAULT_PROCTORING_SETTINGS } from '@/types/proctoring';
import { cn } from '@/lib/utils';

const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

interface ProctoringShieldProps {
  attemptId: string;
  examId?: string;
  /** JWT token for QuickNotify WebSocket connection */
  realtimeToken?: string;
  /** WebSocket URL for QuickNotify Hub */
  realtimeWsUrl?: string;
  children: React.ReactNode;
  onViolation: (type: ViolationType, description: string) => void;
  onServerAlert: (alert: ViolationAlertResponse) => void;
  onExamClosed?: (message?: string) => void;
  onSessionEvicted?: (message?: string) => void;
  isExamActive?: boolean;
  settings?: ProctoringSettings;
}

/**
 * ProctoringShield Component:
 * Wraps the entire exam layout to enforce integrity rules:
 * 1. Master Switch: Toggle proctoring completely on or off.
 * 2. Blocks right-click context menu, text selection, drag-and-drop, and copy-paste.
 * 3. Blocks developer tools key combinations (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+P).
 * 4. Monitors tab switching (Page Visibility API) and fullscreen exit events.
 * 5. Transmits telemetry to backend via STOMP WebSocket (/app/proctoring/violation & /app/proctoring/heartbeat).
 * 6. Listens to candidate proctoring alerts (/topic/attempts/{attemptId}/proctoring & /user/queue/proctoring/alert).
 */
export const ProctoringShield: React.FC<ProctoringShieldProps> = ({
  attemptId,
  examId,
  realtimeToken,
  realtimeWsUrl,
  children,
  onViolation,
  onServerAlert,
  onExamClosed,
  onSessionEvicted,
  isExamActive = true,
  settings = DEFAULT_PROCTORING_SETTINGS,
}) => {
  const onViolationRef = useRef(onViolation);
  const onServerAlertRef = useRef(onServerAlert);
  const onExamClosedRef = useRef(onExamClosed);
  const onSessionEvictedRef = useRef(onSessionEvicted);

  const [isSessionEvicted, setIsSessionEvicted] = useState(false);
  const [evictionMessage, setEvictionMessage] = useState<string>(
    'Phiên thi của bạn đã được mở trên một thiết bị hoặc trình duyệt khác. Phiên hiện tại đã bị khóa để đảm bảo tính độc quyền của bài thi.'
  );
  const [isNetworkOffline, setIsNetworkOffline] = useState(false);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const consecutiveHeartbeatFailuresRef = useRef(0);

  const isMasterEnabled = isExamActive && settings.enabled && !isSessionEvicted;

  // Keep latest callback references
  useEffect(() => {
    onViolationRef.current = onViolation;
    onServerAlertRef.current = onServerAlert;
    onExamClosedRef.current = onExamClosed;
    onSessionEvictedRef.current = onSessionEvicted;
  }, [onViolation, onServerAlert, onExamClosed, onSessionEvicted]);

  const triggerSessionEviction = useCallback((msg?: string) => {
    setIsSessionEvicted((prev) => {
      if (prev) return prev;
      const resolvedMsg =
        msg ||
        'Phiên thi của bạn đã được mở trên một thiết bị hoặc trình duyệt khác. Phiên hiện tại đã bị khóa để đảm bảo tính độc quyền của bài thi.';
      setEvictionMessage(resolvedMsg);
      onSessionEvictedRef.current?.(resolvedMsg);
      return true;
    });
  }, []);

  // Dispatch violation telemetry to REST API (Redis in-RAM buffer) with STOMP fallback
  const reportViolation = useCallback(
    (type: ViolationType, description: string) => {
      if (!isMasterEnabled || isSessionEvicted || isNetworkOffline) return;

      const payload: ViolationTelemetryMessage = {
        attemptId,
        violationType: type,
        description,
        clientTimestamp: new Date().toISOString(),
      };

      // 1. Primary ingestion: Zero-DB HTTP POST to Redis RAM buffer
      candidateSessionService
        .reportViolation(attemptId, {
          attemptId,
          violationType: type,
          description,
          clientTimestamp: payload.clientTimestamp,
        })
        .catch((err: any) => {
          const status = err?.response?.status;
          const errMsg = String(err?.response?.data?.message || err?.message || '');
          if (status === 409 || errMsg.includes('SESSION_EVICTED')) {
            triggerSessionEviction(errMsg.replace('SESSION_EVICTED:', '').trim());
            return;
          }

          console.warn(
            '[ProctoringShield] HTTP violation ingestion failed, sending fallback STOMP message:',
            err
          );
          // 2. Secondary fallback via STOMP
          sendWebSocketMessage('/app/proctoring/violation', payload);
        });

      onViolationRef.current(type, description);
    },
    [attemptId, isMasterEnabled, isSessionEvicted, isNetworkOffline, triggerSessionEviction]
  );

  // 1. Dual-layer Realtime Connection (QuickNotify Primary + STOMP Fallback)
  useEffect(() => {
    if (!attemptId || !isExamActive || isSessionEvicted) return;

    const manager = new ProctoringRealtimeManager({
      quickNotifyWsUrl:
        realtimeWsUrl ||
        process.env.NEXT_PUBLIC_QUICKNOTIFY_WS_URL ||
        'ws://localhost:8080/ws',
      quickNotifyToken: realtimeToken || '',
      role: 'candidate',
      attemptId,
      examId,
    });

    const unsubscribe = manager.subscribe((event: ProctoringEvent) => {
      // Intercept Single Active Session eviction signal
      if (event.eventType === 'SESSION_EVICTED') {
        const myToken = getOrCreateExamSessionToken();
        const activeToken = event.data?.activeSessionToken;
        const evictedToken = event.data?.evictedSessionToken;

        if (
          (evictedToken && myToken === evictedToken) ||
          (activeToken && myToken && myToken !== activeToken)
        ) {
          triggerSessionEviction(event.data?.message);
        }
        return;
      }

      // Intercept exam closure / auto-submit broadcast
      if (event.eventType === 'EXAM_CLOSED' || event.data.action === 'AUTO_SUBMIT') {
        onExamClosedRef.current?.(
          event.data.message || event.data.reason || 'Bài thi của bạn đã bị kết thúc.'
        );
        return;
      }

      // Handle candidate violation alert
      if (
        event.eventType === 'VIOLATION_ALERT' ||
        event.eventType === 'CANDIDATE_DISQUALIFIED'
      ) {
        if (isMasterEnabled) {
          onServerAlertRef.current(event.data as ViolationAlertResponse);
        }
      }
    });

    manager.connect();

    return () => {
      unsubscribe();
      manager.disconnect();
    };
  }, [
    attemptId,
    examId,
    isExamActive,
    isMasterEnabled,
    isSessionEvicted,
    realtimeToken,
    realtimeWsUrl,
    triggerSessionEviction,
  ]);

  // 2. Periodic Heartbeat (every 15 seconds, 60s Redis TTL) + Network Connectivity Monitor
  const sendHeartbeatPulse = useCallback(async () => {
    if (!attemptId || !isUUID(attemptId) || !isExamActive || isSessionEvicted) {
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsNetworkOffline(true);
      return;
    }

    try {
      await candidateSessionService.sendHeartbeat(attemptId);
      consecutiveHeartbeatFailuresRef.current = 0;
      setIsNetworkOffline(false);
    } catch (err: any) {
      const status = err?.response?.status;
      const errMsg = String(err?.response?.data?.message || err?.message || '');

      // Check if session was evicted by another browser/device
      if (status === 409 || errMsg.includes('SESSION_EVICTED')) {
        triggerSessionEviction(errMsg.replace('SESSION_EVICTED:', '').trim());
        return;
      }

      // Network unreachable (no HTTP response received)
      if (!err?.response) {
        consecutiveHeartbeatFailuresRef.current += 1;
        if (
          consecutiveHeartbeatFailuresRef.current >= 2 ||
          (typeof navigator !== 'undefined' && !navigator.onLine)
        ) {
          setIsNetworkOffline(true);
        }
      }

      // Fallback STOMP heartbeat if available
      const isoNow = new Date().toISOString();
      const heartbeatPayload: HeartbeatMessage = {
        attemptId,
        clientTimestamp: isoNow,
        timestamp: isoNow,
        tabActive: typeof document !== 'undefined' ? !document.hidden : true,
        fullscreenActive: typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
      };
      sendWebSocketMessage('/app/proctoring/heartbeat', heartbeatPayload);
    }
  }, [attemptId, isExamActive, isSessionEvicted, triggerSessionEviction]);

  useEffect(() => {
    if (!attemptId || !isUUID(attemptId) || !isExamActive || isSessionEvicted) return;

    // Send initial heartbeat immediately on mount so candidate appears Online right away
    sendHeartbeatPulse();

    // Send heartbeat every 15 seconds (Redis TTL = 60s)
    const intervalId = setInterval(() => {
      sendHeartbeatPulse();
    }, 15000);

    const handleOffline = () => {
      setIsNetworkOffline(true);
    };

    const handleOnline = () => {
      sendHeartbeatPulse();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [attemptId, isExamActive, isSessionEvicted, sendHeartbeatPulse]);

  const handleManualReconnectCheck = async () => {
    setIsCheckingNetwork(true);
    try {
      await sendHeartbeatPulse();
    } finally {
      setIsCheckingNetwork(false);
    }
  };

  // 3. Tab Visibility & Window Focus Listener (Toggleable)
  useEffect(() => {
    if (!isMasterEnabled || !settings.detectTabSwitch) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation(
          'TAB_SWITCH',
          'Thí sinh đã chuyển tab hoặc thu nhỏ cửa sổ làm bài thi.'
        );
      }
    };

    const handleWindowBlur = () => {
      if (document.hidden) {
        return;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isMasterEnabled, settings.detectTabSwitch, reportViolation]);

  // 4. Fullscreen Change Listener (Toggleable)
  useEffect(() => {
    if (!isMasterEnabled || !settings.detectFullscreenExit) return;

    let hasBeenFullscreen = Boolean(document.fullscreenElement);

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        hasBeenFullscreen = true;
      } else if (hasBeenFullscreen) {
        reportViolation(
          'EXIT_FULLSCREEN',
          'Thí sinh đã thoát chế độ toàn màn hình trong khi làm bài thi.'
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isMasterEnabled, settings.detectFullscreenExit, reportViolation]);

  // 5. Anti-Cheat DOM Event Listeners: Context menu, Copy/Paste, Drag (Toggleable)
  useEffect(() => {
    if (!isMasterEnabled || !settings.blockCopyPaste) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Thao tác mở menu chuột phải trong lúc thi.'
      );
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Thao tác sao chép nội dung trong lúc thi.'
      );
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Thao tác cắt nội dung trong lúc thi.'
      );
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Thao tác dán nội dung trong lúc thi.'
      );
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [isMasterEnabled, settings.blockCopyPaste, reportViolation]);

  // 6. DevTools and Source Viewing Keyboard Blockers (Toggleable)
  useEffect(() => {
    if (!isMasterEnabled || !settings.blockDevTools) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // F12 key
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        reportViolation('DEVTOOLS_OPEN', 'Cố gắng mở công cụ nhà phát triển (F12).');
        return;
      }

      // Ctrl+Shift+I / Cmd+Opt+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (
        isCtrlOrCmd &&
        e.shiftKey &&
        (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')
      ) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation('DEVTOOLS_OPEN', 'Cố gắng mở công cụ kiểm tra phần tử.');
        return;
      }

      // Ctrl+U (View Source)
      if (isCtrlOrCmd && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation('DEVTOOLS_OPEN', 'Cố gắng xem mã nguồn trang web.');
        return;
      }

      // Ctrl+S (Save Page)
      if (isCtrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl+P (Print)
      if (isCtrlOrCmd && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isMasterEnabled, settings.blockDevTools, reportViolation]);

  // Listen to custom session-evicted event dispatched from autoSaveAnswer 409 responses
  useEffect(() => {
    const handleCustomEvicted = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      triggerSessionEviction(customEvent.detail?.message);
    };
    window.addEventListener('quicktest:session-evicted', handleCustomEvicted);
    return () => {
      window.removeEventListener('quicktest:session-evicted', handleCustomEvicted);
    };
  }, [triggerSessionEviction]);

  const blockSelection = isMasterEnabled && settings.blockCopyPaste;

  return (
    <div
      className={cn('relative w-full h-full', blockSelection ? 'select-none' : 'select-auto')}
      style={{
        WebkitUserSelect: blockSelection ? 'none' : 'auto',
        userSelect: blockSelection ? 'none' : 'auto',
      }}
    >
      {/* Blur exam content when offline or evicted to prevent offline reading/solving */}
      <div
        className={cn(
          'w-full h-full transition-all duration-200',
          (isNetworkOffline || isSessionEvicted) && 'blur-xl pointer-events-none select-none'
        )}
      >
        {children}
      </div>

      {/* 1. Single Active Session Eviction Lockout Overlay */}
      {isSessionEvicted && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 select-none animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#161B22] border border-amber-500/40 shadow-2xl p-6 sm:p-8 text-center text-zinc-100">
            <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <MonitorX className="w-8 h-8" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
              Độc quyền Phiên Thi (Single Active Session)
            </span>

            <h2 className="text-xl font-bold text-[#E6EDF3] tracking-tight mb-2">
              Phiên làm bài đã chuyển sang thiết bị khác
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
              {evictionMessage}
            </p>

            <div className="rounded-xl bg-[#0D1117] border border-[#30363D] p-3.5 text-left text-xs text-zinc-400 mb-6 space-y-1">
              <p className="font-semibold text-zinc-200">Lưu ý bảo mật:</p>
              <p>• Các câu trả lời bạn đã chọn trước đó vẫn được bảo toàn trên hệ thống.</p>
              <p>• Vui lòng tiếp tục làm bài trên trình duyệt hoặc thiết bị mới vừa đăng nhập.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full py-3 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm shadow-lg shadow-amber-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Thoát trang này
            </button>
          </div>
        </div>
      )}

      {/* 2. Offline Anti-Cheat Lockout Shield (Prevents unplugging WiFi/LAN to solve offline) */}
      {isNetworkOffline && !isSessionEvicted && isExamActive && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 select-none animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#161B22] border border-rose-500/40 shadow-2xl p-6 sm:p-8 text-center text-zinc-100">
            <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <WifiOff className="w-8 h-8 animate-pulse" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-3">
              Cảnh báo Mất kết nối Mạng
            </span>

            <h2 className="text-xl font-bold text-[#E6EDF3] tracking-tight mb-2">
              Tạm khóa màn hình thi do mất kết nối
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
              Hệ thống phát hiện thiết bị của bạn bị ngắt kết nối mạng. Để đảm bảo công bằng và ngăn chặn làm bài ngoại tuyến (Offline), nội dung câu hỏi sẽ tạm ẩn cho đến khi kết nối mạng được khôi phục.
            </p>

            <div className="rounded-xl bg-[#0D1117] border border-[#30363D] p-3.5 text-left text-xs text-zinc-400 mb-6 space-y-1">
              <p className="font-semibold text-zinc-200">Hướng dẫn xử lý:</p>
              <p>• Kiểm tra lại kết nối Wi-Fi hoặc dây mạng LAN của bạn.</p>
              <p>• Màn hình làm bài sẽ tự động mở khóa ngay khi có mạng trở lại.</p>
            </div>

            <button
              type="button"
              onClick={handleManualReconnectCheck}
              disabled={isCheckingNetwork}
              className="w-full py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={cn('w-4 h-4', isCheckingNetwork && 'animate-spin')} />
              {isCheckingNetwork ? 'Đang kiểm tra kết nối...' : 'Thử kết nối lại ngay'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
