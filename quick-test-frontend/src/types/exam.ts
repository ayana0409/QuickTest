import type { Question, QuestionInPaper, QuestionResponse } from './question';
import type { CandidateAnswer, SaveAnswerRequest, GradingStatus } from './candidateAnswer';

// Re-export question and candidateAnswer types for seamless backward compatibility
export * from './question';
export * from './candidateAnswer';

/**
 * Exam lifecycle states matching backend ExamStatus enum.
 */
export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'CLOSED' | 'CLONING';

/**
 * Candidate exam attempt progression status matching backend AttemptStatus enum.
 */
export type AttemptStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'AWAITING_MANUAL_GRADING'
  | 'DISQUALIFIED'
  | 'AUTO_GRADED'
  | 'MANUAL_GRADING'
  | 'COMPLETED'
  | 'EXPIRED';

/**
 * Summary DTO of an exam candidate session / attempt for teacher management views.
 */
export interface AttemptSummaryDto {
  attemptId: string;
  examId: string;
  candidateName: string;
  candidateIdentifier?: string | null;
  status: AttemptStatus;
  totalScore?: number | null;
  startTime?: string | null;
  submitTime?: string | null;
  totalQuestions: number;
  pendingEssayCount: number;
  hasPendingEssay: boolean;
  violationCount: number;
}

/**
 * Exam definition containing core settings, scheduling, and questions list.
 */
export interface Exam {
  id: string;
  title: string;
  accessCode: string;
  description?: string | null;
  status: ExamStatus;
  durationMinutes: number;
  maxAttempts: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  createdAt: string;
  createdById?: string;
  createdByTeacherId?: string;
  createdByName?: string;
  createdByTeacherName?: string;
  createdByEmail?: string;
  totalQuestions?: number;
  totalPoints?: number;
  questions?: Question[];
}

/**
 * Summary DTO for displaying exams in catalog or teacher lists without question payload.
 */
export interface ExamSummaryResponse {
  id: string;
  title: string;
  accessCode: string;
  description?: string | null;
  status: ExamStatus;
  durationMinutes: number;
  maxAttempts: number;
  startTime?: string | null;
  endTime?: string | null;
  createdAt: string;
  createdByTeacherName?: string;
  totalQuestions: number;
  totalPoints: number;
  published: boolean;
}

/**
 * Detailed exam response for teacher management views, containing full questions hierarchy.
 */
export interface ExamDetailResponse {
  id: string;
  title: string;
  accessCode: string;
  description?: string | null;
  status: ExamStatus;
  durationMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  startTime?: string | null;
  endTime?: string | null;
  createdAt: string;
  createdByTeacherId: string;
  createdByTeacherName: string;
  totalQuestions: number;
  totalPoints: number;
  questions: QuestionResponse[];
}

/**
 * Request payload for creating a new exam.
 */
export interface ExamCreateRequest {
  title: string;
  accessCode?: string;
  description?: string;
  durationMinutes: number;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

/**
 * Request payload for updating existing exam settings.
 */
export interface ExamUpdateRequest {
  title?: string;
  description?: string | null;
  durationMinutes?: number;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  status?: ExamStatus;
}

/**
 * Active exam paper returned when starting or resuming an exam session for a candidate.
 */
export interface ExamPaper {
  attemptId: string;
  examId: string;
  examTitle: string;
  examDescription?: string | null;
  durationMinutes: number;
  totalQuestions: number;
  startTime: string;
  expireAt: string;
  serverTime: string;
  remainingSeconds: number;
  candidateName?: string | null;
  candidateIdentifier?: string | null;
  questions: QuestionInPaper[];
}

/**
 * Exam attempt record representing a student's or guest's session.
 */
export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle?: string;
  userId?: string | null;
  candidateId?: string | null;
  candidateName?: string;
  candidateIdentifier?: string;
  status: AttemptStatus;
  startTime: string;
  expireAt?: string | null;
  submittedTime?: string | null;
  submitTime?: string | null;
  totalScore?: number | null;
  maxScore?: number | null;
  passed?: boolean | null;
  violationCount: number;
  disqualifiedReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  answers?: CandidateAnswer[];
}

/**
 * Request payload to start an exam session.
 */
export interface StartExamRequest {
  accessCode: string;
  guestName?: string;
  guestIdentifier?: string;
}

/**
 * Request payload to resume an interrupted exam session.
 */
export interface ResumeExamResponse {
  attemptId?: string;
  examPaper?: ExamPaper;
  paper?: ExamPaper;
  savedAnswers: Record<string, { selectedOptionIds?: string[]; textAnswer?: string }>;
}

/**
 * Payload sent by candidate to submit the finished exam attempt.
 */
export interface SubmitExamRequest {
  attemptId: string;
}

/**
 * Submission response returned immediately upon submission acceptance.
 */
export interface SubmitAcceptedResponse {
  attemptId: string;
  status: AttemptStatus;
  submittedAt: string;
  message: string;
}

/**
 * Submission result response returned after automated scoring.
 */
export interface SubmitResultResponse {
  attemptId: string;
  status: AttemptStatus;
  totalScore?: number | null;
  maxScore?: number | null;
  passed?: boolean | null;
  submittedAt: string;
  message: string;
  gradingStatus?: GradingStatus;
}

/**
 * Standardized pagination wrapper returned from backend PageResponse<T>.
 */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isFirst: boolean;
  isLast: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Request payload to republish an existing closed exam.
 */
export interface ExamRepublishRequest {
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number;
  maxAttempts?: number;
}

/**
 * Request payload to duplicate an existing exam.
 */
export interface ExamDuplicateRequest {
  title?: string;
}

