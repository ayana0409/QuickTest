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
  Layers,
  AlertTriangle,
  Radio,
  BarChart3,
  FileEdit,
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
import { connectWebSocket, subscribeTopic, disconnectWebSocket } from '@/lib/socket';
import type {
  AttemptMonitorItem,
  CandidateViolationEvent,
} from '@/types/proctoring';
import type { ExamDetailResponse, AttemptStatus } from '@/types/exam';
import type { StompSubscription } from '@stomp/stompjs';
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

  // Handle switching sub-tabs and updating query param in URL
  const handleSwitchSubTab = (newTab: 'live' | 'attempts') => {
    setActiveSubTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', newTab);
    window.history.replaceState({}, '', url.toString());
  };

  // Monitoring data state
  const [candidates, setCandidates] = useState<AttemptMonitorItem[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // WebSocket & Live Feed state
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [violationEvents, setViolationEvents] = useState<CandidateViolationEvent[]>([]);
  const subscriptionRef = useRef<StompSubscription | null>(null);

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
      toast.error('Unable to retrieve exam information.');
    } finally {
      setLoadingExam(false);
    }
  }, [examId]);

  // Fetch Monitoring Candidate List
  const fetchCandidates = useCallback(async () => {
    if (!examId) return;
    try {
      setLoadingCandidates(true);
      const apiStatus =
        statusFilter !== 'ALL' &&
        statusFilter !== 'VIOLATION'
          ? (statusFilter as AttemptStatus)
          : undefined;

      const response = await teacherProctoringService.getExamMonitoring(examId, {
        status: apiStatus,
        search: searchQuery.trim() || undefined,
        size: 100, // Fetch top 100 for live dashboard
      });

      setCandidates(response.content || []);
    } catch (err) {
      console.error('Failed to fetch exam monitoring data:', err);
      toast.error('Failed to load candidate monitoring data.');
    } finally {
      setLoadingCandidates(false);
    }
  }, [examId, statusFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchExamDetail();
  }, [fetchExamDetail]);

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

  // Set up WebSocket connection
  useEffect(() => {
    if (!examId) return;

    let mounted = true;

    connectWebSocket(
      null,
      () => {
        if (!mounted) return;
        setIsWsConnected(true);

        // Subscribe to teacher monitoring room
        const destination = `/topic/exams/${examId}/proctoring`;
        const sub = subscribeTopic(destination, (message) => {
          try {
            const eventPayload: CandidateViolationEvent = JSON.parse(message.body);
            handleLiveViolationEvent(eventPayload);
          } catch (err) {
            console.error('Error parsing live proctoring event:', err);
          }
        });

        subscriptionRef.current = sub;
      },
      (err) => {
        if (!mounted) return;
        console.warn('STOMP connection error:', err);
        setIsWsConnected(false);
      }
    );

    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe();
        } catch {
          // ignore
        }
        subscriptionRef.current = null;
      }
    };
  }, [examId, handleLiveViolationEvent]);

  // Copy access code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('Access code copied to clipboard!');
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

      // Refresh list in background
      fetchCandidates();
    } catch (err) {
      console.error('Failed to disqualify candidate:', err);
    } finally {
      setIsDisqualifying(false);
    }
  };

  // Compute Statistics
  const stats: ProctoringStats = React.useMemo(() => {
    const total = candidates.length;
    let online = 0;
    let inProgress = 0;
    let withViolations = 0;
    let disqualified = 0;
    let submitted = 0;

    candidates.forEach((c) => {
      if (c.isOnline) online++;
      if (c.status === 'IN_PROGRESS') inProgress++;
      if (c.violationCount > 0) withViolations++;
      if (c.status === 'DISQUALIFIED' || c.isDisqualified) disqualified++;
      if (c.status === 'SUBMITTED' || c.status === 'COMPLETED') submitted++;
    });

    return { total, online, inProgress, withViolations, disqualified, submitted };
  }, [candidates]);

  // Filter candidates locally for responsive UI
  const filteredCandidates = React.useMemo(() => {
    return candidates.filter((c) => {
      // Search matching
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = c.candidateName?.toLowerCase().includes(query);
        const matchesId = c.candidateIdentifier?.toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }

      // Status pill filter
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'VIOLATION') return c.violationCount > 0;
      if (statusFilter === 'ONLINE') return c.isOnline;
      return c.status === statusFilter;
    });
  }, [candidates, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Header Bar */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/teacher/exams">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                className="rounded-xl"
              >
                Back to Exams
              </Button>
            </Link>

            <Link href={`/teacher/exams/${examId}/edit`}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileEdit className="w-4 h-4" />}
                className="rounded-xl"
                title="Soạn thảo câu hỏi & Cài đặt thông số đề thi"
              >
                Soạn đề & Cài đặt
              </Button>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {loadingExam ? 'Loading Exam...' : exam?.title || 'Phòng thi & Kết quả'}
                </h1>

                {exam?.status && (
                  <Badge variant={exam.status} size="sm">
                    {exam.status}
                  </Badge>
                )}

                {exam?.isProctoringEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/50">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Shield Active</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    Proctoring Off
                  </span>
                )}
              </div>

              {/* Subtitle details */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                {exam?.accessCode && (
                  <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                      Code: {exam.accessCode}
                    </span>
                    <button
                      onClick={() => handleCopyCode(exam.accessCode)}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ml-1"
                      title="Copy access code"
                    >
                      {copiedCode ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}

                {exam?.durationMinutes && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{exam.durationMinutes} minutes</span>
                  </div>
                )}

                {exam?.maxViolations && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Limit: {exam.maxViolations} violations</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Live Controls */}
          <div className="flex items-center gap-2.5">
            {/* WebSocket connection badge */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                isWsConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  isWsConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-rose-500'
                )}
              />
              {isWsConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Telemetry Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Connecting...</span>
                </>
              )}
            </div>

            {/* Sound alert toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="rounded-xl px-2.5"
              title={soundEnabled ? 'Mute alert sound' : 'Enable alert sound'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-400" />
              )}
            </Button>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCandidates()}
              isLoading={loadingCandidates}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="rounded-xl"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Unified Operations Sub-tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => handleSwitchSubTab('live')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all',
            activeSubTab === 'live'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'
          )}
        >
          <Radio
            className={cn(
              'w-4 h-4',
              activeSubTab === 'live' && 'text-emerald-300 animate-pulse'
            )}
          />
          <span>Giám sát trực tiếp (Live Monitor)</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-bold',
              activeSubTab === 'live'
                ? 'bg-white/20 text-white'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            )}
          >
            {stats.online > 0 ? stats.online : stats.inProgress}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchSubTab('attempts')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all',
            activeSubTab === 'attempts'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Danh sách bài thi & Kết quả (Attempts & Grading)</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-bold',
              activeSubTab === 'attempts'
                ? 'bg-white/20 text-white'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
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
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate by name, identifier, email..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {[
                { id: 'ALL', label: 'All Candidates' },
                { id: 'IN_PROGRESS', label: 'In Progress' },
                { id: 'VIOLATION', label: 'With Violations' },
                { id: 'ONLINE', label: 'Online Only' },
                { id: 'SUBMITTED', label: 'Submitted' },
                { id: 'DISQUALIFIED', label: 'Disqualified' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                    statusFilter === tab.id
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-lg text-xs transition-colors',
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                )}
                title="Grid Monitor View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-1.5 rounded-lg text-xs transition-colors',
                  viewMode === 'table'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                )}
                title="Table Data View"
              >
                <List className="w-4 h-4" />
              </button>
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
                No candidates match the current filter
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                Try clearing the search query or switching your status filter to &quot;All
                Candidates&quot;.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="mt-4 rounded-xl"
              >
                Reset Filters
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
