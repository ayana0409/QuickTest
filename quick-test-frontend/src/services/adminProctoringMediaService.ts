import { apiClient } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { PageResponse } from '@/types/exam';
import type {
  AdminProctoringMedia,
  AdminProctoringMediaStats,
  ProctoringMediaCleanupStatus,
  ProctoringMediaFilterParams,
  ProctoringMediaCleanupRequest,
} from '@/types/proctoringMedia';

/**
 * Service providing administrative functions for proctoring evidence images,
 * statistics metrics, and background batch cleanup.
 */
export const adminProctoringMediaService = {
  /**
   * Search and filter proctoring evidence images with pagination.
   */
  async searchMedia(params?: ProctoringMediaFilterParams): Promise<PageResponse<AdminProctoringMedia>> {
    const apiParams: Record<string, any> = { ...params };
    if (apiParams.violationType === 'ALL') delete apiParams.violationType;

    if (typeof apiParams.search === 'string') {
      const trimmed = apiParams.search.trim();
      if (trimmed) {
        apiParams.search = trimmed;
      } else {
        delete apiParams.search;
      }
    }

    const res = await apiClient.get<ApiResponse<PageResponse<AdminProctoringMedia>>>(
      '/admin/proctoring-media',
      { params: apiParams }
    );
    return res.data.data;
  },

  /**
   * Fetch overview analytics metrics for dashboard KPI cards.
   */
  async getStats(): Promise<AdminProctoringMediaStats> {
    const res = await apiClient.get<ApiResponse<AdminProctoringMediaStats>>(
      '/admin/proctoring-media/stats'
    );
    return res.data.data;
  },

  /**
   * Calculate preview count of images matching conditional cleanup criteria.
   */
  async getCleanupPreview(
    days: number,
    violationType?: string,
    examId?: string,
    onlyFinishedExams: boolean = true
  ): Promise<{ matchingCount: number; days: number }> {
    const params: Record<string, any> = { days, onlyFinishedExams };
    if (violationType && violationType !== 'ALL') params.violationType = violationType;
    if (examId) params.examId = examId;

    const res = await apiClient.get<ApiResponse<{ matchingCount: number; days: number }>>(
      '/admin/proctoring-media/cleanup/preview',
      { params, silent: true }
    );
    return res.data.data;
  },

  /**
   * Trigger asynchronous background batch cleanup of evidence images.
   */
  async triggerBatchCleanup(request: ProctoringMediaCleanupRequest): Promise<ProctoringMediaCleanupStatus> {
    const res = await apiClient.post<ApiResponse<ProctoringMediaCleanupStatus>>(
      '/admin/proctoring-media/cleanup',
      request,
      { successMessage: 'Đã bắt đầu tiến trình dọn dẹp ảnh cũ trong nền' }
    );
    return res.data.data;
  },

  /**
   * Retrieve current progress of background batch cleanup.
   */
  async getCleanupStatus(): Promise<ProctoringMediaCleanupStatus> {
    const res = await apiClient.get<ApiResponse<ProctoringMediaCleanupStatus>>(
      '/admin/proctoring-media/cleanup/status',
      { silent: true }
    );
    return res.data.data;
  },

  /**
   * Delete selected media images by IDs.
   */
  async deleteSelectedMedia(ids: string[]): Promise<number> {
    const res = await apiClient.delete<ApiResponse<{ deletedCount: number }>>(
      '/admin/proctoring-media/batch',
      {
        data: { ids },
      }
    );
    return res.data.data.deletedCount;
  },

  /**
   * Delete a single media image by ID.
   */
  async deleteSingleMedia(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<any>>(
      `/admin/proctoring-media/${id}`
    );
  },
};

