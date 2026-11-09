'use client';

import React, { useEffect, use, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  Layers,
  CheckCircle2,
  FileQuestion,
  TrendingUp,
  FileText,
  Users,
} from 'lucide-react';
import { useGradingStore } from '@/stores/useGradingStore';
import { QuestionGradingOverviewCard } from '@/components/grading/QuestionGradingOverviewCard';
import { ExamAttemptsTab } from '@/components/exam/ExamAttemptsTab';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';

interface ExamGradingQuestionsPageProps {
  params: Promise<{
    examId: string;
  }>;
}

/**
 * Inner component to handle searchParams within Suspense boundary.
 */
function ExamGradingOverviewContent({ examId }: { examId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab mode: 'questions' (question-centric) or 'attempts' (session-centric)
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'questions' | 'attempts'>(
    queryTab === 'attempts' ? 'attempts' : 'questions'
  );

  const {
    questions,
    currentExamTitle,
    currentExamStatus,
    currentExamTotalPoints,
    isLoadingQuestions,
    isTriggeringAi,
    fetchQuestions,
    triggerAiGrading,
  } = useGradingStore();

  useEffect(() => {
    fetchQuestions(examId);
  }, [examId, fetchQuestions]);

  // Synchronize state with URL search param
  useEffect(() => {
    if (queryTab === 'attempts' || queryTab === 'questions') {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const handleSwitchTab = (newTab: 'questions' | 'attempts') => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleTriggerEntireExamAi = async () => {
    await triggerAiGrading(examId);
  };

  // Aggregated essay question statistics
  const totalEssayQuestions = questions.length;
  const totalSubmissions = questions.reduce((acc, q) => acc + (q.totalSubmissions || 0), 0);
  const totalGraded = questions.reduce((acc, q) => acc + (q.gradedCount || 0), 0);
  const totalPending = questions.reduce((acc, q) => acc + (q.pendingCount || 0), 0);
  const overallProgressPercent =
    totalSubmissions > 0 ? Math.round((totalGraded / totalSubmissions) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">
      {/* Top Breadcrumb & Header */}
      <div>
        <Link
          href="/teacher/grading"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-2.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại danh sách đề thi</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {isLoadingQuestions ? 'Đang tải thông tin đề thi...' : currentExamTitle || 'Chấm điểm bài thi'}
              </h1>
              {currentExamStatus && (
                <Badge variant={currentExamStatus as any} size="sm" dot>
                  {currentExamStatus === 'PUBLISHED'
                    ? 'Đang mở'
                    : currentExamStatus === 'CLOSED'
                    ? 'Đã đóng'
                    : 'Bản nháp'}
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Quản lý tiến độ chấm bài và xem bài làm chi tiết của từng học sinh
            </p>
          </div>

          {/* Trigger AI Button (Only visible in question tab when essays exist) */}
          {activeTab === 'questions' && totalEssayQuestions > 0 && (
            <Button
              variant="primary"
              size="md"
              className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 shadow-md shadow-indigo-500/20 text-xs sm:text-sm self-start md:self-auto shrink-0"
              isLoading={isTriggeringAi}
              disabled={isTriggeringAi || isLoadingQuestions}
              onClick={handleTriggerEntireExamAi}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              <span>Chấm AI toàn bộ đề thi</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mode Switcher: Segmented Control for Grading Modes */}
      <div className="flex items-center p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-zinc-700/70 w-full sm:w-max">
        <button
          type="button"
          onClick={() => handleSwitchTab('questions')}
          className={cn(
            'flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
            activeTab === 'questions'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          )}
        >
          <FileText className="w-4 h-4 text-indigo-500" />
          <span>Chấm theo câu hỏi</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-mono font-medium',
              activeTab === 'questions'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400'
                : 'bg-zinc-200/70 dark:bg-zinc-700/70 text-zinc-600 dark:text-zinc-400'
            )}
          >
            {totalEssayQuestions}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('attempts')}
          className={cn(
            'flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer',
            activeTab === 'attempts'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          )}
        >
          <Users className="w-4 h-4 text-purple-500" />
          <span>Chấm theo từng phiên</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-mono font-medium',
              activeTab === 'attempts'
                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400'
                : 'bg-zinc-200/70 dark:bg-zinc-700/70 text-zinc-600 dark:text-zinc-400'
            )}
          >
            Bài làm
          </span>
        </button>
      </div>

      {/* Mode 1: Question-Centric Grading View */}
      {activeTab === 'questions' && (
        <div className="space-y-6 sm:space-y-8">
          {/* Overview Metrics Cards: 2x2 on Mobile, 4-col on Desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider truncate">
                  Câu tự luận
                </span>
                <FileQuestion className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 sm:mt-2">
                {totalEssayQuestions} <span className="text-xs font-normal text-zinc-400">câu</span>
              </div>
            </div>

            <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider truncate">
                  Tổng bài nộp
                </span>
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 sm:mt-2">
                {totalSubmissions} <span className="text-xs font-normal text-zinc-400">bài</span>
              </div>
            </div>

            <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider truncate">
                  Chờ chấm điểm
                </span>
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 sm:mt-2">
                {totalPending} <span className="text-xs font-normal text-zinc-400">bài</span>
              </div>
            </div>

            <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider truncate">
                  Tiến độ chấm
                </span>
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 sm:mt-2">
                {overallProgressPercent}%
              </div>
            </div>
          </div>

          {/* Essay Questions List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Danh Sách Câu Hỏi Tự Luận Cần Chấm
              </h2>
              <span className="text-xs text-zinc-500">
                {totalEssayQuestions} câu hỏi yêu cầu chấm điểm
              </span>
            </div>

            {isLoadingQuestions ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs animate-pulse space-y-4"
                  >
                    <div className="h-5 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                    <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
                    <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
                    <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-xl mt-4" />
                  </div>
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Không có câu hỏi tự luận cần chấm
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1">
                    Đề thi này chỉ bao gồm các câu hỏi trắc nghiệm khách quan và đã được hệ thống tự động tính điểm 100% khi thí sinh nộp bài.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitchTab('attempts')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Xem kết quả từng phiên thi</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {questions.map((question) => (
                  <QuestionGradingOverviewCard
                    key={question.questionId}
                    question={question}
                    examId={examId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Candidate Session-Centric (Attempt-Centric) Grading View */}
      {activeTab === 'attempts' && (
        <div className="space-y-4">
          <ExamAttemptsTab
            examId={examId}
            totalPoints={currentExamTotalPoints || 10}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Exam-Level Grading Overview Page.
 * Bundles Question-Centric Grading with Session-Centric (Attempt-Centric) Grading in a unified tab interface.
 */
export default function ExamGradingQuestionsPage({ params }: ExamGradingQuestionsPageProps) {
  const resolvedParams = use(params);
  const examId = resolvedParams.examId;

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto py-16 text-center space-y-4">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500">Đang tải không gian chấm điểm...</p>
        </div>
      }
    >
      <ExamGradingOverviewContent examId={examId} />
    </Suspense>
  );
}
