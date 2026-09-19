'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Award,
  FileCheck2,
  FileText,
  Home,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { candidateSessionService } from '@/services/candidateSession.service';
import type { SubmitResultResponse } from '@/types/exam';
import { cn } from '@/lib/utils';

interface ExamResultPageProps {
  params: Promise<{ attemptId: string }>;
}

/**
 * Exam Result / Confirmation Page:
 * Displays final submission status, automated score or pending manual evaluation status,
 * and completion timestamps.
 */
export default function ExamResultPage({ params }: ExamResultPageProps) {
  const resolvedParams = use(params);
  const attemptId = resolvedParams.attemptId;

  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<SubmitResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchResult = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await candidateSessionService.getResult(attemptId);
        if (isMounted) {
          setResult(data);
        }
      } catch (err: unknown) {
        console.warn('Could not fetch server result directly, showing default submission receipt:', err);
        if (isMounted) {
          // Default completed submission fallback
          setResult({
            attemptId,
            status: 'SUBMITTED',
            submittedAt: new Date().toISOString(),
            message: 'Bài thi của bạn đã được tiếp nhận thành công vào hệ thống!',
            gradingStatus: 'PENDING_MANUAL',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchResult();

    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-zinc-100 p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <div className="text-sm font-medium text-zinc-400">
            Đang tải kết quả và tổng kết bài thi...
          </div>
        </div>
      </div>
    );
  }

  const isAutoGraded =
    result?.status === 'AUTO_GRADED' ||
    result?.status === 'COMPLETED' ||
    (result?.totalScore !== undefined && result?.totalScore !== null);

  const formattedDate = result?.submittedAt
    ? new Date(result.submittedAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : new Date().toLocaleString('vi-VN');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D1117] text-[#E6EDF3] p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-xl rounded-3xl bg-[#161B22] border border-[#30363D] shadow-2xl p-6 sm:p-10 text-center relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Success Icon Badge */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EDF3] tracking-tight mb-2">
          Nộp Bài Thi Thành Công!
        </h1>

        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed mb-8 max-w-md mx-auto">
          {result?.message ||
            'Bài thi của bạn đã được ghi nhận và lưu trữ an toàn trên máy chủ của Quick Test.'}
        </p>

        {/* Result & Scoring Details Card */}
        <div className="rounded-2xl bg-[#0D1117] border border-[#30363D] p-5 sm:p-6 mb-8 text-left space-y-4">
          {/* Status Row */}
          <div className="flex items-center justify-between pb-3 border-b border-[#30363D]/80">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
              <span>Trạng thái bài thi</span>
            </div>
            <span
              className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full border',
                isAutoGraded
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              )}
            >
              {isAutoGraded ? 'Đã hoàn tất chấm điểm' : 'Chờ chấm tự luận'}
            </span>
          </div>

          {/* Submission Timestamp */}
          <div className="flex items-center justify-between pb-3 border-b border-[#30363D]/80">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>Thời gian nộp bài</span>
            </div>
            <span className="text-xs sm:text-sm font-mono text-zinc-200">
              {formattedDate}
            </span>
          </div>

          {/* Score Display (If Available) */}
          {isAutoGraded && result?.totalScore !== undefined && result?.totalScore !== null ? (
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Điểm số đạt được</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold font-mono text-emerald-400">
                  {result.totalScore}
                </span>
                {result.maxScore !== undefined && result.maxScore !== null && (
                  <span className="text-sm font-mono text-zinc-400">
                    {' '}/ {result.maxScore}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 pt-1 text-xs text-zinc-400 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800">
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Đề thi có câu hỏi tự luận cần giáo viên chấm điểm hoặc hệ thống AI đối soát. Kết quả điểm chính thức sẽ được thông báo sau.
              </span>
            </div>
          )}
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/student/history/${attemptId}`}
            className="w-full sm:w-auto py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Xem chi tiết bài làm & điểm từng câu</span>
          </Link>
          <Link
            href="/student/history"
            className="w-full sm:w-auto py-3 px-5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-sm border border-zinc-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            <span>Lịch sử bài thi</span>
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto py-3 px-5 rounded-xl bg-transparent hover:bg-white/5 text-zinc-400 hover:text-zinc-200 font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
