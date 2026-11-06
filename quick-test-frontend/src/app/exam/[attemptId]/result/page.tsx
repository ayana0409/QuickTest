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
  Lock,
  ArrowRight,
  User,
} from 'lucide-react';
import { candidateSessionService } from '@/services/candidateSession.service';
import { useAuthStore } from '@/stores/authStore';
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

  const { isAuthenticated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<SubmitResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
            message: 'Bài thi của bạn đã được ghi nhận trên hệ thống.',
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

  // Candidate is treated as guest if result flags isGuest or no authenticated student account is present
  const isGuestCandidate =
    result?.isGuest === true || (mounted ? !isAuthenticated || !user : false);

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

  const getDisplayMessage = (): string => {
    const rawMsg = result?.message?.trim() || '';
    const lower = rawMsg.toLowerCase();

    if (result?.showResultsToStudents === false || lower.includes('withheld') || lower.includes('bảo mật')) {
      return 'Bài thi đã được ghi nhận. Điểm số và đáp án chi tiết được bảo mật theo quy định của kỳ thi.';
    }
    if (result?.status === 'AWAITING_MANUAL_GRADING' || lower.includes('essay') || lower.includes('tự luận')) {
      return 'Bài thi đã nộp thành công và đang chờ giáo viên chấm điểm phần câu hỏi tự luận.';
    }
    if (isAutoGraded || lower.includes('graded') || lower.includes('chấm điểm')) {
      return 'Bài thi của bạn đã được nộp và hoàn tất chấm điểm tự động.';
    }
    if (rawMsg && !lower.includes('exam') && !lower.includes('successfully')) {
      return rawMsg;
    }
    return 'Bài thi của bạn đã được ghi nhận và lưu trữ an toàn trên hệ thống.';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D1117] text-[#E6EDF3] p-4 sm:p-6 lg:p-8 select-none">
      <div className="w-full max-w-lg rounded-3xl bg-[#161B22] border border-[#30363D] shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden backdrop-blur-xl">
        {/* Top Glow Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Success Icon Badge */}
        <div className="mx-auto mb-5 w-18 h-18 sm:w-20 sm:h-20 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
          <CheckCircle2 className="w-9 h-9 sm:w-10 sm:h-10" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EDF3] tracking-tight mb-2">
          Nộp bài thi thành công!
        </h1>

        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-6 max-w-sm mx-auto">
          {getDisplayMessage()}
        </p>

        {/* Result & Scoring Details Card */}
        <div className="rounded-2xl bg-[#0D1117] border border-[#30363D] p-4 sm:p-5 mb-6 text-left space-y-3.5">
          {/* Candidate Row (If present) */}
          {result?.candidateName && (
            <div className="flex items-center justify-between pb-3 border-b border-[#30363D]/60 text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-medium text-zinc-400">
                <User className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Thí sinh</span>
              </div>
              <span className="font-semibold text-zinc-200 flex items-center gap-2">
                {result.candidateName}
                {isGuestCandidate && (
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Khách dự thi
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Status Row */}
          <div className="flex items-center justify-between pb-3 border-b border-[#30363D]/60 text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-medium text-zinc-400">
              <FileCheck2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Trạng thái bài thi</span>
            </div>
            <span
              className={cn(
                'text-xs font-semibold px-3 py-1 rounded-full border',
                result?.showResultsToStudents === false
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : isAutoGraded
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              )}
            >
              {result?.showResultsToStudents === false
                ? 'Đã nộp'
                : isAutoGraded
                  ? 'Đã hoàn tất chấm điểm'
                  : 'Chờ chấm tự luận'}
            </span>
          </div>

          {/* Submission Timestamp */}
          <div className="flex items-center justify-between pb-3 border-b border-[#30363D]/60 text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-medium text-zinc-400">
              <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Thời gian nộp bài</span>
            </div>
            <span className="font-mono text-zinc-200 font-medium">
              {formattedDate}
            </span>
          </div>

          {/* Score Display (If Available) */}
          {result?.showResultsToStudents === false ? (
            <div className="flex items-start gap-2.5 pt-1 text-xs text-zinc-300 bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-800/40">
              <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Giáo viên không công bố kết quả cho kỳ thi này. Điểm số và đáp án chi tiết sẽ được công bố sau.
              </span>
            </div>
          ) : isAutoGraded && result?.totalScore !== undefined && result?.totalScore !== null ? (
            <div className="flex items-center justify-between pt-1 text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-medium text-zinc-400">
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Điểm số đạt được</span>
              </div>
              <div className="text-right flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
                  {result.totalScore}
                </span>
                {result.maxScore !== undefined && result.maxScore !== null && (
                  <span className="text-xs sm:text-sm font-mono text-zinc-400">
                    / {result.maxScore} điểm
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 pt-1 text-xs text-zinc-400 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800">
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Đề thi có câu hỏi tự luận đang chờ giáo viên chấm điểm. Kết quả điểm chính thức sẽ được cập nhật sau.
              </span>
            </div>
          )}
        </div>

        {/* Navigation Action Buttons */}
          <div className="w-full">
            {isGuestCandidate ? (
              /* Guest / Unauthenticated candidate: Only show Return Home button */
              <div className="space-y-3">
                <Link
                  href="/"
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-[0.99] text-white font-semibold text-sm sm:text-base shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <Home className="w-4 h-4 text-indigo-200" />
                  <span>Về trang chủ</span>
                  <ArrowRight className="w-4 h-4 ml-0.5 transition-transform group-hover:translate-x-1" />
                </Link>
                <p className="text-[11px] sm:text-xs text-zinc-500 text-center">
                  Dữ liệu làm bài đã được ghi nhận trên hệ thống.
                </p>
              </div>
            ) : (
              /* Logged-in Student: Full access to Detailed Review & Exam History */
              <div className="space-y-3 w-full">
                {/* Primary Action Button */}
                <Link
                  href={`/student/history/${attemptId}`}
                  className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <FileText className="w-4 h-4 text-indigo-200" />
                  <span>
                    {result?.showResultsToStudents === false
                      ? 'Xem lại bài làm đã nộp'
                      : 'Xem chi tiết bài làm'}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-0.5 transition-transform group-hover:translate-x-1" />
                </Link>

                  {/* Secondary Actions Row */}
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <Link
                      href="/student/history"
                      className="py-3 px-4 rounded-xl bg-[#21262D] hover:bg-[#30363D] active:scale-[0.99] text-zinc-300 hover:text-white font-medium text-xs sm:text-sm border border-[#30363D] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Clock className="w-4 h-4 text-zinc-400" />
                      <span>Lịch sử bài thi</span>
                    </Link>

                  <Link
                    href="/"
                    className="py-3 px-4 rounded-xl bg-[#21262D] hover:bg-[#30363D] active:scale-[0.99] text-zinc-300 hover:text-white font-medium text-xs sm:text-sm border border-[#30363D] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Home className="w-4 h-4 text-zinc-400" />
                    <span>Về trang chủ</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      );
}
