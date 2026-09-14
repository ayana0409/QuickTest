/**
 * Supported violation events detected by proctoring subsystem.
 */
export type ViolationType =
  | 'TAB_SWITCH'
  | 'EXIT_FULLSCREEN'
  | 'DEVTOOLS_OPEN'
  | 'NO_FACE_DETECTED'
  | 'MULTIPLE_FACES'
  | 'COPY_PASTE_ATTEMPT'
  | 'TEACHER_DISQUALIFY';

/**
 * Incoming telemetry message sent from browser candidate client to WebSocket destination `/app/proctor/violation`.
 */
export interface ViolationTelemetryMessage {
  attemptId: string;
  violationType: ViolationType;
  description?: string;
  clientTimestamp: string;
}

/**
 * Real-time alert response dispatched from server to candidate via WebSocket.
 */
export interface ViolationAlertResponse {
  attemptId: string;
  violationType: ViolationType;
  violationCount: number;
  maxAllowed: number;
  remainingAllowed: number;
  disqualified: boolean;
  message: string;
  timestamp: string;
}

/**
 * Proctoring periodic heartbeat payload sent to `/app/proctor/heartbeat`.
 */
export interface HeartbeatMessage {
  attemptId: string;
  timestamp: string;
  tabActive: boolean;
  fullscreenActive: boolean;
}

/**
 * Candidate status summary for teacher live proctoring dashboard.
 */
export interface AttemptRealtimeStatus {
  attemptId: string;
  candidateName: string;
  candidateIdentifier?: string;
  status: string;
  violationCount: number;
  isDisqualified: boolean;
  lastHeartbeatAt?: string;
}
