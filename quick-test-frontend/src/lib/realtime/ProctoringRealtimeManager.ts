import { Client as StompClient } from '@stomp/stompjs';
import type {
  ProctoringEvent,
  ProctoringEventType,
  QuickNotifyEnvelope,
  RealtimeConnectionStatus,
} from '@/types/proctoring';

export type RealtimeEventHandler = (event: ProctoringEvent) => void;
export type ConnectionStatusHandler = (status: RealtimeConnectionStatus) => void;

export interface RealtimeManagerConfig {
  quickNotifyWsUrl: string;
  quickNotifyToken: string;
  stompBaseUrl?: string;
  role: 'candidate' | 'teacher';
  examId?: string;
  attemptId?: string;
  onStatusChange?: ConnectionStatusHandler;
}

/**
 * ProctoringRealtimeManager:
 * Resilient dual-layer real-time manager providing high-concurrency event delivery:
 * 1. Primary Layer: QuickNotify Go WebSocket Hub (Native WebSocket, sub-millisecond, low RAM).
 * 2. Fallback Layer: Spring Boot STOMP WebSocket (activates automatically on QuickNotify failure).
 * 3. Auto-Recovery: Periodically health-checks QuickNotify and seamlessly falls back up to Primary.
 */
export class ProctoringRealtimeManager {
  private quickNotifySocket: WebSocket | null = null;
  private stompClient: StompClient | null = null;
  private connectionStatus: RealtimeConnectionStatus = 'DISCONNECTED';
  private isUsingFallback = false;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private eventHandlers: Set<RealtimeEventHandler> = new Set();
  private statusHandlers: Set<ConnectionStatusHandler> = new Set();
  private isDestroyed = false;

  private readonly quickNotifyWsUrl: string;
  private readonly quickNotifyToken: string;
  private readonly stompBaseUrl: string;
  private readonly role: 'candidate' | 'teacher';
  private readonly examId?: string;
  private readonly attemptId?: string;

  constructor(config: RealtimeManagerConfig) {
    this.quickNotifyWsUrl = config.quickNotifyWsUrl;
    this.quickNotifyToken = config.quickNotifyToken;
    this.stompBaseUrl =
      config.stompBaseUrl ||
      process.env.NEXT_PUBLIC_WS_URL ||
      'http://localhost:8081/ws-exam';
    this.role = config.role;
    this.examId = config.examId;
    this.attemptId = config.attemptId;

    if (config.onStatusChange) {
      this.statusHandlers.add(config.onStatusChange);
    }
  }

