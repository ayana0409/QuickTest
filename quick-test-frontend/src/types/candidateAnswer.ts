import type { QuestionType } from './question';

/**
 * Grading review status for individual candidate answers.
 */
export type GradingStatus = 'AUTO_GRADED' | 'NEEDS_MANUAL_REVIEW' | 'GRADED';

/**
 * Candidate's single answer response entity or state.
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
 * Auto-save request payload sent from client to persist candidate's answer during test taking.
 */
export interface SaveAnswerRequest {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string | null;
  attemptId?: string;
  savedAt?: string;
}

/**
 * Item representing an essay question that requires manual or AI grading review.
 */
export interface EssayGradingItem {
  candidateAnswerId: string;
  questionId: string;
  orderIndex: number;
  content: string;
  points: number;
  textAnswer?: string | null;
  sampleAnswer?: string | null;
  gradingRubric?: string | null;
  awardedScore?: number | null;
  gradingStatus: GradingStatus;
  teacherFeedback?: string | null;
  aiSimilarityScore?: number | null;
  aiGradingExplanation?: string | null;
}

/**
 * Item representing an objectively scored question (SINGLE_CHOICE, MULTIPLE_CHOICE, NUMERIC).
 */
export interface AutoGradedItem {
  candidateAnswerId?: string;
  questionId: string;
  orderIndex: number;
  content: string;
  questionType: QuestionType;
  points: number;
  awardedScore: number;
  isCorrect: boolean;
  selectedOptionIds?: string[];
  textAnswer?: string | null;
}

/**
 * Detailed candidate submission item shown in teacher grading views.
 */
export interface CandidateSubmissionItem {
  submissionId: string;
  attemptId: string;
  candidateName: string;
  candidateIdentifier?: string | null;
  submittedAt: string;
  textAnswer: string;
  currentScore?: number | null;
  maxScore: number;
  status: GradingStatus;
  feedback?: string | null;
  isAiGraded?: boolean;
}

/**
 * Comprehensive grading overview for an entire candidate exam attempt.
 */
export interface AttemptGradingDetailResponse {
  attemptId: string;
  examId: string;
  examTitle: string;
  candidateName: string;
  candidateIdentifier?: string | null;
  status: string;
  currentTotalScore?: number | null;
  autoGradedScore?: number | null;
  maxTotalPoints: number;
  submitTime?: string | null;
  essayQuestions: EssayGradingItem[];
  autoGradedQuestions: AutoGradedItem[];
}

/**
 * Request payload for grading a single essay response item.
 */
export interface GradeEssayItemRequest {
  candidateAnswerId: string;
  awardedScore: number;
  teacherFeedback?: string;
}

/**
 * Request payload for grading multiple essay items in a submission.
 */
export interface GradeEssaySubmissionRequest {
  attemptId: string;
  grades: GradeEssayItemRequest[];
}

/**
 * Request payload for batch manual grading by question.
 */
export interface ManualGradeItemRequest {
  candidateAnswerId: string;
  awardedScore: number;
  feedback?: string;
}

/**
 * Request payload for batch grading multiple candidates at once.
 */
export interface ManualBatchGradeRequest {
  questionId: string;
  grades: ManualGradeItemRequest[];
}

/**
 * Response returned after batch manual grading.
 */
export interface ManualBatchGradeResponse {
  gradedCount: number;
  success: boolean;
  message?: string;
}

/**
 * AI single item grading result.
 */
export interface AiSingleGradeDto {
  candidateAnswerId: string;
  similarityScore: number;
  suggestedScore: number;
  explanation: string;
  confidence: number;
}

/**
 * AI batch grading result container.
 */
export interface AiBatchGradingResultDto {
  examId: string;
  processedCount: number;
  results: AiSingleGradeDto[];
}

/**
 * Request payload to trigger background AI grading for an exam or specific attempt.
 */
export interface TriggerAiGradingRequest {
  examId: string;
  attemptId?: string;
  questionId?: string;
  overrideExistingScores?: boolean;
}

/**
 * Response acknowledging triggering of AI grading background task.
 */
export interface TriggerAiGradingResponse {
  taskId: string;
  status: 'QUEUED' | 'RUNNING' | 'FAILED';
  queuedItemsCount: number;
  message: string;
}
