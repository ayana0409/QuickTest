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
} from 'lucide-react';

import { examService } from '@/services/exam.service';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/utils';
import type { ExamSummaryResponse, ExamStatus } from '@/types/exam';

/**
 * Teacher Grading Hub Page.
 * Displays all exams created by the authenticated teacher and allows drilling down into question-centric grading.
 */
export default function TeacherGradingHubPage() {
  const [exams, setExams] = useState<ExamSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | ExamStatus>('ALL');

  useEffect(() => {
    let isMounted = true;
    const loadExams = async () => {
      try {
        setIsLoading(true);
        // Load exams from teacher management endpoint
        const response = await examService.getTeacherExams({ size: 100, sort: 'createdAt,desc' });
        if (isMounted) {
          setExams(response.content || []);
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

  // Filter exams according to search and status
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch =
        exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exam.description && exam.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = selectedStatus === 'ALL' || exam.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [exams, searchTerm, selectedStatus]);

  // Aggregate metrics
  const totalExams = exams.length;
  const activeExams = exams.filter((e) => e.status === 'PUBLISHED').length;
  const closedExams = exams.filter((e) => e.status === 'CLOSED').length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-xs font-semibold mb-2 border border-indigo-200/60 dark:border-indigo-900/60">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Phân hệ Chấm Điểm & Đánh Giá</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Trung Tâm Chấm Điểm Tự Luận
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Chọn bài thi để xem danh sách câu hỏi tự luận, chấm bài theo từng câu hỏi và kích hoạt trợ lý AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/teacher/exams">
            <Button variant="outline" size="md">
              Quản lý đề thi
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Tổng số đề thi
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
            {totalExams}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Đang hoạt động (Published)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
            {activeExams}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Đã kết thúc (Closed)
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
            {closedExams}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo tiêu đề hoặc nội dung đề thi..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PUBLISHED', 'CLOSED', 'DRAFT'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0',
                selectedStatus === status
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              )}
            >
              {status === 'ALL'
                ? 'Tất cả'
                : status === 'PUBLISHED'
                ? 'Đang mở'
                : status === 'CLOSED'
                ? 'Đã đóng'
                : 'Bản nháp'}
            </button>
          ))}
        </div>
      </div>

      {/* Exams Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs animate-pulse space-y-4"
            >
              <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
              <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-xl" />
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1">
              {searchTerm
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ lọc trạng thái để xem nhiều kết quả hơn.'
                : 'Hiện bạn chưa có đề thi nào trong hệ thống.'}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => (
            <div
              key={exam.id}
              className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-5 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={exam.status} size="sm" dot>
                    {exam.status === 'PUBLISHED'
                      ? 'Đang diễn ra'
                      : exam.status === 'CLOSED'
                      ? 'Đã kết thúc'
                      : 'Bản nháp'}
                  </Badge>
                  <span className="text-xs text-zinc-400">
                    {exam.totalQuestions || 0} câu hỏi
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {exam.title}
                  </h3>
                  {exam.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                      {exam.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{exam.durationMinutes} phút</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Thang {exam.totalPoints}đ</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Link
                  href={`/teacher/grading/exams/${exam.id}`}
                  className="w-full inline-flex items-center justify-center font-medium rounded-xl text-sm px-4 py-2.5 transition-all duration-200 select-none bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white group-hover:shadow-md"
                >
                  <span>Vào chấm điểm tự luận</span>
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
