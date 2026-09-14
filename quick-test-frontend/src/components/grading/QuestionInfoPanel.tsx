import React, { useState } from 'react';
import Link from 'next/link';

import {
  Sparkles,
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Maximize2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';
import type { QuestionSubmissionsDetailResponse } from '@/types/candidateAnswer';

interface QuestionInfoPanelProps {
  questionDetail: QuestionSubmissionsDetailResponse;
  examId?: string;
  isAiGrading?: boolean;
  onTriggerAi?: () => void;
  className?: string;
}

/**
 * Sticky Left Panel in Split-pane grading workspace.
 * Displays the question prompt, media attachments, grading rubric, sample answer, and progress statistics.
 */
export const QuestionInfoPanel: React.FC<QuestionInfoPanelProps> = ({
  questionDetail,
  examId,
  isAiGrading = false,
  onTriggerAi,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'rubric' | 'sample'>('rubric');
  const [showImageModal, setShowImageModal] = useState(false);

  // Quick stats from submissions page response
  const totalSubmissions = questionDetail.submissions?.totalElements ?? 0;
  const gradedCount =
    questionDetail.submissions?.content?.filter((s) => s.gradingStatus === 'GRADED').length ?? 0;


  return (
    <div
      className={cn(
        'flex flex-col gap-5 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs sticky top-20',
        className
      )}
    >
      {/* Navigation & Header */}
      <div>
        {examId && (
          <Link
            href={`/teacher/grading/exams/${examId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Danh sách câu hỏi của đề</span>
          </Link>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs">
              {(questionDetail.orderIndex ?? 0) + 1}
            </span>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Câu hỏi tự luận
            </h2>
          </div>

          <Badge variant="info" size="sm">
            {questionDetail.maxPoints} Điểm
          </Badge>
        </div>
      </div>

      {/* Question Prompt Body */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
            Đề bài
          </span>
          <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
            <Users className="w-3 h-3" />
            {gradedCount} / {totalSubmissions} bài đã nộp
          </span>
        </div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed p-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/80 border border-zinc-200/60 dark:border-zinc-800/60">
          {questionDetail.content}
        </div>

        {/* Attached Question Image */}
        {questionDetail.imageUrl && (
          <div className="relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={questionDetail.imageUrl}
              alt="Hình ảnh minh họa câu hỏi"
              className="w-full max-h-48 object-cover rounded-xl transition-transform group-hover:scale-[1.02] cursor-pointer"
              onClick={() => setShowImageModal(true)}
            />
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white text-xs backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Phóng to
            </button>
          </div>
        )}

      </div>


      {/* Rubric and Sample Answer Toggle */}
      <div className="space-y-3">
        <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('rubric')}
            className={cn(
              'flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all text-center flex items-center justify-center gap-1.5',
              activeTab === 'rubric'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tiêu chí chấm (Rubric)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sample')}
            className={cn(
              'flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all text-center flex items-center justify-center gap-1.5',
              activeTab === 'sample'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Đáp án mẫu</span>
          </button>
        </div>

        {activeTab === 'rubric' ? (
          <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap min-h-[100px]">
            {questionDetail.gradingRubric && questionDetail.gradingRubric.trim().length > 0 ? (
              questionDetail.gradingRubric
            ) : (
              <span className="italic text-zinc-400 dark:text-zinc-500">
                (Chưa thiết lập tiêu chí chấm chi tiết cho câu hỏi này)
              </span>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed whitespace-pre-wrap min-h-[100px]">
            {questionDetail.sampleAnswer && questionDetail.sampleAnswer.trim().length > 0 ? (
              questionDetail.sampleAnswer
            ) : (
              <span className="italic text-zinc-400 dark:text-zinc-500">
                (Chưa thiết lập đáp án mẫu cho câu hỏi này)
              </span>
            )}
          </div>
        )}
      </div>

      {/* AI Automated Grading Trigger */}
      {onTriggerAi && (
        <div className="pt-2">
          <Button
            variant="primary"
            size="md"
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 shadow-md shadow-indigo-500/20"
            isLoading={isAiGrading}
            disabled={isAiGrading}
            onClick={onTriggerAi}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Chấm AI toàn bộ câu này
          </Button>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center mt-1.5">
            Sử dụng Google Gemini AI đối chiếu rubric và gợi ý điểm số
          </p>
        </div>
      )}

      {/* Image Modal Lightbox */}
      {showImageModal && questionDetail.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto rounded-2xl bg-zinc-950 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={questionDetail.imageUrl}
              alt="Hình ảnh câu hỏi phóng to"
              className="w-full h-auto rounded-xl object-contain"
            />
            <button
              type="button"
              className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-semibold hover:bg-zinc-700"
              onClick={() => setShowImageModal(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
