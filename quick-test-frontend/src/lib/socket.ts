import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080/ws-exam';

let stompClient: Client | null = null;

/**
 * Get current STOMP client instance.
 */
export function getStompClient(): Client | null {
  return stompClient;
}

/**
 * Initialize and connect STOMP WebSocket client with JWT authentication.
 *
 * @param token - Bearer JWT token for WebSocket authentication.
 * @param onConnectCallback - Callback invoked when connection is established.
 * @param onErrorCallback - Callback invoked upon connection or STOMP error.
 * @returns Configured STOMP Client instance.
 */
export function connectWebSocket(
  token?: string | null,
  onConnectCallback?: (client: Client) => void,
  onErrorCallback?: (error: unknown) => void
): Client | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // If already connected, return existing client
  if (stompClient && stompClient.connected) {
    if (onConnectCallback) {
      onConnectCallback(stompClient);
    }
    return stompClient;
  }

  const effectiveToken =
    token || localStorage.getItem('token') || localStorage.getItem('accessToken');

  const headers: Record<string, string> = {};
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken}`;
  }

  stompClient = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    connectHeaders: headers,
    debug: (str: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[STOMP]', str);
      }
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: (frame) => {
      console.log('[STOMP] Connected successfully:', frame);
      if (stompClient && onConnectCallback) {
        onConnectCallback(stompClient);
      }
    },
    onStompError: (frame) => {
      console.error('[STOMP] Broker error:', frame.headers['message'], frame.body);
      if (onErrorCallback) {
        onErrorCallback(frame);
      }
    },
    onWebSocketError: (event) => {
      console.error('[STOMP] WebSocket transport error:', event);
      if (onErrorCallback) {
        onErrorCallback(event);
      }
    },
    onDisconnect: () => {
      console.log('[STOMP] Disconnected');
    },
  });

  stompClient.activate();
  return stompClient;
}

/**
 * Gracefully disconnect and tear down current WebSocket connection.
 */
export function disconnectWebSocket(): void {
  if (stompClient) {
    if (stompClient.connected) {
      stompClient.deactivate();
      console.log('[STOMP] Client deactivated');
    }
    stompClient = null;
  }
}

/**
 * Helper to subscribe to a destination topic or queue.
 */
export function subscribeTopic(
  destination: string,
  callback: (message: IMessage) => void
): StompSubscription | null {
  if (!stompClient || !stompClient.connected) {
    console.warn('[STOMP] Cannot subscribe, client is not connected:', destination);
    return null;
  }

  return stompClient.subscribe(destination, callback);
}

/**
 * Helper to send a message to an application destination endpoint.
 */
export function sendWebSocketMessage(destination: string, body: unknown): void {
  if (!stompClient || !stompClient.connected) {
    console.warn('[STOMP] Cannot send message, client is not connected:', destination);
    return;
  }

  stompClient.publish({
    destination,
    body: JSON.stringify(body),
  });
}
