import { create } from 'zustand';
import { gradingService } from '@/services/grading.service';
import type {
  QuestionGradingSummaryResponse,
  QuestionSubmissionsDetailResponse,
  GradingStatus,
} from '@/types/candidateAnswer';

/**
 * Local draft state for a candidate's answer score and feedback.
 */
export interface AnswerDraft {
  awardedScore: number;
  teacherFeedback: string;
  isDirty: boolean;
}

/**
 * Zustand store interface for Question-Centric Grading state and actions.
 */
export interface GradingState {
  // Exam-level questions state
  currentExamId: string | null;
  questions: QuestionGradingSummaryResponse[];
  isLoadingQuestions: boolean;

  // Question detail and submissions state
  currentQuestionDetail: QuestionSubmissionsDetailResponse | null;
  isLoadingDetail: boolean;
  statusFilter: GradingStatus | 'ALL';
  currentPage: number;
  pageSize: number;

  // Teacher input draft state keyed by candidateAnswerId
  drafts: Record<string, AnswerDraft>;

  // Individual and batch saving indicators
  savingAnswerIds: Record<string, boolean>;
  aiGradingAnswerIds: Record<string, boolean>;
  isBatchSaving: boolean;
  isTriggeringAi: boolean;

  // Actions
  fetchQuestions: (examId: string) => Promise<void>;
  fetchQuestionSubmissions: (
    questionId: string,
    options?: { status?: GradingStatus | 'ALL'; page?: number }
  ) => Promise<void>;
  setStatusFilter: (status: GradingStatus | 'ALL') => void;
  setPage: (page: number) => void;
  updateDraft: (
    candidateAnswerId: string,
    data: { awardedScore?: number; teacherFeedback?: string }
  ) => void;
  saveSingleGrade: (questionId: string, candidateAnswerId: string) => Promise<boolean>;
  saveAllDrafts: (questionId: string) => Promise<boolean>;
  gradeSingleWithAi: (candidateAnswerId: string) => Promise<boolean>;
  triggerAiGrading: (examId?: string, questionId?: string) => Promise<boolean>;
  resetStore: () => void;

}