  /**
   * Register listener for incoming proctoring events.
   * Returns an unsubscribe callback.
   */
  public subscribe(handler: RealtimeEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Register listener for connection state transitions.
   */
  public onStatusChange(handler: ConnectionStatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.connectionStatus);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  /**
   * Get current connection status.
   */
  public getStatus(): RealtimeConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Initialize dual-connection lifecycle. Attempts QuickNotify first.
   */
  public connect(): void {
    if (this.isDestroyed) return;
    this.connectQuickNotify();
  }

  /**
   * Cleanly terminate all active sockets, STOMP clients, and timers.
   */
  public disconnect(): void {
    this.isDestroyed = true;
    this.clearConnectTimeout();
    this.clearHealthCheck();

    if (this.quickNotifySocket) {
      const socket = this.quickNotifySocket;
      this.quickNotifySocket = null;
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'Normal teardown');
        } else if (socket.readyState === WebSocket.CONNECTING) {
          // If socket is still establishing handshake (e.g. during React StrictMode remount),
          // defer closure to onopen to prevent native browser red errors:
          // "WebSocket is closed before the connection is established"
          socket.onopen = () => {
            try {
              socket.close(1000, 'Teardown after connect');
            } catch {
              // Ignored
            }
          };
          socket.onerror = () => { };
        } else {
          socket.close();
        }
      } catch {
        // Ignored
      }
    }

    this.teardownStomp();
    this.updateStatus('DISCONNECTED');
  }

  // ─────────────────────────────────────────────────────────────
  // Primary Layer: QuickNotify Go WebSocket Hub
  // ─────────────────────────────────────────────────────────────

  private connectQuickNotify(): void {
    if (this.isDestroyed) return;

    this.clearConnectTimeout();
    this.updateStatus('CONNECTING');

    if (!this.quickNotifyWsUrl || !this.quickNotifyToken) {
      console.warn('[RealtimeManager] QuickNotify config missing. Falling back to STOMP.');
      this.fallbackToStomp();
      return;
    }

    try {
      // Connect to QuickNotify WebSocket hub according to QuickNotify specification (?token=...)
      let socketUrl = this.quickNotifyWsUrl;
      if (!socketUrl.includes('token=') && this.quickNotifyToken) {
        const separator = socketUrl.includes('?') ? '&' : '?';
        socketUrl = `${socketUrl}${separator}token=${encodeURIComponent(this.quickNotifyToken)}`;
      }

      this.quickNotifySocket = new WebSocket(socketUrl);

      // Trigger fallback if connection handshake is not finished within 3000ms
      this.connectTimeoutTimer = setTimeout(() => {
        if (this.quickNotifySocket?.readyState !== WebSocket.OPEN) {
          console.warn('[RealtimeManager] QuickNotify connection timed out after 3000ms.');
          this.fallbackToStomp();
        }
      }, 3000);

      this.quickNotifySocket.onopen = () => {
        this.clearConnectTimeout();
        this.isUsingFallback = false;
        this.teardownStomp();
        this.clearHealthCheck();
        this.updateStatus('CONNECTED_PRIMARY');
        console.info('[RealtimeManager] QuickNotify Primary connected successfully.');
      };

      this.quickNotifySocket.onmessage = (event: MessageEvent) => {
        this.handleQuickNotifyRawMessage(event.data);
      };

      this.quickNotifySocket.onerror = (err) => {
        console.warn('[RealtimeManager] QuickNotify socket error:', err);
        if (!this.isUsingFallback) {
          this.fallbackToStomp();
        }
      };

      this.quickNotifySocket.onclose = (event) => {
        console.info('[RealtimeManager] QuickNotify socket closed (code=' + event.code + ').');
        if (!this.isDestroyed && !this.isUsingFallback) {
          this.fallbackToStomp();
        }
      };
    } catch (err) {
      console.error('[RealtimeManager] Failed to create WebSocket for QuickNotify:', err);
      this.fallbackToStomp();
    }
  }

  /**
   * Parse QuickNotify frame. QuickNotify frames can contain multiple messages
   * delimited by newline characters ('\n').
   */
  private handleQuickNotifyRawMessage(rawData: string): void {
    if (typeof rawData !== 'string') return;

    const lines = rawData.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const envelope: QuickNotifyEnvelope = JSON.parse(trimmed);
        this.dispatchEnvelopeToHandlers(envelope);
      } catch (err) {
        console.warn('[RealtimeManager] Failed to parse QuickNotify JSON envelope:', err, trimmed);
      }
    }
  }

  /**
   * Translate QuickNotify envelope into unified ProctoringEvent and emit to listeners.
   */
  private dispatchEnvelopeToHandlers(envelope: QuickNotifyEnvelope): void {
    const content = envelope.content;
    if (!content?.data) return;

    const eventType = (content.data.eventType || 'VIOLATION_ALERT') as ProctoringEventType;
    const payload = content.data.payload || content.data;

    let resolvedAttemptId = payload.attemptId as string | undefined;
    let eventData: Record<string, any> = payload;

    // Normalize nested payloads dispatched from QuickNotifyDispatcherService
    if (eventType === 'VIOLATION_ALERT' && payload.alert) {
      eventData = {
        ...payload.alert,
        attemptId: payload.attemptId,
      };
      resolvedAttemptId = payload.attemptId;
    } else if (eventType === 'CANDIDATE_VIOLATION' && payload.event) {
      eventData = {
        ...payload.event,
        attemptId: payload.attemptId,
      };
      resolvedAttemptId = payload.attemptId;
    } else if (eventType === 'EXAM_CLOSED') {
      eventData = {
        message: payload.message || content.data.message || 'Bài thi đã kết thúc.',
        action: 'AUTO_SUBMIT',
      };
    }

    const unifiedEvent: ProctoringEvent = {
      eventType,
      attemptId: resolvedAttemptId || this.attemptId,
      examId: this.examId,
      data: eventData,
      timestamp: new Date().toISOString(),
    };

    this.emitEvent(unifiedEvent);
  }

  // ─────────────────────────────────────────────────────────────
  // Fallback Layer: Spring Boot STOMP WebSocket
  // ─────────────────────────────────────────────────────────────

  private fallbackToStomp(): void {
    if (this.isDestroyed || this.isUsingFallback) return;

    this.isUsingFallback = true;
    this.clearConnectTimeout();

    // Close dying primary socket safely
    if (this.quickNotifySocket) {
      const socket = this.quickNotifySocket;
      this.quickNotifySocket = null;
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => {
            try {
              socket.close();
            } catch {
              // Ignored
            }
          };
          socket.onerror = () => { };
        } else {
          socket.close();
        }
      } catch {
        // Ignored
      }
    }

    console.warn('🔄 [RealtimeManager] Activating Fallback: Spring Boot STOMP...');
    this.updateStatus('CONNECTED_FALLBACK');

    const brokerUrl = this.formatStompBrokerUrl(this.stompBaseUrl);

    this.stompClient = new StompClient({
      brokerURL: brokerUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        console.info('✅ [RealtimeManager] STOMP Fallback connected.');
        this.subscribeStompTopics();
      },
      onStompError: (frame) => {
        console.warn('[RealtimeManager] STOMP frame error:', frame.headers?.['message']);
      },
      onWebSocketError: (err) => {
        console.warn('[RealtimeManager] STOMP transport error:', err);
      },
      onDisconnect: () => {
        if (this.isUsingFallback && !this.isDestroyed) {
          this.updateStatus('DISCONNECTED');
        }
      },
    });

    this.stompClient.activate();

    // Start background healthcheck to auto-recover QuickNotify when it comes back online
    this.scheduleQuickNotifyHealthCheck();
  }

  private subscribeStompTopics(): void {
    if (!this.stompClient || !this.stompClient.connected) return;

    if (this.role === 'candidate') {
      // 1. Candidate's personal attempt alert channel
      if (this.attemptId) {
        this.stompClient.subscribe(
          `/topic/attempts/${this.attemptId}/proctoring`,
          (message) => this.handleStompMessage(message.body)
        );
      }
      // 2. Exam room level announcements (e.g. EXAM_CLOSED)
      if (this.examId) {
        this.stompClient.subscribe(
          `/topic/exams/${this.examId}/proctoring`,
          (message) => this.handleStompMessage(message.body)
        );
      }
    } else if (this.role === 'teacher') {
      // Teacher room broadcast channel
      if (this.examId) {
        this.stompClient.subscribe(
          `/topic/exams/${this.examId}/proctoring`,
          (message) => this.handleStompMessage(message.body)
        );
      }
    }
  }

  private handleStompMessage(body: string): void {
    try {
      const parsed = JSON.parse(body);

      // Check if this is an exam closure
      if (parsed.eventType === 'EXAM_CLOSED' || parsed.action === 'AUTO_SUBMIT') {
        this.emitEvent({
          eventType: 'EXAM_CLOSED',
          attemptId: this.attemptId,
          examId: this.examId,
          data: parsed,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check violation event
      const eventType: ProctoringEventType =
        this.role === 'teacher' ? 'CANDIDATE_VIOLATION' : 'VIOLATION_ALERT';

      this.emitEvent({
        eventType,
        attemptId: parsed.attemptId || this.attemptId,
        examId: this.examId,
        data: parsed,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[RealtimeManager] Failed to parse STOMP message body:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Auto-Recovery: Periodic Health Check
  // ─────────────────────────────────────────────────────────────

  private scheduleQuickNotifyHealthCheck(): void {
    this.clearHealthCheck();

    this.healthCheckInterval = setInterval(async () => {
      if (!this.isUsingFallback || this.isDestroyed) {
        this.clearHealthCheck();
        return;
      }

      try {
        const baseWsUrl =
          this.quickNotifyWsUrl ||
          process.env.NEXT_PUBLIC_QUICKNOTIFY_WS_URL ||
          'ws://localhost:8080/ws';
        const healthUrl = baseWsUrl
          .replace(/^wss:\/\//, 'https://')
          .replace(/^ws:\/\//, 'http://')
          .replace(/\/ws.*$/, '/healthz');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          console.info('✨ [RealtimeManager] QuickNotify is back online! Reconnecting Primary...');
          this.clearHealthCheck();
          this.connectQuickNotify();
        }
      } catch {
        // QuickNotify still unreachable, remain on STOMP Fallback
      }
    }, 15000);
  }

  // ─────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────

  private teardownStomp(): void {
    if (this.stompClient) {
      if (this.stompClient.active) {
        console.info('[RealtimeManager] Deactivating STOMP client (freeing JVM resources).');
        this.stompClient.deactivate();
      }
      this.stompClient = null;
    }
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
  }

  private clearHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private updateStatus(newStatus: RealtimeConnectionStatus): void {
    if (this.connectionStatus === newStatus) return;
    this.connectionStatus = newStatus;
    this.statusHandlers.forEach((handler) => {
      try {
        handler(newStatus);
      } catch (err) {
        console.error('[RealtimeManager] Error in status change handler:', err);
      }
    });
  }

  private emitEvent(event: ProctoringEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error('[RealtimeManager] Error in event listener:', err);
      }
    });
  }

  private formatStompBrokerUrl(rawUrl: string): string {
    if (rawUrl.startsWith('https://')) {
      return rawUrl.replace(/^https:\/\//, 'wss://');
    }
    if (rawUrl.startsWith('http://')) {
      return rawUrl.replace(/^http:\/\//, 'ws://');
    }
    return rawUrl;
  }
}

