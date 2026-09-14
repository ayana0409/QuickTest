import { create } from 'zustand';
import type { ExamPaper } from '@/types/exam';

export interface CandidateAnswerState {
  selectedOptionIds?: string[];
  textAnswer?: string;
}

interface ExamState {
  attemptId: string | null;
  examPaper: ExamPaper | null;
  currentQuestionIndex: number;
  remainingSeconds: number;
  answers: Record<string, CandidateAnswerState>; // keyed by questionId
  isSaving: boolean;
  lastSavedAt: string | null;
  isSubmitting: boolean;
  violationCount: number;
  isDisqualified: boolean;

  // Actions
  initExam: (paper: ExamPaper) => void;
  setCurrentQuestionIndex: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  updateOptionAnswer: (questionId: string, optionId: string, isMultipleChoice?: boolean) => void;
  updateTextAnswer: (questionId: string, textAnswer: string) => void;
  decrementTimer: () => void;
  setRemainingSeconds: (seconds: number) => void;
  setSaving: (saving: boolean) => void;
  markSaved: () => void;
  setSubmitting: (submitting: boolean) => void;
  recordViolation: (count: number, disqualified: boolean) => void;
  resetExam: () => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  attemptId: null,
  examPaper: null,
  currentQuestionIndex: 0,
  remainingSeconds: 0,
  answers: {},
  isSaving: false,
  lastSavedAt: null,
  isSubmitting: false,
  violationCount: 0,
  isDisqualified: false,

  initExam: (paper: ExamPaper) => {
    set({
      attemptId: paper.attemptId,
      examPaper: paper,
      currentQuestionIndex: 0,
      remainingSeconds: paper.remainingSeconds || paper.durationMinutes * 60,
      answers: {},
      isSaving: false,
      lastSavedAt: null,
      isSubmitting: false,
      violationCount: 0,
      isDisqualified: false,
    });
  },

  setCurrentQuestionIndex: (index: number) => {
    const total = get().examPaper?.questions.length || 0;
    if (index >= 0 && index < total) {
      set({ currentQuestionIndex: index });
    }
  },

  nextQuestion: () => {
    const { currentQuestionIndex, examPaper } = get();
    const total = examPaper?.questions.length || 0;
    if (currentQuestionIndex < total - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  prevQuestion: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },

  updateOptionAnswer: (questionId: string, optionId: string, isMultipleChoice = false) => {
    set((state) => {
      const currentAnswer = state.answers[questionId] || {};
      let updatedSelectedIds: string[] = [];

      if (isMultipleChoice) {
        const existing = currentAnswer.selectedOptionIds || [];
        if (existing.includes(optionId)) {
          updatedSelectedIds = existing.filter((id) => id !== optionId);
        } else {
          updatedSelectedIds = [...existing, optionId];
        }
      } else {
        // Single choice selection
        updatedSelectedIds = [optionId];
      }

      return {
        answers: {
          ...state.answers,
          [questionId]: {
            ...currentAnswer,
            selectedOptionIds: updatedSelectedIds,
          },
        },
      };
    });
  },

  updateTextAnswer: (questionId: string, textAnswer: string) => {
    set((state) => ({
      answers: {
        ...state.answers,
        [questionId]: {
          ...state.answers[questionId],
          textAnswer,
        },
      },
    }));
  },

  decrementTimer: () => {
    set((state) => {
      const newTime = state.remainingSeconds > 0 ? state.remainingSeconds - 1 : 0;
      return { remainingSeconds: newTime };
    });
  },

  setRemainingSeconds: (seconds: number) => {
    set({ remainingSeconds: Math.max(0, seconds) });
  },

  setSaving: (saving: boolean) => {
    set({ isSaving: saving });
  },

  markSaved: () => {
    set({
      isSaving: false,
      lastSavedAt: new Date().toLocaleTimeString(),
    });
  },

  setSubmitting: (submitting: boolean) => {
    set({ isSubmitting: submitting });
  },

  recordViolation: (count: number, disqualified: boolean) => {
    set({
      violationCount: count,
      isDisqualified: disqualified,
    });
  },

  resetExam: () => {
    set({
      attemptId: null,
      examPaper: null,
      currentQuestionIndex: 0,
      remainingSeconds: 0,
      answers: {},
      isSaving: false,
      lastSavedAt: null,
      isSubmitting: false,
      violationCount: 0,
      isDisqualified: false,
    });
  },
}));
