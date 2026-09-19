'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  Check,
  Globe,
  Lock,
  Trash2,
  Settings,
  Layers,
  Sparkles,
  AlertTriangle,
  Info,
  Users,
  RotateCcw,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { Tabs } from '@/components/common/Tabs';
import { Modal } from '@/components/common/Modal';
import { QuestionBuilder } from '@/components/exam/QuestionBuilder';
import { ExamAttemptsTab } from '@/components/exam/ExamAttemptsTab';
import { examService } from '@/services/exam.service';
import { formatDateTimeForPayload } from '@/lib/utils';
import type { ExamDetailResponse, ExamUpdateRequest } from '@/types/exam';
import toast from 'react-hot-toast';

interface SettingsFormData {
  title: string;
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

export default function EditExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id as string;

  const [exam, setExam] = useState<ExamDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'questions' | 'settings' | 'attempts'>('questions');
  const [isCopied, setIsCopied] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Republish modal states
  const [isRepublishModalOpen, setIsRepublishModalOpen] = useState(false);
  const [republishStartTime, setRepublishStartTime] = useState<string>('');
  const [republishEndTime, setRepublishEndTime] = useState<string>('');
  const [republishDuration, setRepublishDuration] = useState<number>(45);
  const [isRepublishing, setIsRepublishing] = useState(false);

  // Duplicate modal states
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState<string>('');
  const [isDuplicating, setIsDuplicating] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SettingsFormData>();

