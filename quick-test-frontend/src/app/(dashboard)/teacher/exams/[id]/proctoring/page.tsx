'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Radio,
  BarChart3,
  FileEdit,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import {
  ProctoringMetricCards,
  type ProctoringStats,
  LiveViolationStream,
  CandidateMonitorCard,
  CandidateMonitorTable,
  CandidateDetailModal,
  DisqualifyConfirmModal,
} from '@/components/proctoring';
import { ExamAttemptsTab } from '@/components/exam/ExamAttemptsTab';
import { teacherProctoringService } from '@/services/teacherProctoring.service';
import { examService } from '@/services/exam.service';
import { gradingService, type ExamAttemptStatsDto } from '@/services/grading.service';
import { formatExamStatus } from '@/lib/formatters/statusFormatter';
import { ProctoringRealtimeManager } from '@/lib/realtime/ProctoringRealtimeManager';
import type {
  AttemptMonitorItem,
  CandidateViolationEvent,
  ProctoringEvent,
  RealtimeConnectionStatus,
} from '@/types/proctoring';
import type { ExamDetailResponse, AttemptStatus } from '@/types/exam';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/**
 * Synthetic Web Audio API notification chime for real-time violation alerts.
 */
function playViolationChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.28);
  } catch {
    // Audio play might be restricted before initial user gesture
  }
}

/**
 * Teacher Live Proctoring Command Dashboard.
 * Provides real-time candidate telemetry, live violation feeds via WebSocket STOMP,
 * candidate inspection, and manual disqualification actions.
 */
