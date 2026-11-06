'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  WifiOff,
  MonitorX,
  RefreshCw,
  LogOut,
  EyeOff,
  MousePointerClick,
  AlertTriangle,
  Monitor,
} from 'lucide-react';
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

  // Dual-monitor & Focus Guard states
  const [isFocusLostShieldOpen, setIsFocusLostShieldOpen] = useState(false);
  const [focusLossCount, setFocusLossCount] = useState<number>(() => {
    if (typeof window !== 'undefined' && attemptId) {
      const saved = sessionStorage.getItem(`quicktest_focus_loss_${attemptId}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    }
    return 0;
  });
  const focusLossCountRef = useRef<number>(focusLossCount);
  const [isMultiScreenDetected, setIsMultiScreenDetected] = useState(false);
  const isInBlurEpisodeRef = useRef(false);
  const hasReportedTabSwitchInEpisodeRef = useRef(false);
  const hasReportedMultiScreenRef = useRef(false);
  const blurCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    focusLossCountRef.current = focusLossCount;
  }, [focusLossCount]);

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
        'Bài thi của bạn vừa được mở trên một trình duyệt hoặc thiết bị khác. Để đảm bảo tính bảo mật và công bằng, phiên làm bài tại cửa sổ này đã dừng lại.';
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
        .then((alert) => {
          if (alert) {
            onServerAlertRef.current(alert);
          }
        })
        .catch((err: any) => {
          const status = err?.response?.status;
          const errMsg = String(err?.response?.data?.message || err?.message || '');
          if (status === 409 || errMsg.includes('SESSION_EVICTED')) {
            triggerSessionEviction(errMsg.replace('SESSION_EVICTED:', '').trim());
            return;
          }

          // If attempt is already finalized/disqualified (400 Bad Request), do not spam STOMP fallback
          if (status === 400) {
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

  // 3. Tab Visibility, Window Focus, 1-Second hasFocus() Polling & Multi-Screen Detection
  const registerWindowBlurStrike = useCallback(() => {
    if (!isMasterEnabled || isSessionEvicted || isNetworkOffline) return;

    const nextCount = focusLossCountRef.current + 1;
    focusLossCountRef.current = nextCount;
    setFocusLossCount(nextCount);

    try {
      if (typeof window !== 'undefined' && attemptId) {
        sessionStorage.setItem(`quicktest_focus_loss_${attemptId}`, String(nextCount));
      }
    } catch {
      // Ignore storage errors
    }

    // Every 3 focus losses counts as 1 official WINDOW_BLUR violation
    if (nextCount % 3 === 0) {
      reportViolation(
        'WINDOW_BLUR',
        `Rời khỏi cửa sổ bài thi ${nextCount} lần.`
      );
    }
  }, [attemptId, isMasterEnabled, isNetworkOffline, isSessionEvicted, reportViolation]);

  const triggerFocusLossEpisode = useCallback(
    (reason: 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'POLL_HAS_FOCUS') => {
      if (!isMasterEnabled || isSessionEvicted || isNetworkOffline) return;

      // Immediately activate the anti-cheat shield to cover the exam paper
      setIsFocusLostShieldOpen(true);

      if (reason === 'TAB_HIDDEN') {
        if (!hasReportedTabSwitchInEpisodeRef.current) {
          hasReportedTabSwitchInEpisodeRef.current = true;
          isInBlurEpisodeRef.current = true;
          if (blurCheckTimerRef.current) {
            clearTimeout(blurCheckTimerRef.current);
            blurCheckTimerRef.current = null;
          }
          reportViolation(
            'TAB_SWITCH',
            'Chuyển sang tab khác hoặc thu nhỏ cửa sổ trình duyệt.'
          );
        }
        return;
      }

      // If already in a blur episode, ignore duplicate blur/poll events until user clicks Resume
      if (isInBlurEpisodeRef.current) {
        return;
      }

      isInBlurEpisodeRef.current = true;

      // Wait 150ms to distinguish between a pure window blur (e.g. clicking on 2nd monitor)
      // and a tab switch where document.hidden becomes true right after blur
      if (blurCheckTimerRef.current) {
        clearTimeout(blurCheckTimerRef.current);
      }
      blurCheckTimerRef.current = setTimeout(() => {
        if (typeof document !== 'undefined' && document.hidden) {
          if (!hasReportedTabSwitchInEpisodeRef.current) {
            hasReportedTabSwitchInEpisodeRef.current = true;
            reportViolation(
              'TAB_SWITCH',
              'Chuyển sang tab khác hoặc thu nhỏ cửa sổ trình duyệt.'
            );
          }
        } else {
          registerWindowBlurStrike();
        }
      }, 150);
    },
    [isMasterEnabled, isNetworkOffline, isSessionEvicted, registerWindowBlurStrike, reportViolation]
  );

  // Resume handler when candidate explicitly clicks back into the exam shield
  const handleResumeFromFocusShield = useCallback(async () => {
    isInBlurEpisodeRef.current = false;
    hasReportedTabSwitchInEpisodeRef.current = false;
    if (blurCheckTimerRef.current) {
      clearTimeout(blurCheckTimerRef.current);
      blurCheckTimerRef.current = null;
    }
    setIsFocusLostShieldOpen(false);
    if (typeof window !== 'undefined') {
      window.focus();
    }
    // Re-enter fullscreen automatically on resume click if fullscreen enforcement is enabled
    if (
      settings.detectFullscreenExit &&
      typeof document !== 'undefined' &&
      !document.fullscreenElement &&
      typeof document.documentElement?.requestFullscreen === 'function'
    ) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Ignored if browser denies fullscreen
      }
    }
  }, [settings.detectFullscreenExit]);

  useEffect(() => {
    if (!isMasterEnabled || !settings.detectTabSwitch) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerFocusLossEpisode('TAB_HIDDEN');
      }
    };

    const handleWindowBlur = () => {
      if (document.hidden) {
        triggerFocusLossEpisode('TAB_HIDDEN');
      } else {
        triggerFocusLossEpisode('WINDOW_BLUR');
      }
    };

    // Multi-screen check via Screen Enumeration API (window.screen.isExtended)
    // Displays warning banner & warning modal without deducting candidate's violation quota
    const checkMultiScreen = () => {
      if (typeof window === 'undefined' || !window.screen) return;
      const isExtended = Boolean((window.screen as any).isExtended);
      setIsMultiScreenDetected(isExtended);

      if (isExtended && !hasReportedMultiScreenRef.current) {
        hasReportedMultiScreenRef.current = true;
        onViolationRef.current(
          'MULTI_SCREEN_DETECTED',
          'Lưu ý: Thiết bị của bạn đang kết nối từ 2 màn hình trở lên. Vui lòng chỉ làm bài trên một màn hình duy nhất trong suốt thời gian thi.'
        );
      } else if (!isExtended && hasReportedMultiScreenRef.current) {
        hasReportedMultiScreenRef.current = false;
      }
    };

    checkMultiScreen();

    // 1-second periodic polling of document.hasFocus() and multi-screen state
    const focusPollInterval = setInterval(() => {
      if (typeof document !== 'undefined') {
        if (document.hidden) {
          triggerFocusLossEpisode('TAB_HIDDEN');
        } else if (!document.hasFocus()) {
          triggerFocusLossEpisode('POLL_HAS_FOCUS');
        }
      }
      checkMultiScreen();
    }, 1000);

    const screenObj = typeof window !== 'undefined' ? (window.screen as any) : null;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    if (screenObj && typeof screenObj.addEventListener === 'function') {
      screenObj.addEventListener('change', checkMultiScreen);
    }

    return () => {
      clearInterval(focusPollInterval);
      if (blurCheckTimerRef.current) {
        clearTimeout(blurCheckTimerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      if (screenObj && typeof screenObj.removeEventListener === 'function') {
        screenObj.removeEventListener('change', checkMultiScreen);
      }
    };
  }, [isMasterEnabled, settings.detectTabSwitch, triggerFocusLossEpisode, reportViolation]);

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
          'Thoát khỏi chế độ toàn màn hình.'
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
        'Mở menu chuột phải trong bài thi.'
      );
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Sao chép nội dung bài thi.'
      );
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Cắt nội dung câu hỏi bài thi.'
      );
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Dán nội dung vào bài làm.'
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
        reportViolation('DEVTOOLS_OPEN', 'Mở công cụ phát triển / kiểm tra mã (F12).');
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
        reportViolation('DEVTOOLS_OPEN', 'Mở bảng điều khiển kiểm tra phần tử.');
        return;
      }

      // Ctrl+U (View Source)
      if (isCtrlOrCmd && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation('DEVTOOLS_OPEN', 'Xem mã nguồn trang thi.');
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
  const currentBlurStrikeInCycle =
    focusLossCount === 0 ? 0 : focusLossCount % 3 === 0 ? 3 : focusLossCount % 3;

  return (
    <div
      className={cn('relative w-full h-full', blockSelection ? 'select-none' : 'select-auto')}
      style={{
        WebkitUserSelect: blockSelection ? 'none' : 'auto',
        userSelect: blockSelection ? 'none' : 'auto',
      }}
    >
      {/* Persistent Multi-Monitor Warning Banner */}
      {isMultiScreenDetected && isMasterEnabled && !isSessionEvicted && (
        <div className="sticky top-0 z-[9990] w-full bg-amber-500/95 text-zinc-950 px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg">
          <Monitor className="w-4 h-4 shrink-0" />
          <span>
            Lưu ý: Thiết bị của bạn đang kết nối từ 2 màn hình trở lên. Vui lòng chỉ thao tác trong cửa sổ bài thi để tránh bị tính vi phạm quy chế.
          </span>
        </div>
      )}

      {/* Blur exam content when offline, evicted, or window lost focus to prevent reading/solving on 2nd monitor */}
      <div
        className={cn(
          'w-full h-full transition-all duration-150',
          (isNetworkOffline || isSessionEvicted || (isFocusLostShieldOpen && isMasterEnabled)) &&
          'blur-xl pointer-events-none select-none'
        )}
      >
        {children}
      </div>

      {/* 0. Focus Lost Anti-Cheat Shield (Blocks dual-monitor looking & typing) */}
      {isFocusLostShieldOpen && isMasterEnabled && !isSessionEvicted && !isNetworkOffline && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 select-none animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#161B22] border border-amber-500/50 shadow-2xl p-6 sm:p-8 text-center text-zinc-100">
            <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <EyeOff className="w-8 h-8 animate-pulse" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
              <AlertTriangle className="w-3.5 h-3.5" />
              Rời khỏi cửa sổ bài thi
            </span>

            <h2 className="text-xl font-bold text-[#E6EDF3] tracking-tight mb-2">
              Nội dung bài thi đang tạm ẩn
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-5">
              Bạn vừa thao tác ra ngoài cửa sổ làm bài.
            </p>

            {/* 3-Strike Focus Loss Counter */}
            <div className="rounded-xl bg-[#0D1117] border border-[#30363D] p-3.5 text-left text-xs text-zinc-300 mb-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Số lần rời màn hình thi:</span>
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full font-bold',
                    currentBlurStrikeInCycle === 3
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  )}
                >
                  {currentBlurStrikeInCycle} / 3 lần
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                • Quy định: Mỗi <strong className="text-amber-300">3 lần rời khỏi cửa sổ làm bài</strong> = <strong className="text-rose-400">1 lần vi phạm</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResumeFromFocusShield}
              className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <MousePointerClick className="w-4 h-4" />
              Quay lại làm bài thi
            </button>
          </div>
        </div>
      )}

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
              Phát hiện phiên đăng nhập mới
            </span>

            <h2 className="text-xl font-bold text-[#E6EDF3] tracking-tight mb-2">
              Bài thi đang được mở ở một nơi khác
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
              {evictionMessage}
            </p>

            <div className="rounded-xl bg-[#0D1117] border border-[#30363D] p-3.5 text-left text-xs text-zinc-400 mb-6 space-y-1">
              <p className="font-semibold text-zinc-200">Lưu ý:</p>
              <p>• Các câu trả lời trước đó của bạn đã được lưu an toàn trên hệ thống.</p>
              <p>• Bạn vui lòng tiếp tục làm bài trên thiết bị hoặc trình duyệt mới.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full py-3 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm shadow-lg shadow-amber-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Về trang chủ
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
              Mất kết nối Internet
            </span>

            <h2 className="text-xl font-bold text-[#E6EDF3] tracking-tight mb-2">
              Đang gián đoạn kết nối mạng
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
              Hệ thống nhận thấy thiết bị của bạn vừa bị ngắt kết nối Internet. Đề thi tạm thời được che lại để đảm bảo dữ liệu làm bài không bị gián đoạn cho đến khi có mạng trở lại.
            </p>

            <div className="rounded-xl bg-[#0D1117] border border-[#30363D] p-3.5 text-left text-xs text-zinc-400 mb-6 space-y-1">
              <p className="font-semibold text-zinc-200">Hướng dẫn:</p>
              <p>• Vui lòng kiểm tra lại đường truyền Wi-Fi hoặc dây mạng trên thiết bị.</p>
              <p>• Bài thi sẽ tự động mở lại ngay khi kết nối Internet được khôi phục.</p>
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
