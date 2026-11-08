export type ProctoringViolationType =
  | 'NO_FACE_DETECTED'
  | 'MULTIPLE_FACES'
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'MULTI_SCREEN'
  | 'EXIT_FULLSCREEN'
  | 'DEVTOOLS_OPEN'
  | 'CLIPBOARD_PASTE'
  | 'VOICE_DETECTED';

export interface AdminProctoringMedia {
  id: string;
  attemptId: string;
  examId: string;
  examTitle: string;
  attemptStatus: string;
  studentId?: string;
  studentName: string;
  studentEmail: string;
  violationType: ProctoringViolationType;
  description: string;
  evidenceUrl: string;
  timestamp: string;
  isAnimatedBurst: boolean;
  storageType: 'CLOUDINARY' | 'INLINE_DATA';
}

export interface AdminProctoringMediaStats {
  totalMediaCount: number;
  singleSnapshotCount: number;
  burstAnimationCount: number;
  recent7DaysCount: number;
  olderThan30DaysCount: number;
  examsWithMediaCount: number;
}

export interface ProctoringMediaCleanupStatus {
  isRunning: boolean;
  totalDeleted: number;
  estimatedRemaining: number;
  retentionDaysKept: number;
  batchSize: number;
  cutoff: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  message: string;
}

export interface ProctoringMediaFilterParams {
  violationType?: string;
  examId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface ProctoringMediaCleanupRequest {
  days: number;
  violationType?: string;
  examId?: string;
  onlyFinishedExams: boolean;
  batchSize?: number;
}