export const useGradingStore = create<GradingState>((set, get) => ({
  currentExamId: null,
  questions: [],
  isLoadingQuestions: false,

  currentQuestionDetail: null,
  isLoadingDetail: false,
  statusFilter: 'ALL',
  currentPage: 0,
  pageSize: 10,

  drafts: {},
  savingAnswerIds: {},
  aiGradingAnswerIds: {},
  isBatchSaving: false,
  isTriggeringAi: false,

  /**
   * Fetch all essay questions for the exam and populate the store.
   */
  fetchQuestions: async (examId: string) => {
    set({ isLoadingQuestions: true, currentExamId: examId });
    try {
      const data = await gradingService.getQuestionsForGrading(examId);
      set({ questions: data, isLoadingQuestions: false });
    } catch {
      set({ isLoadingQuestions: false });
    }
  },

  /**
   * Fetch question detail and paginated submissions with current filter and page.
   */
  fetchQuestionSubmissions: async (questionId: string, options) => {
    set({ isLoadingDetail: true });

    const statusFilter = options?.status !== undefined ? options.status : get().statusFilter;
    const page = options?.page !== undefined ? options.page : get().currentPage;
    const size = get().pageSize;

    const queryStatus = statusFilter === 'ALL' ? undefined : (statusFilter as GradingStatus);

    try {
      const detail = await gradingService.getQuestionSubmissions(questionId, {
        status: queryStatus,
        page,
        size,
      });


      // Synchronize drafts with incoming submission scores if not already modified
      const currentDrafts = { ...get().drafts };
      if (detail.submissions?.content) {
        detail.submissions.content.forEach((sub) => {
          if (!currentDrafts[sub.candidateAnswerId] || !currentDrafts[sub.candidateAnswerId].isDirty) {
            currentDrafts[sub.candidateAnswerId] = {
              awardedScore: sub.awardedScore ?? 0,
              teacherFeedback: sub.teacherFeedback ?? '',
              isDirty: false,
            };
          }
        });
      }

      set({
        currentQuestionDetail: detail,
        isLoadingDetail: false,
        statusFilter,
        currentPage: page,
        drafts: currentDrafts,
      });
    } catch {
      set({ isLoadingDetail: false });
    }
  },

  /**
   * Set active status filter and immediately reload submissions from page 0.
   */
  setStatusFilter: (status) => {
    const questionId = get().currentQuestionDetail?.questionId;
    set({ statusFilter: status, currentPage: 0 });
    if (questionId) {
      get().fetchQuestionSubmissions(questionId, { status, page: 0 });
    }
  },

  /**
   * Navigate to a different submissions page.
   */
  setPage: (page) => {
    const questionId = get().currentQuestionDetail?.questionId;
    set({ currentPage: page });
    if (questionId) {
      get().fetchQuestionSubmissions(questionId, { page });
    }
  },

  /**
   * Update draft score or feedback for a specific candidate submission.
   */
  updateDraft: (candidateAnswerId, data) => {
    set((state) => {
      const existing = state.drafts[candidateAnswerId] || {
        awardedScore: 0,
        teacherFeedback: '',
        isDirty: false,
      };

      return {
        drafts: {
          ...state.drafts,
          [candidateAnswerId]: {
            awardedScore:
              data.awardedScore !== undefined ? data.awardedScore : existing.awardedScore,
            teacherFeedback:
              data.teacherFeedback !== undefined ? data.teacherFeedback : existing.teacherFeedback,
            isDirty: true,
          },
        },
      };
    });
  },

  /**
   * Save a single candidate's score and feedback to the backend.
   */
  saveSingleGrade: async (questionId: string, candidateAnswerId: string) => {
    const draft = get().drafts[candidateAnswerId];
    if (!draft) return false;

    set((state) => ({
      savingAnswerIds: { ...state.savingAnswerIds, [candidateAnswerId]: true },
    }));

    try {
      await gradingService.saveManualGrades(questionId, {
        items: [
          {
            candidateAnswerId,
            awardedScore: draft.awardedScore,
            teacherFeedback: draft.teacherFeedback.trim(),
          },
        ],
      });

      // Update local submission status to GRADED and mark draft clean
      set((state) => {
        const detail = state.currentQuestionDetail;
        if (!detail || !detail.submissions) return state;

        const updatedContent = detail.submissions.content.map((item) => {
          if (item.candidateAnswerId === candidateAnswerId) {
            return {
              ...item,
              awardedScore: draft.awardedScore,
              teacherFeedback: draft.teacherFeedback.trim(),
              gradingStatus: 'GRADED' as GradingStatus,
            };
          }
          return item;
        });

        return {
          currentQuestionDetail: {
            ...detail,
            submissions: {
              ...detail.submissions,
              content: updatedContent,
            },
          },
          drafts: {
            ...state.drafts,
            [candidateAnswerId]: {
              ...draft,
              isDirty: false,
            },
          },
          savingAnswerIds: { ...state.savingAnswerIds, [candidateAnswerId]: false },
        };
      });

      return true;
    } catch {
      set((state) => ({
        savingAnswerIds: { ...state.savingAnswerIds, [candidateAnswerId]: false },
      }));
      return false;
    }
  },

  /**
   * Save all modified (dirty) drafts currently visible on this question.
   */
  saveAllDrafts: async (questionId: string) => {
    const drafts = get().drafts;
    const dirtyAnswerIds = Object.keys(drafts).filter((id) => drafts[id].isDirty);

    if (dirtyAnswerIds.length === 0) {
      return true;
    }

    set({ isBatchSaving: true });

    try {
      const items = dirtyAnswerIds.map((candidateAnswerId) => ({
        candidateAnswerId,
        awardedScore: drafts[candidateAnswerId].awardedScore,
        teacherFeedback: drafts[candidateAnswerId].teacherFeedback.trim(),
      }));

      await gradingService.saveManualGrades(questionId, { items });

      // Update submissions and clear dirty flags
      set((state) => {
        const detail = state.currentQuestionDetail;
        if (!detail || !detail.submissions) return state;

        const updatedContent = detail.submissions.content.map((sub) => {
          if (dirtyAnswerIds.includes(sub.candidateAnswerId)) {
            const draft = drafts[sub.candidateAnswerId];
            return {
              ...sub,
              awardedScore: draft.awardedScore,
              teacherFeedback: draft.teacherFeedback.trim(),
              gradingStatus: 'GRADED' as GradingStatus,
            };
          }
          return sub;
        });

        const updatedDrafts = { ...state.drafts };
        dirtyAnswerIds.forEach((id) => {
          if (updatedDrafts[id]) {
            updatedDrafts[id] = { ...updatedDrafts[id], isDirty: false };
          }
        });

        return {
          currentQuestionDetail: {
            ...detail,
            submissions: {
              ...detail.submissions,
              content: updatedContent,
            },
          },
          drafts: updatedDrafts,
          isBatchSaving: false,
        };
      });

      return true;
    } catch {
      set({ isBatchSaving: false });
      return false;
    }
  },

  /**
   * Trigger AI automated grading in background for the exam or specific question.
   */
  triggerAiGrading: async (examId?: string, questionId?: string) => {
    // Resolve valid examId from parameter or fallback to current question detail / current exam id
    const resolvedExamId =
      examId && examId.trim().length > 0
        ? examId.trim()
        : get().currentQuestionDetail?.examId || get().currentExamId || undefined;

    set({ isTriggeringAi: true });
    try {
      await gradingService.triggerAiGrading({
        examId: resolvedExamId,
        questionId: questionId || undefined,
        scope: questionId ? 'SINGLE_QUESTION' : 'ENTIRE_EXAM',
        batchSize: 5,
      });

      set({ isTriggeringAi: false });

      // If viewing a question, refresh submissions to reflect queued/updated status
      if (questionId) {
        await get().fetchQuestionSubmissions(questionId);
      } else if (resolvedExamId) {
        await get().fetchQuestions(resolvedExamId);
      }

      return true;
    } catch {
      set({ isTriggeringAi: false });
      return false;
    }
  },

  /**
   * Evaluate a single candidate answer using AI directly.
   */
  gradeSingleWithAi: async (candidateAnswerId: string) => {
    set((state) => ({
      aiGradingAnswerIds: { ...state.aiGradingAnswerIds, [candidateAnswerId]: true },
    }));

    try {
      const result = await gradingService.gradeSingleAnswerWithAi(candidateAnswerId);
      const score = result.awardedScore ?? 0;
      const feedback = result.feedback ?? '';

      set((state) => {
        const detail = state.currentQuestionDetail;
        if (!detail || !detail.submissions) {
          return {
            aiGradingAnswerIds: { ...state.aiGradingAnswerIds, [candidateAnswerId]: false },
          };
        }

        const updatedContent = detail.submissions.content.map((item) => {
          if (item.candidateAnswerId === candidateAnswerId) {
            return {
              ...item,
              awardedScore: score,
              teacherFeedback: feedback,
              gradingStatus: 'GRADED' as GradingStatus,
            };
          }
          return item;
        });

        return {
          currentQuestionDetail: {
            ...detail,
            submissions: {
              ...detail.submissions,
              content: updatedContent,
            },
          },
          drafts: {
            ...state.drafts,
            [candidateAnswerId]: {
              awardedScore: score,
              teacherFeedback: feedback,
              isDirty: false,
            },
          },
          aiGradingAnswerIds: { ...state.aiGradingAnswerIds, [candidateAnswerId]: false },
        };
      });

      return true;
    } catch {
      set((state) => ({
        aiGradingAnswerIds: { ...state.aiGradingAnswerIds, [candidateAnswerId]: false },
      }));
      return false;
    }
  },


  /**
   * Reset store to initial state when navigating away.
   */
  resetStore: () => {
    set({
      currentExamId: null,
      questions: [],
      isLoadingQuestions: false,
      currentQuestionDetail: null,
      isLoadingDetail: false,
      statusFilter: 'ALL',
      currentPage: 0,
      drafts: {},
      savingAnswerIds: {},
      aiGradingAnswerIds: {},
      isBatchSaving: false,
      isTriggeringAi: false,
    });
  },
}));
