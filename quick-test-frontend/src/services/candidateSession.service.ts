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
import type { ViolationAlertResponse, CloudinaryUploadSignatureResponse } from '@/types/proctoring';

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
      finalPayload,
      { successMessage: 'Tham gia phòng thi thành công!' }
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
   * Report proctoring violation telemetry directly to Redis buffer.
   * High performance (1-3ms in-RAM), zero database queries during the active exam.
   */
  async reportViolation(
    attemptId: string,
    payload: {
      attemptId?: string;
      violationType: string;
      description?: string;
      evidenceUrl?: string;
      clientTimestamp?: string;
      timestamp?: string;
    }
  ): Promise<ViolationAlertResponse | undefined> {
    const body = {
      attemptId,
      violationType: payload.violationType,
      description: payload.description,
      evidenceUrl: payload.evidenceUrl,
      clientTimestamp: payload.clientTimestamp || payload.timestamp || new Date().toISOString(),
    };

    const response = await apiClient.post<ApiResponse<ViolationAlertResponse>>(
      `/session/${attemptId}/proctoring/violation`,
      body,
      {
        silent: true,
        showSuccessToast: false,
        showErrorToast: false,
      }
    );
    return response.data?.data;
  },

  /**
   * Request upload signature from backend for uploading evidence directly to Cloudinary.
   */
  async getUploadSignature(attemptId: string): Promise<CloudinaryUploadSignatureResponse> {
    const response = await apiClient.get<ApiResponse<CloudinaryUploadSignatureResponse>>(
      `/session/${attemptId}/proctoring/upload-signature`,
      {
        silent: true,
        showSuccessToast: false,
        showErrorToast: false,
      }
    );
    if (!response.data?.data) {
      throw new Error('Failed to obtain upload signature');
    }
    return response.data.data;
  },

  /**
   * Upload evidence image directly to Cloudinary using signed parameters.
   */
  async uploadEvidenceToCloudinary(
    signatureInfo: CloudinaryUploadSignatureResponse,
    fileBlob: Blob,
    filename: string = 'evidence.webp'
  ): Promise<string> {
    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    formData.append('api_key', signatureInfo.apiKey);
    formData.append('timestamp', signatureInfo.timestamp.toString());
    formData.append('signature', signatureInfo.signature);
    formData.append('folder', signatureInfo.folder);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureInfo.cloudName}/image/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudinary direct upload failed (${res.status}): ${errText}`);
    }

    const json = await res.json();
    return json.secure_url || json.url;
  },

  /**
   * Send periodic 15-second heartbeat signal to Redis RAM (60s TTL)
   * and verify active session lock ownership.
   */
  async sendHeartbeat(attemptId: string): Promise<void> {
    await apiClient.post(
      '/session/proctoring/heartbeat',
      {
        attemptId,
        clientTimestamp: new Date().toISOString(),
      },
      {
        silent: true,
        showSuccessToast: false,
        showErrorToast: false,
      }
    );
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
