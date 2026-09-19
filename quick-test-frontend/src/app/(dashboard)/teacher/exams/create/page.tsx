'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Shuffle,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { examService } from '@/services/exam.service';
import { formatDateTimeForPayload } from '@/lib/utils';
import type { ExamCreateRequest } from '@/types/exam';
import toast from 'react-hot-toast';

interface CreateExamFormData {
  title: string;
  accessCode?: string;
  description?: string;
  durationMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isProctoringEnabled: boolean;
  showResultsToStudents: boolean;
  maxViolations: number;
  startTime?: string;
  endTime?: string;
}

export default function CreateExamPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateExamFormData>({
    defaultValues: {
      title: '',
      accessCode: '',
      description: '',
      durationMinutes: 60,
      maxAttempts: 1,
      shuffleQuestions: true,
      shuffleOptions: true,
      isProctoringEnabled: false,
      showResultsToStudents: true,
      maxViolations: 5,
      startTime: '',
      endTime: '',
    },
  });

  const onSubmit = async (data: CreateExamFormData) => {
    setIsSubmitting(true);
    try {
      const payload: ExamCreateRequest = {
        title: data.title.trim(),
        accessCode: data.accessCode?.trim() || undefined,
        description: data.description?.trim() || undefined,
        durationMinutes: Number(data.durationMinutes),
        maxAttempts: Number(data.maxAttempts) || 1,
        shuffleQuestions: Boolean(data.shuffleQuestions),
        shuffleOptions: Boolean(data.shuffleOptions),
        isProctoringEnabled: Boolean(data.isProctoringEnabled),
        showResultsToStudents: Boolean(data.showResultsToStudents),
        maxViolations: Number(data.maxViolations) || 5,
        startTime: formatDateTimeForPayload(data.startTime),
        endTime: formatDateTimeForPayload(data.endTime),
      };

      const created = await examService.createExam(payload);
      // Navigate straight to the editor to add questions (Toast is handled automatically by Axios interceptor)
      router.push(`/teacher/exams/${created.id}/edit`);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/teacher/exams"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Tạo đề thi mới
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Thiết lập thông tin chung, thời gian và cấu hình bảo mật trước khi soạn câu hỏi
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Thông tin cơ bản</CardTitle>
                  <CardDescription>
                    Tên đề thi, mã truy cập và mô tả hướng dẫn cho thí sinh
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Tên đề thi *
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Kiểm tra Giữa kỳ - Kiến trúc Hệ thống Phân tán"
                    {...register('title', {
                      required: 'Vui lòng nhập tên đề thi',
                      minLength: { value: 5, message: 'Tên đề thi cần tối thiểu 5 ký tự' },
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {errors.title && (
                    <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>
                  )}
                </div>

                {/* Access Code */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Mã truy cập bài thi (Access Code)
                  </label>
                  <input
                    type="text"
                    placeholder="Để trống hệ thống sẽ tự sinh mã ngẫu nhiên (VD: EXAM-9872)"
                    {...register('accessCode')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Thí sinh sẽ dùng mã này cùng với mã sinh viên để tham gia thi.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Mô tả & Hướng dẫn làm bài
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Nêu rõ phạm vi kiến thức, quy định sử dụng tài liệu hoặc các nhắc nhở quan trọng..."
                    {...register('description')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Thời gian & Khung giờ tổ chức</CardTitle>
                  <CardDescription>
                    Cấu hình thời lượng làm bài và thời gian mở/đóng cổng thi
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Thời lượng (Phút) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      {...register('durationMinutes', {
                        required: 'Thời lượng là bắt buộc',
                        min: { value: 1, message: 'Thời lượng tối thiểu 1 phút' },
                      })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    {errors.durationMinutes && (
                      <p className="text-xs text-rose-500 mt-1">{errors.durationMinutes.message}</p>
                    )}
                  </div>

                  {/* Max Attempts */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Số lần làm bài tối đa
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      {...register('maxAttempts', {
                        min: { value: 1, message: 'Tối thiểu 1 lần' },
                      })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Mặc định 1 lần đối với các kỳ thi chính thức.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                      Thời điểm bắt đầu mở thi
                    </label>
                    <input
                      type="datetime-local"
                      {...register('startTime')}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Để trống nếu muốn mở tự do không giới hạn giờ.
                    </p>
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-500" />
                      Thời điểm kết thúc đóng thi
                    </label>
                    <input
                      type="datetime-local"
                      {...register('endTime')}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Sau thời điểm này thí sinh không thể bắt đầu làm bài.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Cấu hình Chống gian lận & Trộn đề</CardTitle>
                  <CardDescription>
                    Tự động xáo trộn câu hỏi và các phương án trả lời cho từng thí sinh
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    {...register('shuffleQuestions')}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Xáo trộn thứ tự câu hỏi (Shuffle Questions)
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Mỗi thí sinh khi nhận bài sẽ có thứ tự câu hỏi hoàn toàn khác nhau.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    {...register('shuffleOptions')}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Xáo trộn các lựa chọn trắc nghiệm (Shuffle Options)
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Thứ tự các đáp án A, B, C, D sẽ được hoán đổi ngẫu nhiên cho từng câu hỏi.
                    </p>
                  </div>
                </label>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      {...register('isProctoringEnabled')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5 cursor-pointer"
                    />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-500" />
                        Bật giám sát trực tuyến (Proctoring)
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Tự động phát hiện chuyển tab, mở DevTools hoặc mất tiêu điểm và cảnh báo vi phạm.
                      </p>
                    </div>
                  </label>

                  {watch('isProctoringEnabled') && (
                    <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Số lần vi phạm tối đa trước khi đình chỉ
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          {...register('maxViolations', {
                            min: { value: 1, message: 'Tối thiểu 1 lần' },
                            valueAsNumber: true,
                          })}
                          className="w-28 px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                          lần cảnh báo. Nếu thí sinh vượt quá số lần này, hệ thống sẽ tự động đình chỉ bài thi.
                        </span>
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      {...register('showResultsToStudents')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5 cursor-pointer"
                    />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-emerald-500" />
                        Công bố điểm và đáp án cho thí sinh (Show Results)
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Cho phép thí sinh xem lại điểm từng câu và đáp án đúng sau khi nộp bài. Tắt tùy chọn này nếu muốn bảo mật đề thi và chống lộ đáp án cho người khác.
                      </p>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Action & Guidance Sidebar */}
          <div className="space-y-6">
            <Card className="bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200/80 dark:border-zinc-800">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Quy trình tạo đề thi</span>
                </div>
                <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] shrink-0">
                      1
                    </span>
                    <p>
                      <strong>Bước 1:</strong> Thiết lập thông tin và cấu hình thời lượng đề thi tại trang này.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-[10px] shrink-0">
                      2
                    </span>
                    <p>
                      <strong>Bước 2:</strong> Soạn thảo câu hỏi trắc nghiệm, điền số hoặc tự luận tại Question Canvas.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-[10px] shrink-0">
                      3
                    </span>
                    <p>
                      <strong>Bước 3:</strong> Xuất bản đề thi (Publish) để thí sinh có thể vào làm bài bằng Mã truy cập.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    size="md"
                    isLoading={isSubmitting}
                  >
                    Tạo đề & Soạn câu hỏi
                  </Button>
                  <Link href="/teacher/exams" className="block w-full">
                    <Button variant="outline" className="w-full" size="md">
                      Hủy bỏ
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-indigo-100 dark:border-indigo-950 bg-indigo-50/30 dark:bg-indigo-950/20">
              <CardContent className="p-5 text-xs text-indigo-900 dark:text-indigo-300 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Chế độ Bản nháp (DRAFT)</span>
                </div>
                <p className="leading-relaxed">
                  Đề thi vừa tạo sẽ ở trạng thái Bản nháp. Thí sinh sẽ không thể thấy hoặc làm bài cho đến khi bạn bấm <strong>Xuất bản</strong>.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
