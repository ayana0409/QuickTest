'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Plus,
  Key,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Zap,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  PlayCircle,
  X,
  Sliders,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import {
  aiManagementService,
  AiSystemStatusResponse,
  AiKeyResponse,
  AiSlotMetricDto,
  AiModelCreateRequest,
  AiKeyCreateRequest,
  AiKeyUpdateRequest,
} from '@/services/aiManagementService';
import toast from 'react-hot-toast';

// Suggested fast preset models for Google Gemini
const SUGGESTED_MODELS = [
  { name: 'gemini-2.5-flash-lite', rpm: 15, tpm: 1000000 },
  { name: 'gemini-2.0-flash-lite', rpm: 15, tpm: 1000000 },
  { name: 'gemini-1.5-flash', rpm: 15, tpm: 1000000 },
];

export default function AdminAiDashboardPage() {
  const [activeTab, setActiveTab] = useState<'metrics' | 'keys'>('metrics');
  const [status, setStatus] = useState<AiSystemStatusResponse | null>(null);
  const [keysList, setKeysList] = useState<AiKeyResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isReloadingPool, setIsReloadingPool] = useState<boolean>(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Key Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingKey, setEditingKey] = useState<AiKeyResponse | null>(null);
  const [keyFormData, setKeyFormData] = useState<{
    name: string;
    apiKey: string;
    provider: string;
    isActive: boolean;
    orderIndex: number;
    models: AiModelCreateRequest[];
  }>({
    name: '',
    apiKey: '',
    provider: 'GEMINI',
    isActive: true,
    orderIndex: 0,
    models: [
      { modelName: 'gemini-2.5-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 0 },
      { modelName: 'gemini-2.0-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 1 },
    ],
  });
  const [showRawKey, setShowRawKey] = useState<boolean>(false);

  // Delete Confirm Modal State
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [isCancellingJob, setIsCancellingJob] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);

  // Fetch status metrics from Redis (super lightweight, no direct DB bottleneck)
  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const statusRes = await aiManagementService.getSystemStatus(silent);
      if (isMountedRef.current) {
        setStatus(statusRes);
      }
    } catch (err) {
      console.error('Failed to fetch AI system status', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Fetch keys list from Database (called on mount, tab switch, or mutations)
  const fetchKeys = useCallback(async () => {
    try {
      const keysRes = await aiManagementService.getAllKeys();
      if (isMountedRef.current) {
        setKeysList(keysRes);
      }
    } catch (err) {
      console.error('Failed to fetch AI keys list', err);
    }
  }, []);

  const fetchAll = useCallback(async (silent = false) => {
    await Promise.all([fetchStatus(silent), fetchKeys()]);
  }, [fetchStatus, fetchKeys]);

  // Initial load: fetch status and keys, setup 10-second polling for live metrics
  useEffect(() => {
    isMountedRef.current = true;
    fetchAll(false);

    const intervalId = setInterval(() => {
      fetchStatus(true);
    }, 10000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchAll, fetchStatus]);

  // Refresh keys when switching to keys tab
  useEffect(() => {
    if (activeTab === 'keys') {
      fetchKeys();
    }
  }, [activeTab, fetchKeys]);

  // Handle synchronization of keys from DB to memory pool
  const handleReloadPool = async () => {
    try {
      setIsReloadingPool(true);
      await aiManagementService.reloadPool();
      toast.success('Đã đồng bộ lại bộ nhớ đệm AI!');
      await fetchAll(true);
    } catch {
      // Error handled by global Axios interceptor
    } finally {
      setIsReloadingPool(false);
    }
  };

  // Open Modal for Create Key
  const handleOpenCreateModal = () => {
    setEditingKey(null);
    setKeyFormData({
      name: `Khóa Gemini #${keysList.length + 1}`,
      apiKey: '',
      provider: 'GEMINI',
      isActive: true,
      orderIndex: keysList.length,
      models: [
        { modelName: 'gemini-2.5-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 0 },
        { modelName: 'gemini-2.0-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 1 },
      ],
    });
    setShowRawKey(false);
    setIsModalOpen(true);
  };

  // Open Modal for Edit Key
  const handleOpenEditModal = (key: AiKeyResponse) => {
    setEditingKey(key);
    setKeyFormData({
      name: key.name,
      apiKey: '', // Empty unless updated
      provider: key.provider,
      isActive: key.isActive,
      orderIndex: key.orderIndex,
      models: key.models.map((m, idx) => ({
        modelName: m.modelName,
        rpm: m.rpm,
        tpm: m.tpm,
        isActive: m.isActive,
        orderIndex: m.orderIndex ?? idx,
      })),
    });
    setShowRawKey(false);
    setIsModalOpen(true);
  };

  // Save Key Form Submission
  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyFormData.name.trim()) {
      toast.error('Vui lòng nhập tên cho Khóa!');
      return;
    }
    if (!editingKey && !keyFormData.apiKey.trim()) {
      toast.error('Vui lòng nhập mã Google Gemini API Key!');
      return;
    }
    if (keyFormData.models.length === 0) {
      toast.error('Cần ít nhất một mô hình cho Khóa này!');
      return;
    }

    for (const m of keyFormData.models) {
      if (!m.modelName || !m.modelName.trim()) {
        toast.error('Tên mô hình không được để trống!');
        return;
      }
      if (!m.rpm || m.rpm <= 0) {
        toast.error(`Hạn mức RPM của mô hình '${m.modelName}' phải lớn hơn 0!`);
        return;
      }
      if (!m.tpm || m.tpm <= 0) {
        toast.error(`Hạn mức TPM của mô hình '${m.modelName}' phải lớn hơn 0!`);
        return;
      }
    }

    try {
      if (editingKey) {
        const updatePayload: AiKeyUpdateRequest = {
          name: keyFormData.name.trim(),
          apiKey: keyFormData.apiKey.trim() || undefined,
          isActive: keyFormData.isActive,
          orderIndex: keyFormData.orderIndex,
          models: keyFormData.models,
        };
        await aiManagementService.updateKey(editingKey.id, updatePayload);
        toast.success('Đã cập nhật Khóa thành công!');
      } else {
        const createPayload: AiKeyCreateRequest = {
          name: keyFormData.name.trim(),
          apiKey: keyFormData.apiKey.trim(),
          provider: keyFormData.provider,
          isActive: keyFormData.isActive,
          orderIndex: keyFormData.orderIndex,
          models: keyFormData.models,
        };
        await aiManagementService.createKey(createPayload);
        toast.success('Đã thêm Khóa mới thành công!');
      }
      setIsModalOpen(false);
      await fetchAll(true);
    } catch {
      // Error notifications handled by Axios interceptor
    }
  };

  // Toggle Key Active State
  const handleToggleKey = async (keyId: string) => {
    try {
      await aiManagementService.toggleKeyActive(keyId);
      await fetchAll(true);
    } catch {
      // Handled by Axios interceptor
    }
  };

  // Toggle Model Active State
  const handleToggleModel = async (modelId: string) => {
    try {
      await aiManagementService.toggleModelActive(modelId);
      await fetchAll(true);
    } catch {
      // Handled by Axios interceptor
    }
  };

  // Delete Key
  const handleDeleteKey = async () => {
    if (!deletingKeyId) return;
    try {
      await aiManagementService.deleteKey(deletingKeyId);
      toast.success('Đã xóa Khóa thành công!');
      setDeletingKeyId(null);
      await fetchAll(true);
    } catch {
      // Handled by Axios interceptor
    }
  };

  // Cancel single background job
  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Bạn có chắc muốn hủy tiến trình này không?')) return;
    setIsCancellingJob(jobId);
    try {
      await aiManagementService.cancelJob(jobId);
      toast.success('Đã hủy tiến trình!');
      await fetchStatus(true);
    } catch {
      // Error handled by global Axios interceptor
    } finally {
      setIsCancellingJob(null);
    }
  };

  // Clear all background jobs
  const handleClearAllJobs = async () => {
    if (!confirm('Bạn có chắc muốn dừng tất cả các tiến trình chấm bài và tạo đề không?')) return;
    try {
      await aiManagementService.clearAllJobs();
      toast.success('Đã dừng tất cả các tiến trình!');
      await fetchStatus(true);
    } catch {
      // Error handled by global Axios interceptor
    }
  };

  // Copy masked key identifier
  const handleCopyKey = (keyText: string, keyId: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKeyId(keyId);
    toast.success('Đã sao chép!');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Model list helpers in Modal
  const handleAddModelToForm = (preset?: { name: string; rpm: number; tpm: number }) => {
    const newModel: AiModelCreateRequest = preset
      ? { modelName: preset.name, rpm: preset.rpm, tpm: preset.tpm, isActive: true, orderIndex: keyFormData.models.length }
      : { modelName: 'gemini-2.5-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: keyFormData.models.length };

    setKeyFormData({
      ...keyFormData,
      models: [...keyFormData.models, newModel],
    });
  };

  const handleRemoveModelFromForm = (idx: number) => {
    const updated = [...keyFormData.models];
    updated.splice(idx, 1);
    setKeyFormData({ ...keyFormData, models: updated });
  };

  const handleUpdateModelInForm = (idx: number, field: keyof AiModelCreateRequest, val: any) => {
    const updated = [...keyFormData.models];
    updated[idx] = { ...updated[idx], [field]: val };
    setKeyFormData({ ...keyFormData, models: updated });
  };

  // Helper to format masked key nicely
  const formatMaskedKey = (masked: string) => {
    if (!masked) return '••••';
    const lastChars = masked.slice(-4);
    return `••••${lastChars}`;
  };

  return (
    <div className="min-h-screen bg-zinc-50/70 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Quản lý Dịch vụ AI
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                status?.availableSlots && status.availableSlots > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status?.availableSlots && status.availableSlots > 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className="hidden xs:inline">
                {status?.availableSlots && status.availableSlots > 0 ? 'Hoạt động tốt' : 'Đang nạp'}
              </span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Giám sát tải mô hình, điều phối khóa API và theo dõi tiến trình tạo đề, chấm bài.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAll(false)}
            disabled={isRefreshing}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition-colors shadow-2xs flex items-center gap-1.5"
            title="Làm mới số liệu"
            aria-label="Làm mới số liệu"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-500 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden md:inline">{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          {/* Sync / Reload Pool Button */}
          <button
            type="button"
            onClick={handleReloadPool}
            disabled={isReloadingPool}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-amber-600 dark:text-amber-400 border border-zinc-200 dark:border-zinc-800 transition-colors shadow-2xs flex items-center gap-1.5"
            title="Đồng bộ danh sách khóa vào bộ nhớ đệm"
            aria-label="Đồng bộ bộ nhớ đệm"
          >
            <Zap className={`w-4 h-4 text-amber-500 ${isReloadingPool ? 'animate-bounce' : ''}`} />
            <span className="hidden md:inline">{isReloadingPool ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
          </button>

          {/* Add Key Button */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Khóa</span>
          </button>
        </div>
      </div>

      {/* KPI Top Summary Cards (Compact 2x2 grid on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Ready Models */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Mô hình sẵn sàng
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {status ? status.availableSlots : 0}
              </span>
              <span className="text-xs text-zinc-400">/ {status ? status.totalSlots : 0} kênh</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 truncate">
              {status?.exhaustedSlots ? `${status.exhaustedSlots} kênh tạm dừng` : 'Hoạt động ổn định'}
            </p>
          </div>
        </div>

        {/* KPI 2: Total Capacity */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Công suất tải
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {status ? status.totalCapacityRpm : 0}
              </span>
              <span className="text-xs text-zinc-400">lượt/phút</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 truncate">
              Phân phối tự động
            </p>
          </div>
        </div>

        {/* KPI 3: Background Jobs */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Tiến trình chạy
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <PlayCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {status?.activeBackgroundJobsCount ?? 0}
              </span>
              <span className="text-xs text-zinc-400">tác vụ</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 truncate">
              {(status?.activeBackgroundJobsCount ?? 0) > 0 ? 'Đang chấm / tạo đề' : 'Không có tác vụ chờ'}
            </p>
          </div>
        </div>

        {/* KPI 4: Configured Keys */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Khóa API đã lưu
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {keysList.length || (status?.totalConfiguredKeys ?? 0)}
              </span>
              <span className="text-xs text-zinc-400">khóa</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 truncate">
              {status?.configSource === 'DATABASE' ? 'Từ cơ sở dữ liệu' : 'Từ tệp cấu hình'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200/80 dark:border-zinc-800 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('metrics')}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'metrics'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Activity className="w-4 h-4 shrink-0" />
          <span>Giám sát</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 whitespace-nowrap shrink-0">
            {status?.slots?.length || 0}
          </span>
          {activeTab === 'metrics' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('keys')}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'keys'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>Khóa API</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 whitespace-nowrap shrink-0">
            {keysList.length}
          </span>
          {activeTab === 'keys' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>
      </div>

      {/* TAB 1: METRICS & LIVE SLOTS */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Active Background Jobs Banner (Compact layout) */}
          {status && status.activeBackgroundJobs && status.activeBackgroundJobs.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/5 border border-amber-500/30 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center animate-spin">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      Tiến trình đang chạy ({status.activeBackgroundJobs.length})
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Tác vụ chấm bài tự luận hoặc tạo đề thi tự động
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllJobs}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Dừng tất cả</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {status.activeBackgroundJobs.map((job) => {
                  const isQueued = job.status === 'QUEUED';
                  const isQuizGen = job.type === 'AI_QUIZ_GEN';
                  const pct = job.totalAnswers > 0 ? Math.round((job.processedAnswers / job.totalAnswers) * 100) : 0;
                  return (
                    <div
                      key={job.jobId}
                      className="p-3 sm:p-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {job.examTitle || (isQuizGen ? 'Đề thi không tên' : 'Bài thi')}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isQueued
                                ? 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                : isQuizGen
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}>
                              {isQueued ? 'Chờ xử lý' : isQuizGen ? 'Tạo câu hỏi' : 'Chấm bài'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                            {isQueued ? 'Đang đợi lượt' : `Bắt đầu: ${new Date(job.startedAt).toLocaleTimeString('vi-VN')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {isQueued ? '0%' : isQuizGen ? 'Đang chạy' : `${pct}%`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCancelJob(job.jobId)}
                            disabled={isCancellingJob === job.jobId}
                            title="Hủy tiến trình"
                            className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
                            isQueued
                              ? 'bg-zinc-300 dark:bg-zinc-700'
                              : isQuizGen
                              ? 'bg-purple-500 animate-pulse'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: isQueued ? '10%' : isQuizGen ? '100%' : `${Math.min(100, Math.max(5, pct))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>
                          {isQuizGen
                            ? `Mục tiêu: ${job.totalAnswers} câu hỏi`
                            : isQueued
                            ? `Số bài: ${job.totalAnswers}`
                            : `Đã chấm: ${job.processedAnswers} / ${job.totalAnswers}`}
                        </span>
                        <span>{job.totalQuestions ? `${job.totalQuestions} câu tự luận` : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Slots Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Kênh Xử lý AI</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 whitespace-nowrap shrink-0">
                    {status?.slots?.length || 0} kênh
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Các kênh phân tải đang sẵn sàng phục vụ tác vụ
                </p>
              </div>
            </div>

            {status?.slots && status.slots.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {status.slots.map((slot: AiSlotMetricDto) => {
                  const isCooldown = slot.isExhausted || slot.cooldownRemainingSeconds > 0;
                  const rpmPercent = slot.rpmMax > 0 ? Math.min(100, Math.round((slot.rpmCurrent / slot.rpmMax) * 100)) : 0;

                  return (
                    <div
                      key={slot.slotIndex}
                      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border transition-all shadow-2xs hover:shadow-sm ${
                        isCooldown
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : 'border-zinc-200/80 dark:border-zinc-800'
                      }`}
                    >
                      {/* Slot Header */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Kênh #{slot.slotIndex + 1}
                          </span>
                          {isCooldown ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <Clock className="w-3 h-3 animate-spin" />
                              Tạm dừng {slot.cooldownRemainingSeconds}s
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Sẵn sàng
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {slot.modelName}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                            <Key className="w-3 h-3 text-zinc-400 shrink-0" />
                            <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                              {slot.keyName}
                            </span>
                            <span className="font-mono text-zinc-400 text-[11px]">
                              ({formatMaskedKey(slot.maskedKey)})
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Capacity Meter (RPM only for clean visual) */}
                      <div className="space-y-1.5 pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500 font-medium">Tải yêu cầu</span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-[11px]">
                            {slot.rpmCurrent} / {slot.rpmMax} RPM
                          </span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              rpmPercent >= 90
                                ? 'bg-rose-500'
                                : rpmPercent >= 70
                                ? 'bg-amber-500'
                                : 'bg-indigo-600 dark:bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(4, rpmPercent))}%` }}
                          />
                        </div>
                      </div>

                      {/* Request Stats with simple icons */}
                      <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="font-semibold">{slot.successCount}</span>
                          <span className="text-zinc-400 text-[11px]">thành công</span>
                        </span>
                        <span className="flex items-center gap-1 text-zinc-500">
                          <AlertCircle className={`w-3.5 h-3.5 ${slot.failureCount > 0 ? 'text-rose-500' : 'text-zinc-400'}`} />
                          <span className={`font-semibold ${slot.failureCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                            {slot.failureCount}
                          </span>
                          <span className="text-zinc-400 text-[11px]">lỗi</span>
                        </span>
                      </div>

                      {/* Last error if present */}
                      {slot.lastError && (
                        <div className="mt-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 dark:text-rose-400 line-clamp-2">
                          <span className="font-semibold">Lỗi:</span> {slot.lastError}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Chưa có kênh AI nào hoạt động
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                  Vui lòng thêm API Key mới để kích hoạt các kênh phân tải.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm Khóa ngay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: KEYS CONFIGURATION */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Khóa API</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 whitespace-nowrap shrink-0">
                  {keysList.length} khóa
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Danh sách khóa và giới hạn mô hình kết nối
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {keysList.map((keyItem) => (
              <div
                key={keyItem.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-3 hover:shadow-xs transition-shadow"
              >
                {/* Key Header: Name & Masked Key inline on left, Switch + Actions on right */}
                <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Key className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {keyItem.name}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0">
                      <span>{formatMaskedKey(keyItem.maskedKey)}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyKey(keyItem.maskedKey, keyItem.id)}
                        title="Sao chép mã ẩn"
                        className="p-0.5 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                      >
                        {copiedKeyId === keyItem.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </span>
                  </div>

                  {/* Actions: Toggle switch + Edit + Trash */}
                  <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleKey(keyItem.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        keyItem.isActive ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                      title={keyItem.isActive ? 'Bấm để tắt khóa này' : 'Bấm để bật khóa này'}
                      aria-label="Bật tắt khóa"
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          keyItem.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(keyItem)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Chỉnh sửa khóa"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeletingKeyId(keyItem.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Xóa khóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Models as Full-width Responsive Grid (No empty gap on right!) */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {keyItem.models.map((model) => (
                      <div
                        key={model.id}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/50 text-xs transition-colors hover:border-zinc-300 dark:hover:border-zinc-600"
                      >
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate pr-2">
                          {model.modelName}
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {model.rpm} RPM
                          </span>

                          {/* Mini Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleModel(model.id)}
                            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ${
                              model.isActive ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
                            }`}
                            title={model.isActive ? 'Tắt mô hình này' : 'Bật mô hình này'}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ${
                                model.isActive ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {keysList.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800">
                <Key className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Chưa có Khóa API nào được lưu
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Thêm khóa API mới để hệ thống hoạt động ổn định và chủ động điều phối.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm Khóa ngay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT KEY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                {editingKey ? 'Chỉnh sửa Khóa' : 'Thêm Google Gemini Key'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleSaveKey} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Key Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Tên khóa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tài khoản chính, Dự phòng..."
                  value={keyFormData.name}
                  onChange={(e) => setKeyFormData({ ...keyFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  API Key {editingKey ? '' : <span className="text-rose-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showRawKey ? 'text' : 'password'}
                    required={!editingKey}
                    placeholder={editingKey ? 'Để trống nếu không đổi khóa...' : 'Nhập mã API Key (AIzaSy...)'}
                    value={keyFormData.apiKey}
                    onChange={(e) => setKeyFormData({ ...keyFormData, apiKey: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRawKey(!showRawKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                    title={showRawKey ? 'Ẩn mã' : 'Hiện mã'}
                  >
                    {showRawKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Models List */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Mô hình hỗ trợ ({keyFormData.models.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddModelToForm()}
                    className="text-xs font-medium text-indigo-600 flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm model
                  </button>
                </div>

                {/* Suggestions Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400">Gợi ý:</span>
                  {SUGGESTED_MODELS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleAddModelToForm(preset)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-zinc-700 transition-colors"
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {keyFormData.models.map((model, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40"
                    >
                      <input
                        type="text"
                        required
                        placeholder="Tên mô hình"
                        value={model.modelName}
                        onChange={(e) => handleUpdateModelInForm(idx, 'modelName', e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />

                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          placeholder="RPM"
                          value={model.rpm}
                          onChange={(e) => handleUpdateModelInForm(idx, 'rpm', parseInt(e.target.value) || 1)}
                          className="w-16 px-1.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono text-center"
                          title="Hạn mức yêu cầu mỗi phút (RPM)"
                        />
                        <span className="text-[10px] text-zinc-400">RPM</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveModelFromForm(idx)}
                        disabled={keyFormData.models.length <= 1}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="sticky bottom-0 bg-white dark:bg-zinc-900 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20"
                >
                  {editingKey ? 'Lưu thay đổi' : 'Kích hoạt Khóa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingKeyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-5 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Xóa Khóa API này?
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Các kênh xử lý thuộc khóa này sẽ ngừng hoạt động ngay lập tức.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingKeyId(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteKey}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
