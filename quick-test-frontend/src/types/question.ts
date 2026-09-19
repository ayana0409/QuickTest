/**
 * Supported question types in QuickTest assessment engine.
 */
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'NUMERIC' | 'ESSAY_TEXT';

/**
 * Answer option entity / payload for SINGLE_CHOICE and MULTIPLE_CHOICE questions.
 */
export interface AnswerOption {
  id?: string;
  orderIndex: number;
  content: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  isCorrect?: boolean;
}

/**
 * Data Transfer Object for creating or updating an answer option.
 */
export interface AnswerOptionDto {
  orderIndex?: number;
  content: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  isCorrect?: boolean;
}

/**
 * Response DTO representing an answer option returned to teachers/evaluators.
 */
export interface AnswerOptionResponse {
  id: string;
  orderIndex: number;
  content: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  isCorrect: boolean;
}

/**
 * Secure answer option payload presented to candidate during exam taking (hides correctness).
 */
export interface OptionInPaper {
  id: string;
  orderIndex: number;
  content: string;
  imageUrl?: string | null;
}

/**
 * Full question entity definition with options and grading rubrics.
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
  examId?: string;
  options?: AnswerOption[];
}

/**
 * Question payload stripped of correct answers, delivered to candidates during active test taking.
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
 * Detailed question response returned for teacher management views.
 */
export interface QuestionResponse {
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
  options?: AnswerOptionResponse[];
}

/**
 * Request payload for creating a new question inside an exam.
 */
export interface QuestionCreateRequest {
  orderIndex?: number;
  content: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  questionType: QuestionType;
  points: number;
  sampleAnswer?: string | null;
  numericTolerance?: number | null;
  gradingRubric?: string | null;
  options?: AnswerOptionDto[];
}

/**
 * Request payload for updating an existing question.
 */
export interface QuestionUpdateRequest {
  orderIndex?: number;
  content?: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  questionType?: QuestionType;
  points?: number;
  sampleAnswer?: string | null;
  numericTolerance?: number | null;
  gradingRubric?: string | null;
  options?: AnswerOptionDto[];
}

/**
 * Response returned after uploading question or option media (Cloudinary / S3).
 */
export interface MediaUploadResponse {
  url: string;
  publicId: string;
  format?: string;
  bytes?: number;
}

/**
 * Status tracking response for asynchronous batch media processing.
 */
export interface BatchUploadStatusResponse {
  taskId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processedCount: number;
  totalCount: number;
  errorMessages?: string[];
}

/**
 * Item returned in the paginated question bank query.
 * Represents a question along with metadata about the originating exam.
 */
export interface QuestionBankItem {
  id: string;
  examId: string;
  examTitle: string;
  examAccessCode: string;
  examSubject?: string | null;
  content: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  questionType: QuestionType;
  points: number;
  orderIndex: number;
  sampleAnswer?: string | null;
  numericTolerance?: number | null;
  gradingRubric?: string | null;
  options?: AnswerOptionResponse[];
}

/**
 * Request payload for importing questions from bank into an exam.
 */
export interface QuestionImportRequest {
  questionIds: string[];
}

