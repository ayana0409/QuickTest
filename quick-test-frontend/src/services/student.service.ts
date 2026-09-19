import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type {
  PageResponse,
  StudentAttemptSummaryDto,
  StudentAttemptDetailResponse,
} from '@/types/exam';

export interface GetStudentAttemptsParams {
  page?: number;
  size?: number;
}

/**
 * Service for student specific dashboard queries and performance telemetry.
 */
export const studentService = {
  /**
   * Retrieve paginated exam attempt history for the authenticated student.
   * Calls GET /api/student/attempts
   */
  async getAttemptHistory(
    params: GetStudentAttemptsParams = {}
  ): Promise<PageResponse<StudentAttemptSummaryDto>> {
    const { page = 0, size = 10 } = params;
    const response = await apiClient.get<ApiResponse<PageResponse<StudentAttemptSummaryDto>>>(
      '/student/attempts',
      {
        params: { page, size },
        silent: true,
      }
    );
    return response.data.data;
  },

  /**
   * Retrieve detailed attempt review for the student including question breakdowns and violations.
   * Calls GET /api/student/attempts/{attemptId}
   */
  async getAttemptDetail(attemptId: string): Promise<StudentAttemptDetailResponse> {
    const response = await apiClient.get<ApiResponse<StudentAttemptDetailResponse>>(
      `/student/attempts/${attemptId}`,
      { silent: true }
    );
    return response.data.data;
  },
};
