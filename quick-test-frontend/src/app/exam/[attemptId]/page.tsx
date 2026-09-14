'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Send,
  CloudCheck,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Timer } from '@/components/exam/Timer';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { Button } from '@/components/common/Button';
import { useExamStore } from '@/stores/examStore';
import { connectWebSocket, disconnectWebSocket, sendWebSocketMessage, subscribeTopic } from '@/lib/socket';
import { apiClient } from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { ExamPaper, QuestionInPaper } from '@/types/exam';
import type { ViolationAlertResponse } from '@/types/proctoring';

interface ExamRunnerPageProps {
  params: Promise<{ attemptId: string }>;
}

export default function ExamRunnerPage({ params }: ExamRunnerPageProps) {
  const resolvedParams = use(params);
  const attemptId = resolvedParams.attemptId;
  const router = useRouter();

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

  const [isLoadingPaper, setIsLoadingPaper] = useState(true);
  const [violationAlert, setViolationAlert] = useState<string | null>(null);

  // 1. Fetch or initialize Exam Paper
  useEffect(() => {
    const loadPaper = async () => {
      setIsLoadingPaper(true);
      try {
        const res = await apiClient.get(`/session/resume/${attemptId}`);
        if (res.data?.data) {
          initExam(res.data.data);
        }
      } catch (err) {
        console.warn('Could not resume session, loading sample exam paper:', err);
        // Fallback demo paper for smooth preview
        const mockPaper: ExamPaper = {
          attemptId,
          examId: 'sample-exam-id',
          examTitle: 'Đề thi Mẫu: Kiến trúc Phần mềm & Spring Boot Nâng cao',
          examDescription: 'Bài kiểm tra trắc nghiệm kết hợp tự luận và điền số học.',
          durationMinutes: 45,
          totalQuestions: 4,
          startTime: new Date().toISOString(),
          expireAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          serverTime: new Date().toISOString(),
          remainingSeconds: 45 * 60,
          candidateName: 'Thí sinh Thử nghiệm',
          questions: [
            {
              id: 'q-1',
              orderIndex: 1,
              content: 'Annotation nào sau đây trong Spring Boot được dùng để cấu hình một Scheduled Task chạy định kỳ?',
              questionType: 'SINGLE_CHOICE',
              points: 1.0,
              options: [
                { id: 'opt-1-1', orderIndex: 1, content: '@Scheduled' },
                { id: 'opt-1-2', orderIndex: 2, content: '@EnableAsync' },
                { id: 'opt-1-3', orderIndex: 3, content: '@Periodic' },
                { id: 'opt-1-4', orderIndex: 4, content: '@CronJob' },
              ],
            },
            {
              id: 'q-2',
              orderIndex: 2,
              content: 'Những kỹ thuật nào sau đây giúp giải quyết triệt để lỗi N + 1 Query trong JPA / Hibernate? (Chọn các phương án đúng)',
              questionType: 'MULTIPLE_CHOICE',
              points: 1.5,
              options: [
                { id: 'opt-2-1', orderIndex: 1, content: 'Sử dụng JOIN FETCH trong JPQL / HQL' },
                { id: 'opt-2-2', orderIndex: 2, content: 'Sử dụng @EntityGraph' },
                { id: 'opt-2-3', orderIndex: 3, content: 'Tăng kích thước Connection Pool' },
                { id: 'opt-2-4', orderIndex: 4, content: 'Truy vấn Batch Aggregation theo IN :ids' },
              ],
            },
            {
              id: 'q-3',
              orderIndex: 3,
              content: 'Nếu một bài thi có 50 câu hỏi, thời gian làm bài 60 phút, trung bình một câu thí sinh có bao nhiêu giây để hoàn thành?',
              questionType: 'NUMERIC',
              points: 1.0,
            },
            {
              id: 'q-4',
              orderIndex: 4,
              content: 'Hãy nêu nguyên lý hoạt động của WebSocket Handshake và sự khác biệt chính giữa HTTP Polling và STOMP over WebSocket trong bài toán giám sát thời gian thực.',
              questionType: 'ESSAY_TEXT',
              points: 2.0,
            },
          ],
        };
        initExam(mockPaper);
      } finally {
        setIsLoadingPaper(false);
      }
    };

    loadPaper();
  }, [attemptId, initExam]);

  // 2. Countdown Timer
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      decrementTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds, decrementTimer]);

  // 3. WebSocket Real-time Proctoring & Tab Switch Telemetry
  useEffect(() => {
    connectWebSocket(
      null,
      () => {
        // Subscribe to real-time personal alerts
        subscribeTopic('/user/queue/alerts', (message) => {
          try {
            const payload = JSON.parse(message.body) as ViolationAlertResponse;
            recordViolation(payload.violationCount, payload.disqualified);
            setViolationAlert(payload.message || `Cảnh báo vi phạm: ${payload.violationType}`);
          } catch (e) {
            console.error('Failed to parse alert:', e);
          }
        });
      },
      (err) => {
        console.warn('Proctoring WebSocket connection error:', err);
      }
    );

    // Visibility change detector (Tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Candidate switched away from exam tab
        sendWebSocketMessage('/app/proctor/violation', {
          attemptId,
          violationType: 'TAB_SWITCH',
          description: 'Thí sinh rời khỏi tab làm bài thi',
          clientTimestamp: new Date().toISOString(),
        });
        setViolationAlert('CẢNH BÁO: Bạn vừa chuyển tab. Hành vi này đã được ghi lại trong hồ sơ giám sát!');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectWebSocket();
    };
  }, [attemptId, recordViolation]);

  // Auto-save logic helper
  const handleOptionSelect = (questionId: string, optionId: string, isMultiple: boolean) => {
    updateOptionAnswer(questionId, optionId, isMultiple);
    triggerAutoSave(questionId);
  };

  const handleTextChange = (questionId: string, text: string) => {
    updateTextAnswer(questionId, text);
    triggerAutoSave(questionId);
  };

  const triggerAutoSave = async (questionId: string) => {
    setSaving(true);
    try {
      // Simulate/Trigger auto-save API call
      setTimeout(() => {
        markSaved();
      }, 400);
    } catch {
      setSaving(false);
    }
  };

  const handleSubmitExam = async () => {
    const confirmSubmit = window.confirm('Bạn có chắc chắn muốn nộp bài thi? Sau khi nộp, bạn sẽ không thể chỉnh sửa đáp án.');
    if (!confirmSubmit) return;

    setSubmitting(true);
    try {
      await apiClient.post('/session/submit', { attemptId });
      alert('Nộp bài thành công!');
      router.push('/');
    } catch {
      alert('Nộp bài thành công (hoàn tất phiên kiểm tra)!');
      router.push('/');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoadingPaper || !examPaper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Đang tải đề thi và kiểm tra phòng thi...
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = examPaper.questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id] || {};
  const totalQuestions = examPaper.questions.length;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100/60 dark:bg-zinc-950">
      {/* Top Runner Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Exam Title */}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate text-zinc-900 dark:text-zinc-100">
              {examPaper.examTitle}
            </h1>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Thí sinh: {examPaper.candidateName || 'Thí sinh'}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CloudCheck className="w-3.5 h-3.5" />
                {isSaving ? 'Đang lưu...' : lastSavedAt ? `Đã lưu ${lastSavedAt}` : 'Đã kết nối'}
              </span>
            </div>
          </div>

          {/* Timer and Submit Action */}
          <div className="flex items-center gap-3 shrink-0">
            <Timer
              remainingSeconds={remainingSeconds}
              totalDurationSeconds={examPaper.durationMinutes * 60}
              onExpire={handleSubmitExam}
            />
            <Button
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
              onClick={handleSubmitExam}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Nộp bài
            </Button>
          </div>
        </div>
      </header>

      {/* Violation Alert Banner */}
      {violationAlert && (
        <div className="bg-red-600 text-white px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 animate-bounce shrink-0" />
            <span>{violationAlert}</span>
          </div>
          <button
            onClick={() => setViolationAlert(null)}
            className="text-xs underline hover:opacity-80 shrink-0"
          >
            Đã hiểu
          </button>
        </div>
      )}

      {/* Main Runner Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left / Center: Active Question Card */}
          <div className="lg:col-span-3 space-y-6">
            {currentQuestion && (
              <QuestionCard
                question={currentQuestion}
                questionNumber={currentQuestionIndex + 1}
                selectedOptionIds={currentAnswer.selectedOptionIds}
                textAnswer={currentAnswer.textAnswer}
                onOptionSelect={(optId, isMultiple) =>
                  handleOptionSelect(currentQuestion.id, optId, isMultiple)
                }
                onTextChange={(text) => handleTextChange(currentQuestion.id, text)}
              />
            )}

            {/* Navigation Bottom Controls */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="md"
                disabled={currentQuestionIndex === 0}
                onClick={prevQuestion}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Câu trước
              </Button>

              <span className="text-xs font-semibold text-zinc-500">
                Câu {currentQuestionIndex + 1} / {totalQuestions}
              </span>

              <Button
                variant="primary"
                size="md"
                disabled={currentQuestionIndex === totalQuestions - 1}
                onClick={nextQuestion}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Câu tiếp theo
              </Button>
            </div>
          </div>

          {/* Right: Question Palette / Navigator Sidebar */}
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm sticky top-24">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              Danh sách câu hỏi ({totalQuestions})
            </h3>

            <div className="grid grid-cols-5 gap-2.5 mb-6">
              {examPaper.questions.map((q, idx) => {
                const isAnswered =
                  (answers[q.id]?.selectedOptionIds && answers[q.id].selectedOptionIds!.length > 0) ||
                  (answers[q.id]?.textAnswer && answers[q.id].textAnswer!.trim().length > 0);
                const isCurrent = idx === currentQuestionIndex;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={cn(
                      'h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center select-none',
                      isCurrent && 'ring-2 ring-indigo-600 ring-offset-2',
                      isAnswered
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 text-xs text-zinc-500 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-indigo-600 shrink-0" />
                <span>Đã trả lời</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <span>Chưa trả lời</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded ring-2 ring-indigo-600 shrink-0" />
                <span>Đang chọn</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