export default function TeacherLiveProctoringPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = params?.id as string;
  const urlTab = searchParams.get('tab');

  // Sub-tab state: 'live' proctoring or 'attempts' (submissions & grading)
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'attempts'>(
    urlTab === 'attempts' ? 'attempts' : 'live'
  );

  // Exam meta state
  const [exam, setExam] = useState<ExamDetailResponse | null>(null);
  const [loadingExam, setLoadingExam] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Synchronize active sub-tab with URL query parameter or exam status
  useEffect(() => {
    if (urlTab === 'attempts' || urlTab === 'live') {
      setActiveSubTab(urlTab);
    } else if (exam && !urlTab) {
      if (exam.status === 'CLOSED') {
        setActiveSubTab('attempts');
      } else {
        setActiveSubTab('live');
      }
    }
  }, [exam, urlTab]);

  // Monitoring data state
  const [candidates, setCandidates] = useState<AttemptMonitorItem[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Overall Exam Stats
  const [examStats, setExamStats] = useState<ExamAttemptStatsDto | null>(null);

  // Pagination & Sorting state
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(24);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCandidates, setTotalCandidates] = useState<number>(0);
  const [sortOption, setSortOption] = useState<string>('violationCount,desc');

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(0);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // WebSocket & Live Feed state
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>('CONNECTING');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [violationEvents, setViolationEvents] = useState<CandidateViolationEvent[]>([]);

  // Inspector & Disqualify Modals
  const [inspectAttemptId, setInspectAttemptId] = useState<string | null>(null);
  const [disqualifyCandidate, setDisqualifyCandidate] =
    useState<AttemptMonitorItem | null>(null);
  const [isDisqualifying, setIsDisqualifying] = useState<boolean>(false);

  // Fetch Exam Details
  const fetchExamDetail = useCallback(async () => {
    if (!examId) return;
    try {
      setLoadingExam(true);
      const data = await examService.getExamDetail(examId);
      setExam(data);
    } catch (err) {
      console.error('Failed to load exam details:', err);
    } finally {
      setLoadingExam(false);
    }
  }, [examId]);

  // Fetch Aggregated Exam Statistics across all attempts
  const fetchExamStats = useCallback(async () => {
    if (!examId) return;
    try {
      const data = await gradingService.getExamAttemptStats(examId);
      setExamStats(data);
    } catch (err) {
      console.error('Failed to load exam attempt stats:', err);
    }
  }, [examId]);

  // Fetch Monitoring Candidate List
  const fetchCandidates = useCallback(async () => {
    if (!examId) return;
    try {
      setLoadingCandidates(true);
      const isViolation = statusFilter === 'VIOLATION';
      const apiStatus =
        statusFilter !== 'ALL' &&
          statusFilter !== 'VIOLATION' &&
          statusFilter !== 'ONLINE'
          ? (statusFilter as AttemptStatus)
          : undefined;

      const response = await teacherProctoringService.getExamMonitoring(examId, {
        status: apiStatus,
        hasViolation: isViolation ? true : undefined,
        search: debouncedSearch || undefined,
        page: currentPage,
        size: pageSize,
        sort: sortOption,
      });

      setCandidates(response.content || []);
      setTotalPages(response.totalPages || 1);
      setTotalCandidates(response.totalElements || 0);
    } catch (err) {
      console.error('Failed to fetch exam monitoring data:', err);
    } finally {
      setLoadingCandidates(false);
    }
  }, [examId, statusFilter, debouncedSearch, currentPage, pageSize, sortOption]);

  // Handle switching sub-tabs, synchronizing stats, and updating query param in URL
  const handleSwitchSubTab = useCallback(
    (newTab: 'live' | 'attempts') => {
      setActiveSubTab(newTab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.replaceState({}, '', url.toString());

      // Instantly synchronize stats across tabs so header badges match the active view
      fetchExamStats();
      if (newTab === 'live') {
        fetchCandidates();
      }
    },
    [fetchExamStats, fetchCandidates]
  );

  // Initial load & periodic stats synchronization
  useEffect(() => {
    fetchExamDetail();
    fetchExamStats();

    // Auto-refresh stats every 15s for live dashboard accuracy
    const statsTimer = setInterval(() => {
      fetchExamStats();
    }, 15000);

    return () => clearInterval(statsTimer);
  }, [fetchExamDetail, fetchExamStats]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Handle incoming STOMP violation event
  const handleLiveViolationEvent = useCallback(
    (event: CandidateViolationEvent) => {
      // Append to live feed
      setViolationEvents((prev) => [event, ...prev.slice(0, 49)]);

      // Audio notification if enabled and instructor is in the live tab
      if (soundEnabled && activeSubTab === 'live') {
        playViolationChime();
      }

      // Update in-memory candidate status without waiting for network poll
      setCandidates((prev) =>
        prev.map((c) => {
          if (c.attemptId === event.attemptId) {
            return {
              ...c,
              violationCount: event.violationCount,
              status: event.disqualified ? 'DISQUALIFIED' : c.status,
              isDisqualified: event.disqualified || c.isDisqualified,
            };
          }
          return c;
        })
      );

      // Toast notification
      toast(
        (t) => (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-rose-600">Violation:</span>
            <span>{event.candidateName}</span>
            <span className="text-zinc-500">({event.violationType})</span>
          </div>
        ),
        {
          icon: '⚠️',
          duration: 4000,
        }
      );
    },
    [soundEnabled, activeSubTab]
  );

  // Set up Dual-layer Realtime Connection (QuickNotify Primary + STOMP Fallback)
  useEffect(() => {
    if (!examId) return;

    let mounted = true;
    let manager: ProctoringRealtimeManager | null = null;

    const setupConnection = async () => {
      try {
        const tokenRes = await teacherProctoringService.getRealtimeToken(examId);
        if (!mounted) return;

        manager = new ProctoringRealtimeManager({
          quickNotifyWsUrl:
            tokenRes.realtimeWsUrl ||
            tokenRes.wsUrl ||
            process.env.NEXT_PUBLIC_QUICKNOTIFY_WS_URL ||
            'ws://localhost:8080/ws',
          quickNotifyToken: tokenRes.realtimeToken || tokenRes.token || '',
          role: 'teacher',
          examId,
          onStatusChange: (status) => {
            if (mounted) setConnectionStatus(status);
          },
        });

        manager.subscribe((event: ProctoringEvent) => {
          if (event.eventType === 'CANDIDATE_VIOLATION') {
            const raw = event.data;
            const violationEvent: CandidateViolationEvent = {
              attemptId: raw.attemptId || event.attemptId || '',
              examId: raw.examId || examId,
              candidateName: raw.candidateName || 'Thí sinh',
              candidateIdentifier: raw.candidateIdentifier,
              violationType: raw.violationType || 'TAB_SWITCH',
              violationCount: raw.violationCount || 1,
              description: raw.description || raw.message || '',
              disqualified: Boolean(raw.disqualified),
              timestamp: raw.timestamp || event.timestamp || new Date().toISOString(),
            };
            handleLiveViolationEvent(violationEvent);
          }
        });

        manager.connect();
      } catch (err) {
        console.warn(
          '[TeacherLiveProctoring] Failed to fetch realtime token, launching STOMP fallback directly:',
          err
        );
        if (!mounted) return;

        manager = new ProctoringRealtimeManager({
          quickNotifyWsUrl: '',
          quickNotifyToken: '',
          role: 'teacher',
          examId,
          onStatusChange: (status) => {
            if (mounted) setConnectionStatus(status);
          },
        });

        manager.subscribe((event: ProctoringEvent) => {
          if (event.eventType === 'CANDIDATE_VIOLATION') {
            const raw = event.data;
            const violationEvent: CandidateViolationEvent = {
              attemptId: raw.attemptId || event.attemptId || '',
              examId: raw.examId || examId,
              candidateName: raw.candidateName || 'Thí sinh',
              candidateIdentifier: raw.candidateIdentifier,
              violationType: raw.violationType || 'TAB_SWITCH',
              violationCount: raw.violationCount || 1,
              description: raw.description || '',
              disqualified: Boolean(raw.disqualified),
              timestamp: raw.timestamp || event.timestamp || new Date().toISOString(),
            };
            handleLiveViolationEvent(violationEvent);
          }
        });

        manager.connect();
      }
    };

    setupConnection();

    return () => {
      mounted = false;
      manager?.disconnect();
    };
  }, [examId, handleLiveViolationEvent]);

  // Copy access code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('Đã sao chép mã phòng thi!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Manual Disqualification Action
  const handleConfirmDisqualify = async (attemptId: string, reason?: string) => {
    try {
      setIsDisqualifying(true);
      await teacherProctoringService.disqualifyAttempt(attemptId, { reason });
      setDisqualifyCandidate(null);

      // Update candidate locally
      setCandidates((prev) =>
        prev.map((c) =>
          c.attemptId === attemptId
            ? { ...c, status: 'DISQUALIFIED', isDisqualified: true }
            : c
        )
      );

      // Refresh list and stats in background
      fetchCandidates();
      fetchExamStats();
    } catch (err) {
      console.error('Failed to disqualify candidate:', err);
    } finally {
      setIsDisqualifying(false);
    }
  };

  // Compute Statistics
  const stats: ProctoringStats = React.useMemo(() => {
    // Priority: use aggregated database statistics from examStats for 100% accuracy across all candidates
    const baseTotal = examStats?.totalAttempts ?? totalCandidates;
    const submitted = examStats?.completedAttempts ?? 0;
    // Guaranteed consistency: Synchronize with live paginated totalElements when filtering by status
    const inProgress = Math.max(
      examStats?.inProgressAttempts ?? 0,
      statusFilter === 'IN_PROGRESS' ? totalCandidates : 0
    );
    const withViolations = Math.max(
      examStats?.attemptsWithViolations ?? 0,
      statusFilter === 'VIOLATION' ? totalCandidates : 0
    );
    const disqualified = Math.max(
      examStats?.disqualifiedAttempts ?? 0,
      statusFilter === 'DISQUALIFIED' ? totalCandidates : 0
    );
    const total = Math.max(baseTotal, inProgress + submitted + disqualified);

    let online = 0;
    candidates.forEach((c) => {
      if (c.isOnline) online++;
    });

    return { total, online, inProgress, withViolations, disqualified, submitted };
  }, [examStats, totalCandidates, candidates, statusFilter]);

  // Filter candidates locally for ephemeral online state
  const filteredCandidates = React.useMemo(() => {
    if (statusFilter === 'ONLINE') {
      return candidates.filter((c) => c.isOnline);
    }
    return candidates;
  }, [candidates, statusFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Header Bar */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href="/teacher/exams">
              <button
                type="button"
                className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Quay lại danh sách đề thi"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                  {loadingExam ? 'Đang tải đề thi...' : exam?.title || 'Phòng giám sát thi'}
                </h1>
                {exam?.status && (
                  <Badge variant={formatExamStatus(exam.status).variant} size="sm">
                    {formatExamStatus(exam.status).label}
                  </Badge>
                )}
                {exam?.accessCode && (
                  <button
                    type="button"
                    onClick={() => handleCopyCode(exam.accessCode)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    title="Sao chép mã phòng thi"
                  >
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{exam.accessCode}</span>
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                  </button>
                )}
              </div>

              {/* Subline */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {exam?.durationMinutes && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{exam.durationMinutes}&apos;</span>
                  </div>
                )}
                {exam?.isProctoringEnabled ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Giám sát AI bật</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-400">Giám sát AI tắt</span>
                )}
                {exam?.maxViolations && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">
                    Tối đa {exam.maxViolations} vi phạm
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Live Controls */}
          <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
            <Link href={`/teacher/exams/${examId}/edit`}>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                title="Soạn thảo & Cài đặt thông số"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chỉnh sửa</span>
              </button>
            </Link>

            {/* Sound alert toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              title={soundEnabled ? 'Tắt chuông cảnh báo' : 'Bật chuông cảnh báo'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => {
                fetchCandidates();
                fetchExamStats();
              }}
              disabled={loadingCandidates}
              className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400", loadingCandidates && "animate-spin text-indigo-500")} />
            </button>

            {/* Connection Signal */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all',
                connectionStatus === 'CONNECTED_PRIMARY'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400'
                  : connectionStatus === 'CONNECTED_FALLBACK'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-900/60 text-amber-700 dark:text-amber-400'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-900/60 text-sky-700 dark:text-sky-400'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-900/60 text-rose-700 dark:text-rose-400'
              )}
              title={
                connectionStatus === 'CONNECTED_PRIMARY'
                  ? 'Kết nối trực tiếp ổn định'
                  : connectionStatus === 'CONNECTED_FALLBACK'
                  ? 'Đang dùng đường truyền dự phòng'
                  : connectionStatus === 'CONNECTING'
                  ? 'Đang kết nối...'
                  : 'Mất kết nối mạng'
              }
            >
              <Wifi className="w-3 h-3" />
              <span className="text-[11px] hidden sm:inline">
                {connectionStatus === 'CONNECTED_PRIMARY'
                  ? 'Online'
                  : connectionStatus === 'CONNECTING'
                  ? 'Kết nối...'
                  : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Operations Sub-tabs: Apple Segmented Control */}
      <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 w-full sm:w-fit">
        <button
          type="button"
          onClick={() => handleSwitchSubTab('live')}
          className={cn(
            'flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all cursor-pointer',
            activeSubTab === 'live'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          )}
        >
          <Radio
            className={cn(
              'w-3.5 h-3.5',
              activeSubTab === 'live' ? 'text-emerald-500 animate-pulse' : 'text-zinc-400'
            )}
          />
          <span>Giám sát trực tiếp</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono',
              activeSubTab === 'live'
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
            )}
          >
            {stats.inProgress > 0 ? stats.inProgress : stats.online > 0 ? stats.online : stats.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchSubTab('attempts')}
          className={cn(
            'flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all cursor-pointer',
            activeSubTab === 'attempts'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          )}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Danh sách bài thi</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono',
              activeSubTab === 'attempts'
                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
            )}
          >
            {stats.total}
          </span>
        </button>
      </div>

      {/* Sub-tab 1: Live Monitor & Telemetry */}
      {activeSubTab === 'live' && (
        <div className="space-y-6">
          {/* Real-time Ticker / Stream */}
          <LiveViolationStream
            events={violationEvents}
            onInspectCandidate={(attId) => setInspectAttemptId(attId)}
            onClearStream={() => setViolationEvents([])}
          />

          {/* KPI Metric Summary Cards */}
          <ProctoringMetricCards
            stats={stats}
            activeFilter={statusFilter}
            onSelectFilter={(newFilter) => setStatusFilter(newFilter)}
          />

          {/* Filter and View Mode Toolbar */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-auto md:flex-1 md:max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Tìm kiếm theo tên hoặc mã thí sinh..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full md:w-auto">
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'IN_PROGRESS', label: 'Đang thi' },
                { id: 'VIOLATION', label: 'Vi phạm' },
                { id: 'ONLINE', label: 'Trực tuyến' },
                { id: 'SUBMITTED', label: 'Đã nộp' },
                { id: 'DISQUALIFIED', label: 'Đình chỉ' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(0);
                  }}
                  className={cn(
                    'px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer',
                    statusFilter === tab.id
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Selector + View Mode Toggle combined into one row */}
            <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto pt-1 md:pt-0 md:pl-2 md:border-l md:border-zinc-200 md:dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Sắp xếp:</span>
                <select
                  value={sortOption}
                  onChange={(e) => {
                    setSortOption(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="px-2.5 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="violationCount,desc">Vi phạm nhiều nhất</option>
                  <option value="startTime,desc">Thời gian mới nhất</option>
                  <option value="startTime,asc">Thời gian cũ nhất</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-1.5 rounded-lg text-xs transition-colors cursor-pointer',
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                  )}
                  title="Xem dạng thẻ lưới"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'p-1.5 rounded-lg text-xs transition-colors cursor-pointer',
                    viewMode === 'table'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                  )}
                  title="Xem dạng danh sách bảng"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Candidate Monitoring Grid / Table View */}
          {loadingCandidates && candidates.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse border border-zinc-200 dark:border-zinc-800"
                />
              ))}
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50">
              <ShieldAlert className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Không có thí sinh nào phù hợp với bộ lọc hiện tại
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setCurrentPage(0);
                }}
                className="mt-4 rounded-xl"
              >
                Xóa bộ lọc
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCandidates.map((candidate) => (
                <CandidateMonitorCard
                  key={candidate.attemptId}
                  candidate={candidate}
                  maxViolations={exam?.maxViolations || 3}
                  onInspect={(id) => setInspectAttemptId(id)}
                  onDisqualify={(cand) => setDisqualifyCandidate(cand)}
                />
              ))}
            </div>
          ) : (
            <CandidateMonitorTable
              candidates={filteredCandidates}
              maxViolations={exam?.maxViolations || 3}
              onInspect={(id) => setInspectAttemptId(id)}
              onDisqualify={(cand) => setDisqualifyCandidate(cand)}
            />
          )}

          {/* Pagination Controls */}
          {totalCandidates > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  Đang hiển thị{' '}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {candidates.length > 0 ? currentPage * pageSize + 1 : 0}
                  </span>{' '}
                  -{' '}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {Math.min((currentPage + 1) * pageSize, totalCandidates)}
                  </span>{' '}
                  trong tổng số{' '}
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {totalCandidates.toLocaleString('vi-VN')}
                  </span>{' '}
                  thí sinh
                </div>

                <div className="flex items-center gap-1.5 pl-3 border-l border-zinc-200 dark:border-zinc-800">
                  <span>Hiển thị:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(0);
                    }}
                    className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value={12}>12 / trang</option>
                    <option value={24}>24 / trang</option>
                    <option value={48}>48 / trang</option>
                    <option value={100}>100 / trang</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 0 || loadingCandidates}
                  onClick={() => setCurrentPage(0)}
                  className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 transition-colors"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage === 0 || loadingCandidates}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 transition-colors"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i)
                    .filter((p) => {
                      if (totalPages <= 7) return true;
                      if (p === 0 || p === totalPages - 1) return true;
                      return Math.abs(p - currentPage) <= 1;
                    })
                    .map((p, idx, arr) => {
                      const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsisBefore && (
                            <span className="px-1 text-zinc-400">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${currentPage === p
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              }`}
                          >
                            {p + 1}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages - 1 || loadingCandidates}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 transition-colors"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages - 1 || loadingCandidates}
                  onClick={() => setCurrentPage(totalPages - 1)}
                  className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 transition-colors"
                  title="Trang cuối"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 2: Attempts, Grading & Evaluation */}
      {activeSubTab === 'attempts' && exam && (
        <div className="pt-2">
          <ExamAttemptsTab
            examId={exam.id}
            totalPoints={exam.totalPoints}
          />
        </div>
      )}

      {/* Candidate Telemetry Inspector Modal */}
      <CandidateDetailModal
        isOpen={!!inspectAttemptId}
        attemptId={inspectAttemptId}
        maxViolations={exam?.maxViolations || 3}
        onClose={() => setInspectAttemptId(null)}
        onDisqualifyClick={(attId, name) => {
          const cand = candidates.find((c) => c.attemptId === attId);
          if (cand) {
            setDisqualifyCandidate(cand);
          } else {
            setDisqualifyCandidate({
              attemptId: attId,
              candidateName: name,
            } as AttemptMonitorItem);
          }
        }}
      />

      {/* Disqualify Confirmation Modal */}
      <DisqualifyConfirmModal
        isOpen={!!disqualifyCandidate}
        attemptId={disqualifyCandidate?.attemptId || null}
        candidateName={disqualifyCandidate?.candidateName}
        isLoading={isDisqualifying}
        onClose={() => setDisqualifyCandidate(null)}
        onConfirm={handleConfirmDisqualify}
      />
    </div>
  );
}
