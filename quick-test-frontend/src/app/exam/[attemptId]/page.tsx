'use client';

import React, { useEffect, useState, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Send,
  Maximize2,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { useExamStore, type CandidateAnswerState } from '@/stores/examStore';
import { candidateSessionService } from '@/services/candidateSession.service';
import { ProctoringShield } from '@/components/exam/ProctoringShield';
import { ExamTopBar } from '@/components/exam/ExamTopBar';
import { QuestionNavigator } from '@/components/exam/QuestionNavigator';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { ExamWarningModal } from '@/components/exam/ExamWarningModal';
import { ExamDisqualifiedOverlay } from '@/components/exam/ExamDisqualifiedOverlay';
import { SubmitConfirmModal } from '@/components/exam/SubmitConfirmModal';
import { ProctoringSettingsModal } from '@/components/exam/ProctoringSettingsModal';
import { GuestInfoModal } from '@/components/exam/GuestInfoModal';
import toast from 'react-hot-toast';
import type { ExamPaper, QuestionInPaper } from '@/types/exam';
import type {
  ViolationType,
  ViolationAlertResponse,
  ProctoringSettings,
} from '@/types/proctoring';
import { DEFAULT_PROCTORING_SETTINGS } from '@/types/proctoring';
import type { SaveAnswerRequest } from '@/types/candidateAnswer';

interface ExamRunnerPageProps {
  params: Promise<{ attemptId: string }>;
}

const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const normalizeAnswers = (
  rawSavedAnswers?: Record<string, any>
): Record<string, CandidateAnswerState> => {
  if (!rawSavedAnswers || typeof rawSavedAnswers !== 'object') return {};

  const normalized: Record<string, CandidateAnswerState> = {};
  for (const [key, val] of Object.entries(rawSavedAnswers)) {
    if (!val) continue;

    const qId = String(val.questionId || key);
    const selectedOptionIds = Array.isArray(val.selectedOptionIds)
      ? val.selectedOptionIds.map((id: any) => String(id))
      : val.selectedOptionIds instanceof Set
      ? Array.from(val.selectedOptionIds).map((id: any) => String(id))
      : [];

    const textAnswer = typeof val.textAnswer === 'string' ? val.textAnswer : '';

    const item: CandidateAnswerState = {
      selectedOptionIds,
      textAnswer,
    };

    normalized[qId] = item;
    normalized[qId.toLowerCase()] = item;
    normalized[key.toLowerCase()] = item;
  }
  return normalized;
};

/**
 * Exam Runner Page:
 * Production-ready full-screen exam interface featuring real-time proctoring shields,
 * debounced auto-saving, anti-cheat detection, full keyboard/clipboard blocking,
 * question navigation grid, and strict submission validation.
 */
export default function ExamRunnerPage({ params }: ExamRunnerPageProps) {
  const resolvedParams = use(params);
  const attemptId = resolvedParams.attemptId;
  const router = useRouter();

  // Zustand Store
  const {
    examPaper,
    currentQuestionIndex,
    remainingSeconds,
    answers,
    isSaving,
    lastSavedAt,
    isSubmitting,
    violationCount,
    isDisqualified,
    initExam,
    loadSavedAnswers,
    setCurrentQuestionIndex,
    nextQuestion,
    prevQuestion,
    updateOptionAnswer,
    updateTextAnswer,
    decrementTimer,
    setSaving,
    markSaved,
    setSubmitting,
    recordViolation,
  } = useExamStore();

  // Local Component States
  const [isLoadingPaper, setIsLoadingPaper] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  // Guest Candidate Prompt State
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [isStartingGuestExam, setIsStartingGuestExam] = useState(false);

  // Warning & Confirmation Modals
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Proctoring Settings State
  const [proctoringSettings, setProctoringSettings] = useState<ProctoringSettings>(
    DEFAULT_PROCTORING_SETTINGS
  );
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Load Proctoring Settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('quicktest_proctoring_settings');
      if (saved) {
        setProctoringSettings(JSON.parse(saved));
      }
    } catch {
      // Ignored
    }
  }, []);

  const handleSaveProctoringSettings = (newSettings: ProctoringSettings) => {
    setProctoringSettings(newSettings);
    try {
      localStorage.setItem('quicktest_proctoring_settings', JSON.stringify(newSettings));
    } catch {
      // Ignored
    }
    // If master proctoring was turned off, dismiss any active violation alert modal
    if (!newSettings.enabled) {
      setWarningModalOpen(false);
    }
  };

  const handleToggleMasterProctoring = () => {
    const nextSettings: ProctoringSettings = {
      ...proctoringSettings,
      enabled: !proctoringSettings.enabled,
    };
    handleSaveProctoringSettings(nextSettings);
  };

  // Debounce Auto-Save Ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavePayloadRef = useRef<SaveAnswerRequest | null>(null);

  // Guest Info Confirmation Handler
  const handleGuestInfoConfirm = async (name: string, identifier: string) => {
    setIsStartingGuestExam(true);
    try {
      if (!isUUID(attemptId)) {
        const paper = await candidateSessionService.startExam({
          accessCode: attemptId.toUpperCase(),
          guestName: name,
          guestIdentifier: identifier,
        });
        setShowGuestModal(false);
        if (paper && paper.attemptId) {
          initExam(paper);
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `/exam/${paper.attemptId}`);
          }
          try {
            const resumeData = await candidateSessionService.resumeSession(paper.attemptId);
            const activePaper = resumeData.paper || resumeData.examPaper || paper;
            initExam(activePaper);
            const redisAnswers = normalizeAnswers(resumeData.savedAnswers);
            loadSavedAnswers(redisAnswers);
          } catch {
            // Paper already initialized
          }
        }
      } else {
        const response = await candidateSessionService.resumeSession(attemptId);
        setShowGuestModal(false);
        const paper = response.paper || response.examPaper;
        if (paper) {
          initExam(paper);
          const redisAnswers = normalizeAnswers(response.savedAnswers);
          loadSavedAnswers(redisAnswers);
        }
      }
    } catch (err) {
      console.error('Failed to initialize guest exam session:', err);
    } finally {
      setIsStartingGuestExam(false);
    }
  };

  // 1. Fetch Exam Paper & Resume Session
  useEffect(() => {
    let isMounted = true;

    const loadExamSession = async () => {
      setIsLoadingPaper(true);
      setLoadError(null);

      try {
        if (!isUUID(attemptId)) {
          // If attemptId is actually an access code (e.g. 'gp8w9d')
          const token =
            typeof window !== 'undefined'
              ? localStorage.getItem('token') || localStorage.getItem('accessToken')
              : null;
          const guestName =
            typeof window !== 'undefined'
              ? localStorage.getItem('quicktest_guest_name')
              : null;
          const guestId =
            typeof window !== 'undefined'
              ? localStorage.getItem('quicktest_guest_id')
              : null;

          // If candidate is unauthenticated and hasn't entered guest info yet, prompt modal
          if (!token && (!guestName || !guestId)) {
            setIsLoadingPaper(false);
            setShowGuestModal(true);
            return;
          }

          const paper = await candidateSessionService.startExam({
            accessCode: attemptId.toUpperCase(),
            guestName: !token ? (guestName || undefined) : undefined,
            guestIdentifier: !token ? (guestId || undefined) : undefined,
          });
          if (!isMounted) return;

          if (paper && paper.attemptId) {
            // Also fetch saved answers from Redis for this attempt!
            try {
              const resumeData = await candidateSessionService.resumeSession(paper.attemptId);
              const activePaper = resumeData.paper || resumeData.examPaper || paper;
              initExam(activePaper);

              const redisAnswers = normalizeAnswers(resumeData.savedAnswers);
              // Merge local backup if any
              const localBackupStr =
                typeof window !== 'undefined'
                  ? localStorage.getItem(`quicktest_exam_answers_${paper.attemptId}`)
                  : null;
              const localBackup = localBackupStr ? JSON.parse(localBackupStr) : {};
              const merged = { ...localBackup, ...redisAnswers };

              console.log('[ExamRunner] Restored answers from Redis / Cache:', merged);
              loadSavedAnswers(merged);
            } catch {
              initExam(paper);
            }

            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', `/exam/${paper.attemptId}`);
            }
          } else {
            throw new Error('Không thể khởi tạo bài thi với mã này.');
          }
        } else {
          // Valid UUID attemptId
          const response = await candidateSessionService.resumeSession(attemptId);
          if (!isMounted) return;

          const paper = response.paper || response.examPaper;
          if (paper) {
            initExam(paper);

            const redisAnswers = normalizeAnswers(response.savedAnswers);
            const localBackupStr =
              typeof window !== 'undefined'
                ? localStorage.getItem(`quicktest_exam_answers_${attemptId}`)
                : null;
            const localBackup = localBackupStr ? JSON.parse(localBackupStr) : {};
            const merged = { ...localBackup, ...redisAnswers };

            console.log('[ExamRunner] Restored answers from Redis / Cache:', merged);
            loadSavedAnswers(merged);
          } else {
            throw new Error('Không tìm thấy dữ liệu đề thi cho phiên làm bài này.');
          }
        }
      } catch (err: unknown) {
        console.warn('Could not resume session from backend, loading fallback mock paper:', err);
        if (!isMounted) return;

        // Realistic fallback exam paper for offline / preview testing
        const fallbackPaper: ExamPaper = {
          attemptId,
          examId: 'sample-exam-id',
          examTitle: 'Đề thi Kiểm thử: Kiến trúc Vi dịch vụ & Bảo mật Spring Boot',
          examDescription: 'Bài kiểm tra chính thức phòng thi thực chiến Quick Test.',
          durationMinutes: 45,
          totalQuestions: 5,
          startTime: new Date().toISOString(),
          expireAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          serverTime: new Date().toISOString(),
          remainingSeconds: 45 * 60,
          candidateName: 'Thí sinh Thử nghiệm',
          candidateIdentifier: 'QT-2026-88',
          questions: [
            {
              id: 'q-1',
              orderIndex: 1,
              content:
                'Trong kiến trúc Spring Cloud, thành phần nào giữ vai trò Service Registry cho phép các dịch vụ tự động đăng ký và khám phá lẫn nhau?',
              questionType: 'SINGLE_CHOICE',
              points: 2.0,
              options: [
                { id: 'opt-1-1', orderIndex: 1, content: 'Spring Cloud Netflix Eureka / HashiCorp Consul' },
                { id: 'opt-1-2', orderIndex: 2, content: 'Spring Cloud Gateway' },
                { id: 'opt-1-3', orderIndex: 3, content: 'Spring Cloud Config Server' },
                { id: 'opt-1-4', orderIndex: 4, content: 'Resilience4j Circuit Breaker' },
              ],
            },
            {
              id: 'q-2',
              orderIndex: 2,
              content:
                'Những cơ chế nào sau đây được khuyến nghị để bảo vệ API chống lại các cuộc tấn công Brute Force và Denial of Service (DoS)? (Chọn các đáp án đúng)',
              questionType: 'MULTIPLE_CHOICE',
              points: 2.5,
              options: [
                { id: 'opt-2-1', orderIndex: 1, content: 'Áp dụng Rate Limiting bằng thuật toán Token Bucket (e.g. Bucket4j / Redis)' },
                { id: 'opt-2-2', orderIndex: 2, content: 'Kích hoạt Web Application Firewall (WAF) và IP Throttling' },
                { id: 'opt-2-3', orderIndex: 3, content: 'Vô hiệu hóa hoàn toàn CORS trên toàn hệ thống' },
                { id: 'opt-2-4', orderIndex: 4, content: 'Sử dụng Captcha sau nhiều lần thử đăng nhập thất bại' },
              ],
            },
            {
              id: 'q-3',
              orderIndex: 3,
              content:
                'Nếu một hệ thống phân tán xử lý 12,000 requests/phút, trung bình số requests mỗi giây (RPS) mà hệ thống cần gánh chịu là bao nhiêu?',
              questionType: 'NUMERIC',
              points: 1.5,
            },
            {
              id: 'q-4',
              orderIndex: 4,
              content:
                'Hãy phân tích ưu và nhược điểm của việc sử dụng JWT (JSON Web Token) so với Server-side Session trong kiến trúc Microservices có tải cao.',
              questionType: 'ESSAY_TEXT',
              points: 3.0,
            },
            {
              id: 'q-5',
              orderIndex: 5,
              content:
                'Giao thức nào sau đây chạy trực tiếp trên nền TCP và được sử dụng rộng rãi trong các hệ thống truyền nhận message hiệu năng cao giữa microservices?',
              questionType: 'SINGLE_CHOICE',
              points: 1.0,
              options: [
                { id: 'opt-5-1', orderIndex: 1, content: 'AMQP / Kafka Binary Protocol' },
                { id: 'opt-5-2', orderIndex: 2, content: 'HTTP/1.1' },
                { id: 'opt-5-3', orderIndex: 3, content: 'SMTP' },
                { id: 'opt-5-4', orderIndex: 4, content: 'FTP' },
              ],
            },
          ],
        };

        initExam(fallbackPaper);
      } finally {
        if (isMounted) {
          setIsLoadingPaper(false);
          // Show initial fullscreen prompt if not in fullscreen
          if (!document.fullscreenElement) {
            setShowFullscreenPrompt(true);
          }
        }
      }
    };

    loadExamSession();

    return () => {
      isMounted = false;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [attemptId, initExam, loadSavedAnswers]);

  // 2. Fullscreen Change Tracker
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleEnterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request denied by user/browser:', err);
    } finally {
      setShowFullscreenPrompt(false);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Error toggling fullscreen:', err);
    }
  };

  // 3. Countdown Timer (1 second interval)
  useEffect(() => {
    if (isLoadingPaper || remainingSeconds <= 0 || isDisqualified) return;

    const timerId = setInterval(() => {
      decrementTimer();
    }, 1000);

    return () => clearInterval(timerId);
  }, [isLoadingPaper, remainingSeconds, isDisqualified, decrementTimer]);

  // 4. Auto-submit when countdown hits zero
  const handleAutoSubmitOnExpire = useCallback(async () => {
    if (isSubmitting || isDisqualified) return;

    const activeAttemptId = examPaper?.attemptId || attemptId;
    setSubmitting(true);
    try {
      await candidateSessionService.submitExam(activeAttemptId);
      router.push(`/exam/${activeAttemptId}/result`);
    } catch {
      router.push(`/exam/${activeAttemptId}/result`);
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, examPaper, isSubmitting, isDisqualified, router, setSubmitting]);

  // 4b. Real-time auto-submit when exam is closed by teacher/admin or background scheduler
  const handleExamClosed = useCallback(
    async (reasonMessage?: string) => {
      if (isSubmitting || isDisqualified) return;
      toast.error(
        reasonMessage || 'Đề thi đã đóng! Hệ thống đang tự động thu bài...',
        { id: 'exam-closed-toast', duration: 4000, icon: '🛑' }
      );
      // Flush pending save draft immediately if any
      if (pendingSavePayloadRef.current) {
        const activeAttemptId = examPaper?.attemptId || attemptId;
        try {
          await candidateSessionService.autoSaveAnswer(
            activeAttemptId,
            pendingSavePayloadRef.current
          );
        } catch {
          // Ignored
        }
        pendingSavePayloadRef.current = null;
      }
      handleAutoSubmitOnExpire();
    },
    [attemptId, examPaper?.attemptId, handleAutoSubmitOnExpire, isDisqualified, isSubmitting]
  );

  // 5. Debounced Auto-Save Mechanism (800ms responsive debounce)
  const scheduleAutoSave = useCallback(
    (payload: SaveAnswerRequest) => {
      pendingSavePayloadRef.current = payload;
      setSaving(true);

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(async () => {
        if (!pendingSavePayloadRef.current) return;

        const activeAttemptId = examPaper?.attemptId || attemptId;
        try {
          await candidateSessionService.autoSaveAnswer(
            activeAttemptId,
            pendingSavePayloadRef.current
          );
          markSaved();
        } catch (err: any) {
          console.warn('[AutoSave] Failed to save answer payload silently:', err);
          setSaving(false);
          const errorMsg = err?.response?.data?.message || err?.message || '';
          if (
            typeof errorMsg === 'string' &&
            (errorMsg.toLowerCase().includes('closed') ||
              errorMsg.toLowerCase().includes('đã đóng') ||
              errorMsg.toLowerCase().includes('kết thúc'))
          ) {
            handleExamClosed('Đề thi đã đóng! Hệ thống đang tự động thu bài...');
          }
        }
      }, 800);
    },
    [attemptId, examPaper, setSaving, markSaved, handleExamClosed]
  );

  // Sync answers state to localStorage backup
  useEffect(() => {
    const activeAttemptId = examPaper?.attemptId || attemptId;
    if (activeAttemptId && Object.keys(answers).length > 0) {
      try {
        localStorage.setItem(
          `quicktest_exam_answers_${activeAttemptId}`,
          JSON.stringify(answers)
        );
      } catch {
        // Ignored
      }
    }
  }, [answers, attemptId, examPaper?.attemptId]);

  // Flush pending save immediately on page exit or tab switch
  useEffect(() => {
    const handleExit = () => {
      if (pendingSavePayloadRef.current) {
        const activeAttemptId = examPaper?.attemptId || attemptId;
        candidateSessionService
          .autoSaveAnswer(activeAttemptId, pendingSavePayloadRef.current)
          .catch(() => {});
        pendingSavePayloadRef.current = null;
      }
    };

    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);

    return () => {
      handleExit();
      window.removeEventListener('pagehide', handleExit);
      window.removeEventListener('beforeunload', handleExit);
    };
  }, [attemptId, examPaper?.attemptId]);

  // Question Answer Handlers
  const handleOptionSelect = (optionId: string, isMultiple: boolean) => {
    if (!examPaper) return;
    const currentQuestion = examPaper.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    updateOptionAnswer(currentQuestion.id, optionId, isMultiple);

    // Prepare updated selected IDs for auto-save
    const existing = answers[currentQuestion.id]?.selectedOptionIds || [];
    let updated: string[] = [];
    if (isMultiple) {
      updated = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
    } else {
      updated = [optionId];
    }

    scheduleAutoSave({
      questionId: currentQuestion.id,
      selectedOptionIds: updated,
    });
  };

  const handleTextChange = (text: string) => {
    if (!examPaper) return;
    const currentQuestion = examPaper.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    updateTextAnswer(currentQuestion.id, text);

    scheduleAutoSave({
      questionId: currentQuestion.id,
      textAnswer: text,
    });
  };

  // 6. Proctoring Violation & Alert Handlers
  const handleClientViolation = (type: ViolationType, description: string) => {
    // Show warning modal on any client-side detected attempt
    setWarningMessage(description);
    setWarningModalOpen(true);
  };

  const handleServerAlert = (alert: ViolationAlertResponse) => {
    recordViolation(alert.violationCount, alert.disqualified);

    if (alert.disqualified) {
      setWarningModalOpen(false);
    } else {
      setWarningMessage(alert.message || `Cảnh báo vi phạm nội quy phòng thi: ${alert.violationType}`);
      setWarningModalOpen(true);
    }
  };

  // 7. Manual Submit Flow
  const handleOpenSubmitModal = () => {
    setIsSubmitModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitModalOpen(false);
    setSubmitting(true);

    const activeAttemptId = examPaper?.attemptId || attemptId;

    // Flush any pending auto-save immediately before submit
    if (autoSaveTimerRef.current && pendingSavePayloadRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      try {
        await candidateSessionService.autoSaveAnswer(
          activeAttemptId,
          pendingSavePayloadRef.current
        );
      } catch {
        // Continue with submission regardless
      }
    }

    try {
      await candidateSessionService.submitExam(activeAttemptId);
      router.push(`/exam/${activeAttemptId}/result`);
    } catch (err) {
      console.error('Submit exam error:', err);
      // Even on error, attempt navigation to result page so candidate can view state
      router.push(`/exam/${activeAttemptId}/result`);
    } finally {
      setSubmitting(false);
    }
  };

  // 8. Loading & Error Views
  if (isLoadingPaper || !examPaper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-zinc-100 select-none">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="relative w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#E6EDF3] tracking-tight">
              Đang chuẩn bị đề thi và khởi tạo giám sát
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm">
              Hệ thống đang kết nối phòng thi bảo mật và khôi phục các câu trả lời đã lưu...
            </p>
          </div>
        </div>

        {/* Guest Candidate Credentials Prompt */}
        <GuestInfoModal
          isOpen={showGuestModal}
          accessCode={!isUUID(attemptId) ? attemptId : undefined}
          isLoading={isStartingGuestExam}
          onConfirm={handleGuestInfoConfirm}
          onCancel={() => router.push('/exam')}
        />
      </div>
    );
  }

  // Calculate unanswered questions for submit confirmation modal
  const unansweredIndices = examPaper.questions
    .map((q, idx) => {
      const ans = answers[q.id];
      if (!ans) return idx;
      if (q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTIPLE_CHOICE') {
        return ans.selectedOptionIds && ans.selectedOptionIds.length > 0 ? -1 : idx;
      }
      if (q.questionType === 'NUMERIC' || q.questionType === 'ESSAY_TEXT') {
        return ans.textAnswer && ans.textAnswer.trim().length > 0 ? -1 : idx;
      }
      return idx;
    })
    .filter((idx) => idx !== -1);

  const answeredCount = examPaper.questions.length - unansweredIndices.length;
  const currentQuestion: QuestionInPaper = examPaper.questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id] || {};
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex === examPaper.questions.length - 1;

  return (
    <ProctoringShield
      attemptId={attemptId}
      examId={examPaper?.examId}
      isExamActive={!isDisqualified}
      settings={proctoringSettings}
      onViolation={handleClientViolation}
      onServerAlert={handleServerAlert}
      onExamClosed={handleExamClosed}
    >
      <div className="min-h-screen flex flex-col bg-[#0D1117] text-[#E6EDF3]">
        {/* Fixed Top Bar */}
        <ExamTopBar
          examTitle={examPaper.examTitle}
          candidateName={examPaper.candidateName}
          remainingSeconds={remainingSeconds}
          totalDurationSeconds={examPaper.durationMinutes * 60}
          isSaving={isSaving}
          lastSavedAt={lastSavedAt}
          isSubmitting={isSubmitting}
          onSubmitClick={handleOpenSubmitModal}
          onTimerExpire={handleAutoSubmitOnExpire}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
          proctoringSettings={proctoringSettings}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onToggleMasterProctoring={handleToggleMasterProctoring}
        />

        {/* Main Workspace */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Column: Active Question Workspace */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col space-y-6">
              {/* Question Card */}
              {currentQuestion && (
                <QuestionCard
                  question={currentQuestion}
                  questionNumber={currentQuestionIndex + 1}
                  selectedOptionIds={currentAnswer.selectedOptionIds || []}
                  textAnswer={currentAnswer.textAnswer || ''}
                  onOptionSelect={handleOptionSelect}
                  onTextChange={handleTextChange}
                />
              )}

              {/* Bottom Question Controls / Navigation Bar */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#161B22] border border-[#30363D] shadow-xl">
                <button
                  type="button"
                  onClick={prevQuestion}
                  disabled={isFirstQuestion}
                  className="py-2.5 px-4 rounded-xl bg-[#0D1117] hover:bg-[#21262D] text-zinc-300 border border-[#30363D] text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                <div className="text-xs font-mono font-medium text-zinc-400">
                  Câu <span className="text-[#E6EDF3] font-bold">{currentQuestionIndex + 1}</span> / {examPaper.questions.length}
                </div>

                {isLastQuestion ? (
                  <button
                    type="button"
                    onClick={handleOpenSubmitModal}
                    disabled={isSubmitting}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>Nộp bài thi</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={nextQuestion}
                    className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <span>Câu tiếp theo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Question Navigator Sidebar */}
            <div className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24">
              <QuestionNavigator
                questions={examPaper.questions}
                currentIndex={currentQuestionIndex}
                answers={answers}
                onSelectQuestion={setCurrentQuestionIndex}
                onSubmitClick={handleOpenSubmitModal}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        </main>

        {/* Initial Fullscreen Prompt Modal */}
        {showFullscreenPrompt && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none animate-in fade-in"
          >
            <div className="relative w-full max-w-md rounded-2xl bg-[#161B22] border border-[#30363D] shadow-2xl p-6 sm:p-8 text-center text-zinc-100">
              <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Maximize2 className="w-7 h-7" />
              </div>

              <h2 className="text-xl font-bold text-[#E6EDF3] tracking-tight mb-2">
                Chế độ Toàn màn hình
              </h2>

              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6 font-normal">
                Để đảm bảo tính bảo mật và sự tập trung cao nhất cho phòng thi, vui lòng bật chế độ toàn màn hình trước khi bắt đầu làm bài.
              </p>

              <button
                type="button"
                onClick={handleEnterFullscreen}
                className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                Vào toàn màn hình & Bắt đầu
              </button>

              <button
                type="button"
                onClick={() => setShowFullscreenPrompt(false)}
                className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 transition-colors py-1 cursor-pointer"
              >
                Bỏ qua (tiếp tục ở chế độ cửa sổ)
              </button>
            </div>
          </div>
        )}

        {/* Proctoring Warning Modal (Non-dismissable until acknowledged) */}
        <ExamWarningModal
          isOpen={warningModalOpen && !isDisqualified}
          violationCount={violationCount}
          maxAllowed={3}
          message={warningMessage}
          onAcknowledge={() => setWarningModalOpen(false)}
        />

        {/* Disqualified Overlay (Total Blockade) */}
        <ExamDisqualifiedOverlay
          isOpen={isDisqualified}
          reason="Bạn đã vi phạm quy chế thi vượt mức giới hạn cho phép hoặc bị giám thị đình chỉ trực tiếp từ bảng điều khiển."
          onExit={() => router.push('/')}
        />

        {/* Submit Confirmation Modal */}
        <SubmitConfirmModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          onConfirm={handleConfirmSubmit}
          totalQuestions={examPaper.questions.length}
          answeredCount={answeredCount}
          unansweredIndices={unansweredIndices}
          onJumpToQuestion={setCurrentQuestionIndex}
          isSubmitting={isSubmitting}
        />

        {/* Proctoring Settings Modal */}
        <ProctoringSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={proctoringSettings}
          onSaveSettings={handleSaveProctoringSettings}
        />

        {/* Guest Candidate Info Modal (Re-authentication) */}
        <GuestInfoModal
          isOpen={showGuestModal}
          accessCode={!isUUID(attemptId) ? attemptId : undefined}
          isLoading={isStartingGuestExam}
          onConfirm={handleGuestInfoConfirm}
          onCancel={() => router.push('/exam')}
        />
      </div>
    </ProctoringShield>
  );
}
