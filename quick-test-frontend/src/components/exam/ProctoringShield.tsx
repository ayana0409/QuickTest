'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import {
  connectWebSocket,
  sendWebSocketMessage,
  subscribeTopic,
} from '@/lib/socket';
import type {
  ViolationType,
  ViolationTelemetryMessage,
  ViolationAlertResponse,
  HeartbeatMessage,
  ProctoringSettings,
} from '@/types/proctoring';
import { DEFAULT_PROCTORING_SETTINGS } from '@/types/proctoring';
import { cn } from '@/lib/utils';

interface ProctoringShieldProps {
  attemptId: string;
  children: React.ReactNode;
  onViolation: (type: ViolationType, description: string) => void;
  onServerAlert: (alert: ViolationAlertResponse) => void;
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
  children,
  onViolation,
  onServerAlert,
  isExamActive = true,
  settings = DEFAULT_PROCTORING_SETTINGS,
}) => {
  const onViolationRef = useRef(onViolation);
  const onServerAlertRef = useRef(onServerAlert);

  const isMasterEnabled = isExamActive && settings.enabled;

  // Keep latest callback references
  useEffect(() => {
    onViolationRef.current = onViolation;
    onServerAlertRef.current = onServerAlert;
  }, [onViolation, onServerAlert]);

  // Dispatch violation telemetry to WebSocket and parent handler
  const reportViolation = useCallback(
    (type: ViolationType, description: string) => {
      if (!isMasterEnabled) return;

      const payload: ViolationTelemetryMessage = {
        attemptId,
        violationType: type,
        description,
        clientTimestamp: new Date().toISOString(),
      };

      sendWebSocketMessage('/app/proctoring/violation', payload);
      onViolationRef.current(type, description);
    },
    [attemptId, isMasterEnabled]
  );

  // 1. Setup STOMP WebSocket connection and alert subscription
  useEffect(() => {
    if (!attemptId || !isExamActive) return;

    const subscriptions: Array<{ unsubscribe: () => void }> = [];

    const handleIncomingAlert = (messageBody: string) => {
      try {
        const alert = JSON.parse(messageBody) as ViolationAlertResponse;
        if (alert.attemptId === attemptId) {
          if (isMasterEnabled) {
            onServerAlertRef.current(alert);
          }
        }
      } catch (err) {
        console.error('[ProctoringShield] Failed to parse alert message:', err);
      }
    };

    connectWebSocket(
      null,
      () => {
        // 1. Attempt broadcast channel: /topic/attempts/{attemptId}/proctoring
        const attemptSub = subscribeTopic(`/topic/attempts/${attemptId}/proctoring`, (message) => {
          handleIncomingAlert(message.body);
        });
        if (attemptSub) subscriptions.push(attemptSub);

        // 2. User specific point-to-point queue: /user/queue/proctoring/alert
        const userSub = subscribeTopic('/user/queue/proctoring/alert', (message) => {
          handleIncomingAlert(message.body);
        });
        if (userSub) subscriptions.push(userSub);

        // 3. Fallback queue: /user/queue/alerts
        const fallbackSub = subscribeTopic('/user/queue/alerts', (message) => {
          handleIncomingAlert(message.body);
        });
        if (fallbackSub) subscriptions.push(fallbackSub);
      },
      (error) => {
        console.warn('[ProctoringShield] STOMP connection error:', error);
      }
    );

    return () => {
      subscriptions.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch {
          // Ignored
        }
      });
    };
  }, [attemptId, isExamActive, isMasterEnabled]);

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
        'Thao tác nhấp chuột phải (Context menu) bị cấm trong phòng thi.'
      );
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Thao tác sao chép nội dung (Copy) bị cấm trong phòng thi.'
      );
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Thao tác cắt nội dung (Cut) bị cấm trong phòng thi.'
      );
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        'COPY_PASTE_ATTEMPT',
        'Thao tác dán nội dung từ bên ngoài (Paste) bị cấm trong phòng thi.'
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
        reportViolation('DEVTOOLS_OPEN', 'Cố gắng mở công cụ kiểm tra phần tử (DevTools).');
        return;
      }

      // Ctrl+U (View Source)
      if (isCtrlOrCmd && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation('DEVTOOLS_OPEN', 'Cố gắng xem mã nguồn trang web (Ctrl+U).');
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
