import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type {
  ExamPaper,
  StartExamRequest,
  ResumeExamResponse,
  SubmitExamRequest,
  SubmitResultResponse,
} from '@/types/exam';
import type { SaveAnswerRequest } from '@/types/candidateAnswer';

/**
 * Service handling Candidate Exam Session operations matching Spring Boot ExamSessionController:
 * - Start exam with access code: POST /api/session/start
 * - Resume exam session by attemptId: GET /api/session/{attemptId}/resume
 * - Auto-save single question answer: PUT /api/session/{attemptId}/save
 * - Submit exam attempt: POST /api/session/{attemptId}/submit
 * - Poll / retrieve result: GET /api/session/{attemptId}/result
 */
export const candidateSessionService = {
  /**
   * Start a new exam session or retrieve an active attempt for the given access code.
   * Automatically enriches payload with guest credentials if candidate is taking exam without logging in.
   */
  async startExam(payload: StartExamRequest): Promise<ExamPaper> {
    const finalPayload: StartExamRequest = { ...payload };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      if (!token) {
        if (!finalPayload.guestName) {
          finalPayload.guestName = localStorage.getItem('quicktest_guest_name') || undefined;
        }
        if (!finalPayload.guestIdentifier) {
          finalPayload.guestIdentifier = localStorage.getItem('quicktest_guest_id') || undefined;
        }
      }
    }

    const response = await apiClient.post<ApiResponse<ExamPaper>>(
      '/session/start',
      finalPayload
    );
    return response.data.data;
  },

  /**
   * Resume an active exam session after page refresh or network disconnection.
   */
  async resumeSession(attemptId: string): Promise<ResumeExamResponse> {
    const response = await apiClient.get<ApiResponse<ResumeExamResponse>>(
      `/session/${attemptId}/resume`
    );
    return response.data.data;
  },

  /**
   * Auto-save candidate answer draft to Redis Hash silently in the background.
   */
  async autoSaveAnswer(
    attemptId: string,
    payload: SaveAnswerRequest
  ): Promise<void> {
    const cleanPayload: {
      questionId: string;
      selectedOptionIds?: string[];
      textAnswer?: string;
    } = {
      questionId: payload.questionId,
    };

    if (Array.isArray(payload.selectedOptionIds)) {
      cleanPayload.selectedOptionIds = payload.selectedOptionIds;
    }

    if (payload.textAnswer !== undefined && payload.textAnswer !== null) {
      cleanPayload.textAnswer = payload.textAnswer;
    }

    await apiClient.put<ApiResponse<void>>(
      `/session/${attemptId}/save`,
      cleanPayload,
      {
        silent: true,
        showSuccessToast: false,
        showErrorToast: false,
      }
    );
  },

  /**
   * Finalize and submit the exam attempt.
   */
  async submitExam(
    attemptId: string,
    payload?: SubmitExamRequest
  ): Promise<SubmitResultResponse> {
    const response = await apiClient.post<ApiResponse<SubmitResultResponse>>(
      `/session/${attemptId}/submit`,
      payload || { attemptId },
      {
        successMessage: 'Nộp bài thi thành công!',
      }
    );
    return response.data.data;
  },

  /**
   * Retrieve submission result and score for candidate review.
   */
  async getResult(attemptId: string): Promise<SubmitResultResponse> {
    const response = await apiClient.get<ApiResponse<SubmitResultResponse>>(
      `/session/${attemptId}/result`
    );
    return response.data.data;
  },
};
