'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Clock,
  FileQuestion,
  Award,
  User,
  Copy,
  Check,
  RotateCw,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { examService } from '@/services/exam.service';
import type { PublicExamCardResponse } from '@/types/exam';
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
      icon: '📋',
    });
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  const handleEnterExam = (code: string) => {
    router.push(`/exam?code=${encodeURIComponent(code)}`);
  };

  return (
    <section className="py-20 sm:py-28 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300">
              <Compass className="w-3.5 h-3.5 animate-pulse text-indigo-600 dark:text-indigo-400" />
              <span>KHẢO THÍ & LUYỆN ĐỀ CÔNG KHAI</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Thử sức ngay với{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                các đề thi mở
              </span>
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Khám phá các bài thi ngẫu nhiên từ giáo viên trên toàn hệ thống.
              Bạn có thể sao chép mã phòng hoặc bấm vào làm bài trực tiếp không cần đăng nhập.
            </p>
          </div>

          {/* Shuffle / Reload Action Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchExams(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isRefreshing ? 'Đang đổi...' : 'Đổi bộ đề khác'}</span>
            </button>
          </div>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="p-1 rounded-3xl bg-zinc-200/60 dark:bg-zinc-800/40 animate-pulse"
              >
                <div className="p-6 rounded-[calc(1.5rem-2px)] bg-white dark:bg-zinc-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                    <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                  </div>
                  <div className="h-6 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                  <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
                  <div className="pt-4 flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800">
                    <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                    <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && exams.length === 0 && (
          <div className="p-8 sm:p-12 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 text-center max-w-xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Chưa có đề thi công khai khả dụng
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Hiện tại các đề thi công khai đang được cập nhật. Bạn vẫn có thể nhập mã phòng thi cá nhân để làm bài ngay.
            </p>
            <div className="pt-2">
              <Link
                href="/exam"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <span>Nhập mã phòng thi</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Exam Cards Grid */}
        {!isLoading && exams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => {
              const isCopied = copiedCode === exam.accessCode;

              return (
                <div
                  key={exam.id}
                  className="group relative p-1 rounded-3xl bg-zinc-100/90 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 transition-all duration-300 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between"
                >
                  {/* Inner Card Container */}
                  <div className="p-6 rounded-[calc(1.5rem-2px)] bg-white dark:bg-zinc-900/95 h-full flex flex-col justify-between space-y-5">
                    {/* Top Row: Status badge & Access Code Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {exam.isOpen ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/50">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Đang mở
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/50">
                            {exam.examTimeStatus === 'UPCOMING' ? 'Sắp mở' : 'Đã đóng'}
                          </span>
                        )}

                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                          Công khai
                        </span>
                      </div>

                      {/* Access Code with Copy Button */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(e, exam.accessCode)}
                        title="Bấm để sao chép mã phòng"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold tracking-wider bg-zinc-100 dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 border border-zinc-200/80 dark:border-zinc-700/80 transition-all cursor-pointer group/code"
                      >
                        <span>{exam.accessCode}</span>
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-scale-in" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover/code:text-indigo-600 dark:group-hover/code:text-indigo-400" />
                        )}
                      </button>
                    </div>

                    {/* Middle: Title, Description & Author */}
                    <div className="space-y-2.5 flex-1">
                      <h3
                        onClick={() => handleEnterExam(exam.accessCode)}
                        className="text-lg font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer"
                        title={exam.title}
                      >
                        {exam.title}
                      </h3>

                      <p
                        className={`text-xs line-clamp-2 leading-relaxed ${exam.description?.trim()
                            ? 'text-zinc-500 dark:text-zinc-400'
                            : 'text-zinc-400 dark:text-zinc-500 italic'
                          }`}
                      >
                        {exam.description?.trim() ? exam.description.trim() : 'Bài thi không có mô tả'}
                      </p>

                      {exam.teacherName && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="font-medium truncate">{exam.teacherName}</span>
                        </div>
                      )}
                    </div>

                    {/* Meta Indicators: Duration, Questions, Points */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1" title="Thời lượng làm bài">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{exam.durationMinutes} phút</span>
                      </div>

                      <div className="flex items-center gap-1" title="Số lượng câu hỏi">
                        <FileQuestion className="w-3.5 h-3.5 text-purple-500" />
                        <span>{exam.questionCount || 0} câu</span>
                      </div>

                      {exam.totalPoints != null && exam.totalPoints > 0 && (
                        <div className="flex items-center gap-1" title="Thang điểm tối đa">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>{exam.totalPoints}đ</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button: Vào thi ngay */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleEnterExam(exam.accessCode)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white transition-all duration-200 shadow-sm group/btn cursor-pointer"
                      >
                        <span>Vào thi ngay</span>
                        <div className="w-5 h-5 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center transition-transform duration-200 group-hover/btn:translate-x-1">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    </div>
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