  // Fetch full exam details
  const fetchExamDetail = useCallback(async () => {
    if (!examId) return;
    try {
      const data = await examService.getExamDetail(examId);
      setExam(data);
      reset({
        title: data.title,
        description: data.description || '',
        durationMinutes: data.durationMinutes,
        maxAttempts: data.maxAttempts || 1,
        shuffleQuestions: data.shuffleQuestions,
        shuffleOptions: data.shuffleOptions,
        isProctoringEnabled: data.isProctoringEnabled ?? false,
        showResultsToStudents: data.showResultsToStudents ?? true,
        maxViolations: data.maxViolations ?? 5,
        startTime: data.startTime ? data.startTime.slice(0, 16) : '',
        endTime: data.endTime ? data.endTime.slice(0, 16) : '',
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải thông tin đề thi.');
    } finally {
      setIsLoading(false);
    }
  }, [examId, reset]);

  useEffect(() => {
    fetchExamDetail();
  }, [fetchExamDetail]);

  // Copy access code to clipboard
  const handleCopyAccessCode = () => {
    if (!exam?.accessCode) return;
    navigator.clipboard.writeText(exam.accessCode);
    setIsCopied(true);
    toast.success(`Đã sao chép mã đề: ${exam.accessCode}`);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Publish exam
  const handlePublish = async () => {
    if (!exam) return;
    if (!exam.questions || exam.questions.length === 0) {
      toast.error('Đề thi cần có ít nhất 1 câu hỏi trước khi xuất bản.');
      return;
    }

    setIsPublishing(true);
    try {
      const updated = await examService.publishExam(exam.id);
      setExam(updated);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsPublishing(false);
    }
  };

  // Close exam
  const handleClose = async () => {
    if (!exam) return;
    setIsClosing(true);
    try {
      const updated = await examService.closeExam(exam.id);
      setExam(updated);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsClosing(false);
    }
  };

  // Delete draft exam
  const handleDeleteExam = async () => {
    if (!exam) return;
    setIsDeleting(true);
    try {
      await examService.deleteExam(exam.id);
      router.push('/teacher/exams');
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  // Open modal to configure and republish a closed exam
  const handleOpenRepublishModal = () => {
    if (!exam) return;
    setRepublishDuration(exam.durationMinutes || 45);

    // Suggest new end time 24 hours from now
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTomorrow = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setRepublishEndTime(localISOTomorrow);

    const now = new Date();
    const localISONow = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setRepublishStartTime(localISONow);
    setIsRepublishModalOpen(true);
  };

  // Confirm republish exam with updated schedule
  const handleConfirmRepublish = async () => {
    if (!exam) return;

    if (republishEndTime) {
      const endTimestamp = new Date(republishEndTime).getTime();
      if (endTimestamp <= Date.now()) {
        toast.error('Thời gian kết thúc phải sau thời điểm hiện tại.');
        return;
      }
    }

    setIsRepublishing(true);
    try {
      const updated = await examService.republishExam(exam.id, {
        startTime: republishStartTime ? formatDateTimeForPayload(republishStartTime) : null,
        endTime: republishEndTime ? formatDateTimeForPayload(republishEndTime) : null,
        durationMinutes: Number(republishDuration) || undefined,
      });
      setExam(updated);
      reset({
        title: updated.title,
        description: updated.description || '',
        durationMinutes: updated.durationMinutes,
        maxAttempts: updated.maxAttempts || 1,
        shuffleQuestions: updated.shuffleQuestions,
        shuffleOptions: updated.shuffleOptions,
        startTime: updated.startTime ? updated.startTime.slice(0, 16) : '',
        endTime: updated.endTime ? updated.endTime.slice(0, 16) : '',
      });
      setIsRepublishModalOpen(false);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsRepublishing(false);
    }
  };

  // Open modal to duplicate exam
  const handleOpenDuplicateModal = () => {
    if (!exam) return;
    const titleBase = exam.title.replace(/^\[Bản sao\]\s*/, '');
    setDuplicateTitle(`[Bản sao] ${titleBase}`);
    setIsDuplicateModalOpen(true);
  };

  // Confirm duplication
  const handleConfirmDuplicate = async () => {
    if (!exam) return;
    setIsDuplicating(true);
    try {
      const cloned = await examService.duplicateExam(exam.id, {
        title: duplicateTitle.trim() || undefined,
      });
      setIsDuplicateModalOpen(false);
      if (cloned.status === 'CLONING') {
        router.push('/teacher/exams');
      } else {
        router.push(`/teacher/exams/${cloned.id}/edit`);
      }
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsDuplicating(false);
    }
  };

  // Save Settings
  const onSaveSettings = async (data: SettingsFormData) => {
    if (!exam) return;
    setIsSavingSettings(true);
    try {
      const payload: ExamUpdateRequest = {
        title: data.title.trim(),
        description: data.description?.trim() || null,
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
      const updated = await examService.updateExam(exam.id, payload);
      setExam(updated);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsSavingSettings(false);
    }
  };


  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-16 space-y-4 text-center">
        <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-zinc-500">Đang tải chi tiết đề thi...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Không tìm thấy đề thi
        </h2>
        <p className="text-sm text-zinc-500">
          Đề thi không tồn tại hoặc bạn không có quyền truy cập quản trị đề thi này.
        </p>
        <Link href="/teacher/exams">
          <Button variant="outline">Quay lại danh sách</Button>
        </Link>
      </div>
    );
  }

  const isDraft = exam.status === 'DRAFT';
  const isPublished = exam.status === 'PUBLISHED';
  const isClosed = exam.status === 'CLOSED';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Breadcrumbs and Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link
              href="/teacher/exams"
              className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quản lý Đề thi</span>
            </Link>
            <span>/</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">
              {exam.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {exam.title}
            </h1>
            <Badge variant={exam.status} dot>
              {exam.status === 'PUBLISHED'
                ? 'Đang mở (Published)'
                : exam.status === 'CLOSED'
                ? 'Đã đóng (Closed)'
                : 'Bản nháp (Draft)'}
            </Badge>
          </div>

          {/* Metadata quick stats */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{exam.durationMinutes} phút</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>{exam.totalQuestions} câu hỏi ({exam.totalPoints} điểm)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
              <span>Mã đề:</span>
              <strong className="text-indigo-600 dark:text-indigo-400">{exam.accessCode}</strong>
              <button
                type="button"
                onClick={handleCopyAccessCode}
                className="ml-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                title="Sao chép mã đề"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenDuplicateModal}
            leftIcon={<Copy className="w-3.5 h-3.5" />}
            title="Nhân bản đề thi này sang bản nháp mới"
          >
            Nhân bản
          </Button>

          {isDraft && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30"
                onClick={() => setIsDeleteModalOpen(true)}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Xóa đề
              </Button>
              <Button
                size="sm"
                variant="success"
                isLoading={isPublishing}
                onClick={handlePublish}
                leftIcon={<Globe className="w-3.5 h-3.5" />}
              >
                Xuất bản đề thi
              </Button>
            </>
          )}

          {isPublished && (
            <Button
              variant="outline"
              size="sm"
              isLoading={isClosing}
              onClick={handleClose}
              leftIcon={<Lock className="w-3.5 h-3.5" />}
            >
              Đóng đề thi
            </Button>
          )}

          {isClosed && (
            <Button
              size="sm"
              variant="success"
              isLoading={isRepublishing}
              onClick={handleOpenRepublishModal}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Mở lại đề thi
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <Tabs
          items={[
            {
              id: 'questions',
              label: 'Soạn thảo câu hỏi',
              icon: <Layers className="w-4 h-4" />,
              badge: (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold">
                  {exam.questions?.length || 0}
                </span>
              ),
            },
            {
              id: 'settings',
              label: 'Cài đặt đề thi',
              icon: <Settings className="w-4 h-4" />,
            },
            {
              id: 'attempts',
              label: 'Phiên thi',
              icon: <Users className="w-4 h-4" />,
            },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as 'questions' | 'settings' | 'attempts')}
        />

        {!isDraft && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              {isClosed
                ? 'Đề thi đã đóng, câu hỏi ở chế độ chỉ đọc. Bạn có thể cập nhật cài đặt hoặc bấm Mở lại đề thi để học sinh tiếp tục thi.'
                : 'Đề thi đã xuất bản, chế độ xem câu hỏi chỉ đọc để đảm bảo tính công bằng.'}
            </span>
          </div>
        )}
      </div>

      {/* Tab 1: Question Builder Canvas */}
      {activeTab === 'questions' && (
        <QuestionBuilder
          examId={exam.id}
          questions={exam.questions || []}
          isLocked={!isDraft}
          onQuestionsChange={fetchExamDetail}
        />
      )}

      {/* Tab 2: Settings Form */}
      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cập nhật cài đặt đề thi</CardTitle>
              <CardDescription>
                Thay đổi tiêu đề, thời lượng và các thiết lập an toàn cho kỳ thi
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSaveSettings)} className="space-y-6">
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Tên đề thi *
                  </label>
                  <input
                    type="text"
                    {...register('title', { required: 'Tên đề thi là bắt buộc' })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {errors.title && (
                    <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Mô tả & Hướng dẫn thí sinh
                  </label>
                  <textarea
                    rows={4}
                    {...register('description')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Duration & Attempts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Thời lượng làm bài (Phút) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      {...register('durationMinutes', {
                        required: 'Thời lượng là bắt buộc',
                        min: { value: 1, message: 'Tối thiểu 1 phút' },
                      })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Số lần làm bài tối đa
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      {...register('maxAttempts')}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Schedule Window */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                      Bắt đầu mở thi
                    </label>
                    <input
                      type="datetime-local"
                      {...register('startTime')}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-500" />
                      Kết thúc đóng thi
                    </label>
                    <input
                      type="datetime-local"
                      {...register('endTime')}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Shuffling Options */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('shuffleQuestions')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Tự động đảo thứ tự câu hỏi cho từng thí sinh
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('shuffleOptions')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Tự động đảo thứ tự các phương án lựa chọn trắc nghiệm
                    </span>
                  </label>
                </div>

                {/* Proctoring Configuration */}
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
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="submit"
                  isLoading={isSavingSettings}
                >
                  Lưu thay đổi cài đặt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Candidate Attempts Sessions */}
      {activeTab === 'attempts' && (
        <ExamAttemptsTab
          examId={exam.id}
          totalPoints={exam.totalPoints}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Xóa đề thi bản nháp"
        description="Hành động này sẽ xóa vĩnh viễn đề thi và toàn bộ câu hỏi liên quan."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={handleDeleteExam}
            >
              Xác nhận xóa
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Chỉ những đề thi ở trạng thái <strong>Bản nháp (DRAFT)</strong> mới có thể xóa. Dữ liệu sau khi xóa sẽ không thể phục hồi.
        </p>
      </Modal>

      {/* Republish Modal */}
      <Modal
        isOpen={isRepublishModalOpen}
        onClose={() => setIsRepublishModalOpen(false)}
        title="Mở lại Đề thi (Republish)"
        description="Cho phép thí sinh tiếp tục tham gia làm bài thi với mã đề hiện tại."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsRepublishModalOpen(false)}
              disabled={isRepublishing}
            >
              Hủy
            </Button>
            <Button
              variant="success"
              isLoading={isRepublishing}
              onClick={handleConfirmRepublish}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Xác nhận mở lại
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
            <p>
              Đề thi: <strong className="text-zinc-900 dark:text-zinc-100">{exam.title}</strong>
            </p>
            <p>
              Mã phòng thi: <strong className="text-indigo-600 dark:text-indigo-400">{exam.accessCode}</strong>
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                Thời gian mở đề (Bắt đầu)
              </label>
              <input
                type="datetime-local"
                value={republishStartTime}
                onChange={(e) => setRepublishStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                Thời gian đóng đề mới (Hạn chót thi) *
              </label>
              <input
                type="datetime-local"
                value={republishEndTime}
                onChange={(e) => setRepublishEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Lưu ý: Thời gian kết thúc phải ở tương lai để hệ thống không tự động đóng bài thi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                Thời lượng làm bài (Phút)
              </label>
              <input
                type="number"
                min={1}
                value={republishDuration}
                onChange={(e) => setRepublishDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Duplicate Exam Modal */}
      <Modal
        isOpen={isDuplicateModalOpen}
        onClose={() => !isDuplicating && setIsDuplicateModalOpen(false)}
        title="Nhân bản Đề thi"
        description="Tạo một đề thi bản nháp mới kế thừa toàn bộ câu hỏi, đáp án và hình ảnh minh họa."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsDuplicateModalOpen(false)}
              disabled={isDuplicating}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              isLoading={isDuplicating}
              onClick={handleConfirmDuplicate}
              leftIcon={<Copy className="w-4 h-4" />}
            >
              Xác nhận nhân bản
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Tên đề thi bản sao *
            </label>
            <input
              type="text"
              value={duplicateTitle}
              onChange={(e) => setDuplicateTitle(e.target.value)}
              placeholder="Nhập tên đề thi mới..."
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              disabled={isDuplicating}
            />
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Cơ chế nhân bản đề thi:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90">
              <li>Mã phòng thi mới ngẫu nhiên, trạng thái ban đầu là <strong>Bản nháp</strong>.</li>
              <li>Sao chép toàn bộ câu hỏi trắc nghiệm, tự luận và các đáp án.</li>
              <li>Hình ảnh minh họa sẽ được nhân bản độc lập qua hàng đợi ngầm.</li>
              <li>Đề thi sẽ tự động xuất hiện trên danh sách ngay sau khi hoàn tất.</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}
