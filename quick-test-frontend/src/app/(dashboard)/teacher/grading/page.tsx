'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Search,
  BookOpen,
  Clock,
  ArrowRight,
  CheckCircle2,
  FolderX,
  Layers,
  FileText,
  Check,
  Users,
} from 'lucide-react';

import { examService } from '@/services/exam.service';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';
import type { ExamSummaryResponse, ExamStatus } from '@/types/exam';

/**
 * Teacher Grading Hub Page.
 * Displays all published or closed exams created by the teacher,
 * highlighting essay questions for grading and clearly identifying
 * exams with zero essay questions.
 */
export default function TeacherGradingHubPage() {
  const [exams, setExams] = useState<ExamSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PUBLISHED' | 'CLOSED'>('ALL');

  useEffect(() => {
    let isMounted = true;
    const loadExams = async () => {
      try {
        setIsLoading(true);
        // Load teacher exams from backend endpoint
        const response = await examService.getTeacherExams({ size: 100, sort: 'createdAt,desc' });
        if (isMounted) {
          // Strictly exclude draft exams as drafts have no student submissions
          const validExams = (response.content || []).filter((exam) => exam.status !== 'DRAFT');
          setExams(validExams);
        }
      } catch {
        if (isMounted) {
          setExams([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadExams();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter and sort exams according to search and status filter
  const filteredExams = useMemo(() => {
    const list = exams.filter((exam) => {
      const matchesSearch =
        exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exam.description && exam.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = selectedStatus === 'ALL' || exam.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });

    // Prioritize exams with essay questions needing grading, followed by newest
    return [...list].sort((a, b) => {
      const aEssay = a.totalEssayQuestions ?? 0;
      const bEssay = b.totalEssayQuestions ?? 0;
      if (aEssay > 0 && bEssay === 0) return -1;
      if (aEssay === 0 && bEssay > 0) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [exams, searchTerm, selectedStatus]);

  // Aggregate metrics (excluding drafts entirely)
  const totalExams = exams.length;
  const activeExams = exams.filter((e) => e.status === 'PUBLISHED').length;
  const closedExams = exams.filter((e) => e.status === 'CLOSED').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold mb-1.5 border border-indigo-200/60 dark:border-indigo-900/60">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Chấm điểm tự luận</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Chấm Điểm Bài Thi Tự Luận
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Xem lại bài làm tự luận của học sinh, đánh giá cho điểm và nhận gợi ý từ trợ lý AI
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/teacher/exams"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
            <span>Quản lý đề thi</span>
          </Link>
        </div>
      </div>

      {/* Metrics Banner: 3-column horizontal grid across all screen sizes */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider truncate">
              Tổng đề thi
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 sm:mt-2">
            {totalExams}
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider truncate">
              Đang mở
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 sm:mt-2">
            {activeExams}
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider truncate">
              Đã kết thúc
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 sm:mt-2">
            {closedExams}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo tiêu đề hoặc nội dung đề thi..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Clean Segmented Control: All, Published, Closed (no draft) */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 overflow-x-auto scrollbar-none w-full sm:w-auto shrink-0">
          {(
            [
              { id: 'ALL', label: 'Tất cả' },
              { id: 'PUBLISHED', label: 'Đang mở' },
              { id: 'CLOSED', label: 'Đã đóng' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatus(tab.id)}
              className={cn(
                'flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer text-center',
                selectedStatus === tab.id
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exams Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs animate-pulse space-y-3"
            >
              <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
              <div className="h-9 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
            <FolderX className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Không tìm thấy đề thi phù hợp
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1">
              {searchTerm
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái để xem nhiều kết quả hơn.'
                : 'Hiện bạn chưa có đề thi nào đã phát hành.'}
            </p>
          </div>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('ALL');
              }}
            >
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredExams.map((exam) => {
            const essayCount = exam.totalEssayQuestions ?? 0;
            const hasEssayQuestions = essayCount > 0;

            return (
              <div
                key={exam.id}
                className={cn(
                  'rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all duration-300',
                  hasEssayQuestions
                    ? 'border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 group'
                    : 'border border-dashed border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 opacity-80'
                )}
              >
                <div className="space-y-3">
                  {/* Top Bar: Exam Status Badge + Question Counts */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant={exam.status as ExamStatus} size="sm" dot>
                      {exam.status === 'PUBLISHED' ? 'Đang mở' : 'Đã đóng'}
                    </Badge>

                    <div className="flex items-center gap-1.5">
                      {hasEssayQuestions ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50">
                          <FileText className="w-3 h-3 text-indigo-500" />
                          <span>{essayCount} câu tự luận</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                          <Check className="w-3 h-3 text-zinc-400" />
                          <span>0 câu tự luận</span>
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                        / {exam.totalQuestions || 0} câu
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3
                      className={cn(
                        'text-sm sm:text-base font-bold line-clamp-1 transition-colors',
                        hasEssayQuestions
                          ? 'text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                          : 'text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      {exam.title}
                    </h3>
                    {exam.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {exam.description}
                      </p>
                    )}
                  </div>

                  {/* Exam Details (Duration, Points) */}
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{exam.durationMinutes} phút</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{exam.totalPoints} điểm</span>
                    </div>
                  </div>

                  {/* Zero Essay Questions Notice */}
                  {!hasEssayQuestions && (
                    <div className="mt-2 p-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                      <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <span>
                        Đề thi hoàn toàn là trắc nghiệm, hệ thống đã tự động chấm điểm cho học sinh.
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Area: Question-centric vs Attempt-centric */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  {hasEssayQuestions ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/teacher/grading/exams/${exam.id}?tab=questions`}
                        className="inline-flex items-center justify-center font-semibold rounded-xl text-xs px-2.5 py-2.5 transition-all select-none bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white cursor-pointer shadow-xs"
                        title="Chấm gom theo từng câu hỏi tự luận"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-zinc-300 dark:text-zinc-600 shrink-0" />
                        <span className="truncate">Theo câu hỏi</span>
                      </Link>
                      <Link
                        href={`/teacher/grading/exams/${exam.id}?tab=attempts`}
                        className="inline-flex items-center justify-center font-semibold rounded-xl text-xs px-2.5 py-2.5 transition-all select-none border border-zinc-200 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 active:scale-[0.98] cursor-pointer"
                        title="Chấm toàn bộ bài nộp của từng học sinh"
                      >
                        <Users className="w-3.5 h-3.5 mr-1 text-zinc-400 shrink-0" />
                        <span className="truncate">Theo từng phiên</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-full inline-flex items-center justify-center font-medium rounded-xl text-xs px-3 py-2 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 cursor-not-allowed select-none border border-zinc-200/40 dark:border-zinc-700/40">
                        <span>Không có câu hỏi tự luận để chấm</span>
                      </div>
                      <Link
                        href={`/teacher/grading/exams/${exam.id}?tab=attempts`}
                        className="w-full inline-flex items-center justify-center font-medium rounded-xl text-xs px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                        <span>Xem kết quả từng phiên thi</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
