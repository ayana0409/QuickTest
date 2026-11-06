'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { sendWebSocketMessage } from '@/lib/socket';
import { ProctoringRealtimeManager } from '@/lib/realtime/ProctoringRealtimeManager';
import { candidateSessionService } from '@/services/candidateSession.service';
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
  isExamActive = true,
  settings = DEFAULT_PROCTORING_SETTINGS,
}) => {
  const onViolationRef = useRef(onViolation);
  const onServerAlertRef = useRef(onServerAlert);
  const onExamClosedRef = useRef(onExamClosed);

  const isMasterEnabled = isExamActive && settings.enabled;

  // Keep latest callback references
  useEffect(() => {
    onViolationRef.current = onViolation;
    onServerAlertRef.current = onServerAlert;
    onExamClosedRef.current = onExamClosed;
  }, [onViolation, onServerAlert, onExamClosed]);

  // Dispatch violation telemetry to REST API (Redis in-RAM buffer) with STOMP fallback
  const reportViolation = useCallback(
    (type: ViolationType, description: string) => {
      if (!isMasterEnabled) return;

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
        .catch((err) => {
          console.warn(
            '[ProctoringShield] HTTP violation ingestion failed, sending fallback STOMP message:',
            err
          );
          // 2. Secondary fallback via STOMP
          sendWebSocketMessage('/app/proctoring/violation', payload);
        });

      onViolationRef.current(type, description);
    },
    [attemptId, isMasterEnabled]
  );

  // 1. Dual-layer Realtime Connection (QuickNotify Primary + STOMP Fallback)
  useEffect(() => {
    if (!attemptId || !isExamActive) return;

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
  }, [attemptId, examId, isExamActive, isMasterEnabled, realtimeToken, realtimeWsUrl]);

  // 2. Periodic Heartbeat (every 30 seconds)
  useEffect(() => {
    if (!attemptId || !isExamActive) return;

    const intervalId = setInterval(() => {
      const isTabActive = !document.hidden;
      const isFullscreenActive = Boolean(document.fullscreenElement);
      const isoNow = new Date().toISOString();

      const heartbeatPayload: HeartbeatMessage = {
        attemptId,
        clientTimestamp: isoNow,
        timestamp: isoNow,
        tabActive: isTabActive,
        fullscreenActive: isFullscreenActive,
      };

      sendWebSocketMessage('/app/proctoring/heartbeat', heartbeatPayload);
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [attemptId, isExamActive]);

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

  const blockSelection = isMasterEnabled && settings.blockCopyPaste;

  return (
    <div
      className={cn('relative w-full h-full', blockSelection ? 'select-none' : 'select-auto')}
      style={{
        WebkitUserSelect: blockSelection ? 'none' : 'auto',
        userSelect: blockSelection ? 'none' : 'auto',
      }}
    >
      {children}
    </div>
  );
};
