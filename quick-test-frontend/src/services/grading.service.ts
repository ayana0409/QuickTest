import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type {
  QuestionGradingSummaryResponse,
  QuestionSubmissionsDetailResponse,
  ManualBatchGradeRequest,
  ManualBatchGradeResponse,
  TriggerAiGradingRequest,
  TriggerAiGradingResponse,
  GradingStatus,
  AiSingleGradeDto,
  AttemptGradingDetailResponse,
  GradeEssaySubmissionRequest,
  GradingResultResponse,
} from '@/types/candidateAnswer';
import type { AttemptSummaryDto, AttemptStatus, PageResponse } from '@/types/exam';

/**
 * Aggregated statistics for all attempts within a specific exam.
 * Mirrors the backend ExamAttemptStatsResponse DTO.
 */
export interface ExamAttemptStatsDto {
  totalAttempts: number;
  completedAttempts: number;
  pendingGradingAttempts: number;
  inProgressAttempts: number;
  disqualifiedAttempts: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  gradedCount: number;
  totalViolations: number;
  maxViolations: number;
  attemptsWithViolations: number;
  averageDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  minDurationSeconds: number | null;
}

/**
 * Filter parameters for querying candidate exam attempts.
 */
export interface GetExamAttemptsParams {
  status?: AttemptStatus;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Filter parameters for querying question candidate submissions.
 */
export interface GetSubmissionsParams {
  status?: GradingStatus;
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Service providing API communication for Question-Centric Grading and AI evaluation.
 */
export const gradingService = {
  /**
   * Fetch all essay questions for a given exam along with their grading status summaries.
   *
   * @param examId The unique identifier of the target exam
   * @returns Array of question summaries with submission counts and grading progress
   */
  async getQuestionsForGrading(examId: string): Promise<QuestionGradingSummaryResponse[]> {
    const response = await apiClient.get<ApiResponse<QuestionGradingSummaryResponse[]>>(
      `/teacher/grading/exams/${examId}/questions`
    );
    return response.data.data;
  },

  /**
   * Fetch rubric, sample answer, and paginated candidate submissions for a specific essay question.
   *
   * @param questionId The unique identifier of the question
   * @param params Filtering and pagination options (status, page, size, sort)
   * @returns Detailed question content, rubric, and candidate answer page
   */
  async getQuestionSubmissions(
    questionId: string,
    params?: GetSubmissionsParams
  ): Promise<QuestionSubmissionsDetailResponse> {
    const response = await apiClient.get<ApiResponse<QuestionSubmissionsDetailResponse>>(
      `/teacher/grading/questions/${questionId}/submissions`,
      { params }
    );
    return response.data.data;
  },

  /**
   * Save manual grades and feedback for one or more candidate submissions of a question.
   *
   * @param questionId The unique identifier of the question
   * @param payload List of candidate answers with assigned scores and optional feedback
   * @returns Batch grading summary result with graded count
   */
  async saveManualGrades(
    questionId: string,
    payload: ManualBatchGradeRequest
  ): Promise<ManualBatchGradeResponse> {
    const response = await apiClient.post<ApiResponse<ManualBatchGradeResponse>>(
      `/teacher/grading/questions/${questionId}/manual`,
      payload,
      {
        successMessage: 'Lưu điểm và nhận xét thành công!',
      }
    );
    return response.data.data;
  },

  /**
   * Trigger background AI grading for an essay question or entire exam.
   *
   * @param payload Scope and target configuration for AI evaluation
   * @returns Acknowledgement message and scheduled task details
   */
  async triggerAiGrading(payload: TriggerAiGradingRequest): Promise<TriggerAiGradingResponse> {
    const response = await apiClient.post<ApiResponse<TriggerAiGradingResponse>>(
      '/teacher/grading/trigger-ai',
      payload,
      {
        successMessage: 'Đã kích hoạt chấm AI tự động. Hệ thống đang tiến hành xử lý trong nền!',
      }
    );
    return response.data.data;
  },

  /**
   * Evaluate a single candidate essay response using AI.
   *
   * @param candidateAnswerId The unique identifier of the candidate's answer
   * @returns AI grading result with awarded score and feedback
   */
  async gradeSingleAnswerWithAi(candidateAnswerId: string): Promise<AiSingleGradeDto> {
    const response = await apiClient.post<ApiResponse<AiSingleGradeDto>>(
      `/teacher/grading/answers/${candidateAnswerId}/ai`,
      {},
      {
        successMessage: 'Đã hoàn tất chấm AI cho thí sinh!',
      }
    );
    return response.data.data;
  },

  /**
   * Fetch paginated list of candidate attempts for a specific exam.
   *
   * @param examId The unique identifier of the target exam
   * @param params Filtering by status, search keyword, and pagination options
   * @returns Paginated list of attempt summaries
   */
  async getExamAttempts(
    examId: string,
    params?: GetExamAttemptsParams
  ): Promise<PageResponse<AttemptSummaryDto>> {
    const response = await apiClient.get<ApiResponse<PageResponse<AttemptSummaryDto>>>(
      `/teacher/grading/exams/${examId}/attempts`,
      { params }
    );
    return response.data.data;
  },

  /**
   * Retrieve full grading breakdown for an individual attempt.
   *
   * @param attemptId The unique identifier of the target attempt
   * @returns Detailed candidate answers, rubric criteria, and auto-graded questions
   */
  async getAttemptDetailForGrading(
    attemptId: string
  ): Promise<AttemptGradingDetailResponse> {
    const response = await apiClient.get<ApiResponse<AttemptGradingDetailResponse>>(
      `/teacher/grading/attempts/${attemptId}`
    );
    return response.data.data;
  },

  /**
   * Submit manual grades and optional feedback for essay questions in an attempt.
   *
   * @param payload Candidate answer grades and feedbacks
   * @returns Updated attempt status and score confirmation
   */
  async submitEssayGrades(
    payload: GradeEssaySubmissionRequest
  ): Promise<GradingResultResponse> {
    const response = await apiClient.post<ApiResponse<GradingResultResponse>>(
      '/teacher/grading/attempts/submit-grades',
      payload,
      {
        successMessage: 'Cập nhật điểm thành công!',
      }
    );
    return response.data.data;
  },

  /**
   * Fetch aggregated statistics for all attempts in an exam in a single API call.
   * Returns counts by status, score min/max/avg, violation totals, and duration metrics.
   *
   * @param examId The unique identifier of the target exam
   * @returns Aggregated attempt statistics
   */
  async getExamAttemptStats(examId: string): Promise<ExamAttemptStatsDto> {
    const response = await apiClient.get<ApiResponse<ExamAttemptStatsDto>>(
      `/teacher/grading/exams/${examId}/stats`
    );
    return response.data.data;
  },

  /**
   * Export all candidate exam attempts for an exam to an Excel (.xlsx) file.
   * Downloads as binary blob.
   *
   * @param examId The unique identifier of the target exam
   * @param status Optional filter by attempt status
   * @param search Optional keyword search
   * @returns Blob representation of the Excel spreadsheet
   */
  async exportExamAttemptsExcel(
    examId: string,
    status?: AttemptStatus,
    search?: string
  ): Promise<Blob> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (search && search.trim()) params.search = search.trim();

    const response = await apiClient.get(
      `/teacher/grading/exams/${examId}/attempts/export-excel`,
      {
        params,
        responseType: 'blob',
      }
    );
    return response.data as Blob;
  },
};

