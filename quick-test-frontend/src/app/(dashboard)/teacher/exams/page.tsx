'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, BookOpen, Clock, Users, CheckCircle2, FileEdit, Eye } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
import { formatDateTime } from '@/lib/utils';
import type { Exam } from '@/types/exam';

export default function TeacherExamsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchExams = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get('/teacher/exams');
        if (res.data?.data?.content) {
          setExams(res.data.data.content);
        } else if (Array.isArray(res.data?.data)) {
          setExams(res.data.data);
        }
      } catch (err) {
        console.warn('Could not fetch teacher exams, showing sample data:', err);
        // Fallback sample data for preview
        setExams([
          {
            id: 'exam-1',
            title: 'Kiểm tra Giữa kỳ: Lập trình Java & Spring Boot',
            accessCode: 'JAVA-MIDTERM-2026',
            status: 'PUBLISHED',
            durationMinutes: 60,
            maxAttempts: 1,
            totalQuestions: 25,
            totalPoints: 10,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'exam-2',
            title: 'Trắc nghiệm Nhập môn Cơ sở Dữ liệu & SQL',
            accessCode: 'DB-QUIZ-01',
            status: 'DRAFT',
            durationMinutes: 45,
            maxAttempts: 2,
            totalQuestions: 20,
            totalPoints: 10,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExams();
  }, [isAuthenticated, router]);

  const filteredExams = exams.filter((e) =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.accessCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Quản lý Đề thi
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Tạo mới, chỉnh sửa và theo dõi trạng thái tổ chức các kỳ thi
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/teacher/grading">
            <Button variant="outline" size="sm">
              Chấm bài tự luận
            </Button>
          </Link>
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
            Tạo đề thi mới
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên hoặc mã đề..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Exams Grid */}
        {isLoading ? (
          <div className="py-20 text-center text-zinc-500 text-sm">Đang tải danh sách đề thi...</div>
        ) : filteredExams.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <BookOpen className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
            <h3 className="font-semibold text-base mb-1">Chưa tìm thấy đề thi nào</h3>
            <p className="text-sm text-zinc-500 mb-4">Hãy tạo đề thi đầu tiên để bắt đầu kỳ kiểm tra.</p>
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Tạo đề thi mới
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
              <div
                key={exam.id}
                className="flex flex-col justify-between p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                        exam.status === 'PUBLISHED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : exam.status === 'CLOSED'
                          ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {exam.status === 'PUBLISHED'
                        ? 'Đang mở'
                        : exam.status === 'CLOSED'
                        ? 'Đã đóng'
                        : 'Bản nháp'}
                    </span>

                    <span className="font-mono text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {exam.accessCode}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 mb-3 line-clamp-2">
                    {exam.title}
                  </h3>

                  <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-6">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Thời lượng: {exam.durationMinutes} phút</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Số câu hỏi: {exam.totalQuestions ?? 0} câu</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Tạo lúc: {formatDateTime(exam.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <Button variant="outline" size="sm" className="flex-1" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                    Chi tiết
                  </Button>
                  <Button variant="secondary" size="sm" leftIcon={<FileEdit className="w-3.5 h-3.5" />}>
                    Sửa
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
