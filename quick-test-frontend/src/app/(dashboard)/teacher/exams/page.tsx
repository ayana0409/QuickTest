'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  BookOpen,
  Clock,
  Layers,
  FileEdit,
  Trash2,
  Copy,
  Check,
  Globe,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Card, CardContent } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { useAuthStore } from '@/stores/authStore';
import { examService } from '@/services/exam.service';
import { connectWebSocket, subscribeTopic } from '@/lib/socket';
import { formatDateTime, formatDateTimeForPayload } from '@/lib/utils';
import type { ExamSummaryResponse, ExamStatus, PageResponse } from '@/types/exam';
import toast from 'react-hot-toast';

export default function TeacherExamsPage() {
  const router = useRouter();
  const { isAuthenticated, user, token } = useAuthStore();

  const [exams, setExams] = useState<ExamSummaryResponse[]>([]);
  const [pageMeta, setPageMeta] = useState<PageResponse<ExamSummaryResponse> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExamStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals & Action States
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamSummaryResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Republish Modal States
  const [republishTarget, setRepublishTarget] = useState<ExamSummaryResponse | null>(null);
  const [republishEndTime, setRepublishEndTime] = useState<string>('');
  const [republishStartTime, setRepublishStartTime] = useState<string>('');
  const [republishDuration, setRepublishDuration] = useState<number>(45);
  const [isRepublishing, setIsRepublishing] = useState(false);

  // Duplicate Modal States
  const [duplicateTarget, setDuplicateTarget] = useState<ExamSummaryResponse | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState<string>('');
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Fetch exams from real backend API
  const fetchExams = useCallback(
    async (pageIndex = 0) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await examService.getTeacherExams({
          page: pageIndex,
          size: pageSize,
          sort: 'createdAt,desc',
        });
        setExams(res.content || []);
        setPageMeta(res);
        setCurrentPage(pageIndex);
      } catch (err: any) {
        console.error('Failed to fetch exams from backend:', err);
        setLoadError(err?.response?.data?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchExams(0);
  }, [isAuthenticated, router, fetchExams]);

  // Copy access code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã đề: ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Publish exam directly
  const handlePublishExam = async (exam: ExamSummaryResponse) => {
    if (exam.totalQuestions === 0) {
      toast.error('Đề thi chưa có câu hỏi nào. Vui lòng vào Soạn thảo để thêm câu hỏi trước.');
      router.push(`/teacher/exams/${exam.id}/edit`);
      return;
    }

    setActionInProgressId(exam.id);
    try {
      await examService.publishExam(exam.id);
      fetchExams(currentPage);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setActionInProgressId(null);
    }
  };

  // Close exam directly
  const handleCloseExam = async (exam: ExamSummaryResponse) => {
    setActionInProgressId(exam.id);
    try {
      await examService.closeExam(exam.id);
      fetchExams(currentPage);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setActionInProgressId(null);
    }
  };

  // Open modal to configure and republish a closed exam
  const handleOpenRepublishModal = (exam: ExamSummaryResponse) => {
    setRepublishTarget(exam);
    setRepublishDuration(exam.durationMinutes || 45);

    // Suggest new end time 24 hours from now
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTomorrow = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setRepublishEndTime(localISOTomorrow);

    const now = new Date();
    const localISONow = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setRepublishStartTime(localISONow);
  };

  // Confirm republish exam with updated schedule
  const handleConfirmRepublish = async () => {
    if (!republishTarget) return;

    if (republishEndTime) {
      const endTimestamp = new Date(republishEndTime).getTime();
      if (endTimestamp <= Date.now()) {
        toast.error('Thời gian kết thúc phải sau thời điểm hiện tại.');
        return;
      }
    }

    setIsRepublishing(true);
    try {
      await examService.republishExam(republishTarget.id, {
        startTime: republishStartTime ? formatDateTimeForPayload(republishStartTime) : null,
        endTime: republishEndTime ? formatDateTimeForPayload(republishEndTime) : null,
        durationMinutes: Number(republishDuration) || undefined,
      });
      setRepublishTarget(null);
      fetchExams(currentPage);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsRepublishing(false);
    }
  };

  // Open modal to duplicate an exam
  const handleOpenDuplicateModal = (exam: ExamSummaryResponse) => {
    setDuplicateTarget(exam);
    const titleBase = exam.title.replace(/^\[Bản sao\]\s*/, '');
    setDuplicateTitle(`[Bản sao] ${titleBase}`);
  };

  // Confirm exam duplication
  const handleConfirmDuplicate = async () => {
    if (!duplicateTarget) return;
    setIsDuplicating(true);
    try {
      await examService.duplicateExam(duplicateTarget.id, {
        title: duplicateTitle.trim() || undefined,
      });
      setDuplicateTarget(null);
      fetchExams(currentPage);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsDuplicating(false);
    }
  };

  // Stable refs for fetchExams and currentPage to prevent unnecessary re-subscribing
  const fetchExamsRef = useRef(fetchExams);
  useEffect(() => {
    fetchExamsRef.current = fetchExams;
  }, [fetchExams]);

  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Real-time WebSocket listener for completed background image duplication
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let isMounted = true;
    let sub: any = null;

    connectWebSocket(token, () => {
      if (!isMounted) return;
      if (sub) {
        sub.unsubscribe();
        sub = null;
      }
      sub = subscribeTopic(`/topic/teachers/${user.id}/notifications`, (message) => {
        try {
          const payload = JSON.parse(message.body);
          if (payload.type === 'EXAM_CLONED') {
            const toastKey = payload.examId ? `exam-cloned-${payload.examId}` : 'exam-cloned';
            toast.success(payload.message || 'Đề thi đã được nhân bản hoàn tất!', {
              id: toastKey,
            });
            fetchExamsRef.current(currentPageRef.current);
          }
        } catch (e) {
          console.error('Failed to parse teacher notification payload:', e);
        }
      });
    });

    return () => {
      isMounted = false;
      if (sub) {
        sub.unsubscribe();
        sub = null;
      }
    };
  }, [isAuthenticated, user?.id, token]);

  // Delete draft exam
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await examService.deleteExam(deleteTarget.id);
      setDeleteTarget(null);
      fetchExams(currentPage);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsDeleting(false);
    }
  };

  // Client side filtering for active search and status
  const filteredExams = exams.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.accessCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Quản trị Đề thi
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Thiết kế, xuất bản và theo dõi các bài thi trắc nghiệm & tự luận
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/teacher/grading">
            <Button variant="outline" size="sm">
              Chấm bài tự luận
            </Button>
          </Link>
          <Link href="/teacher/exams/create">
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Tạo đề thi mới
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo tiêu đề hoặc mã đề thi..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'DRAFT', 'PUBLISHED', 'CLOSED'] as const).map((status) => {
            const isSelected = statusFilter === status;
            const labels = {
              ALL: 'Tất cả',
              DRAFT: 'Bản nháp',
              PUBLISHED: 'Đang mở',
              CLOSED: 'Đã đóng',
            };

            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {labels[status]}
              </button>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchExams(currentPage)}
            className="h-8 px-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 ml-1"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {loadError ? (
        <div className="p-8 text-center rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="font-semibold text-rose-900 dark:text-rose-300 text-base">
            Không thể tải danh sách đề thi
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-400 max-w-md mx-auto">
            {loadError}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchExams(currentPage)}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Thử lại
          </Button>
        </div>
      ) : isLoading ? (
        /* Skeleton Table Loading */
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 animate-pulse flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2.5 flex-1">
                <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                <div className="flex gap-3">
                  <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-20" />
                  <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-28" />
                  <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-20" />
                <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredExams.length === 0 ? (
        /* Empty State */
        <div className="p-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-900/60">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-1">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Không có đề thi phù hợp với bộ lọc'
              : 'Chưa có đề thi nào'}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-6">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn trạng thái đã lọc.'
              : 'Bắt đầu khởi tạo kỳ thi đầu tiên để gửi mã thi cho học sinh của bạn.'}
          </p>
          <Link href="/teacher/exams/create">
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Tạo đề thi mới ngay
            </Button>
          </Link>
        </div>
      ) : (
        /* Responsive Data Table / List */
        <div className="space-y-3">
          {filteredExams.map((exam) => {
            const isDraft = exam.status === 'DRAFT';
            const isPublished = exam.status === 'PUBLISHED';
            const isActionBusy = actionInProgressId === exam.id;

            return (
              <div
                key={exam.id}
                className="group p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info column */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={exam.status} size="sm" dot>
                      {exam.status === 'PUBLISHED'
                        ? 'Đang mở'
                        : exam.status === 'CLOSED'
                        ? 'Đã đóng'
                        : 'Bản nháp'}
                    </Badge>

                    {/* Access code 1-click copy */}
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span>Mã:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400">
                        {exam.accessCode}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(exam.accessCode)}
                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        title="Sao chép mã đề"
                      >
                        {copiedCode === exam.accessCode ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    <Link href={`/teacher/exams/${exam.id}/edit`}>
                      {exam.title}
                    </Link>
                  </h3>

                  {/* Metadata line */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{exam.durationMinutes} phút</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>
                        {exam.totalQuestions} câu hỏi ({exam.totalPoints} điểm)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>Tạo: {formatDateTime(exam.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Right actions column */}
                <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
                  <Link href={`/teacher/exams/${exam.id}/edit`}>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<FileEdit className="w-3.5 h-3.5" />}
                    >
                      Soạn đề & Cài đặt
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDuplicateModal(exam)}
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    title="Nhân bản đề thi này sang bản nháp mới"
                  >
                    Nhân bản
                  </Button>

                  {isDraft && (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        isLoading={isActionBusy}
                        onClick={() => handlePublishExam(exam)}
                        leftIcon={<Globe className="w-3.5 h-3.5" />}
                        title="Xuất bản để thí sinh có thể làm bài"
                      >
                        Xuất bản
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={() => setDeleteTarget(exam)}
                        title="Xóa đề nháp"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}

                  {isPublished && (
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={isActionBusy}
                      onClick={() => handleCloseExam(exam)}
                      leftIcon={<Lock className="w-3.5 h-3.5" />}
                      title="Đóng kỳ thi"
                    >
                      Đóng đề
                    </Button>
                  )}

                  {exam.status === 'CLOSED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      onClick={() => handleOpenRepublishModal(exam)}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                      title="Mở lại đề thi cho đợt thi mới"
                    >
                      Mở lại đề
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {pageMeta && pageMeta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 px-2">
              <span className="text-xs text-zinc-500">
                Hiển thị trang {pageMeta.page + 1} / {pageMeta.totalPages} ({pageMeta.totalElements} đề thi)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageMeta.isFirst}
                  onClick={() => fetchExams(currentPage - 1)}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageMeta.isLast}
                  onClick={() => fetchExams(currentPage + 1)}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Draft Exam Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xóa đề thi bản nháp"
        description="Thao tác này sẽ gỡ bỏ hoàn toàn đề thi và các câu hỏi đã soạn."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={handleDeleteConfirm}
            >
              Xác nhận xóa
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Bạn có chắc chắn muốn xóa đề thi <strong>&quot;{deleteTarget?.title}&quot;</strong>?
        </p>
      </Modal>

      {/* Republish Closed Exam Modal */}
      <Modal
        isOpen={!!republishTarget}
        onClose={() => setRepublishTarget(null)}
        title="Mở lại Đề thi (Republish)"
        description="Cho phép thí sinh tiếp tục tham gia làm bài thi với mã đề hiện tại."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setRepublishTarget(null)}
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
              Đề thi: <strong className="text-zinc-900 dark:text-zinc-100">{republishTarget?.title}</strong>
            </p>
            <p>
              Mã phòng thi: <strong className="text-indigo-600 dark:text-indigo-400">{republishTarget?.accessCode}</strong>
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
        isOpen={!!duplicateTarget}
        onClose={() => !isDuplicating && setDuplicateTarget(null)}
        title="Nhân bản Đề thi"
        description="Tạo một đề thi bản nháp mới kế thừa toàn bộ câu hỏi, đáp án và hình ảnh minh họa."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDuplicateTarget(null)}
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
