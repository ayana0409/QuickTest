'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  KeyRound,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  BookOpen,
  Award,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { candidateSessionService } from '@/services/candidateSession.service';
import toast from 'react-hot-toast';

interface AvailableExam {
  id: string;
  title: string;
  code: string;
  durationMinutes: number;
  questionCount: number;
  instructor: string;
  deadline: string;
  status: 'OPEN' | 'UPCOMING' | 'COMPLETED';
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [accessCode, setAccessCode] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  const availableExams: AvailableExam[] = [
    {
      id: 'exam-java-01',
      title: 'Kiểm tra Kiến trúc Ứng dụng Web & Spring Boot Framework',
      code: 'JAVA-MIDTERM-2026',
      durationMinutes: 60,
      questionCount: 25,
      instructor: 'TS. Nguyễn Văn Hùng',
      deadline: '23:59, 20/09/2026',
      status: 'OPEN',
    },
    {
      id: 'exam-db-02',
      title: 'Trắc nghiệm Hệ Quản trị Cơ sở Dữ liệu & Tối ưu SQL',
      code: 'DB-SQL-FINAL',
      durationMinutes: 45,
      questionCount: 30,
      instructor: 'ThS. Trần Thị Mai',
      deadline: '17:00, 25/09/2026',
      status: 'OPEN',
    },
    {
      id: 'exam-algo-03',
      title: 'Đánh giá Kỹ năng Cấu trúc Dữ liệu & Giải thuật',
      code: 'DSA-FINAL-TERM',
      durationMinutes: 90,
      questionCount: 40,
      instructor: 'PGS. TS. Lê Hoàng Nam',
      deadline: '08:00, 30/09/2026',
      status: 'UPCOMING',
    },
  ];

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim().toUpperCase();

    if (!cleanCode) {
      toast.error('Vui lòng nhập mã phòng thi hoặc mã đề');
      return;
    }

    setIsSubmittingCode(true);

    try {
      const paper = await candidateSessionService.startExam({ accessCode: cleanCode });
      if (paper && paper.attemptId) {
        router.push(`/exam/${paper.attemptId}`);
      } else {
        router.push(`/exam/${cleanCode.toLowerCase()}`);
      }
    } catch {
      // Handled by axios interceptor
    } finally {
      setIsSubmittingCode(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 sm:p-8 text-white shadow-xl shadow-indigo-600/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md border border-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Student Learning & Assessment Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Xin chào, {user?.fullName || 'Học sinh'}! 👋
            </h1>
            <p className="text-indigo-100 text-sm sm:text-base leading-relaxed">
              Chào mừng bạn đến với cổng thi trực tuyến QuickTest. Chuẩn bị tinh thần và thiết bị sẵn sàng trước khi bắt đầu bài làm.
            </p>
          </div>

          {/* Quick Access Code Input */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl md:w-80 shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-100 mb-2 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Vào thi bằng mã</span>
            </h2>
            <form onSubmit={handleJoinByCode} className="space-y-2">
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Nhập Access Code..."
                className="w-full px-3 py-2 rounded-xl bg-white/90 text-zinc-900 placeholder:text-zinc-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white uppercase"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                isLoading={isSubmittingCode}
                className="w-full font-semibold shadow-xs"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Vào phòng thi
              </Button>
            </form>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Kỳ thi mở
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">02</div>
          <p className="text-xs text-zinc-400 mt-1">Đang mở bài thi làm được</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Bài thi đã nộp
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">05</div>
          <p className="text-xs text-zinc-400 mt-1">Đã hoàn thành đánh giá</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Điểm trung bình
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">8.4 / 10</div>
          <p className="text-xs text-zinc-400 mt-1">Xếp loại: Xuất sắc</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Kỳ thi sắp tới
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">01</div>
          <p className="text-xs text-zinc-400 mt-1">Kỳ thi dự kiến tuần tới</p>
        </div>
      </div>

      {/* Available Exams Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Kỳ thi dành cho bạn
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Chọn kỳ thi để xem thể lệ và tiến hành làm bài kiểm tra
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {availableExams.map((exam) => (
            <div
              key={exam.id}
              className="flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-200 hover:shadow-md group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {exam.code}
                  </span>
                  {exam.status === 'OPEN' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Đang mở
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Sắp diễn ra
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {exam.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">Giảng viên: {exam.instructor}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{exam.durationMinutes} phút</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{exam.questionCount} câu hỏi</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-zinc-100 dark:border-zinc-800/80">
                <Button
                  onClick={async () => {
                    try {
                      const paper = await candidateSessionService.startExam({ accessCode: exam.code });
                      router.push(`/exam/${paper.attemptId}`);
                    } catch {
                      router.push(`/exam/${exam.code.toLowerCase()}`);
                    }
                  }}
                  disabled={exam.status !== 'OPEN'}
                  size="sm"
                  className="w-full font-semibold"
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  {exam.status === 'OPEN' ? 'Bắt đầu làm bài' : 'Chưa mở'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
