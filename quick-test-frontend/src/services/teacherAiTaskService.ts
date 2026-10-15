import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { AiGeneratedQuestionDto } from '@/types/aiGenerate';

/**
 * Representation of a teacher's asynchronous AI background task.
 */
export interface TeacherAiTaskDto {
  taskId: string;
  type: 'AI_QUIZ_GEN' | 'AI_GRADING' | string;
  teacherId: string;
  title: string;
  targetExamId?: string | null;
  targetExamTitle?: string | null;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  progressPercent: number;
  currentStep?: string | null;
  totalItems: number;
  processedItems: number;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  questions?: AiGeneratedQuestionDto[] | null;
}

/**
 * Service for managing teacher's background AI tasks.
 */
export const teacherAiTaskService = {
  /**
   * Retrieves all recent AI tasks initiated by the authenticated teacher.
   */
  async getMyTasks(): Promise<TeacherAiTaskDto[]> {
    const response = await apiClient.get<ApiResponse<TeacherAiTaskDto[]>>(
      '/teacher/ai-tasks',
      { silent: true }
    );
    return response.data.data;
  },

  /**
   * Retrieves full details and question payload of a specific AI task.
   */
  async getTaskDetail(taskId: string): Promise<TeacherAiTaskDto> {
    const response = await apiClient.get<ApiResponse<TeacherAiTaskDto>>(
      `/teacher/ai-tasks/${taskId}`,
      { silent: true }
    );
    return response.data.data;
  },

  /**
   * Cancels an active or queued AI task and releases concurrency locks.
   */
  async cancelTask(taskId: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(
      `/teacher/ai-tasks/${taskId}/cancel`,
      {},
      { successMessage: 'Đã hủy tác vụ AI thành công!' }
    );
  },

  /**
   * Removes an AI task from the teacher's task history.
   */
  async deleteTask(taskId: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(
      `/teacher/ai-tasks/${taskId}`,
      { successMessage: 'Đã xóa tác vụ khỏi danh sách!' }
    );
  },
};
