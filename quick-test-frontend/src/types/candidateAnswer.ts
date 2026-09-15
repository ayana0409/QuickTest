import type { QuestionType } from './question';
import type { PageResponse } from './exam';

/**
 * Grading review status for individual candidate answers.
 * Matches backend com.quicktest.modules.session.entity.GradingStatus enum.
 */
export type GradingStatus = 'AUTO_GRADED' | 'PENDING_MANUAL' | 'GRADED' | 'PENDING_AI';


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
 * Summary DTO for an essay question in the question-centric grading workflow.
 */
export interface QuestionGradingSummaryResponse {
  questionId: string;
  orderIndex: number;
  content: string;
  imageUrl?: string | null;
  maxPoints: number;
  pendingCount: number;
  gradedCount: number;
  totalSubmissions: number;
}

/**
 * Detailed DTO for a candidate's essay response in the question-centric grading view.
 */
export interface CandidateSubmissionItemDto {
  candidateAnswerId: string;
  attemptId: string;
  candidateName: string;
  studentIdentifier?: string | null;
  submittedAt: string;
  textAnswer: string;
  awardedScore?: number | null;
  teacherFeedback?: string | null;
  gradingStatus: GradingStatus;
}

/**
 * Question detail and rubric along with paginated candidate submissions.
 */
export interface QuestionSubmissionsDetailResponse {
  questionId: string;
  examId?: string;
  orderIndex: number;
  content: string;

  imageUrl?: string | null;
  sampleAnswer?: string | null;
  gradingRubric?: string | null;
  maxPoints: number;
  submissions: PageResponse<CandidateSubmissionItemDto>;
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
  startTime?: string | null;
  submitTime?: string | null;
  violationCount?: number;
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
 * Response returned after submitting manual essay grades for an attempt.
 */
export interface GradingResultResponse {
  attemptId: string;
  status: string;
  totalScore?: number | null;
  remainingPendingEssays: number;
  message: string;
}

/**
 * Individual grade item submitted by the teacher for question-centric grading.
 */
export interface ManualGradeItemRequest {
  candidateAnswerId: string;
  awardedScore: number;
  teacherFeedback?: string;
}

/**
 * Request payload for batch grading multiple candidates on a question.
 */
export interface ManualBatchGradeRequest {
  items: ManualGradeItemRequest[];
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
  awardedScore?: number;
  feedback?: string;
  similarityScore?: number;
  suggestedScore?: number;
  explanation?: string;
  confidence?: number;
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
 * Request payload to trigger background AI grading for an essay question or entire exam.
 */
export interface TriggerAiGradingRequest {
  examId?: string;
  questionId?: string;
  scope?: 'SINGLE_QUESTION' | 'ENTIRE_EXAM';
  batchSize?: number;
}


/**
 * Response acknowledging triggering of AI grading background task.
 */
export interface TriggerAiGradingResponse {
  status: string;
  message: string;
  totalQuestionsScheduled: number;
  totalSubmissionsScheduled: number;
}

