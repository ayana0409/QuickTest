import type { AttemptStatus } from './exam';

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
 * Incoming telemetry message sent from browser candidate client to WebSocket destination `/app/proctoring/violation`.
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
 * Proctoring periodic heartbeat payload sent to `/app/proctoring/heartbeat`.
 */
export interface HeartbeatMessage {
  attemptId: string;
  clientTimestamp: string;
  timestamp?: string;
  tabActive?: boolean;
  fullscreenActive?: boolean;
}

/**
 * Candidate status summary for teacher live proctoring dashboard list.
 */
export interface AttemptMonitorItem {
  attemptId: string;
  examId: string;
  userId?: string;
  candidateName: string;
  candidateIdentifier?: string;
  status: AttemptStatus;
  violationCount: number;
  isDisqualified: boolean;
  startTime: string;
  expireAt: string;
  submitTime?: string;
  isOnline: boolean;
}

/**
 * Audit log entry for a recorded candidate violation.
 */
export interface ViolationLogEntry {
  id: string;
  attemptId: string;
  violationType: ViolationType;
  description: string;
  timestamp: string;
}

/**
 * Detailed real-time telemetry status for candidate attempt inspector.
 */
export interface AttemptRealtimeStatusDetail {
  attemptId: string;
  examId: string;
  candidateName: string;
  candidateIdentifier?: string;
  status: AttemptStatus;
  violationCount: number;
  isDisqualified: boolean;
  isOnline: boolean;
  lastHeartbeat?: string;
  violationBreakdown: Partial<Record<ViolationType, number>>;
  recentViolations: ViolationLogEntry[];
}

/**
 * WebSocket event broadcast to teacher monitoring room when candidate violation is recorded.
 */
export interface CandidateViolationEvent {
  attemptId: string;
  examId: string;
  candidateName: string;
  candidateIdentifier?: string;
  violationType: ViolationType;
  violationCount: number;
  description: string;
  disqualified: boolean;
  timestamp: string;
}

/**
 * Request payload for manually disqualifying a candidate.
 */
export interface DisqualifyAttemptRequest {
  reason?: string;
}

/**
 * Query parameters for fetching exam monitoring list.
 */
export interface ExamMonitoringParams {
  status?: AttemptStatus;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Customizable proctoring toggles for test session.
 */
export interface ProctoringSettings {
  enabled: boolean;
  detectTabSwitch: boolean;
  detectFullscreenExit: boolean;
  blockCopyPaste: boolean;
  blockDevTools: boolean;
}

export const DEFAULT_PROCTORING_SETTINGS: ProctoringSettings = {
  enabled: true,
  detectTabSwitch: true,
  detectFullscreenExit: true,
  blockCopyPaste: true,
  blockDevTools: true,
};

