'use client';

import { useEffect, useState, useCallback } from 'react';
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
  AlertTriangle,
  Info,
  RotateCcw,
  ShieldCheck,
  Camera,
  Eye,
  X,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { QuestionBuilder } from '@/components/exam/QuestionBuilder';
import { examService } from '@/services/exam.service';
import { formatDateTimeForPayload } from '@/lib/utils';
import { getAuthCookie } from '@/lib/cookie';
import { connectWebSocket, subscribeTopic } from '@/lib/socket';
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
  isCameraProctoringEnabled: boolean;
  showResultsToStudents: boolean;
  maxViolations: number;
  isPrivate: boolean;
  startTime?: string;
  endTime?: string;
}

export default function EditExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id as string;

  const [exam, setExam] = useState<ExamDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>('questions');
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
    setValue,
    formState: { errors },
  } = useForm<SettingsFormData>();

  const isProctoringSettingEnabled = watch('isProctoringEnabled');
  useEffect(() => {
    if (!isProctoringSettingEnabled) {
      setValue('isCameraProctoringEnabled', false);
    }
  }, [isProctoringSettingEnabled, setValue]);

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
        isCameraProctoringEnabled: data.isCameraProctoringEnabled ?? false,
        showResultsToStudents: data.showResultsToStudents ?? true,
        maxViolations: data.maxViolations ?? 5,
        isPrivate: data.isPrivate ?? true,
        startTime: data.startTime ? data.startTime.slice(0, 16) : '',
        endTime: data.endTime ? data.endTime.slice(0, 16) : '',
      });
    } catch {
      // Error toast is handled automatically by axios interceptor
    } finally {
      setIsLoading(false);
    }
  }, [examId, reset]);

  useEffect(() => {
    fetchExamDetail();
  }, [fetchExamDetail]);

  // Real-time synchronization for background media uploads
  useEffect(() => {
    if (!examId) return;

    const token = getAuthCookie();
    let sub: { unsubscribe: () => void } | null = null;

    if (token) {
      connectWebSocket(token, () => {
        sub = subscribeTopic(`/topic/exams/${examId}/questions`, (message: any) => {
          try {
            const payload = typeof message?.body === 'string' ? JSON.parse(message.body) : message;
            if (payload?.type === 'QUESTION_MEDIA_UPLOADED') {
              fetchExamDetail();
            }
          } catch (err) {
            console.error('Error handling live question update:', err);
          }
        });
      });
    }

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [examId, fetchExamDetail]);

  // Fallback poller when questions have pending background uploads
  useEffect(() => {
    const hasPendingMedia = exam?.questions?.some(
      (q) =>
        q.imageUrl?.startsWith('pending:') ||
        q.options?.some((opt) => opt.imageUrl?.startsWith('pending:'))
    );

    if (!hasPendingMedia) return;

    const interval = setInterval(() => {
      fetchExamDetail();
    }, 3000);

    return () => clearInterval(interval);
  }, [exam?.questions, fetchExamDetail]);

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
        isCameraProctoringEnabled: Boolean(data.isProctoringEnabled && data.isCameraProctoringEnabled),
        showResultsToStudents: Boolean(data.showResultsToStudents),
        maxViolations: Number(data.maxViolations) || 5,
        isPrivate: data.isPrivate !== undefined ? Boolean(data.isPrivate) : true,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link
              href="/teacher/exams"
              className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quản lý đề thi</span>
            </Link>
            <span>/</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
              {exam.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
              {exam.title}
            </h1>
            <Badge variant={exam.status} size="sm" dot>
              {exam.status === 'PUBLISHED'
                ? 'Đang mở'
                : exam.status === 'CLOSED'
                  ? 'Đã đóng'
                  : 'Bản nháp'}
            </Badge>

            {/* Access Code 1-click copy */}
            <button
              type="button"
              onClick={handleCopyAccessCode}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 transition-colors cursor-pointer"
              title="Sao chép mã phòng thi"
            >
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{exam.accessCode}</span>
              {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
            </button>
          </div>

          {/* Metadata quick stats */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>{exam.durationMinutes}&apos;</span>
            </div>
            <div className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              <span>{exam.totalQuestions} câu hỏi • {exam.totalPoints}đ</span>
            </div>
            {exam.isProctoringEnabled && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Giám sát AI bật</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons: 1 Primary CTA + Compact Secondary Icons */}
        <div className="flex items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
          
          {/* Primary CTA */}
          {isPublished && (
            <Link href={`/teacher/exams/${exam.id}/proctoring`}>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Mở phòng giám sát thí sinh trực tiếp"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Phòng giám sát</span>
              </button>
            </Link>
          )}

          {isDraft && (
            <button
              type="button"
              disabled={isPublishing}
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Xuất bản</span>
            </button>
          )}

          {isClosed && (
            <button
              type="button"
              onClick={handleOpenRepublishModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mở lại đề</span>
            </button>
          )}

          {/* Secondary: Duplicate */}
          <button
            type="button"
            onClick={handleOpenDuplicateModal}
            className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Nhân bản đề thi này"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Secondary: Close (when published) */}
          {isPublished && (
            <button
              type="button"
              disabled={isClosing}
              onClick={handleClose}
              className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-700 dark:bg-zinc-800 dark:hover:bg-amber-950/40 dark:text-zinc-300 dark:hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng đề thi"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Secondary: Delete (when draft) */}
          {isDraft && (
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
              title="Xóa đề nháp"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation: Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'questions'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Soạn thảo câu hỏi</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                activeTab === 'questions'
                  ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {exam.questions?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cài đặt thông số</span>
          </button>
        </div>

        {!isDraft && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-700 dark:text-amber-400">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isClosed
                ? 'Đề thi đã đóng. Bấm Mở lại đề thi để học sinh tiếp tục thi.'
                : 'Đề thi đã xuất bản, danh sách câu hỏi đã được khóa an toàn.'}
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
                Thay đổi thông tin và các thiết lập an toàn cho kỳ thi
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
                      Tự động đảo thứ tự câu hỏi
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('shuffleOptions')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Tự động đảo thứ tự các phương án lựa chọn
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
                        Bật giám sát trực tuyến
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Tự động phát hiện vi phạm trong kỳ thi.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${isProctoringSettingEnabled
                        ? 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer'
                        : 'border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 opacity-60 cursor-not-allowed'
                      }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!isProctoringSettingEnabled}
                      {...register('isCameraProctoringEnabled')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-rose-500" />
                        Giám sát qua Camera
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Yêu cầu thí sinh bật camera khi làm bài. Tự động ghi lại hình ảnh nếu phát hiện không có người hoặc có người lạ.
                        {!isProctoringSettingEnabled && (
                          <span className="block text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                            (Cần bật tính năng Giám sát trực tuyến ở trên trước)
                          </span>
                        )}
                      </p>
                    </div>
                  </label>

                  {watch('isProctoringEnabled') && (
                    <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        Số lần vi phạm tối đa
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
                        Công bố điểm và đáp án cho thí sinh
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Cho phép thí sinh xem lại điểm từng câu và đáp án đúng sau khi nộp bài. Tắt tùy chọn này nếu muốn bảo mật đề thi và chống lộ đáp án cho người khác.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      {...register('isPrivate')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5 cursor-pointer"
                    />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-500" />
                        Đề thi riêng tư
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Khi bật, chỉ thí sinh có mã phòng mới có thể vào thi. Khi tắt, đề thi sẽ có thể xuất hiện tại mục Khám phá công khai cho tất cả thí sinh luyện tập.
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
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 1. Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Xóa đề thi bản nháp
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Hành động này không thể hoàn tác
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-xs space-y-1">
              <span className="text-[11px] text-zinc-400 block">Đề thi sẽ bị xóa vĩnh viễn:</span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {exam.title}
              </p>
              <p className="text-[11px] text-zinc-500 font-mono">
                Mã đề: {exam.accessCode} • {exam.totalQuestions} câu hỏi • {exam.durationMinutes} phút
              </p>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Chỉ những đề thi ở trạng thái <strong>Bản nháp</strong> mới có thể xóa. Toàn bộ câu hỏi và cài đặt liên quan sẽ bị xóa vĩnh viễn khỏi hệ thống.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteExam}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Republish Closed Exam Modal */}
      {isRepublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Mở lại đợt thi mới
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Mã đề thi: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{exam.accessCode}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isRepublishing}
                onClick={() => setIsRepublishModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isRepublishing}
                onClick={() => setIsRepublishModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isRepublishing}
                onClick={handleConfirmRepublish}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isRepublishing ? 'Đang mở lại...' : 'Xác nhận mở lại'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Duplicate Exam Modal */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Nhân bản đề thi
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Tạo đề nháp mới từ đề thi hiện tại
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDuplicating}
                onClick={() => setIsDuplicateModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
                  <li>Mã phòng thi mới ngẫu nhiên, trạng thái <strong>Bản nháp</strong>.</li>
                  <li>Sao chép toàn bộ câu hỏi trắc nghiệm, tự luận và các đáp án.</li>
                  <li>Kế thừa đầy đủ các cài đặt thời gian và cấu hình giám sát AI.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isDuplicating}
                onClick={() => setIsDuplicateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDuplicating || !duplicateTitle.trim()}
                onClick={handleConfirmDuplicate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isDuplicating ? 'Đang tạo bản sao...' : 'Xác nhận nhân bản'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
