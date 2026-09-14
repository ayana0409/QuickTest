'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Layers,
  CheckCircle2,
  FileQuestion,
  TrendingUp,
} from 'lucide-react';
import { examService } from '@/services/exam.service';
import { useGradingStore } from '@/stores/useGradingStore';
import { QuestionGradingOverviewCard } from '@/components/grading/QuestionGradingOverviewCard';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import type { ExamDetailResponse } from '@/types/exam';


interface ExamGradingQuestionsPageProps {
  params: Promise<{
    examId: string;
  }>;
}

/**
 * Exam-Level Grading Overview Page.
 * Displays all essay questions belonging to a specific exam with completion progress and batch AI actions.
 */
export default function ExamGradingQuestionsPage({ params }: ExamGradingQuestionsPageProps) {
  const resolvedParams = use(params);
  const examId = resolvedParams.examId;

  const [examDetail, setExamDetail] = useState<ExamDetailResponse | null>(null);
  const [isLoadingExam, setIsLoadingExam] = useState(true);

  const {
    questions,
    isLoadingQuestions,
    isTriggeringAi,
    fetchQuestions,
    triggerAiGrading,
  } = useGradingStore();

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setIsLoadingExam(true);
        const detail = await examService.getExamDetail(examId);
        if (isMounted) {
          setExamDetail(detail);
        }
      } catch {
        if (isMounted) {
          setExamDetail(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingExam(false);
        }
      }
    };

    loadData();
    fetchQuestions(examId);

    return () => {
      isMounted = false;
    };
  }, [examId, fetchQuestions]);

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
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Top Breadcrumb & Header */}
      <div>
        <Link
          href="/teacher/grading"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại Trung tâm chấm điểm</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {isLoadingExam ? 'Đang tải thông tin đề thi...' : examDetail?.title || 'Chấm điểm bài thi'}
              </h1>
              {examDetail && (
                <Badge variant={examDetail.status} size="sm" dot>
                  {examDetail.status === 'PUBLISHED'
                    ? 'Đang diễn ra'
                    : examDetail.status === 'CLOSED'
                    ? 'Đã kết thúc'
                    : 'Bản nháp'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Quản lý tiến độ chấm và đối chiếu rubric theo từng câu hỏi tự luận
            </p>
          </div>

          {/* Trigger AI Button */}
          {totalEssayQuestions > 0 && (
            <Button
              variant="primary"
              size="md"
              className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 shadow-md shadow-indigo-500/20"
              isLoading={isTriggeringAi}
              disabled={isTriggeringAi || isLoadingQuestions}
              onClick={handleTriggerEntireExamAi}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Chấm AI toàn bộ đề thi
            </Button>
          )}
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
            Câu hỏi tự luận
          </span>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 flex items-center justify-between">
            <span>{totalEssayQuestions} câu</span>
            <FileQuestion className="w-5 h-5 text-indigo-500" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
            Tổng lượt bài nộp
          </span>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 flex items-center justify-between">
            <span>{totalSubmissions} bài</span>
            <Layers className="w-5 h-5 text-zinc-400" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
            Chờ chấm điểm
          </span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 flex items-center justify-between">
            <span>{totalPending} bài</span>
            <Layers className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
            Tiến độ hoàn thành
          </span>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2 flex items-center justify-between">
            <span>{overallProgressPercent}%</span>
            <TrendingUp className="w-5 h-5 text-indigo-500" />
          </div>
        </div>

      </div>

      {/* Questions Section */}
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
            <Link href="/teacher/grading">
              <Button variant="outline" size="sm">
                Quay lại danh sách đề thi
              </Button>
            </Link>
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
  );
}
