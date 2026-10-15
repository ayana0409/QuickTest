import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { PageResponse } from '@/types/exam';
import type {
  AttemptMonitorItem,
  AttemptRealtimeStatusDetail,
  ViolationLogEntry,
  DisqualifyAttemptRequest,
  ExamMonitoringParams,
} from '@/types/proctoring';

/**
 * Service handling teacher live proctoring & candidate telemetry monitoring operations.
 * Communicates with backend endpoints in TeacherProctoringController (/api/teacher/proctoring).
 */
export const teacherProctoringService = {
  /**
   * Retrieve paginated real-time monitoring list of candidates for an exam.
   * Supports filtering by status, search query (name, identifier), and pagination.
   */
  async getExamMonitoring(
    examId: string,
    params?: ExamMonitoringParams
  ): Promise<PageResponse<AttemptMonitorItem>> {
    const queryParams: Record<string, string | number> = {};

    if (params?.status) {
      queryParams.status = params.status;
    }
    if (params?.search && params.search.trim()) {
      queryParams.search = params.search.trim();
    }
    if (typeof params?.page === 'number') {
      queryParams.page = params.page;
    }
    if (typeof params?.size === 'number') {
      queryParams.size = params.size;
    }
    if (params?.sort) {
      queryParams.sort = params.sort;
    }

    const response = await apiClient.get<ApiResponse<PageResponse<AttemptMonitorItem>>>(
      `/teacher/proctoring/exams/${examId}/attempts`,
      {
        params: queryParams,
        silent: true,
      }
    );

    return response.data.data;
  },

  /**
   * Retrieve the complete audit trail of recorded violation logs for a specific candidate attempt.
   */
  async getAttemptViolations(attemptId: string): Promise<ViolationLogEntry[]> {
    const response = await apiClient.get<ApiResponse<ViolationLogEntry[]>>(
      `/teacher/proctoring/attempts/${attemptId}/violations`,
      {
        silent: true,
      }
    );

    return response.data.data;
  },

  /**
   * Retrieve detailed real-time telemetry status, heartbeat status, and violation breakdown for an attempt.
   */
  async getAttemptStatus(attemptId: string): Promise<AttemptRealtimeStatusDetail> {
    const response = await apiClient.get<ApiResponse<AttemptRealtimeStatusDetail>>(
      `/teacher/proctoring/attempts/${attemptId}/status`,
      {
        silent: true,
      }
    );

    return response.data.data;
  },

  /**
   * Manually force disqualify a candidate from an active or completed exam attempt.
   */
  async disqualifyAttempt(
    attemptId: string,
    payload?: DisqualifyAttemptRequest
  ): Promise<string> {
    const response = await apiClient.post<ApiResponse<string>>(
      `/teacher/proctoring/attempts/${attemptId}/disqualify`,
      payload || {},
      {
        successMessage: 'Đã đình chỉ tư cách thi của thí sinh thành công!',
        errorMessage: 'Không thể đình chỉ thí sinh, vui lòng thử lại.',
      }
    );

    return response.data.data;
  },
};
