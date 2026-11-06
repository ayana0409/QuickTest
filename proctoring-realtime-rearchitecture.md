# TÀI LIỆU THIẾT KẾ KỸ THUẬT CHI TIẾT
# TỐI ƯU HÓA HỆ THỐNG GIÁM SÁT VI PHẠM & NỘP BÀI THI
## QuickTest Proctoring & Submission Re-Architecture

**Phiên bản:** 1.0.0  
**Ngày tạo:** 06/11/2026  
**Trạng thái:** In Review

---

## MỤC LỤC

1. [Tổng quan & Mục tiêu](#1-tổng-quan--mục-tiêu)
2. [Phân tích điểm nghẽn hiện tại](#2-phân-tích-điểm-nghẽn-hiện-tại)
3. [Kiến trúc tổng thể hệ thống mới](#3-kiến-trúc-tổng-thể-hệ-thống-mới)
4. [Bước 1: Chuyển đổi sang QuickNotify & Dual-WS Fallback](#4-bước-1-chuyển-đổi-sang-quicknotify--dual-ws-fallback)
5. [Bước 2: Luồng ghi nhận vi phạm qua Redis](#5-bước-2-luồng-ghi-nhận-vi-phạm-qua-redis)
6. [Bước 3: Luồng giám sát vi phạm (Redis vs PostgreSQL)](#6-bước-3-luồng-giám-sát-vi-phạm-redis-vs-postgresql)
7. [Bước 4: Luồng nộp bài – Batch Persistence](#7-bước-4-luồng-nộp-bài--batch-persistence)
8. [Xử lý các case biên (Edge Cases)](#8-xử-lý-các-case-biên-edge-cases)
9. [So sánh trước và sau tái cấu trúc](#9-so-sánh-trước-và-sau-tái-cấu-trúc)
10. [Kế hoạch triển khai](#10-kế-hoạch-triển-khai)

---

## 1. Tổng quan & Mục tiêu

### 1.1. Bối cảnh

QuickTest hiện đang sử dụng **Spring Boot STOMP WebSocket** để xử lý toàn bộ luồng giám sát vi phạm thời gian thực. Mỗi khi thí sinh kích hoạt sự kiện vi phạm (chuyển tab, thoát fullscreen, mở DevTools), hệ thống thực hiện ngay **3 truy vấn SQL đồng bộ** trong cùng một transaction:

```
Candidate violation event
  → Spring STOMP Controller
  → ProctoringServiceImpl.recordViolation() [@Transactional]
      ├── SELECT ExamAttempt JOIN Exam JOIN User   (PostgreSQL)
      ├── INSERT INTO violation_logs               (PostgreSQL)
      └── UPDATE exam_attempts SET violation_count (PostgreSQL)
```

Luồng này hoạt động tốt với số lượng nhỏ, nhưng **sẽ sập toàn bộ hệ thống khi phòng thi có hàng trăm đến hàng nghìn thí sinh đồng thời** do cạn kiệt HikariCP Connection Pool.

### 1.2. Mục tiêu kiến trúc mới

| # | Mục tiêu | Phương án |
|:--|:---------|:----------|
| 1 | **Zero DB Writes trong thời gian thi** | Redis In-Memory Buffer cho toàn bộ violation events |
| 2 | **Batch Persistence khi nộp bài** | Gom toàn bộ log vi phạm, INSERT 1 lần duy nhất trong RabbitMQ Worker |
| 3 | **Chuyển tầng WebSocket sang Go** | Tích hợp QuickNotify (Go) làm Primary WS Engine |
| 4 | **Fallback tự động và trong suốt** | Spring STOMP tiếp tục hoạt động như Standby khi QuickNotify gặp sự cố |

---

## 2. Phân tích điểm nghẽn hiện tại

### 2.1. Vấn đề Connection Pool Exhaustion

HikariCP trong Spring Boot mặc định cấu hình `maximumPoolSize = 10`. Với tải thực tế:

- Giả sử phòng thi có **500 thí sinh** đang làm bài.
- Chỉ cần **10% thí sinh** (50 người) đồng thời kích hoạt sự kiện vi phạm trong vòng 1 giây (do cùng nhận popup thông báo OS, hoặc bị mất focus toàn màn hình).
- **50 violation events × 1 transaction mỗi event = 50 connections cần thiết ngay lập tức**.
- HikariCP hết sạch 10 connections → **Toàn bộ API còn lại bị xếp hàng chờ (Queue)**, bao gồm cả `PUT /api/session/{id}/save` và `POST /api/session/{id}/submit`.
- **Hệ quả:** Thí sinh mất bài đang làm, không nộp được bài.

```
[Violation Storm at T=0]
   50 concurrent events → 50 DB transactions needed

   HikariCP Pool:  [■■■■■■■■■■] = 10 connections (FULL)
   Waiting Queue:  [save_answer, save_answer, submit, submit, ...] = BLOCKED

   Result: HikariCP timeout (30s) → HTTP 500 for all queued requests
```

### 2.2. Vấn đề JVM WebSocket Resource Usage

Spring Boot STOMP WebSocket dùng mô hình **Thread-per-Connection** của Tomcat:

- Mỗi kết nối WebSocket tốn khoảng **1MB stack + overhead JVM**.
- 1.000 thí sinh đồng thời → **~1GB RAM chỉ để giữ socket connections**.
- GC Pressure (Full GC Pauses) ảnh hưởng trực tiếp đến response time của tất cả API.

**So sánh với Go Goroutines (QuickNotify):**

- Mỗi goroutine chỉ tốn **2–4KB** stack ban đầu, tăng dần theo nhu cầu.
- 100.000 kết nối đồng thời trên Go chỉ tốn **~400MB RAM**.

---

## 3. Kiến trúc tổng thể hệ thống mới

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
│                                                             │
│  [Candidate Browser]          [Teacher Browser]             │
│         │                            │                      │
│         └───────────┐    ┌───────────┘                      │
│                     │    │                                  │
│            [Dual-WS Connection Manager]                     │
│             Primary : QuickNotify (Go)                      │
│             Fallback: Spring STOMP [Auto-activate]          │
└─────────────────┬───────────────────────────┬───────────────┘
                  │                           │
       [Primary WS Path]           [Fallback WS Path]
                  │                           │
┌─────────────────▼────────────┐ ┌────────────▼──────────────┐
│   QUICKNOTIFY (Go)           │ │   SPRING STOMP WS (Java)  │
│   ws://quicknotify/ws        │ │   /ws-proctoring (SockJS) │
│   Goroutine-based Hub        │ │   [Standby only if needed]│
└─────────────────▲────────────┘ └───────────────────────────┘
                  │ POST /api/v1/notify
┌─────────────────┴──────────────────────────────────────────┐
│               SPRING BOOT BACKEND CORE                      │
│                                                             │
│  POST /api/session/{id}/proctoring/violation                │
│      │                                                      │
│      ├──► RedisProctoringService                            │
│      │        ├── INCR violation_count  ┐                   │
│      │        └── RPUSH violation_logs  ┘ Redis (<1ms)      │
│      │                                                      │
│      └──► QuickNotifyDispatcherService (@Async)             │
│               └── POST http://quicknotify/api/v1/notify     │
│                                                             │
│  Teacher GET /api/teacher/proctoring/attempt/{id}/violations│
│      └──► ProctoringQueryService                            │
│               ├── [IN_PROGRESS]  → Read Redis (0 DB I/O)   │
│               └── [SUBMITTED]    → Read PostgreSQL          │
│                                                             │
│  POST /api/session/{id}/submit                              │
│      └──► ExamSubmissionProducer → RabbitMQ                 │
│               └──► ExamSubmissionConsumer (Worker)          │
│                       ├── Grade answers (RAM)               │
│                       ├── LRANGE violation_logs (Redis)     │
│                       └── Batch INSERT → PostgreSQL         │
└─────────────────────────────────────────────────────────────┘
              │                              │
   ┌──────────▼──────────┐       ┌───────────▼──────────────┐
   │    REDIS 7           │       │    POSTGRESQL 16          │
   │                      │       │                           │
   │ attempt:{id}:        │       │ exam_attempts             │
   │   violation_count    │       │ violation_logs            │
   │   violation_logs     │       │ candidate_answers         │
   │   status             │       │                           │
   │ TTL: duration + 4h   │       │ Written ONCE on submit    │
   └──────────────────────┘       └───────────────────────────┘
```

---

## 4. Bước 1: Chuyển đổi sang QuickNotify & Dual-WS Fallback

### 4.1. Thiết kế luồng kết nối Dual-WS

```
Client khởi động session thi
        │
        ▼
Backend cấp QuickNotify JWT Token
(project_id: "quicktest", user_id: "att_{attemptId}", exp: expireAt)
        │
        ▼
Frontend khởi tạo ProctoringRealtimeManager
        │
        ▼
Thử kết nối QuickNotify ws://quicknotify/ws?token=...
        │
        ├── Thành công ──────────────────────────────────┐
        │                                                 │
        │                             [QuickNotify ACTIVE]│
        │                             [STOMP: OFF / IDLE] │
        │                                                 │
        └── Thất bại (timeout 3s) ──► Fallback to STOMP  │
                                               │          │
                                 [STOMP ACTIVE]           │
                                 Background polling       │
                                 QuickNotify health       │
                                 every 15s                │
                                               │          │
                                 QuickNotify healthy? ────┘
                                 YES → Reconnect QN,
                                       disconnect STOMP
```

### 4.2. JWT Token cấp cho QuickNotify

Khi thí sinh bắt đầu thi (`POST /api/session/start`), Backend cần cấp thêm 1 token riêng để kết nối vào QuickNotify. Token này ký bằng **Secret Key chung** giữa Spring Boot và QuickNotify (`AUTH_JWT_SECRET` trong `.env` của QuickNotify).

**Cấu trúc Claims:**

```json
{
  "project_id": "quicktest",
  "user_id": "att_3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "role": "CANDIDATE",
  "attempt_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "exp": 1793856000
}
```

> **Lưu ý về `user_id`:** Vì QuickNotify dùng `user_id` để định tuyến tin nhắn tới đúng client, với thí sinh ta dùng prefix `att_` + `attemptId` thay vì `userId` thuần túy. Lý do: thí sinh Guest không có `userId` nhưng luôn có `attemptId`. Mô hình này đảm bảo cả thí sinh đã đăng nhập và thí sinh Guest đều được định tuyến chính xác.

**API trả về token trong `ExamPaperResponse`:**

```json
{
  "attemptId": "3fa85f64-...",
  "examTitle": "Đề thi Giữa kỳ CNTT2024",
  "questions": ["..."],
  "expireAt": "2026-11-06T13:50:00",
  "realtimeToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "quickNotifyWsUrl": "ws://notify.quicktest.io/ws"
}
```

**Giáo viên giám sát:** Dùng `teacher_{teacherId}` làm `user_id`, đăng ký lắng nghe kênh Broadcast của exam (`exam_monitor_{examId}`).

### 4.3. Frontend: ProctoringRealtimeManager

```typescript
// File: src/lib/realtime/ProctoringRealtimeManager.ts

import { Client as StompClient } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export type RealtimeHandler = (event: ProctoringEvent) => void;

export interface ProctoringEvent {
  eventType: 'VIOLATION_ALERT' | 'EXAM_CLOSED' | 'CANDIDATE_DISQUALIFIED' | 'HEARTBEAT_ACK';
  attemptId?: string;
  examId?: string;
  data: Record<string, unknown>;
}

/**
 * Manages dual WebSocket connections for proctoring:
 * - Primary  : QuickNotify (Go)   — lightweight, high-concurrency
 * - Fallback : Spring STOMP (JVM) — activates automatically if QuickNotify is unreachable
 */
export class ProctoringRealtimeManager {
  private quickNotifySocket: WebSocket | null = null;
  private stompClient: StompClient | null = null;
  private isUsingFallback = false;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private handlers: Set<RealtimeHandler> = new Set();
  private destroyed = false;

  constructor(
    private readonly quickNotifyWsUrl: string,  // e.g. ws://notify.quicktest.io/ws
    private readonly stompBaseUrl: string,       // e.g. http://localhost:8080
    private readonly quickNotifyToken: string,
    private readonly examId: string,
    private readonly attemptId: string,
  ) {}

  /** Start connection sequence: QuickNotify first, STOMP as fallback. */
  public connect(): void {
    this.connectQuickNotify();
  }

  /** Subscribe to incoming proctoring events. Returns an unsubscribe function. */
  public subscribe(handler: RealtimeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Gracefully close all connections. */
  public disconnect(): void {
    this.destroyed = true;
    this.clearHealthCheck();
    this.quickNotifySocket?.close(1000, 'Session ended');
    this.quickNotifySocket = null;
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
  }

  // ─────────────────────────────────────────────────────
  // Private: QuickNotify (Go) — Primary Connection
  // ─────────────────────────────────────────────────────

  private connectQuickNotify(): void {
    if (this.destroyed) return;
    console.info('[Realtime] Connecting to Primary (QuickNotify Go)...');

    const url = `${this.quickNotifyWsUrl}?token=${encodeURIComponent(this.quickNotifyToken)}`;

    try {
      this.quickNotifySocket = new WebSocket(url);
    } catch (err) {
      console.error('[Realtime] WebSocket init failed:', err);
      this.fallbackToStomp();
      return;
    }

    // 3-second timeout: if not connected, trigger fallback
    const connectionTimeout = setTimeout(() => {
      if (this.quickNotifySocket?.readyState !== WebSocket.OPEN) {
        console.warn('[Realtime] QuickNotify connection timed out (3s). Triggering fallback...');
        this.quickNotifySocket?.close();
        this.fallbackToStomp();
      }
    }, 3000);

    this.quickNotifySocket.onopen = () => {
      clearTimeout(connectionTimeout);
      console.info('✅ [Realtime] QuickNotify connected. STOMP is now OFF.');
      this.isUsingFallback = false;
      this.teardownStomp();
    };

    this.quickNotifySocket.onmessage = (event) => {
      // QuickNotify may batch multiple messages per frame, separated by newline
      const lines = (event.data as string).split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const payload = JSON.parse(trimmed);
          const procEvent: ProctoringEvent = payload.content?.data ?? payload;
          this.emit(procEvent);
        } catch {
          console.error('[Realtime] Failed to parse QuickNotify message:', trimmed);
        }
      }
    };

    this.quickNotifySocket.onclose = (closeEvent) => {
      clearTimeout(connectionTimeout);
      if (!this.destroyed && !this.isUsingFallback) {
        console.warn(`[Realtime] QuickNotify closed (code=${closeEvent.code}). Triggering fallback...`);
        this.fallbackToStomp();
      }
    };

    this.quickNotifySocket.onerror = () => {
      clearTimeout(connectionTimeout);
      if (!this.isUsingFallback) {
        console.warn('[Realtime] QuickNotify error. Triggering fallback...');
        this.fallbackToStomp();
      }
    };
  }

  // ─────────────────────────────────────────────────────
  // Private: Spring STOMP — Fallback Connection
  // ─────────────────────────────────────────────────────

  private fallbackToStomp(): void {
    if (this.destroyed || this.isUsingFallback) return;
    this.isUsingFallback = true;
    console.warn('🔄 [Realtime] Activating Fallback: Spring Boot STOMP...');

    this.quickNotifySocket?.close();
    this.quickNotifySocket = null;

    this.stompClient = new StompClient({
      webSocketFactory: () => new SockJS(`${this.stompBaseUrl}/ws-proctoring`),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.info('✅ [Realtime] STOMP Fallback connected.');
        // Subscribe to this candidate's personal alert channel
        this.stompClient?.subscribe(
          `/topic/attempts/${this.attemptId}/proctoring`,
          (frame) => this.emit(JSON.parse(frame.body))
        );
        // Subscribe to exam-level broadcast (exam closed, etc.)
        this.stompClient?.subscribe(
          `/topic/exams/${this.examId}/proctoring`,
          (frame) => this.emit(JSON.parse(frame.body))
        );
      },
      onStompError: (frame) => {
        console.error('[Realtime] STOMP error:', frame.headers['message']);
      },
    });

    this.stompClient.activate();

    // Background: Try to restore QuickNotify connection every 15 seconds
    this.scheduleQuickNotifyHealthCheck();
  }

  private scheduleQuickNotifyHealthCheck(): void {
    this.clearHealthCheck();
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isUsingFallback || this.destroyed) {
        this.clearHealthCheck();
        return;
      }
      try {
        const healthUrl = this.quickNotifyWsUrl
          .replace('wss://', 'https://')
          .replace('ws://', 'http://')
          .replace('/ws', '/health');
        const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          console.info('[Realtime] QuickNotify is back online! Reconnecting Primary...');
          this.isUsingFallback = false;
          this.clearHealthCheck();
          this.connectQuickNotify();
        }
      } catch {
        // QuickNotify still unreachable, stay on STOMP
      }
    }, 15_000);
  }

  private teardownStomp(): void {
    if (this.stompClient?.active) {
      console.info('[Realtime] Deactivating STOMP client (freeing JVM resources).');
      this.stompClient.deactivate();
      this.stompClient = null;
    }
  }

  private clearHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private emit(event: ProctoringEvent): void {
    this.handlers.forEach((h) => {
      try { h(event); } catch (err) {
        console.error('[Realtime] Event handler error:', err);
      }
    });
  }
}
```

### 4.4. Backend: QuickNotifyDispatcherService

```java
// File: src/main/java/com/quicktest/core/notify/QuickNotifyDispatcherService.java

package com.quicktest.core.notify;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.UUID;

/**
 * Fire-and-forget dispatcher that pushes real-time proctoring events
 * to the QuickNotify Go WebSocket Hub via REST API.
 * Uses @Async to avoid blocking the main violation ingestion thread.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuickNotifyDispatcherService {

    @Value("${quicknotify.base-url:http://localhost:8085}")
    private String quickNotifyBaseUrl;

    @Value("${quicknotify.api-key:}")
    private String quickNotifyApiKey;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /** Push violation alert to candidate and teacher channels. Non-blocking. */
    @Async("quickNotifyExecutor")
    public void dispatchViolationAlert(UUID attemptId, UUID examId, Object alertPayload) {
        // 1. Dispatch alert to candidate's personal channel
        sendNotify("att_" + attemptId, "VIOLATION_ALERT",
            Map.of("attemptId", attemptId.toString(), "alert", alertPayload));

        // 2. Broadcast violation event to teacher monitoring channel
        sendNotifyBroadcast(examId, "CANDIDATE_VIOLATION",
            Map.of("attemptId", attemptId.toString(), "event", alertPayload));
    }

    /** Push exam lifecycle event (EXAM_CLOSED, etc.) to all candidates in a room. */
    @Async("quickNotifyExecutor")
    public void dispatchExamLifecycleEvent(UUID examId, String eventType, String message) {
        sendNotifyBroadcast(examId, eventType, Map.of("message", message));
    }

    // ─────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────

    /** Send to a specific user channel (scope: user). */
    private void sendNotify(String userId, String eventType, Map<String, Object> data) {
        try {
            post(Map.of(
                "event_id",  "evt_" + System.currentTimeMillis(),
                "project_id", "quicktest",
                "scope",     "user",
                "priority",  "high",
                "channels",  new String[]{"websocket"},
                "target",    Map.of("user_id", userId),
                "content",   Map.of("type", "raw", "data",
                    Map.of("eventType", eventType, "payload", data))
            ));
        } catch (Exception ex) {
            // Swallow: failure to push realtime notification must NEVER affect core exam flow
            log.warn("[QuickNotify] Failed to dispatch user event (userId={}, type={}): {}", userId, eventType, ex.getMessage());
        }
    }

    /** Broadcast to all users in an exam room. */
    private void sendNotifyBroadcast(UUID examId, String eventType, Map<String, Object> data) {
        try {
            post(Map.of(
                "event_id",  "evt_exam_" + System.currentTimeMillis(),
                "project_id", "quicktest",
                "scope",     "user",
                "priority",  "high",
                "channels",  new String[]{"websocket"},
                "target",    Map.of("user_id", "exam_monitor_" + examId),
                "content",   Map.of("type", "raw", "data",
                    Map.of("eventType", eventType, "examId", examId.toString(), "payload", data))
            ));
        } catch (Exception ex) {
            log.warn("[QuickNotify] Failed to dispatch broadcast (examId={}, type={}): {}", examId, eventType, ex.getMessage());
        }
    }

    private void post(Map<String, Object> envelope) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (quickNotifyApiKey != null && !quickNotifyApiKey.isBlank()) headers.set("X-API-Key", quickNotifyApiKey);
        restTemplate.postForEntity(
            quickNotifyBaseUrl + "/api/v1/notify",
            new HttpEntity<>(envelope, headers),
            Void.class
        );
    }
}
```

---

## 5. Bước 2: Luồng ghi nhận vi phạm qua Redis

### 5.1. Sơ đồ luồng mới

```
Candidate Browser
      │
      │  Phát hiện vi phạm (TAB_SWITCH, EXIT_FULLSCREEN, DEVTOOLS_OPEN...)
      ▼
POST /api/session/{attemptId}/proctoring/violation
      │
      ├── [Guard] Đọc ExamAttempt + Exam config (1 lần duy nhất, có thể cache)
      │
      ▼
RedisProctoringService.recordViolationInMemory()
      │
      ├── 1. GET quicktest:attempt:{id}:status
      │       └── If DISQUALIFIED → Return 403 immediately
      │
      ├── 2. INCR quicktest:attempt:{id}:violation_count → returns currentCount
      │       └── EXPIRE key (exam_duration + 4h)
      │
      ├── 3. RPUSH quicktest:attempt:{id}:violation_logs <json_violation_item>
      │       └── EXPIRE key (exam_duration + 4h)
      │
      ├── 4. [If currentCount >= maxViolations]
      │       └── SET quicktest:attempt:{id}:status "DISQUALIFIED"
      │           EXPIRE key (exam_duration + 4h)
      │
      └── 5. @Async → QuickNotifyDispatcherService.dispatchViolationAlert()
                   └── POST http://quicknotify/api/v1/notify (non-blocking)

      ◄── HTTP 200 trả về ViolationAlertMessage cho Client (<3ms)
```

### 5.2. Cấu trúc key Redis

| Redis Key | Kiểu | Nội dung | TTL |
|:----------|:-----|:---------|:----|
| `quicktest:attempt:{attemptId}:violation_count` | `String (Integer)` | Tổng số lần vi phạm | `durationMinutes` phút + 4 giờ |
| `quicktest:attempt:{attemptId}:violation_logs` | `List<String (JSON)>` | Danh sách chi tiết từng lần vi phạm | `durationMinutes` phút + 4 giờ |
| `quicktest:attempt:{attemptId}:status` | `String` | `IN_PROGRESS` hoặc `DISQUALIFIED` | `durationMinutes` phút + 4 giờ |

**Ví dụ 1 phần tử trong `violation_logs` List:**

```json
{
  "violationType": "TAB_SWITCH",
  "description": "Thí sinh chuyển tab ra ngoài màn hình thi lần 3",
  "timestamp": "2026-11-06T11:52:34.123"
}
```

### 5.3. DTO và Service Implementation

```java
// File: src/main/java/com/quicktest/modules/proctoring/dto/ViolationItemRedisDto.java

package com.quicktest.modules.proctoring.dto;

import com.quicktest.modules.proctoring.entity.ViolationType;
import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class ViolationItemRedisDto {
    private ViolationType violationType;
    private String description;
    private LocalDateTime timestamp;
}
```

```java
// File: src/main/java/com/quicktest/modules/proctoring/service/RedisProctoringService.java

package com.quicktest.modules.proctoring.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.notify.QuickNotifyDispatcherService;
import com.quicktest.modules.proctoring.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * In-memory violation tracking service.
 * Performs ALL violation ingestion operations on Redis only.
 * Zero database writes during active exam sessions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RedisProctoringService {

    private static final String KEY_COUNT  = "quicktest:attempt:%s:violation_count";
    private static final String KEY_LOGS   = "quicktest:attempt:%s:violation_logs";
    private static final String KEY_STATUS = "quicktest:attempt:%s:status";

    private final StringRedisTemplate redis;
    private final QuickNotifyDispatcherService quickNotifyDispatcher;
    private final ObjectMapper objectMapper;

    /**
     * Record a candidate violation entirely in Redis.
     * No database connection opened or held during this operation.
     */
    public ViolationAlertMessage recordViolationInMemory(
            UUID attemptId,
            UUID examId,
            int maxAllowedViolations,
            Duration examTtl,
            ViolationReportMessage report) {

        Duration keyTtl = examTtl.plusHours(4);
        String countKey  = String.format(KEY_COUNT,  attemptId);
        String logsKey   = String.format(KEY_LOGS,   attemptId);
        String statusKey = String.format(KEY_STATUS, attemptId);

        // 1. Short-circuit if already disqualified
        if ("DISQUALIFIED".equalsIgnoreCase(redis.opsForValue().get(statusKey))) {
            return ViolationAlertMessage.builder()
                    .attemptId(attemptId)
                    .violationType(report.getViolationType())
                    .disqualified(true)
                    .message("Thí sinh đã bị đình chỉ thi.")
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        // 2. Atomically increment violation counter
        Long countLong = redis.opsForValue().increment(countKey);
        redis.expire(countKey, keyTtl);
        int currentCount = countLong != null ? countLong.intValue() : 1;

        // 3. Append structured log entry to Redis List
        ViolationItemRedisDto logItem = ViolationItemRedisDto.builder()
                .violationType(report.getViolationType())
                .description(report.getDescription() != null && !report.getDescription().isBlank()
                    ? report.getDescription().trim()
                    : "Vi phạm phát hiện: " + report.getViolationType().name())
                .timestamp(LocalDateTime.now())
                .build();

        try {
            redis.opsForList().rightPush(logsKey, objectMapper.writeValueAsString(logItem));
            redis.expire(logsKey, keyTtl);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize violation log for attemptId={}: {}", attemptId, e.getMessage());
        }

        // 4. Check disqualification threshold
        boolean isDisqualified = currentCount >= maxAllowedViolations;
        if (isDisqualified) {
            log.warn("Attempt {} DISQUALIFIED: violations={}/{}", attemptId, currentCount, maxAllowedViolations);
            redis.opsForValue().set(statusKey, "DISQUALIFIED", keyTtl);
        }

        // 5. Build response
        int remaining = Math.max(0, maxAllowedViolations - currentCount);
        String alertText = isDisqualified
            ? String.format("Đình chỉ thi! Đã vượt quá giới hạn vi phạm (%d/%d).", currentCount, maxAllowedViolations)
            : String.format("Cảnh báo [%s]: %d/%d vi phạm. Còn được %d lần.",
                report.getViolationType().name(), currentCount, maxAllowedViolations, remaining);

        ViolationAlertMessage alert = ViolationAlertMessage.builder()
                .attemptId(attemptId)
                .violationType(report.getViolationType())
                .violationCount(currentCount)
                .maxAllowed(maxAllowedViolations)
                .remainingAllowed(remaining)
                .disqualified(isDisqualified)
                .message(alertText)
                .timestamp(LocalDateTime.now())
                .build();

        // 6. Fire-and-forget: push realtime event (does NOT block response)
        quickNotifyDispatcher.dispatchViolationAlert(attemptId, examId, alert);

        return alert;
    }
}
```

### 5.4. Controller thay thế ProctoringWebSocketController

```java
// File: src/main/java/com/quicktest/modules/proctoring/controller/ViolationIngestionController.java

package com.quicktest.modules.proctoring.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import com.quicktest.modules.proctoring.dto.ViolationReportMessage;
import com.quicktest.modules.proctoring.service.RedisProctoringService;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/session")
@RequiredArgsConstructor
public class ViolationIngestionController {

    private final ExamAttemptRepository examAttemptRepository;
    private final RedisProctoringService redisProctoringService;

    /**
     * Receive and buffer a violation event in Redis.
     * Returns in <5ms with zero DB writes after the initial metadata read.
     */
    @PostMapping("/{attemptId}/proctoring/violation")
    public ResponseEntity<ApiResponse<ViolationAlertMessage>> recordViolation(
            @PathVariable UUID attemptId,
            @RequestBody ViolationReportMessage report,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        // The only DB read in this endpoint: fetch Exam config (threshold, proctoring flag)
        // Optimization: can be wrapped with @Cacheable on Exam config fields
        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.fail("Phiên thi không còn đang diễn ra."));
        }

        Exam exam = attempt.getExam();
        if (!Boolean.TRUE.equals(exam.getIsProctoringEnabled())) {
            return ResponseEntity.ok(ApiResponse.success(ViolationAlertMessage.builder()
                    .attemptId(attemptId).disqualified(false)
                    .message("Phòng thi không bật chức năng giám sát.").build()));
        }

        int maxViolations = exam.getMaxViolations() != null ? exam.getMaxViolations() : 5;

        // Calculate remaining exam duration for Redis TTL
        Duration remainingDuration = attempt.getExpireAt() != null
                ? Duration.between(LocalDateTime.now(), attempt.getExpireAt())
                : Duration.ofHours(4);
        if (remainingDuration.isNegative()) remainingDuration = Duration.ofMinutes(5);

        ViolationAlertMessage alert = redisProctoringService.recordViolationInMemory(
                attemptId, exam.getId(), maxViolations, remainingDuration, report);

        return ResponseEntity.ok(ApiResponse.success(alert));
    }
}
```

---

## 6. Bước 3: Luồng giám sát vi phạm (Redis vs PostgreSQL)

### 6.1. Quy tắc phân tầng dữ liệu

```
Teacher GET /api/teacher/proctoring/attempt/{attemptId}/violations
                        │
                        ▼
            Lấy status của attempt
                        │
            ┌───────────┴───────────┐
            │                       │
       IN_PROGRESS             SUBMITTED / DISQUALIFIED
       AWAITING_MANUAL_GRADING
            │                       │
            ▼                       ▼
     Đọc từ REDIS           Đọc từ POSTGRESQL
     - LRANGE logs          - SELECT * FROM violation_logs
     - GET count              WHERE attempt_id = ?
     - Trả về realtime      - Trả về lịch sử đã chốt
     - 0 DB I/O             - Dữ liệu đã được persist
```

### 6.2. ProctoringQueryService

```java
// File: src/main/java/com/quicktest/modules/proctoring/service/ProctoringQueryService.java

package com.quicktest.modules.proctoring.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.proctoring.dto.ViolationDetailResponse;
import com.quicktest.modules.proctoring.dto.ViolationItemRedisDto;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Smart violation query service:
 * - Active attempts (IN_PROGRESS)       → reads from Redis (sub-millisecond, zero DB load)
 * - Finished attempts (SUBMITTED/etc.)  → reads from PostgreSQL (accurate historical record)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProctoringQueryService {

    private static final String KEY_COUNT = "quicktest:attempt:%s:violation_count";
    private static final String KEY_LOGS  = "quicktest:attempt:%s:violation_logs";

    private final ExamAttemptRepository examAttemptRepository;
    private final ViolationLogRepository violationLogRepository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public ViolationDetailResponse getAttemptViolations(UUID attemptId) {
        ExamAttempt attempt = examAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        return attempt.getStatus() == AttemptStatus.IN_PROGRESS
                ? fetchFromRedis(attempt)
                : fetchFromDatabase(attempt);
    }

    // ─────────────────────────────────────────────────────────────
    // Redis path: live (IN_PROGRESS) attempts
    // ─────────────────────────────────────────────────────────────

    private ViolationDetailResponse fetchFromRedis(ExamAttempt attempt) {
        UUID attemptId = attempt.getId();
        String countStr  = redis.opsForValue().get(String.format(KEY_COUNT, attemptId));
        List<String> rawLogs = redis.opsForList().range(String.format(KEY_LOGS, attemptId), 0, -1);

        int count = countStr != null ? Integer.parseInt(countStr) : 0;
        List<ViolationItemRedisDto> items = parseRedisLogs(rawLogs, attemptId);

        log.debug("Serving live violation data from Redis for attemptId={}: count={}", attemptId, count);
        return ViolationDetailResponse.builder()
                .attemptId(attemptId).source("REDIS_LIVE")
                .violationCount(count).status(attempt.getStatus()).violations(items)
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // PostgreSQL path: finalized attempts
    // ─────────────────────────────────────────────────────────────

    private ViolationDetailResponse fetchFromDatabase(ExamAttempt attempt) {
        List<ViolationLog> dbLogs = violationLogRepository
                .findByExamAttemptIdOrderByTimestampAsc(attempt.getId());

        List<ViolationItemRedisDto> items = dbLogs.stream()
                .map(l -> ViolationItemRedisDto.builder()
                        .violationType(l.getViolationType())
                        .description(l.getDescription())
                        .timestamp(l.getTimestamp())
                        .build())
                .toList();

        log.debug("Serving historical violation data from PostgreSQL for attemptId={}", attempt.getId());
        return ViolationDetailResponse.builder()
                .attemptId(attempt.getId()).source("POSTGRESQL_FINAL")
                .violationCount(attempt.getViolationCount()).status(attempt.getStatus()).violations(items)
                .build();
    }

    private List<ViolationItemRedisDto> parseRedisLogs(List<String> rawLogs, UUID attemptId) {
        if (rawLogs == null) return List.of();
        List<ViolationItemRedisDto> result = new ArrayList<>(rawLogs.size());
        for (String raw : rawLogs) {
            try {
                result.add(objectMapper.readValue(raw, ViolationItemRedisDto.class));
            } catch (Exception ex) {
                log.warn("Skipping malformed Redis log for attemptId={}: {}", attemptId, raw);
            }
        }
        return result;
    }
}
```

### 6.3. DTO cho response

```java
// File: src/main/java/com/quicktest/modules/proctoring/dto/ViolationDetailResponse.java

package com.quicktest.modules.proctoring.dto;

import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.*;
import java.util.List;
import java.util.UUID;

@Getter
@Builder
public class ViolationDetailResponse {
    private UUID attemptId;

    /** "REDIS_LIVE" if attempt is active, "POSTGRESQL_FINAL" if already submitted */
    private String source;

    private int violationCount;
    private AttemptStatus status;
    private List<ViolationItemRedisDto> violations;
}
```

---

## 7. Bước 4: Luồng nộp bài – Batch Persistence

### 7.1. Sơ đồ luồng nộp bài mới

```
Candidate: POST /api/session/{attemptId}/submit
        │
        ▼
ExamSessionServiceImpl.submitExam()
        ├── 1. Acquire Redis Submission Lock (SETNX)
        ├── 2. Collect draft answers from Redis
        ├── 3. Enqueue SubmissionMessage to RabbitMQ
        └── 4. Return HTTP 202 Accepted immediately (< 5ms)

                    ↓ (asynchronous, in background)

ExamSubmissionConsumer.processSubmission()
        ├── 1. Grade objective questions in RAM
        │
        ├── 2. Read violations from Redis:
        │       ├── GET  quicktest:attempt:{id}:violation_count → totalViolations
        │       ├── GET  quicktest:attempt:{id}:status         → wasDisqualified?
        │       └── LRANGE quicktest:attempt:{id}:violation_logs 0 -1 → logItems
        │
        ├── 3. Build List<ViolationLog> entities
        │
        ├── 4. Single DB Transaction:
        │       ├── examAttemptRepository.save(attempt)         ← finalStatus + violationCount
        │       ├── candidateAnswerRepository.saveAll(answers)   ← batch
        │       └── violationLogRepository.saveAll(violations)   ← batch INSERT
        │
        ├── 5. Cache result in Redis for instant polling
        └── 6. Delete violation keys from Redis
```

### 7.2. Mở rộng ExamSubmissionConsumer

Thêm phần đọc vi phạm từ Redis vào trong `processSubmission()`:

```java
// Phần bổ sung thêm vào ExamSubmissionConsumer.java

private static final String KEY_VIOLATION_COUNT  = "quicktest:attempt:%s:violation_count";
private static final String KEY_VIOLATION_LOGS   = "quicktest:attempt:%s:violation_logs";
private static final String KEY_ATTEMPT_STATUS   = "quicktest:attempt:%s:status";

/**
 * Collect all buffered violation data from Redis and return a persistence-ready
 * record containing violation count, disqualification flag, and log entities.
 */
private ViolationPersistenceData collectViolationsFromRedis(UUID attemptId) {
    String countStr    = redisTemplate.opsForValue().get(String.format(KEY_VIOLATION_COUNT, attemptId));
    String redisStatus = redisTemplate.opsForValue().get(String.format(KEY_ATTEMPT_STATUS, attemptId));
    List<String> rawLogs = redisTemplate.opsForList()
            .range(String.format(KEY_VIOLATION_LOGS, attemptId), 0, -1);

    int totalViolations  = countStr != null ? Integer.parseInt(countStr) : 0;
    boolean wasDisqualified = "DISQUALIFIED".equalsIgnoreCase(redisStatus);

    List<ViolationLog> entities = new ArrayList<>();
    if (rawLogs != null) {
        for (String raw : rawLogs) {
            try {
                ViolationItemRedisDto dto = objectMapper.readValue(raw, ViolationItemRedisDto.class);
                entities.add(ViolationLog.builder()
                        .examAttempt(ExamAttempt.builder().id(attemptId).build())
                        .violationType(dto.getViolationType())
                        .description(dto.getDescription())
                        .timestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now())
                        .build());
            } catch (Exception ex) {
                log.warn("[SubmissionConsumer] Skipping malformed Redis violation entry for attempt {}: {}", attemptId, raw);
            }
        }
    }

    return new ViolationPersistenceData(totalViolations, wasDisqualified, entities);
}

/** Clean up Redis violation keys after successful DB persistence. */
private void cleanupViolationKeys(UUID attemptId) {
    redisTemplate.delete(List.of(
        String.format(KEY_VIOLATION_COUNT, attemptId),
        String.format(KEY_VIOLATION_LOGS, attemptId),
        String.format(KEY_ATTEMPT_STATUS, attemptId)
    ));
}

/** Value record holding collected violation data. */
public record ViolationPersistenceData(
    int totalViolations,
    boolean wasDisqualified,
    List<ViolationLog> entities
) {}
```

**Tích hợp vào `processSubmission()` — sau bước grading, trước khi gọi persist:**

```java
// Inside processSubmission(), after grading loop:

// --- Collect violation history from Redis ---
ViolationPersistenceData violationData = collectViolationsFromRedis(attemptId);

// Override status if candidate was disqualified during the exam
AttemptStatus finalStatus;
if (violationData.wasDisqualified()) {
    finalStatus = AttemptStatus.DISQUALIFIED;
} else if (hasPendingManualGrading) {
    finalStatus = AttemptStatus.AWAITING_MANUAL_GRADING;
} else {
    finalStatus = AttemptStatus.SUBMITTED;
}

// --- Persist everything in a single transaction ---
examPersistenceService.persistGradedAnswersAndStatusWithViolations(
    attemptId, candidateAnswers,
    finalStatus,
    hasPendingManualGrading ? null : totalScore,
    submitTime,
    violationData.totalViolations(),
    violationData.entities()         // ← batch insert all violation logs
);

// --- Cleanup Redis violation keys after TX commits ---
cleanupViolationKeys(attemptId);
```

### 7.3. Mở rộng ExamPersistenceService

```java
// Thêm method mới vào ExamPersistenceService.java

/**
 * Persists graded answers, attempt status, and batches all violation logs
 * from Redis into PostgreSQL in a single database transaction.
 */
@Transactional
public void persistGradedAnswersAndStatusWithViolations(
        UUID attemptId,
        List<CandidateAnswer> candidateAnswers,
        AttemptStatus finalStatus,
        Double finalScore,
        LocalDateTime submitTime,
        int violationCount,
        List<ViolationLog> violationLogs) {

    // 1. Update ExamAttempt: status, score, submission time, violation count
    examAttemptRepository.updateStatusAndScoreAndViolationCount(
        attemptId, finalStatus, finalScore, submitTime, violationCount);

    // 2. Batch save candidate answers (saveAll triggers batch INSERT)
    candidateAnswerRepository.saveAll(candidateAnswers);

    // 3. Batch insert all violation logs (single multi-row INSERT)
    if (!violationLogs.isEmpty()) {
        violationLogRepository.saveAll(violationLogs);
        log.info("[Persistence] Batch inserted {} violation logs for attemptId={}",
            violationLogs.size(), attemptId);
    }
}
```

---

## 8. Xử lý các case biên (Edge Cases)

### Case 1: Thí sinh tắt máy / mất mạng (Không bấm nộp)

`ExamLifecycleScheduler` chạy định kỳ, phát hiện attempt đã quá `expireAt`, gọi `autoSubmitExpiredAttempt()` → đẩy vào RabbitMQ → `ExamSubmissionConsumer` xử lý giống như nộp bình thường, **bao gồm đọc vi phạm từ Redis và persist xuống DB**. Dữ liệu không bị mất vì Redis vẫn còn TTL (duration + 4h).

### Case 2: Redis gặp sự cố khi thí sinh đang thi

Nếu Redis down trong lúc thi:
- Việc ghi vi phạm sẽ thất bại nhưng **không làm sập hệ thống** (violation ingestion là best-effort).
- Thí sinh vẫn tiếp tục làm bài được bình thường.
- Khi nộp bài, Consumer đọc Redis trả về empty list → Persist 0 violation logs.
- **Giải pháp bù (nâng cao):** Thêm circuit breaker, nếu Redis INCR thất bại → ghi tạm vào AtomicInteger in-memory và flush khi Redis phục hồi.

### Case 3: Redis TTL hết trước khi thí sinh nộp bài

Cực kỳ hiếm vì TTL = duration + 4h, nhưng để an toàn: mỗi lần `INCR` và `RPUSH`, code đã gọi `EXPIRE` lại key → Mỗi vi phạm mới sẽ refresh TTL về đủ thời gian.

### Case 4: QuickNotify down trong khi thi

Frontend `ProctoringRealtimeManager` tự động:
1. Phát hiện kết nối đứt (onclose / onerror).
2. Kích hoạt kết nối STOMP Fallback trong < 1 giây.
3. Thí sinh tiếp tục nhận cảnh báo vi phạm qua STOMP.
4. Background health check mỗi 15 giây → Tự động kết nối lại QuickNotify khi khôi phục và tắt STOMP đi.

---

## 9. So sánh trước và sau tái cấu trúc

| Tiêu chí | Trước (Legacy) | Sau (New Architecture) |
|:---------|:--------------|:-----------------------|
| **Ghi DB khi vi phạm** | 3 queries SQL mỗi event | **0 query SQL trong lúc thi** |
| **Độ trễ ghi nhận vi phạm** | 50–300ms (tùy độ nghẽn pool) | **1–3ms (Redis in-memory)** |
| **Nguy cơ Connection Pool Exhaustion** | Nghẽn từ ~30 violations/s | **Không giới hạn (INCR là atomic operation)** |
| **WebSocket engine** | Java/JVM (~1MB/connection) | **Go Goroutines (2–4KB/goroutine, 100k+ concurrent)** |
| **Độ sẵn sàng WS** | Single point of failure | **Dual-layer: QuickNotify Primary + STOMP Fallback** |
| **Persist vi phạm** | Ghi lẻ từng dòng ngay lúc xảy ra | **Batch INSERT một lần khi nộp bài** |
| **Giám sát live** | Query từ DB (tốn connection) | **Đọc trực tiếp Redis, 0 DB I/O** |
| **Giám sát lịch sử** | Query từ DB | Query từ DB (không thay đổi) |
| **Tác động khi có violation storm** | Có thể làm sập toàn bộ hệ thống | **Hoàn toàn cô lập, không ảnh hưởng luồng thi** |

---

## 10. Kế hoạch triển khai

### Giai đoạn 1 — Backend Core

- [x] Tạo `ViolationItemRedisDto.java`
- [x] Tạo `ViolationDetailResponse.java`
- [x] Tạo `RedisProctoringService.java`
- [x] Tạo `ProctoringQueryService.java`
- [x] Tạo `ViolationIngestionController.java`
- [x] Tạo `QuickNotifyDispatcherService.java`
- [x] Thêm cấu hình `AsyncConfig.java` với `quickNotifyExecutor` ThreadPool
- [x] Mở rộng `ExamSubmissionConsumer.java` với `collectViolationsFromRedis()`
- [x] Mở rộng `ExamPersistenceService.java` với `persistGradedAnswersAndStatusWithViolations()`
- [x] Thêm vào `application.properties`: `quicknotify.base-url`, `quicknotify.api-key`, `quicknotify.ws-url`
- [x] Cập nhật `ExamPaperResponse` DTO: thêm `realtimeToken`, `quickNotifyWsUrl`

### Giai đoạn 2 — Frontend Migration

- [x] Tạo `src/lib/realtime/ProctoringRealtimeManager.ts`
- [x] Tích hợp vào trang thi của thí sinh (`ProctoringShield.tsx` & `ExamRunnerPage`)
- [x] Tích hợp vào trang giám sát phòng thi của giáo viên (`TeacherLiveProctoringPage` với Minimal Status Dot)
- [x] Viết logic cấp JWT Token cho QuickNotify tại Backend (`QuickNotifyTokenService.java`)

### Giai đoạn 3 — Integration Testing

- [x] Test Fallback & Parse: Frame parser QuickNotify và fallback tự động sang STOMP (`realtime-manager.test.mjs`)
- [x] Test Ingestion & Threshold: Redis in-RAM buffering, auto-disqualification (`RedisProctoringServiceTest`, `ViolationIngestionControllerTest`)
- [x] Test Phân tầng dữ liệu: Đọc live từ Redis, đọc đã nộp từ DB (`ProctoringQueryServiceTest`)
- [x] Test Auth & Dispatcher: Ký JWT Token và đính kèm `X-API-Key` (`QuickNotifyTokenServiceTest`, `QuickNotifyDispatcherServiceTest`)
- [x] Test Nộp bài & Batch persistence: Persist toàn bộ vi phạm từ Redis sang PostgreSQL trong 1 single transaction (`ExamSubmissionConsumerTest`, `ExamSessionServiceTest`)
- [x] Script Load Test mô phỏng 500 violations/s (`scripts/test_proctoring_load.py`)

### Giai đoạn 4 — Stress Testing & Deployment

- [ ] Dùng `load_test_exam.py` mô phỏng 500 thí sinh + 50 violation events/giây
- [ ] Giám sát `hikaricp.connections.active` trước và sau
- [ ] Giám sát Redis memory: `redis-cli info memory`
- [ ] Deploy với feature flag cho phép rollback về luồng cũ nếu cần

---

*Tài liệu kỹ thuật nội bộ — QuickTest Project. Mọi thay đổi cần review qua Pull Request.*

