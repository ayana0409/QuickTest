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
  Filter,
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
  HelpCircle,
  Hash,
  ListChecks,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { useAuthStore } from '@/stores/authStore';
import { teacherAiTaskService, type TeacherAiTaskDto } from '@/services/teacherAiTaskService';
import { aiGenerateService } from '@/services/aiGenerateService';
import { examService } from '@/services/exam.service';
import type { ExamSummaryResponse } from '@/types/exam';
import type { AiGeneratedQuestionDto } from '@/types/aiGenerate';
import type { QuestionType } from '@/types/question';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function TeacherAiTasksPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  // State
  const [tasks, setTasks] = useState<TeacherAiTaskDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'AI_QUIZ_GEN' | 'AI_GRADING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cancelling / Deleting state
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Question Review Modal State
  const [reviewTask, setReviewTask] = useState<TeacherAiTaskDto | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<AiGeneratedQuestionDto[]>([]);
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Target exam for commit & Redesigned Exam Picker State
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
      // Guarantee newest to oldest sort and DRAFT only
      const sorted = (res.content || [])
        .filter((e) => e.status === 'DRAFT')
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
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

  // Polling mechanism
  useEffect(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    // Poll every 3.5s if active tasks exist, else every 15s
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
    if (!confirm('Bạn có chắc chắn muốn hủy tác vụ này? Tiến trình đang xử lý sẽ dừng lại.')) {
      return;
    }

    setCancellingTaskId(taskId);
    try {
      await teacherAiTaskService.cancelTask(taskId);
      await fetchTasks(true);
    } catch {
      // Error toast is handled automatically by axios interceptor
    } finally {
      setCancellingTaskId(null);
    }
  };

  // Delete task handler
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Bạn có chắc muốn xóa tác vụ này khỏi danh sách lưu trữ?')) {
      return;
    }

    setDeletingTaskId(taskId);
    try {
      await teacherAiTaskService.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    } catch {
      // Error toast is handled automatically by axios interceptor
    } finally {
      setDeletingTaskId(null);
    }
  };

  // Open Question Review Modal
  const handleOpenReview = async (task: TeacherAiTaskDto) => {
    setReviewTask(task);
    setIsLoadingDetail(true);
    // Only preselect targetExamId if it exists in draft exams
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
      // Select all questions by default
      setSelectedQuestionIndices(new Set(questions.map((_, i) => i)));
      // Expand all by default
      setExpandedIndices(new Set(questions.map((_, i) => i)));
    } catch {
      // Error toast is handled automatically by axios interceptor
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

  // Toggle select all
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
    } catch (err: any) {
      // Handled by axios interceptor toast
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

  // Exam picker search and pagination (Ordered newest to oldest, DRAFT only)
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
    <div className="min-h-[100dvh] space-y-8 pb-16">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              AI Background Execution
            </span>
            {hasActiveTasks && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Đang chạy thời gian thực
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Tiến trình Tác vụ AI
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Theo dõi tất cả tiến trình tạo đề thi từ tài liệu và chấm tự luận AI chạy ngầm. Bạn có thể tự do rời trang hoặc làm việc khác trong khi hệ thống đang xử lý.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTasks(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-xl border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Làm mới
          </Button>
          <Link href="/teacher/exams">
            <Button
              variant="primary"
              size="sm"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
            >
              <BookOpen className="w-4 h-4" />
              Quản lý đề thi
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Bento Grid (Double-Bezel Architecture) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="p-1.5 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/40 ring-1 ring-zinc-300/40 dark:ring-zinc-700/40">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Tổng tác vụ
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
                {totalCount}
              </p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Lưu trữ trong 48 giờ</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="p-1.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 ring-1 ring-amber-500/20">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Đang xử lý / Chờ
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {activeCount}
              </p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Hàng đợi đơn luồng AI</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 relative">
              {activeCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 animate-ping" />}
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="p-1.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/5 ring-1 ring-emerald-500/20">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Đã hoàn thành
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {completedCount}
              </p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Sẵn sàng xem & duyệt</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Failed / Cancelled */}
        <div className="p-1.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/5 ring-1 ring-rose-500/20">
          <div className="rounded-[calc(1rem-0.25rem)] bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Thất bại / Đã hủy
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                {failedCount}
              </p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Đã giải phóng tài nguyên</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-1.5 rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/40 ring-1 ring-zinc-300/40 dark:ring-zinc-700/40">
        <div className="rounded-[calc(1rem-0.25rem)] bg-white dark:bg-zinc-900 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Type Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                typeFilter === 'ALL'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Tất cả loại ({totalCount})
            </button>
            <button
              onClick={() => setTypeFilter('AI_QUIZ_GEN')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                typeFilter === 'AI_QUIZ_GEN'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Soạn đề AI
            </button>
            <button
              onClick={() => setTypeFilter('AI_GRADING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                typeFilter === 'AI_GRADING'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Chấm thi tự luận
            </button>
          </div>

          {/* Status & Search */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang xử lý / Chờ</option>
              <option value="COMPLETED">Đã hoàn thành</option>
              <option value="FAILED">Thất bại / Hủy</option>
            </select>

            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Tìm theo tên file / đề thi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-xl pl-9 pr-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task List Section */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Đang tải dữ liệu tiến trình tác vụ AI...
          </p>
        </div>
      ) : loadError ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTasks(false)}
            className="mt-4 rounded-xl"
          >
            Thử lại
          </Button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-16 px-4 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 mx-auto flex items-center justify-center text-zinc-400 mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Chưa có tác vụ AI nào
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
            {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Không tìm thấy tác vụ phù hợp với bộ lọc hiện tại. Thử bỏ bộ lọc để xem toàn bộ tác vụ.'
              : 'Khi bạn tạo câu hỏi từ tài liệu PDF/Word hoặc khởi chạy chấm tự luận tự động, các tác vụ sẽ hiển thị và cập nhật trực tiếp tại đây.'}
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
        <div className="grid grid-cols-1 gap-4">
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
                className="group p-1.5 rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/40 ring-1 ring-zinc-300/40 dark:ring-zinc-700/40 transition-all hover:ring-zinc-400/60 dark:hover:ring-zinc-600/60"
              >
                <div className="rounded-[calc(1rem-0.25rem)] bg-white dark:bg-zinc-900 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-col gap-4">
                  {/* Task Header: Badges + Timestamp */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Type Badge */}
                      {isQuizGen ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/50">
                          <Sparkles className="w-3.5 h-3.5" />
                          Soạn đề từ tài liệu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50">
                          <Award className="w-3.5 h-3.5" />
                          Chấm thi tự luận
                        </span>
                      )}

                      {/* Status Badge */}
                      {isQueued && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          Đang chờ trong hàng đợi
                        </span>
                      )}
                      {isProcessing && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                          Đang xử lý ({task.progressPercent}%)
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Hoàn thành
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          <XCircle className="w-3.5 h-3.5" />
                          Thất bại
                        </span>
                      )}
                      {isCancelled && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                          <X className="w-3.5 h-3.5" />
                          Đã hủy
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span>Bắt đầu: {formatDateTime(task.createdAt)}</span>
                      {task.completedAt && (
                        <>
                          <span>•</span>
                          <span>Xong: {formatDateTime(task.completedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Task Body: Title & Meta */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        {task.title || 'Tác vụ AI không tên'}
                      </h4>
                      {task.targetExamTitle && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                          Đề thi đích:{' '}
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {task.targetExamTitle}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Progress Percent or Item count */}
                    <div className="text-right">
                      <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                        {isCompleted
                          ? `${task.totalItems} ${isQuizGen ? 'câu hỏi' : 'bài thi'}`
                          : `${task.processedItems} / ${task.totalItems} ${isQuizGen ? 'câu hỏi' : 'bài thi'}`}
                      </p>
                      <p className="text-[11px] text-zinc-400 font-medium">
                        {isCompleted
                          ? 'Đã xử lý trọn vẹn'
                          : `Tiến độ: ${task.progressPercent}%`}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar & Current Step */}
                  {(isProcessing || isQueued) && (
                    <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                      <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.max(5, task.progressPercent)}%` }}
                        />
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {task.currentStep || 'Đang chờ xử lý trong hàng đợi nền...'}
                      </p>
                    </div>
                  )}

                  {/* Error Message Box if FAILED */}
                  {isFailed && task.errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Chi tiết lỗi:</p>
                        <p className="mt-0.5 leading-relaxed">{task.errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[11px] text-zinc-400">
                      Mã tác vụ: <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[10px]">{task.taskId.substring(0, 13)}...</code>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Cancel Task */}
                      {(isQueued || isProcessing) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelTask(task.taskId)}
                          disabled={cancellingTaskId === task.taskId}
                          className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/50 rounded-xl"
                        >
                          {cancellingTaskId === task.taskId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : (
                            <X className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Hủy tác vụ
                        </Button>
                      )}

                      {/* AI Grading: Link to grading results */}
                      {isGrading && isCompleted && task.targetExamId && (
                        <Link href={`/teacher/grading/exams/${task.targetExamId}`}>
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm flex items-center gap-1.5"
                          >
                            <Award className="w-3.5 h-3.5" />
                            Xem kết quả chấm thi
                            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      )}

                      {/* AI Quiz Gen: Open Question Review Modal */}
                      {isQuizGen && isCompleted && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenReview(task)}
                          className="text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 font-semibold"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Xem & Duyệt câu hỏi ({task.totalItems})
                          <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      )}

                      {/* Delete Task button */}
                      {(isCompleted || isFailed || isCancelled) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.taskId)}
                          disabled={deletingTaskId === task.taskId}
                          className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl p-2 h-auto"
                          title="Xóa tác vụ khỏi lịch sử"
                        >
                          {deletingTaskId === task.taskId ? (
                            <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
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
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Duyệt & Lưu câu hỏi AI vào đề thi
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tài liệu: {reviewTask?.title || 'Không có tên'}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Đã chọn <strong className="text-indigo-600 dark:text-indigo-400">{selectedQuestionIndices.size}</strong> / {reviewQuestions.length} câu hỏi • Tổng điểm:{' '}
              <strong className="text-zinc-800 dark:text-zinc-200">{totalSelectedPoints.toFixed(1)}đ</strong>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewTask(null)}
                disabled={isCommitting}
                className="rounded-xl text-xs"
              >
                Đóng
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCommitQuestions}
                disabled={isCommitting || selectedQuestionIndices.size === 0 || !selectedExamId}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Đang lưu vào đề thi...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Lưu {selectedQuestionIndices.size} câu vào đề thi
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
            <p className="text-xs text-zinc-500">Đang tải danh sách câu hỏi AI đã tạo...</p>
          </div>
        ) : reviewQuestions.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            Không tìm thấy câu hỏi nào trong tác vụ này. Có thể tiến trình đã bị gián đoạn.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target Exam Selection Box (Redesigned with Sorting, Search by Code & Pagination) */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      Đề thi đích lưu câu hỏi
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60">
                        Chỉ đề thi Bản nháp
                      </span>
                    </h5>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Chỉ đề thi ở trạng thái <strong>Bản nháp</strong> mới có thể cập nhật và bổ sung thêm câu hỏi
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedExam && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExamPickerOpen(!isExamPickerOpen)}
                      className="text-xs h-8 px-3 rounded-xl border-zinc-300 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800"
                    >
                      {isExamPickerOpen ? 'Thu gọn danh sách' : 'Đổi đề thi khác'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Selected Exam Preview Card (if an exam is selected) */}
              {selectedExam && !isExamPickerOpen && (
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 shadow-sm flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {selectedExam.title}
                      </span>
                      {selectedExam.accessCode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                          <Hash className="w-3 h-3 text-indigo-500" />
                          Mã: {selectedExam.accessCode}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          selectedExam.status === 'PUBLISHED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200'
                        }`}
                      >
                        {selectedExam.status === 'PUBLISHED' ? 'Đã phát hành' : 'Bản nháp'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Hiện có: <strong>{selectedExam.totalQuestions} câu hỏi</strong> • Tạo lúc: {formatDateTime(selectedExam.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã chọn</span>
                  </div>
                </div>
              )}

              {/* No Exam Selected Notice */}
              {!selectedExam && !isExamPickerOpen && (
                <div
                  onClick={() => setIsExamPickerOpen(true)}
                  className="p-3.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Chưa chọn đề thi đích. Bấm vào đây để chọn đề thi lưu câu hỏi!</span>
                  </div>
                  <Button variant="primary" size="sm" className="text-xs h-7 px-3 rounded-lg">
                    Chọn đề thi
                  </Button>
                </div>
              )}

              {/* Exam Picker Box (Search + List + Pagination) */}
              {isExamPickerOpen && (
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo mã đề (Access Code) hoặc tên đề thi..."
                      value={examSearchQuery}
                      onChange={(e) => handleExamSearchChange(e.target.value)}
                      className="w-full text-xs rounded-xl pl-9 pr-8 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    {examSearchQuery && (
                      <button
                        type="button"
                        onClick={() => handleExamSearchChange('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Exams List */}
                  {teacherExams.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-2 border border-dashed border-amber-300 dark:border-amber-800 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 text-xs">
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        Không có đề thi nào ở trạng thái Bản nháp
                      </p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 max-w-sm mx-auto leading-relaxed">
                        Các đề thi đã phát hành không thể thêm câu hỏi mới. Vui lòng tạo một đề thi mới ở trạng thái Bản nháp để thêm bộ câu hỏi này.
                      </p>
                      <Link href="/teacher/exams/create" target="_blank">
                        <Button variant="outline" size="sm" className="mt-2 text-xs rounded-lg h-7 px-3">
                          + Tạo đề thi mới
                        </Button>
                      </Link>
                    </div>
                  ) : filteredTeacherExams.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400">
                      Không tìm thấy đề thi bản nháp nào khớp với &quot;{examSearchQuery}&quot;. Thử tìm mã khác hoặc xóa tìm kiếm.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pagedTeacherExams.map((exam) => {
                        const isChosen = selectedExamId === exam.id;
                        return (
                          <div
                            key={exam.id}
                            onClick={() => {
                              setSelectedExamId(exam.id);
                              setIsExamPickerOpen(false);
                            }}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                              isChosen
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                                : 'bg-zinc-50/60 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-zinc-800'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                  isChosen ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-zinc-400'
                                }`}>
                                  {isChosen && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </span>
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                  {exam.title}
                                </span>
                                {exam.accessCode && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-700 text-indigo-700 dark:text-indigo-300">
                                    <Hash className="w-3 h-3 text-indigo-500" />
                                    {exam.accessCode}
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                  Bản nháp
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 pl-5">
                                {exam.totalQuestions} câu hiện có • Tạo ngày: {formatDateTime(exam.createdAt)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isChosen ? (
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-semibold text-[11px]">
                                  Đang chọn
                                </span>
                              ) : (
                                <span className="text-[11px] text-zinc-400 hover:text-indigo-600">
                                  Chọn đề này
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination Footer */}
                  {totalExamPages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                      <span className="text-[11px] text-zinc-400">
                        Trang {examPage + 1} / {totalExamPages} • Tổng {filteredTeacherExams.length} đề thi
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={examPage === 0}
                          onClick={() => setExamPage((p) => Math.max(0, p - 1))}
                          className="h-7 px-2.5 rounded-lg text-xs"
                          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                        >
                          Trước
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={examPage >= totalExamPages - 1}
                          onClick={() => setExamPage((p) => Math.min(totalExamPages - 1, p + 1))}
                          className="h-7 px-2.5 rounded-lg text-xs"
                          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                          Sau
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Questions Toolbar: Select All & Count */}
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Danh sách câu hỏi AI ({reviewQuestions.length} câu)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="rounded-xl text-xs flex items-center gap-1.5 h-8 px-3"
              >
                {selectedQuestionIndices.size === reviewQuestions.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    Bỏ chọn tất cả
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-zinc-400" />
                    Chọn tất cả ({reviewQuestions.length})
                  </>
                )}
              </Button>
            </div>

            {/* Questions List */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {reviewQuestions.map((question, index) => {
                const isSelected = selectedQuestionIndices.has(index);
                const isExpanded = expandedIndices.has(index);
                const isEditing = editingIndex === index;

                return (
                  <div
                    key={index}
                    className={`rounded-xl border transition-all ${
                      isSelected
                        ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/10'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 opacity-75'
                    }`}
                  >
                    {/* Header item */}
                    <div className="p-3.5 flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleQuestionSelection(index)}
                        className="mt-0.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>

                      {/* Question Content & Badges */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            Câu {index + 1}:
                          </span>

                          {/* Type badge */}
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                            {question.questionType === 'SINGLE_CHOICE' && 'Trắc nghiệm 1 đáp án'}
                            {question.questionType === 'MULTIPLE_CHOICE' && 'Nhiều đáp án'}
                            {question.questionType === 'NUMERIC' && 'Điền số (Numeric)'}
                            {question.questionType === 'ESSAY_TEXT' && 'Tự luận (Essay)'}
                          </span>

                          {/* Points */}
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                            {question.points || 1.0} điểm
                          </span>

                          {/* Difficulty */}
                          {question.difficulty && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              {question.difficulty === 'EASY'
                                ? 'Dễ'
                                : question.difficulty === 'HARD'
                                ? 'Khó'
                                : 'Trung bình'}
                            </span>
                          )}
                        </div>

                        {/* Content (Inline Edit or Preview) */}
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
                                className="text-[11px] h-7 px-2.5 rounded-lg"
                              >
                                Hủy
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => saveEditedQuestion(index)}
                                className="text-[11px] h-7 px-2.5 rounded-lg bg-indigo-600 text-white"
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

                      {/* Actions: Edit & Expand */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEditingQuestion(index, question.content)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            title="Sửa nội dung câu hỏi"
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
                          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details: Options / Rubric / Explanation */}
                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
                        {/* Options if choice-based */}
                        {question.options && question.options.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                              Đáp án lựa chọn:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {question.options.map((opt, optIdx) => (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                                    opt.isCorrect
                                      ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                                      : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                                  }`}
                                >
                                  {opt.isCorrect ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border border-zinc-400 flex-shrink-0 mt-0.5" />
                                  )}
                                  <span className="leading-relaxed">{opt.content}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Essay Sample Answer & Rubric */}
                        {question.questionType === 'ESSAY_TEXT' && (
                          <div className="space-y-2 pt-1 text-xs">
                            {question.sampleAnswer && (
                              <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300">
                                <span className="font-bold">Gợi ý trả lời / Đáp án mẫu:</span>
                                <p className="mt-1 leading-relaxed whitespace-pre-wrap">
                                  {question.sampleAnswer}
                                </p>
                              </div>
                            )}
                            {question.gradingRubric && (
                              <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300">
                                <span className="font-bold">Tiêu chí chấm điểm (Rubric):</span>
                                <p className="mt-1 leading-relaxed whitespace-pre-wrap">
                                  {question.gradingRubric}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Explanation */}
                        {question.explanation && (
                          <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 text-xs">
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
    </div>
  );
}
