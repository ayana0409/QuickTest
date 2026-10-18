import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { QuestionResponse } from '@/types/question';
import type {
  AiGenerateQuizRequest,
  AiGenerateJobResponse,
  AiGeneratedQuestionDto,
} from '@/types/aiGenerate';

/**
 * Service for communicating with backend AI Document-to-Exam generation endpoints.
 */
export const aiGenerateService = {
  /**
   * Submits a document file or raw text to enqueue an AI quiz generation job
   * into the shared single-thread queue.
   */
  async generateFromDocument(
    file: File | null,
    request: AiGenerateQuizRequest
  ): Promise<AiGenerateJobResponse> {
    const formData = new FormData();

    if (file) {
      formData.append('file', file);
    }
    if (request.examId) {
      formData.append('examId', request.examId);
    }
    if (request.totalQuestions != null) {
      formData.append('totalQuestions', String(request.totalQuestions));
    }
    if (request.difficulty) {
      formData.append('difficulty', request.difficulty);
    }
    if (request.language) {
      formData.append('language', request.language);
    }
    if (request.rawText) {
      formData.append('rawText', request.rawText);
    }
    if (request.additionalInstructions) {
      formData.append('additionalInstructions', request.additionalInstructions);
    }
    if (request.targetQuestionTypes && request.targetQuestionTypes.length > 0) {
      request.targetQuestionTypes.forEach((type) => {
        formData.append('targetQuestionTypes', type);
      });
    }

    const response = await apiClient.post<ApiResponse<AiGenerateJobResponse>>(
      '/teacher/ai-generate/from-document',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes timeout for large document uploads
        showSuccessToast: false, // Progress modal will display live status
      }
    );

    return response.data.data;
  },

  /**
   * Polls the live status, progress percent, and generated questions of a background AI job.
   */
  async getJobStatus(jobId: string): Promise<AiGenerateJobResponse> {
    const response = await apiClient.get<ApiResponse<AiGenerateJobResponse>>(
      `/teacher/ai-generate/jobs/${jobId}`,
      {
        silent: true, // Suppress repeated toasts during polling
      }
    );

    return response.data.data;
  },

  /**
   * Cancels a queued or running generation job and releases the user's AI concurrency lock.
   */
  async cancelJob(jobId: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(
      `/teacher/ai-generate/jobs/${jobId}/cancel`,
      {},
      {
        successMessage: 'Đã hủy tác vụ tạo đề thi bằng AI.',
      }
    );
  },

  /**
   * Bulk commits approved AI-generated questions into the target exam.
   */
  async commitQuestionsToExam(
    examId: string,
    questions: AiGeneratedQuestionDto[]
  ): Promise<QuestionResponse[]> {
    const response = await apiClient.post<ApiResponse<QuestionResponse[]>>(
      `/teacher/ai-generate/commit-to-exam/${examId}`,
      { questions },
      {
        successMessage: `Đã thêm thành công ${questions.length} câu hỏi vào đề thi!`,
      }
    );

    return response.data.data;
  },
};
