'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock,
  FileQuestion,
  Award,
  User,
  Copy,
  Check,
  RotateCw,
  ArrowRight,
  BookOpen,
  Compass,
} from 'lucide-react';
import { examService } from '@/services/exam.service';
import type { PublicExamCardResponse } from '@/types/exam';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function PublicExamsSection() {
  const router = useRouter();
  const [exams, setExams] = useState<PublicExamCardResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchExams = useCallback(async (isUserManualRefresh = false) => {
    try {
      if (isUserManualRefresh) setIsRefreshing(true);
      const data = await examService.getPublicRandomExams();
      setExams(data || []);
    } catch (error) {
      console.error('Failed to load public exams:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã phòng: ${code}`, {
      id: `copy-${code}`,
      duration: 2000,
    });
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  const handleEnterExam = (code: string) => {
    router.push(`/exam?code=${encodeURIComponent(code)}`);
  };

  return (
    <section className="py-12 sm:py-20 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-950/40 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60">
              <Compass className="w-3.5 h-3.5" />
              <span>Khám phá đề thi mở</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Luyện tập nhanh với{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                đề thi công khai
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Chọn một đề thi bên dưới để thử sức ngay hoặc sao chép mã phòng chia sẻ cho bạn bè.
            </p>
          </div>

          {/* Shuffle / Reload Action Button */}
          <button
            type="button"
            onClick={() => fetchExams(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer w-fit shrink-0"
          >
            <RotateCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-indigo-600")} />
            <span>{isRefreshing ? 'Đang tải...' : 'Đổi đề khác'}</span>
          </button>
        </div>

        {/* Loading Skeletons (3 on mobile, 6 on desktop) */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 animate-pulse space-y-3.5",
                  idx >= 3 && "hidden md:block"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                  <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                </div>
                <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                <div className="pt-3 flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800">
                  <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                  <div className="h-7 w-7 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && exams.length === 0 && (
          <div className="p-8 sm:p-10 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 text-center max-w-lg mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Hiện chưa có đề thi mở khả dụng
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Các đề thi công khai đang được cập nhật. Bạn vẫn có thể nhập mã phòng thi cá nhân để vào làm bài ngay.
            </p>
            <div className="pt-1">
              <Link
                href="/exam"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all"
              >
                <span>Nhập mã phòng thi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Exam Cards Grid */}
        {!isLoading && exams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {exams.map((exam) => {
              const isCopied = copiedCode === exam.accessCode;
              const hasDesc = Boolean(exam.description?.trim());

              return (
                <div
                  key={exam.id}
                  onClick={() => handleEnterExam(exam.accessCode)}
                  className="group rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs hover:border-indigo-500/50 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Teacher Info & Access Code Copy Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                          {exam.teacherName || 'Giảng viên'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(e, exam.accessCode)}
                        title="Sao chép mã phòng"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 border border-zinc-200/60 dark:border-zinc-700 transition-colors cursor-pointer shrink-0"
                      >
                        <span>#{exam.accessCode}</span>
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-zinc-400" />
                        )}
                      </button>
                    </div>

                    {/* Title & Optional Description */}
                    <div className="space-y-1.5">
                      <h3
                        className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug"
                        title={exam.title}
                      >
                        {exam.title}
                      </h3>

                      {hasDesc && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                          {exam.description!.trim()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meta Indicators & Circular Action Arrow */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{exam.durationMinutes}p</span>
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <FileQuestion className="w-3.5 h-3.5 text-purple-500" />
                        <span>{exam.questionCount || 0} câu</span>
                      </span>

                      {exam.totalPoints != null && exam.totalPoints > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>{exam.totalPoints}đ</span>
                        </span>
                      )}
                    </div>

                    <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
