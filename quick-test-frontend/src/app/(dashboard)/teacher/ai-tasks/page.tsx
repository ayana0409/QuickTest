'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  RefreshCw,
  Search,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Award,
  CheckSquare,
  Square,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText,
  Check,
  Loader2,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useAuthStore } from '@/stores/authStore';
import { teacherAiTaskService, type TeacherAiTaskDto } from '@/services/teacherAiTaskService';
import { aiGenerateService } from '@/services/aiGenerateService';
import { examService } from '@/services/exam.service';
import type { ExamSummaryResponse } from '@/types/exam';
import type { AiGeneratedQuestionDto } from '@/types/aiGenerate';
import { formatDateTime, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function TeacherAiTasksPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  // Tasks state
  const [tasks, setTasks] = useState<TeacherAiTaskDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters state
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'AI_QUIZ_GEN' | 'AI_GRADING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cancelling / Deleting confirmation state
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    type: 'cancel' | 'delete';
    taskId: string;
    title: string;
  } | null>(null);

  // Question Review Modal State
  const [reviewTask, setReviewTask] = useState<TeacherAiTaskDto | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<AiGeneratedQuestionDto[]>([]);
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Target exam selector state (only DRAFT exams)
  const [teacherExams, setTeacherExams] = useState<ExamSummaryResponse[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isExamPickerOpen, setIsExamPickerOpen] = useState(false);
  const [examSearchQuery, setExamSearchQuery] = useState('');
  const [examPage, setExamPage] = useState(0);
  const EXAM_PAGE_SIZE = 4;

  // Polling ref
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch tasks
  const fetchTasks = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const data = await teacherAiTaskService.getMyTasks();
      setTasks(data || []);
      setLoadError(null);
    } catch (err: any) {
      if (!isSilent) {
        setLoadError(err?.message || 'Không thể tải danh sách tác vụ AI');
      }
    } finally {
      setIsLoading(false);
      if (!isSilent) setIsRefreshing(false);
    }
  }, []);

  // Fetch teacher exams for exam selector (sorted newest to oldest, ONLY DRAFT)
  const fetchTeacherExams = useCallback(async () => {
    try {
      const res = await examService.getTeacherExams({ size: 100, status: 'DRAFT', sort: 'createdAt,desc' });
      const sorted = (res.content || [])
        .filter((e) => e.status === 'DRAFT')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTeacherExams(sorted);
    } catch (err) {
      console.error('Failed to load teacher exams:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTasks();
    fetchTeacherExams();
  }, [fetchTasks, fetchTeacherExams]);

  // Determine if any task is actively running or queued
  const hasActiveTasks = tasks.some(
    (t) => t.status === 'QUEUED' || t.status === 'PROCESSING'
  );

  // Polling mechanism (3.5s for active tasks, 15s for idle)
  useEffect(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    const pollInterval = hasActiveTasks ? 3500 : 15000;
    pollingTimerRef.current = setInterval(() => {
      fetchTasks(true);
    }, pollInterval);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [hasActiveTasks, fetchTasks]);

  // Cancel task handler
  const handleCancelTask = async (taskId: string) => {
    setCancellingTaskId(taskId);
    try {
      await teacherAiTaskService.cancelTask(taskId);
      await fetchTasks(true);
    } catch {
      // Handled by axios interceptor
    } finally {
      setCancellingTaskId(null);
      setConfirmModalState(null);
    }
  };

  // Delete task handler
  const handleDeleteTask = async (taskId: string) => {
    setDeletingTaskId(taskId);
    try {
      await teacherAiTaskService.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    } catch {
      // Handled by axios interceptor
    } finally {
      setDeletingTaskId(null);
      setConfirmModalState(null);
    }
  };

  // Open Question Review Modal
  const handleOpenReview = async (task: TeacherAiTaskDto) => {
    setReviewTask(task);
    setIsLoadingDetail(true);
    const isTargetDraft = task.targetExamId && teacherExams.some((e) => e.id === task.targetExamId && e.status === 'DRAFT');
    const defaultExamId = isTargetDraft ? (task.targetExamId || '') : '';
    setSelectedExamId(defaultExamId);
    setIsExamPickerOpen(!defaultExamId);
    setExamSearchQuery('');
    setExamPage(0);

    try {
      const detail = await teacherAiTaskService.getTaskDetail(task.taskId);
      const questions = detail.questions || [];
      setReviewQuestions(questions);
      setSelectedQuestionIndices(new Set(questions.map((_, i) => i)));
      setExpandedIndices(new Set(questions.map((_, i) => i)));
    } catch {
      setReviewTask(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Toggle selection for a single question
  const toggleQuestionSelection = (index: number) => {
    setSelectedQuestionIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Toggle select all questions
  const toggleSelectAll = () => {
    if (selectedQuestionIndices.size === reviewQuestions.length) {
      setSelectedQuestionIndices(new Set());
    } else {
      setSelectedQuestionIndices(new Set(reviewQuestions.map((_, i) => i)));
    }
  };

  // Inline editing question content
  const startEditingQuestion = (index: number, content: string) => {
    setEditingIndex(index);
    setEditedContent(content);
  };

  const saveEditedQuestion = (index: number) => {
    if (!editedContent.trim()) {
      toast.error('Nội dung câu hỏi không được để trống!');
      return;
    }
    setReviewQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], content: editedContent.trim() };
      return next;
    });
    setEditingIndex(null);
  };

  // Commit questions to exam
  const handleCommitQuestions = async () => {
    if (!selectedExamId) {
      toast.error('Vui lòng chọn đề thi đích để lưu các câu hỏi!');
      return;
    }

    const selectedQuestions = reviewQuestions.filter((_, i) => selectedQuestionIndices.has(i));
    if (selectedQuestions.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 câu hỏi để thêm vào đề thi!');
      return;
    }

    setIsCommitting(true);
    try {
      await aiGenerateService.commitQuestionsToExam(selectedExamId, selectedQuestions);
      setReviewTask(null);
      await fetchTasks(true);
      router.push(`/teacher/exams/${selectedExamId}/edit`);
    } catch {
      // Handled by axios interceptor
    } finally {
      setIsCommitting(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
    if (statusFilter === 'ACTIVE' && t.status !== 'QUEUED' && t.status !== 'PROCESSING') return false;
    if (statusFilter === 'COMPLETED' && t.status !== 'COMPLETED') return false;
    if (statusFilter === 'FAILED' && t.status !== 'FAILED' && t.status !== 'CANCELLED') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchExam = (t.targetExamTitle || '').toLowerCase().includes(q);
      if (!matchTitle && !matchExam) return false;
    }
    return true;
  });

  // Overview metrics
  const totalCount = tasks.length;
  const activeCount = tasks.filter((t) => t.status === 'QUEUED' || t.status === 'PROCESSING').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const failedCount = tasks.filter((t) => t.status === 'FAILED' || t.status === 'CANCELLED').length;

  // Selected points calculation
  const selectedQuestionsList = reviewQuestions.filter((_, i) => selectedQuestionIndices.has(i));
  const totalSelectedPoints = selectedQuestionsList.reduce((sum, q) => sum + (q.points || 1.0), 0);

  // Exam picker search and pagination
  const filteredTeacherExams = teacherExams.filter((exam) => {
    if (exam.status !== 'DRAFT') return false;
    if (!examSearchQuery.trim()) return true;
    const q = examSearchQuery.trim().toLowerCase();
    const matchCode = (exam.accessCode || '').toLowerCase().includes(q);
    const matchTitle = (exam.title || '').toLowerCase().includes(q);
    return matchCode || matchTitle;
  });

  const totalExamPages = Math.ceil(filteredTeacherExams.length / EXAM_PAGE_SIZE);
  const pagedTeacherExams = filteredTeacherExams.slice(
    examPage * EXAM_PAGE_SIZE,
    (examPage + 1) * EXAM_PAGE_SIZE
  );

  const selectedExam = teacherExams.find((e) => e.id === selectedExamId);

  const handleExamSearchChange = (query: string) => {
    setExamSearchQuery(query);
    setExamPage(0);
  };

  return (
    <div className="min-h-[100dvh] space-y-6 sm:space-y-8 pb-16">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
              <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
              Trợ lý AI tự động
            </span>
            {hasActiveTasks && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Đang xử lý
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Tác vụ AI Tự động
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Theo dõi tiến trình soạn đề từ tài liệu và chấm thi tự luận tự động bằng mô hình AI.
          </p>
        </div>

        {/* Action Controls: Compact Refresh Icon Button + Primary CTA */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => fetchTasks(false)}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
            title="Làm mới danh sách"
          >
            <RefreshCw className={cn("w-4 h-4 text-zinc-600 dark:text-zinc-400", isRefreshing && "animate-spin text-indigo-600")} />
          </button>

          <Link href="/teacher/exams">
            <Button
              variant="primary"
              size="sm"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-semibold text-xs sm:text-sm h-9 px-3.5"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Quản lý</span> đề thi
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid: 2x2 on Mobile, 4 columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Tasks */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">
              Tổng tác vụ
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
              {totalCount}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-snug truncate">
              Lưu trữ 48 giờ gần nhất
            </p>
          </div>
        </div>

        {/* In Progress */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400 leading-snug">
              Đang xử lý / Chờ
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 relative">
              {activeCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 leading-tight">
              {activeCount}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-snug truncate">
              Đang chạy ngầm
            </p>
          </div>
        </div>

        {/* Completed */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 leading-snug">
              Đã hoàn thành
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
              {completedCount}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-snug truncate">
              Sẵn sàng xem & duyệt
            </p>
          </div>
        </div>

        {/* Failed / Cancelled */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400 leading-snug">
              Thất bại / Hủy
            </span>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 leading-tight">
              {failedCount}
            </div>
            <p className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-snug truncate">
              Đã dừng tác vụ
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar: Apple Segmented Control + Responsive Search */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Type Tabs: Apple Segmented Control */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={cn(
              'flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              typeFilter === 'ALL'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            <span>Tất cả</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono',
                typeFilter === 'ALL'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                  : 'bg-zinc-200/70 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
              )}
            >
              {totalCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('AI_QUIZ_GEN')}
            className={cn(
              'flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              typeFilter === 'AI_QUIZ_GEN'
                ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Soạn đề</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('AI_GRADING')}
            className={cn(
              'flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              typeFilter === 'AI_GRADING'
                ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Chấm thi</span>
          </button>
        </div>

        {/* Status Dropdown & Search Input */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 cursor-pointer font-medium"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang xử lý / Chờ</option>
              <option value="COMPLETED">Đã hoàn thành</option>
              <option value="FAILED">Thất bại / Hủy</option>
            </select>
          </div>

          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo tên file, đề thi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Task List Section */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-9 h-9 text-indigo-600 animate-spin mb-3" />
          <p className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Đang tải danh sách tác vụ AI...
          </p>
        </div>
      ) : loadError ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTasks(false)}
            className="rounded-xl text-xs"
          >
            Thử lại
          </Button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-16 px-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center bg-white/50 dark:bg-zinc-900/50">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
            Chưa có tác vụ AI nào
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
            {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Không tìm thấy tác vụ phù hợp với bộ lọc hiện tại. Thử bỏ bộ lọc để xem toàn bộ tác vụ.'
              : 'Khi bạn tạo câu hỏi từ tài liệu hoặc khởi chạy chấm tự luận tự động, các tác vụ sẽ cập nhật trực tiếp tại đây.'}
          </p>
          {(searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTypeFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="mt-4 rounded-xl text-xs"
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
          {filteredTasks.map((task) => {
            const isQuizGen = task.type === 'AI_QUIZ_GEN';
            const isGrading = task.type === 'AI_GRADING';
            const isProcessing = task.status === 'PROCESSING';
            const isQueued = task.status === 'QUEUED';
            const isCompleted = task.status === 'COMPLETED';
            const isFailed = task.status === 'FAILED';
            const isCancelled = task.status === 'CANCELLED';

            return (
              <div
                key={task.taskId}
                className="group rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-3.5"
              >
                {/* Task Header: Badges & Timestamp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Type Badge */}
                    {isQuizGen ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/50">
                        <Sparkles className="w-3 h-3 text-purple-500" />
                        Soạn đề từ tài liệu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50">
                        <Award className="w-3 h-3 text-amber-500" />
                        Chấm thi tự luận
                      </span>
                    )}

                    {/* Status Badge */}
                    {isQueued && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        <Clock className="w-3 h-3 animate-spin" />
                        Đang chờ xử lý
                      </span>
                    )}
                    {isProcessing && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                        Đang xử lý ({task.progressPercent}%)
                      </span>
                    )}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Hoàn thành
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        <XCircle className="w-3 h-3" />
                        Thất bại
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        <X className="w-3 h-3" />
                        Đã hủy
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-[11px] sm:text-xs text-zinc-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>{formatDateTime(task.createdAt)}</span>
                  </div>
                </div>

                {/* Task Body: Title & Meta */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {task.title || 'Tác vụ AI không tên'}
                    </h4>
                    {task.targetExamTitle && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                        Đề thi đích:{' '}
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {task.targetExamTitle}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Item counter */}
                  <div className="sm:text-right shrink-0">
                    <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100">
                      {isCompleted
                        ? `${task.totalItems} ${isQuizGen ? 'câu hỏi' : 'bài thi'}`
                        : `${task.processedItems} / ${task.totalItems} ${isQuizGen ? 'câu hỏi' : 'bài thi'}`}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-medium block">
                      {isCompleted ? 'Đã hoàn tất trọn vẹn' : `Tiến độ: ${task.progressPercent}%`}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Current Step */}
                {(isProcessing || isQueued) && (
                  <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(5, task.progressPercent)}%` }}
                      />
                    </div>
                    <p className="text-[11px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      <span className="truncate">{task.currentStep || 'Hệ thống đang chuẩn bị nội dung...'}</span>
                    </p>
                  </div>
                )}

                {/* Error Box if FAILED */}
                {isFailed && task.errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Chi tiết lỗi:</span>
                      <p className="mt-0.5 leading-relaxed">{task.errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Card Action Bar */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-400 font-mono">
                    #{task.taskId.substring(0, 8)}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Cancel Task */}
                    {(isQueued || isProcessing) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmModalState({
                            isOpen: true,
                            type: 'cancel',
                            taskId: task.taskId,
                            title: task.title || 'Tác vụ AI',
                          })
                        }
                        disabled={cancellingTaskId === task.taskId}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/50 rounded-xl h-8 px-2.5"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Hủy
                      </Button>
                    )}

                    {/* AI Grading: Link to grading results */}
                    {isGrading && isCompleted && task.targetExamId && (
                      <Link href={`/teacher/grading/exams/${task.targetExamId}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-2xs flex items-center gap-1.5 h-8 px-3"
                        >
                          <Award className="w-3.5 h-3.5" />
                          Xem kết quả
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    )}

                    {/* AI Quiz Gen: Open Question Review Modal */}
                    {isQuizGen && isCompleted && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenReview(task)}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs flex items-center gap-1.5 font-semibold h-8 px-3"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Duyệt câu hỏi ({task.totalItems})
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {/* Delete Task button */}
                    {(isCompleted || isFailed || isCancelled) && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModalState({
                            isOpen: true,
                            type: 'delete',
                            taskId: task.taskId,
                            title: task.title || 'Tác vụ AI',
                          })
                        }
                        disabled={deletingTaskId === task.taskId}
                        className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Xóa tác vụ khỏi danh sách"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUESTION REVIEW & COMMIT MODAL */}
      <Modal
        isOpen={!!reviewTask}
        onClose={() => {
          if (!isCommitting) setReviewTask(null);
        }}
        size="2xl"
        title={
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                Duyệt câu hỏi AI
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                {reviewTask?.title || 'Tài liệu nguồn'}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 min-w-0 truncate">
              Đã chọn <strong className="text-indigo-600 dark:text-indigo-400">{selectedQuestionIndices.size}</strong>/{reviewQuestions.length} câu • <strong className="text-zinc-800 dark:text-zinc-200">{totalSelectedPoints.toFixed(1)}đ</strong>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewTask(null)}
                disabled={isCommitting}
                className="rounded-xl text-xs h-8 px-3"
              >
                Đóng
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCommitQuestions}
                disabled={isCommitting || selectedQuestionIndices.size === 0 || !selectedExamId}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-2xs h-8 px-3"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Lưu {selectedQuestionIndices.size} câu vào đề
                  </>
                )}
              </Button>
            </div>
          </div>
        }
      >
        {isLoadingDetail ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-xs text-zinc-500">Đang tải danh sách câu hỏi AI...</p>
          </div>
        ) : reviewQuestions.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            Không tìm thấy câu hỏi nào trong tác vụ này. Tác vụ có thể đã bị gián đoạn hoặc tài liệu không có nội dung phù hợp.
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Target Exam Accordion Bar */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Đề thi đích lưu câu hỏi:
                  </span>
                </div>

                {selectedExam && (
                  <button
                    type="button"
                    onClick={() => setIsExamPickerOpen(!isExamPickerOpen)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {isExamPickerOpen ? 'Thu gọn' : 'Đổi đề thi khác'}
                  </button>
                )}
              </div>

              {/* Selected Exam Preview */}
              {selectedExam && !isExamPickerOpen && (
                <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {selectedExam.title}
                      </span>
                      {selectedExam.accessCode && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          #{selectedExam.accessCode}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200">
                        Bản nháp
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">
                      Đang có {selectedExam.totalQuestions} câu hỏi
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã chọn</span>
                  </div>
                </div>
              )}

              {/* No Exam Selected Notice */}
              {!selectedExam && !isExamPickerOpen && (
                <div
                  onClick={() => setIsExamPickerOpen(true)}
                  className="p-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between cursor-pointer hover:bg-amber-50 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Chưa chọn đề thi đích. Bấm vào đây để chọn!</span>
                  </div>
                  <Button variant="primary" size="sm" className="text-xs h-7 px-2.5">
                    Chọn đề thi
                  </Button>
                </div>
              )}

              {/* Exam Picker Box */}
              {isExamPickerOpen && (
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo mã đề hoặc tên đề thi bản nháp..."
                      value={examSearchQuery}
                      onChange={(e) => handleExamSearchChange(e.target.value)}
                      className="w-full text-xs rounded-xl pl-9 pr-8 py-1.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    {examSearchQuery && (
                      <button
                        type="button"
                        onClick={() => handleExamSearchChange('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {teacherExams.length === 0 ? (
                    <div className="py-4 text-center space-y-1 text-xs text-amber-700 dark:text-amber-400">
                      <p className="font-semibold">Không có đề thi nào ở trạng thái Bản nháp</p>
                      <Link href="/teacher/exams/create" target="_blank">
                        <Button variant="outline" size="sm" className="mt-1 text-xs h-7 px-3">
                          + Tạo đề thi mới
                        </Button>
                      </Link>
                    </div>
                  ) : filteredTeacherExams.length === 0 ? (
                    <div className="py-4 text-center text-xs text-zinc-400">
                      Không tìm thấy đề thi bản nháp phù hợp.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {pagedTeacherExams.map((exam) => {
                        const isChosen = selectedExamId === exam.id;
                        return (
                          <div
                            key={exam.id}
                            onClick={() => {
                              setSelectedExamId(exam.id);
                              setIsExamPickerOpen(false);
                            }}
                            className={cn(
                              'p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2',
                              isChosen
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/20'
                                : 'bg-zinc-50/60 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                  {exam.title}
                                </span>
                                {exam.accessCode && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-700 text-indigo-700 dark:text-indigo-300">
                                    #{exam.accessCode}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-400 block mt-0.5">
                                {exam.totalQuestions} câu hiện có
                              </span>
                            </div>

                            <span className={cn(
                              'text-[11px] font-semibold shrink-0',
                              isChosen ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'
                            )}>
                              {isChosen ? 'Đang chọn' : 'Chọn'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {totalExamPages > 1 && (
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
                      <span className="text-zinc-400">
                        {examPage + 1}/{totalExamPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={examPage === 0}
                          onClick={() => setExamPage((p) => Math.max(0, p - 1))}
                          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={examPage >= totalExamPages - 1}
                          onClick={() => setExamPage((p) => Math.min(totalExamPages - 1, p + 1))}
                          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Questions Toolbar: Select All & Count */}
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Danh sách câu hỏi AI ({reviewQuestions.length} câu)
              </span>

              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {selectedQuestionIndices.size === reviewQuestions.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Bỏ chọn tất cả</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Chọn tất cả</span>
                  </>
                )}
              </button>
            </div>

            {/* Questions List */}
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {reviewQuestions.map((question, index) => {
                const isSelected = selectedQuestionIndices.has(index);
                const isExpanded = expandedIndices.has(index);
                const isEditing = editingIndex === index;

                return (
                  <div
                    key={index}
                    className={cn(
                      'rounded-xl border transition-all',
                      isSelected
                        ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/10'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 opacity-75'
                    )}
                  >
                    {/* Header item */}
                    <div className="p-3 flex items-start gap-2.5">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleQuestionSelection(index)}
                        className="mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>

                      {/* Content & Meta */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            Câu {index + 1}:
                          </span>

                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                            {question.questionType === 'SINGLE_CHOICE' && 'Trắc nghiệm'}
                            {question.questionType === 'MULTIPLE_CHOICE' && 'Nhiều đáp án'}
                            {question.questionType === 'NUMERIC' && 'Điền số'}
                            {question.questionType === 'ESSAY_TEXT' && 'Tự luận'}
                          </span>

                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                            {question.points || 1.0}đ
                          </span>

                          {question.difficulty && (
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              {question.difficulty === 'EASY'
                                ? 'Dễ'
                                : question.difficulty === 'HARD'
                                ? 'Khó'
                                : 'TB'}
                            </span>
                          )}
                        </div>

                        {/* Content text */}
                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={3}
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              className="w-full text-xs rounded-xl p-2.5 border border-indigo-400 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingIndex(null)}
                                className="text-[11px] h-7 px-2 rounded-lg"
                              >
                                Hủy
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => saveEditedQuestion(index)}
                                className="text-[11px] h-7 px-2 rounded-lg bg-indigo-600 text-white"
                              >
                                Lưu
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
                            {question.content}
                          </p>
                        )}
                      </div>

                      {/* Action buttons: Edit & Expand */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEditingQuestion(index, question.content)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                            title="Sửa nội dung"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedIndices((prev) => {
                              const next = new Set(prev);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              return next;
                            });
                          }}
                          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3 pt-1 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                        {/* Options if choice-based */}
                        {question.options && question.options.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                              Đáp án:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {question.options.map((opt, optIdx) => (
                                <div
                                  key={optIdx}
                                  className={cn(
                                    'p-2 rounded-lg text-xs flex items-start gap-2 border',
                                    opt.isCorrect
                                      ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 font-medium'
                                      : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                                  )}
                                >
                                  {opt.isCorrect ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-zinc-400 shrink-0 mt-0.5" />
                                  )}
                                  <span className="leading-snug">{opt.content}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Essay Rubric */}
                        {question.questionType === 'ESSAY_TEXT' && (
                          <div className="space-y-1.5 pt-1 text-xs">
                            {question.sampleAnswer && (
                              <div className="p-2 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300">
                                <span className="font-bold">Đáp án mẫu:</span>
                                <p className="mt-0.5 leading-relaxed whitespace-pre-wrap">
                                  {question.sampleAnswer}
                                </p>
                              </div>
                            )}
                            {question.gradingRubric && (
                              <div className="p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300">
                                <span className="font-bold">Tiêu chí chấm điểm:</span>
                                <p className="mt-0.5 leading-relaxed whitespace-pre-wrap">
                                  {question.gradingRubric}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Explanation */}
                        {question.explanation && (
                          <div className="p-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 text-xs">
                            <span className="font-bold">Giải thích:</span>
                            <p className="mt-0.5 leading-relaxed">{question.explanation}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* CUSTOM CONFIRMATION DIALOG (Apple/Linear tier) */}
      {confirmModalState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  confirmModalState.type === 'cancel'
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                    : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                )}
              >
                {confirmModalState.type === 'cancel' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {confirmModalState.type === 'cancel' ? 'Dừng xử lý tác vụ?' : 'Xóa tác vụ khỏi lịch sử?'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {confirmModalState.type === 'cancel'
                    ? `Hệ thống sẽ ngừng xử lý tác vụ "${confirmModalState.title}". Thao tác này không thể hoàn tác.`
                    : `Tác vụ "${confirmModalState.title}" sẽ bị xóa vĩnh viễn khỏi danh sách lưu trữ của bạn.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmModalState(null)}
                className="rounded-xl text-xs h-8 px-3"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (confirmModalState.type === 'cancel') {
                    handleCancelTask(confirmModalState.taskId);
                  } else {
                    handleDeleteTask(confirmModalState.taskId);
                  }
                }}
                disabled={cancellingTaskId === confirmModalState.taskId || deletingTaskId === confirmModalState.taskId}
                className={cn(
                  'rounded-xl text-xs font-semibold h-8 px-3.5',
                  confirmModalState.type === 'cancel'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                )}
              >
                {cancellingTaskId === confirmModalState.taskId || deletingTaskId === confirmModalState.taskId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : null}
                {confirmModalState.type === 'cancel' ? 'Dừng tác vụ' : 'Xóa vĩnh viễn'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
