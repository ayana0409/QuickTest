import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type {
  ExamSummaryResponse,
  ExamDetailResponse,
  ExamCreateRequest,
  ExamUpdateRequest,
  PageResponse,
} from '@/types/exam';
import type {
  QuestionResponse,
  QuestionCreateRequest,
  QuestionUpdateRequest,
  MediaUploadResponse,
} from '@/types/question';

/**
 * Service providing typed API communication with Teacher Exam & Question backend endpoints.
 */
export const examService = {
  /**
   * Fetch paginated list of exams created by the authenticated teacher.
   */
  async getTeacherExams(params?: { page?: number; size?: number; sort?: string }): Promise<PageResponse<ExamSummaryResponse>> {
    const response = await apiClient.get<ApiResponse<PageResponse<ExamSummaryResponse>>>('/teacher/exams', {
      params,
    });
    return response.data.data;
  },

  /**
   * Retrieve full details of an exam (including complete questions hierarchy).
   */
  async getExamDetail(id: string): Promise<ExamDetailResponse> {
    const response = await apiClient.get<ApiResponse<ExamDetailResponse>>(`/teacher/exams/${id}`);
    return response.data.data;
  },

  /**
   * Create a new exam in DRAFT status.
   */
  async createExam(payload: ExamCreateRequest): Promise<ExamDetailResponse> {
    const response = await apiClient.post<ApiResponse<ExamDetailResponse>>('/teacher/exams', payload, {
      successMessage: 'Khởi tạo đề thi mới thành công!',
    });
    return response.data.data;
  },

  /**
   * Update configuration and settings of an existing exam.
   */
  async updateExam(id: string, payload: ExamUpdateRequest): Promise<ExamDetailResponse> {
    const response = await apiClient.put<ApiResponse<ExamDetailResponse>>(`/teacher/exams/${id}`, payload, {
      successMessage: 'Cập nhật thông tin đề thi thành công!',
    });
    return response.data.data;
  },

  /**
   * Publish an exam, transitioning status from DRAFT to PUBLISHED.
   */
  async publishExam(id: string): Promise<ExamDetailResponse> {
    const response = await apiClient.patch<ApiResponse<ExamDetailResponse>>(
      `/teacher/exams/${id}/publish`,
      undefined,
      {
        successMessage: 'Xuất bản đề thi thành công! Thí sinh có thể bắt đầu làm bài.',
      }
    );
    return response.data.data;
  },

  /**
   * Close an active exam, transitioning status to CLOSED.
   */
  async closeExam(id: string): Promise<ExamDetailResponse> {
    const response = await apiClient.patch<ApiResponse<ExamDetailResponse>>(
      `/teacher/exams/${id}/close`,
      undefined,
      {
        successMessage: 'Đã đóng đề thi thành công.',
      }
    );
    return response.data.data;
  },

  /**
   * Delete an exam (only allowed for DRAFT exams).
   */
  async deleteExam(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`/teacher/exams/${id}`, {
      successMessage: 'Đã xóa đề thi thành công.',
    });
  },

  /**
   * Add a new question to an exam.
   */
  async addQuestion(examId: string, payload: QuestionCreateRequest): Promise<QuestionResponse> {
    const response = await apiClient.post<ApiResponse<QuestionResponse>>(
      `/teacher/exams/${examId}/questions`,
      payload,
      {
        successMessage: 'Thêm câu hỏi mới vào đề thi thành công!',
      }
    );
    return response.data.data;
  },

  /**
   * Update an existing question.
   */
  async updateQuestion(questionId: string, payload: QuestionUpdateRequest): Promise<QuestionResponse> {
    const response = await apiClient.put<ApiResponse<QuestionResponse>>(
      `/teacher/questions/${questionId}`,
      payload,
      {
        successMessage: 'Cập nhật câu hỏi thành công!',
      }
    );
    return response.data.data;
  },

  /**
   * Delete a question from an exam.
   */
  async deleteQuestion(questionId: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`/teacher/questions/${questionId}`, {
      successMessage: 'Đã gỡ bỏ câu hỏi khỏi đề thi.',
    });
  },

  /**
   * Upload and attach an image directly to a question.
   */
  async uploadQuestionImage(questionId: string, file: File): Promise<QuestionResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.put<ApiResponse<QuestionResponse>>(
      `/teacher/questions/${questionId}/image`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        successMessage: 'Cập nhật hình ảnh câu hỏi thành công!',
      }
    );
    return response.data.data;
  },

  /**
   * Single synchronous image upload to Cloudinary storage.
   */
  async uploadMedia(file: File, folderType = 'questions'): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderType', folderType);
    const response = await apiClient.post<ApiResponse<MediaUploadResponse>>(
      '/teacher/media/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        successMessage: 'Tải ảnh minh họa lên thành công!',
      }
    );
    return response.data.data;
  },
};
