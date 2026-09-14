/**
 * Supported question types in Quick Test.
 */
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'NUMERIC' | 'ESSAY_TEXT';

/**
 * Exam lifecycle states.
 */
export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'CLOSED';

/**
 * Candidate exam attempt progression status.
 */
export type AttemptStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'AUTO_GRADED'
  | 'MANUAL_GRADING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'DISQUALIFIED';

/**
 * Grading status for individual candidate answers.
 */
export type GradingStatus = 'AUTO_GRADED' | 'NEEDS_MANUAL_REVIEW' | 'GRADED';

/**
 * Single answer option choice for SINGLE_CHOICE or MULTIPLE_CHOICE questions.
 */
export interface AnswerOption {
  id: string;
  orderIndex: number;
  content: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  isCorrect?: boolean;
}

/**
 * Answer option payload presented to candidate during exam taking.
 */
export interface OptionInPaper {
  id: string;
  orderIndex: number;
  content: string;
  imageUrl?: string | null;
}

/**
 * Question entity with its options and grading configuration.
 */
export interface Question {
  id: string;
  orderIndex: number;
  content: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  questionType: QuestionType;
  points: number;
  sampleAnswer?: string | null;
  numericTolerance?: number | null;
  gradingRubric?: string | null;
  options?: AnswerOption[];
}

/**
 * Question payload presented to candidate in exam paper.
 */
export interface QuestionInPaper {
  id: string;
  orderIndex: number;
  content: string;
  imageUrl?: string | null;
  questionType: QuestionType;
  points: number;
  options?: OptionInPaper[];
}

/**
 * Exam definition containing settings, scheduling, and questions.
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
 * Active exam paper returned when starting or resuming an exam session.
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
 * Candidate's single answer response state.
 */
export interface CandidateAnswer {
  id?: string;
  attemptId: string;
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string | null;
  awardedScore?: number | null;
  gradingStatus?: GradingStatus;
  teacherFeedback?: string | null;
  aiSimilarityScore?: number | null;
  aiGradingExplanation?: string | null;
}

/**
 * Exam attempt record representing a student's session.
 */
export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle?: string;
  candidateId?: string | null;
  candidateName?: string;
  candidateIdentifier?: string;
  status: AttemptStatus;
  startTime: string;
  submittedTime?: string | null;
  totalScore?: number | null;
  maxScore?: number | null;
  passed?: boolean | null;
  violationCount: number;
  disqualifiedReason?: string | null;
}

/**
 * Payload sent by candidate to save or auto-save an answer for a question.
 */
export interface SaveAnswerRequest {
  attemptId: string;
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string | null;
}

/**
 * Payload sent to submit the completed exam.
 */
export interface SubmitExamRequest {
  attemptId: string;
}

/**
 * Submission result response returned after exam submission.
 */
export interface SubmitResultResponse {
  attemptId: string;
  status: AttemptStatus;
  totalScore?: number | null;
  maxScore?: number | null;
  passed?: boolean | null;
  submittedAt: string;
  message: string;
}
