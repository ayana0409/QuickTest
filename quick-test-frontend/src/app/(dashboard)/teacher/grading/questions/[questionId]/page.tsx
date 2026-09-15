'use client';

import React, { useEffect, use, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  FolderX,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useGradingStore } from '@/stores/useGradingStore';
import {
  GradingSplitPane,
  QuestionInfoPanel,
  CandidateSubmissionCard,
  SkeletonGradingCard,
} from '@/components/grading';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';

interface QuestionGradingDetailPageProps {
  params: Promise<{
    questionId: string;
  }>;
}

function QuestionGradingDetailContent({ questionId }: { questionId: string }) {
  const searchParams = useSearchParams();
  const examId = searchParams.get('examId') || undefined;

  const {
    currentQuestionDetail,
    isLoadingDetail,
    statusFilter,
    currentPage,
    drafts,
    savingAnswerIds,
    aiGradingAnswerIds,
    isBatchSaving,
    isTriggeringAi,
    fetchQuestionSubmissions,
    setStatusFilter,
    setPage,
    updateDraft,
    saveSingleGrade,
    saveAllDrafts,
    gradeSingleWithAi,
    triggerAiGrading,
    resetStore,
  } = useGradingStore();


  useEffect(() => {
    fetchQuestionSubmissions(questionId);

    return () => {
      resetStore();
    };
  }, [questionId, fetchQuestionSubmissions, resetStore]);

  // Count number of modified/dirty drafts for this question
  const dirtyCount = useMemo(() => {
    return Object.values(drafts).filter((d) => d.isDirty).length;
  }, [drafts]);

  const handleSaveBatch = async () => {
    if (dirtyCount === 0) return;
    const success = await saveAllDrafts(questionId);
    if (success) {
      toast.success(`Đã lưu thành công điểm và nhận xét cho ${dirtyCount} bài làm!`);
    }
  };

  const handleTriggerAi = async () => {
    if (!currentQuestionDetail) return;
    const targetExamId = currentQuestionDetail.examId || examId;
    await triggerAiGrading(targetExamId, questionId);
  };


  const submissionsPage = currentQuestionDetail?.submissions;
  const submissionsList = submissionsPage?.content || [];
  const totalPages = submissionsPage?.totalPages || 0;
  const totalElements = submissionsPage?.totalElements || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <Link
            href={examId ? `/teacher/grading/exams/${examId}` : '/teacher/grading'}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại {examId ? 'danh sách câu hỏi' : 'trung tâm chấm'}</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Không gian chấm điểm câu hỏi
            </h1>
            {currentQuestionDetail && (
              <Badge variant="neutral" size="sm">
                Câu {(currentQuestionDetail.orderIndex ?? 0) + 1}
              </Badge>
            )}
          </div>
        </div>

        {/* Global Save Changes Button if there are dirty drafts */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            isLoading={isBatchSaving}
            disabled={isBatchSaving || dirtyCount === 0}
            onClick={handleSaveBatch}
            className={cn(
              'transition-all shadow-sm',
              dirtyCount > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 ring-2 ring-amber-400/20'
                : 'opacity-70'
            )}
            leftIcon={<Save className="w-4 h-4" />}
          >
            <span>Lưu tất cả thay đổi</span>
            {dirtyCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                {dirtyCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      {isLoadingDetail && !currentQuestionDetail ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs animate-pulse space-y-4">
            <div className="h-6 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            <div className="h-24 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-xl" />
            <div className="h-32 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-xl" />
          </div>
          <div className="lg:col-span-8 space-y-4">
            {[1, 2, 3].map((idx) => (
              <SkeletonGradingCard key={idx} />
            ))}
          </div>
        </div>
      ) : currentQuestionDetail ? (
        <GradingSplitPane
          leftPanel={
            <QuestionInfoPanel
              questionDetail={currentQuestionDetail}
              examId={currentQuestionDetail.examId || examId}
              isAiGrading={isTriggeringAi}
              onTriggerAi={handleTriggerAi}
            />
          }


          rightPanel={
            <div className="space-y-6">
              {/* Right Panel Submissions Toolbar */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Bài làm của thí sinh
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                    {totalElements} bài
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
                  {(
                    [
                      { key: 'ALL', label: 'Tất cả' },
                      { key: 'PENDING_MANUAL', label: 'Chờ chấm' },
                      { key: 'GRADED', label: 'Đã chấm' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                        statusFilter === tab.key
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submissions List */}
              {isLoadingDetail ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((idx) => (
                    <SkeletonGradingCard key={idx} />
                  ))}
                </div>
              ) : submissionsList.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
                    <FolderX className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Không có bài làm nào
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                    {statusFilter === 'PENDING_MANUAL'
                      ? 'Tất cả các bài làm cho câu hỏi này đã được hoàn tất chấm điểm!'
                      : 'Chưa có bài nộp nào cho tiêu chí đang chọn.'}
                  </p>

                  {statusFilter !== 'ALL' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatusFilter('ALL')}
                    >
                      Xem tất cả bài làm
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {submissionsList.map((submission) => (
                    <CandidateSubmissionCard
                      key={submission.candidateAnswerId}
                      submission={submission}
                      maxPoints={currentQuestionDetail.maxPoints}
                      draft={drafts[submission.candidateAnswerId]}
                      isSaving={Boolean(savingAnswerIds[submission.candidateAnswerId])}
                      isAiGrading={Boolean(aiGradingAnswerIds[submission.candidateAnswerId])}
                      onDraftChange={(score, feedback) =>
                        updateDraft(submission.candidateAnswerId, {
                          awardedScore: score,
                          teacherFeedback: feedback,
                        })
                      }
                      onSave={() =>
                        saveSingleGrade(questionId, submission.candidateAnswerId)
                      }
                      onAiGrade={() =>
                        gradeSingleWithAi(submission.candidateAnswerId)
                      }
                    />
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80">
                  <span className="text-xs text-zinc-500">
                    Trang <strong>{currentPage + 1}</strong> / {totalPages} (Tổng {totalElements} bài)
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 0 || isLoadingDetail}
                      onClick={() => setPage(currentPage - 1)}
                      leftIcon={<ChevronLeft className="w-4 h-4" />}
                    >
                      Trang trước
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages - 1 || isLoadingDetail}
                      onClick={() => setPage(currentPage + 1)}
                      rightIcon={<ChevronRight className="w-4 h-4" />}
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              )}
            </div>
          }
        />
      ) : null}
    </div>
  );
}

/**
 * Question-Centric Grading Workspace Page.
 * Implements a split-pane layout with a sticky question rubric panel on the left
 * and a list of candidate responses on the right, equipped with batch saving and AI evaluation.
 */
export default function QuestionGradingDetailPage({ params }: QuestionGradingDetailPageProps) {
  const resolvedParams = use(params);

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-12 text-center text-sm text-zinc-500 animate-pulse">
          Đang chuẩn bị không gian chấm điểm câu hỏi...
        </div>
      }
    >
      <QuestionGradingDetailContent questionId={resolvedParams.questionId} />
    </Suspense>
  );
}

