'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cpu,
  RefreshCw,
  Plus,
  Key,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Database,
  Server,
  PlayCircle,
  X,
  Sliders,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  aiManagementService,
  AiSystemStatusResponse,
  AiKeyResponse,
  AiSlotMetricDto,
  AiBackgroundJobDto,
  AiModelCreateRequest,
  AiKeyCreateRequest,
  AiKeyUpdateRequest,
} from '@/services/aiManagementService';
import toast from 'react-hot-toast';

const SUGGESTED_MODELS = [
  { name: 'gemini-3.5-flash-lite', rpm: 15, tpm: 1000000 },
  { name: 'gemini-3.1-flash-lite', rpm: 15, tpm: 1000000 },
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
      { modelName: 'gemini-3.5-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 0 },
      { modelName: 'gemini-3.1-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 1 },
      { modelName: 'gemini-2.5-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 2 },
    ],
  });
  const [showRawKey, setShowRawKey] = useState<boolean>(false);

  // Delete Confirm Modal State
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [isCancellingJob, setIsCancellingJob] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);

  // Fetch status metrics from Redis (super lightweight, no DB query)
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

  // Fetch keys list from Database (only called on mount, tab switch, or mutations)
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

  // Initial load: fetch both
  useEffect(() => {
    isMountedRef.current = true;
    fetchAll(false);

    // Polling every 10 seconds ONLY for Redis live metrics (no continuous DB queries)
    const intervalId = setInterval(() => {
      fetchStatus(true);
    }, 10000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchAll, fetchStatus]);

  // When switching to 'keys' tab, refresh keys list
  useEffect(() => {
    if (activeTab === 'keys') {
      fetchKeys();
    }
  }, [activeTab, fetchKeys]);

  // Handle Pool Reload
  const handleReloadPool = async () => {
    try {
      setIsReloadingPool(true);
      await aiManagementService.reloadPool();
      await fetchAll(true);
    } catch {
      // Handled by Axios interceptor
    } finally {
      setIsReloadingPool(false);
    }
  };

  // Open Modal for Create
  const handleOpenCreateModal = () => {
    setEditingKey(null);
    setKeyFormData({
      name: `Gemini Key #${keysList.length + 1}`,
      apiKey: '',
      provider: 'GEMINI',
      isActive: true,
      orderIndex: keysList.length,
      models: [
        { modelName: 'gemini-3.5-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 0 },
        { modelName: 'gemini-3.1-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 1 },
        { modelName: 'gemini-2.5-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: 2 },
      ],
    });
    setShowRawKey(false);
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (key: AiKeyResponse) => {
    setEditingKey(key);
    setKeyFormData({
      name: key.name,
      apiKey: '', // leave empty unless admin wants to update
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

  // Save Key Form
  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyFormData.name.trim()) {
      toast.error('Vui lòng nhập tên nhận diện cho Key!');
      return;
    }
    if (!editingKey && !keyFormData.apiKey.trim()) {
      toast.error('Vui lòng cung cấp Google Gemini API Key!');
      return;
    }
    if (keyFormData.models.length === 0) {
      toast.error('Cần ít nhất một model cho Key này!');
      return;
    }

    for (const m of keyFormData.models) {
      if (!m.modelName || !m.modelName.trim()) {
        toast.error('Tên model không được để trống!');
        return;
      }
      if (!m.rpm || m.rpm <= 0) {
        toast.error(`Hạn mức RPM của model '${m.modelName}' phải lớn hơn 0!`);
        return;
      }
      if (!m.tpm || m.tpm <= 0) {
        toast.error(`Hạn mức TPM của model '${m.modelName}' phải lớn hơn 0!`);
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
      }
      setIsModalOpen(false);
      await fetchAll(true);
    } catch {
      // Error notifications handled by Axios interceptor
    }
  };

  // Toggle Key Active
  const handleToggleKey = async (keyId: string) => {
    try {
      await aiManagementService.toggleKeyActive(keyId);
      await fetchAll(true);
    } catch {
      // Handled by Axios interceptor
    }
  };

  // Toggle Model Active
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
      setDeletingKeyId(null);
      await fetchAll(true);
    } catch {
      // Handled by Axios interceptor
    }
  };

  // Cancel single background job and release lock
  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Bạn có chắc muốn hủy tiến trình này và giải phóng khóa đề thi không?')) return;
    setIsCancellingJob(jobId);
    try {
      await aiManagementService.cancelJob(jobId);
      toast.success('Đã hủy tiến trình và giải phóng khóa đề thi thành công!');
      await fetchStatus(true);
    } catch (err: any) {
      toast.error('Lỗi khi hủy tiến trình: ' + (err?.response?.data?.message || err.message));
    } finally {
      setIsCancellingJob(null);
    }
  };

  // Clear all background jobs and release all locks
  const handleClearAllJobs = async () => {
    if (!confirm('Bạn có chắc muốn dọn sạch tất cả các tiến trình chấm AI và giải phóng toàn bộ khóa đề thi không?')) return;
    try {
      await aiManagementService.clearAllJobs();
      toast.success('Đã dọn dẹp sạch tất cả các tiến trình nền!');
      await fetchStatus(true);
    } catch (err: any) {
      toast.error('Lỗi khi dọn dẹp tiến trình: ' + (err?.response?.data?.message || err.message));
    }
  };

  // Model List helper inside Modal
  const handleAddModelToForm = (preset?: { name: string; rpm: number; tpm: number }) => {
    const newModel: AiModelCreateRequest = preset
      ? { modelName: preset.name, rpm: preset.rpm, tpm: preset.tpm, isActive: true, orderIndex: keyFormData.models.length }
      : { modelName: 'gemini-3.5-flash-lite', rpm: 15, tpm: 1000000, isActive: true, orderIndex: keyFormData.models.length };

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

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 p-4 md:p-8 lg:p-10 space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              AI Infrastructure
            </span>
            {status?.configSource === 'DATABASE' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Database className="w-3.5 h-3.5" />
                DATABASE DRIVEN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                <Server className="w-3.5 h-3.5" />
                ENV SINGLE-KEY FALLBACK
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Hạ tầng Điều phối & Xoay vòng AI
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Quản trị viên theo dõi real-time hạn mức RPM/TPM, thời gian cooldown khi bị Google 429, tiến trình chấm bài tự động ngầm và cấu hình dynamic API Keys.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchAll(false)}
            disabled={isRefreshing}
            className="group flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-all duration-200 active:scale-95 shadow-xs"
            title="Làm mới số liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          <button
            type="button"
            onClick={handleReloadPool}
            disabled={isReloadingPool}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all duration-200 active:scale-95 shadow-xs"
            title="Tải lại slots từ DB / Env"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-500 ${isReloadingPool ? 'animate-bounce' : ''}`} />
            <span>{isReloadingPool ? 'Đang nạp...' : 'Tải lại Pool'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition-all duration-200 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm API Key</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('metrics')}
          className={`relative flex items-center gap-2.5 px-6 py-3 text-sm font-semibold transition-colors duration-200 ${
            activeTab === 'metrics'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Trạng thái Real-time & Slots Pool</span>
          {activeTab === 'metrics' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('keys')}
          className={`relative flex items-center gap-2.5 px-6 py-3 text-sm font-semibold transition-colors duration-200 ${
            activeTab === 'keys'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Quản lý Khóa API & Models ({keysList.length})</span>
          {activeTab === 'keys' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>
      </div>

      {/* KPI Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Slots */}
        <div className="p-1 rounded-[1.5rem] bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60">
          <div className="p-5 rounded-[calc(1.5rem-0.25rem)] bg-white dark:bg-zinc-900/90 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Model Slots Sẵn Sàng
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {status ? status.availableSlots : 0}
              </span>
              <span className="text-xs text-zinc-500">/ {status ? status.totalSlots : 0} slots</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {status?.exhaustedSlots ? `${status.exhaustedSlots} slot đang chờ cooldown` : 'Tất cả slots hoạt động trơn tru'}
            </p>
          </div>
        </div>

        {/* KPI 2: Total RPM Capacity */}
        <div className="p-1 rounded-[1.5rem] bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60">
          <div className="p-5 rounded-[calc(1.5rem-0.25rem)] bg-white dark:bg-zinc-900/90 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Tổng Công Suất Quota
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {status ? status.totalCapacityRpm : 0}
              </span>
              <span className="text-xs text-zinc-500">RPM / phút</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Phân bổ xoay vòng thông minh qua {status?.slots?.length || 0} slots
            </p>
          </div>
        </div>

        {/* KPI 3: Background Workers */}
        <div className="p-1 rounded-[1.5rem] bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60">
          <div className="p-5 rounded-[calc(1.5rem-0.25rem)] bg-white dark:bg-zinc-900/90 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Tiến Trình Chấm Ngầm
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <PlayCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {status?.activeBackgroundJobsCount ?? 0}
              </span>
              <span className="text-xs text-zinc-500">workers active</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              {(status?.activeBackgroundJobsCount ?? 0) > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Đang chấm tự động cho bài thi
                </>
              ) : (
                'Không có bài thi nào đang chấm'
              )}
            </p>
          </div>
        </div>

        {/* KPI 4: Keys Configured */}
        <div className="p-1 rounded-[1.5rem] bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60">
          <div className="p-5 rounded-[calc(1.5rem-0.25rem)] bg-white dark:bg-zinc-900/90 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Khóa API Đã Đăng Ký
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {status ? status.totalConfiguredKeys : keysList.length}
              </span>
              <span className="text-xs text-zinc-500">API keys</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Nguồn: {status?.configSource === 'DATABASE' ? 'PostgreSQL Database' : 'Biến môi trường (.env)'}
            </p>
          </div>
        </div>
      </div>

      {/* TAB 1: METRICS & SLOTS */}
      {activeTab === 'metrics' && (
        <div className="space-y-8">
          {/* Active Background Jobs Banner (if any) */}
          {status && status.activeBackgroundJobs && status.activeBackgroundJobs.length > 0 && (
            <div className="p-1 rounded-[1.75rem] bg-amber-500/20 border border-amber-500/30">
              <div className="p-6 rounded-[calc(1.75rem-0.25rem)] bg-white dark:bg-zinc-950 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center animate-spin">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        Đang xử lý tác vụ chấm thi nền ({status.activeBackgroundJobs.length})
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full">
                          BACKGROUND ASYNC
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-500">
                        AI đang đọc các câu hỏi tự luận và commit từng batch vào CSDL.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearAllJobs}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Dọn sạch tất cả job treo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {status.activeBackgroundJobs.map((job) => {
                    const isQueued = job.status === 'QUEUED';
                    const pct = job.totalAnswers > 0 ? Math.round((job.processedAnswers / job.totalAnswers) * 100) : 0;
                    return (
                      <div
                        key={job.jobId}
                        className={`p-4 rounded-xl border space-y-3 transition-colors ${
                          isQueued
                            ? 'border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20'
                            : 'border-amber-200 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-950/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                Đề thi: {job.examTitle || 'Không tên'}
                              </p>
                              {isQueued ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  <Clock className="w-3 h-3" />
                                  Đang xếp hàng (Queued)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                  Đang chấm (Processing)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1">
                              {isQueued
                                ? 'Chờ lượt chạy (Luồng AI đơn 100% quota) • Tự động kích hoạt khi luồng trước xong'
                                : `Thread: ${job.threadName} • Bắt đầu: ${new Date(job.startedAt).toLocaleTimeString()}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isQueued ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {isQueued ? 'Chờ' : `${pct}%`}
                            </span>
                            <button
                              onClick={() => handleCancelJob(job.jobId)}
                              disabled={isCancellingJob === job.jobId}
                              title="Hủy tiến trình và giải phóng khóa đề thi"
                              className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ease-out ${
                              isQueued
                                ? 'bg-indigo-400/60 dark:bg-indigo-500/40 animate-pulse'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: isQueued ? '100%' : `${Math.min(100, Math.max(5, pct))}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                          <span>
                            {isQueued
                              ? `Tổng số bài cần chấm: ${job.totalAnswers} bài`
                              : `Đã chấm: ${job.processedAnswers} / ${job.totalAnswers} bài làm`}
                          </span>
                          <span>{job.totalQuestions} câu hỏi tự luận</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Slots Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  Danh sách Model Slots trong Rotation Pool
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {status?.slots?.length || 0} slots
                  </span>
                </h2>
                <p className="text-xs text-zinc-500">
                  Mỗi slot kết hợp giữa một Key và Model riêng biệt. Khi gặp lỗi 429, hệ thống tự động xoay sang slot kế tiếp.
                </p>
              </div>
            </div>

            {status?.slots && status.slots.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {status.slots.map((slot: AiSlotMetricDto) => {
                  const isCooldown = slot.isExhausted || slot.cooldownRemainingSeconds > 0;
                  const rpmPercent = slot.rpmMax > 0 ? Math.min(100, Math.round((slot.rpmCurrent / slot.rpmMax) * 100)) : 0;
                  const tpmPercent = slot.tpmMax > 0 ? Math.min(100, Math.round((slot.tpmCurrent / slot.tpmMax) * 100)) : 0;

                  return (
                    <div
                      key={slot.slotIndex}
                      className={`p-1 rounded-[1.75rem] transition-all duration-300 ${
                        isCooldown
                          ? 'bg-rose-500/20 border border-rose-500/30'
                          : 'bg-zinc-200/60 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <div className="p-5 rounded-[calc(1.75rem-0.25rem)] bg-white dark:bg-zinc-950 flex flex-col justify-between h-full space-y-4">
                        {/* Header: Key & Model info */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              Slot #{slot.slotIndex}
                            </span>
                            {isCooldown ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <Clock className="w-3 h-3 animate-spin" />
                                Cooldown {slot.cooldownRemainingSeconds}s
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                SẴN SÀNG
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {slot.modelName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                            <Key className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                              {slot.keyName}
                            </span>
                            <span className="font-mono text-zinc-400">({slot.maskedKey})</span>
                          </div>
                        </div>

                        {/* Meters */}
                        <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                          {/* RPM Meter */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-500 font-medium">Yêu cầu / phút (RPM)</span>
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                                {slot.rpmCurrent} / {slot.rpmMax}
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
                                style={{ width: `${Math.min(100, Math.max(3, rpmPercent))}%` }}
                              />
                            </div>
                          </div>

                          {/* TPM Meter */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-500 font-medium">Tokens / phút (TPM)</span>
                              <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                                {slot.tpmCurrent.toLocaleString()} / {slot.tpmMax.toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  tpmPercent >= 90
                                    ? 'bg-rose-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(2, tpmPercent))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Request Stats */}
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-xs text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Thành công: <strong className="text-zinc-800 dark:text-zinc-200">{slot.successCount}</strong>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            429/Lỗi: <strong className="text-zinc-800 dark:text-zinc-200">{slot.failureCount}</strong>
                          </span>
                        </div>

                        {/* Last error if present */}
                        {slot.lastError && (
                          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 dark:text-rose-400">
                            <strong>Lỗi gần nhất:</strong> {slot.lastError}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-white dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Chưa có Slot AI nào hoạt động
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                  Vui lòng thêm API Key mới hoặc bấm &quot;Tải lại Pool&quot; để nạp từ biến môi trường.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-indigo-600 text-white"
                >
                  <Plus className="w-4 h-4" />
                  Thêm API Key ngay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: KEYS & MODELS CONFIGURATION */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Bảng Cấu Hình Khóa API Trong Cơ Sở Dữ Liệu
              </h2>
              <p className="text-xs text-zinc-500">
                Quản trị viên có thể thêm nhiều khóa, chỉnh sửa hạn mức RPM/TPM của từng model, hoặc tạm tắt một khóa mà không cần khởi động lại ứng dụng.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Thêm Khóa Mới
            </button>
          </div>

          <div className="space-y-4">
            {keysList.map((keyItem, index) => (
              <div
                key={keyItem.id}
                className="p-1 rounded-[1.75rem] bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="p-6 rounded-[calc(1.75rem-0.25rem)] bg-white dark:bg-zinc-950 space-y-5">
                  {/* Key Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                            {keyItem.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              keyItem.isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {keyItem.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">
                          Key Mask: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{keyItem.maskedKey}</span> • Provider: {keyItem.provider}
                        </p>
                      </div>
                    </div>

                    {/* Key Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleKey(keyItem.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          keyItem.isActive
                            ? 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {keyItem.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(keyItem)}
                        className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Chỉnh sửa Key & Models"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingKeyId(keyItem.id)}
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Xóa Key này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Configured Models list under this Key */}
                  <div className="space-y-2 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Các Models Cấu Hình ({keyItem.models.length}):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {keyItem.models.map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50"
                        >
                          <div>
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              {model.modelName}
                            </p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Limit: <strong className="text-zinc-700 dark:text-zinc-300">{model.rpm} RPM</strong> • {model.tpm.toLocaleString()} TPM
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleModel(model.id)}
                            className={`w-7 h-4 rounded-full transition-colors relative ${
                              model.isActive ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                            }`}
                            title={model.isActive ? 'Model đang bật (Click để tắt)' : 'Model đang tắt (Click để bật)'}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                model.isActive ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {keysList.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800">
                <Database className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Chưa có API Key nào được lưu trong Database
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Hệ thống đang tự động fallback về biến môi trường GEMINI_API_KEY. Hãy thêm key vào DB để quản lý trực tiếp.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT KEY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600" />
                {editingKey ? 'Chỉnh Sửa API Key' : 'Thêm Google Gemini API Key Mới'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-5">
              {/* Key Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Tên nhận diện Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Google Cloud Key 1 (Account Chính)"
                  value={keyFormData.name}
                  onChange={(e) => setKeyFormData({ ...keyFormData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>API Key (AIzaSy...) {editingKey ? '(Để trống nếu giữ nguyên key cũ)' : <span className="text-rose-500">*</span>}</span>
                  <button
                    type="button"
                    onClick={() => setShowRawKey(!showRawKey)}
                    className="text-xs text-indigo-600 flex items-center gap-1"
                  >
                    {showRawKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showRawKey ? 'Ẩn' : 'Hiện key'}</span>
                  </button>
                </label>
                <input
                  type={showRawKey ? 'text' : 'password'}
                  required={!editingKey}
                  placeholder={editingKey ? 'Nhập nếu muốn thay đổi key mới...' : 'Nhập mã API Key Google Gemini...'}
                  value={keyFormData.apiKey}
                  onChange={(e) => setKeyFormData({ ...keyFormData, apiKey: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Models Configuration inside Key */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Danh Sách Models Cho Key Này ({keyFormData.models.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddModelToForm()}
                    className="text-xs font-semibold text-indigo-600 flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm model tùy chỉnh
                  </button>
                </div>

                {/* Suggestions Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-zinc-400">Gợi ý nhanh:</span>
                  {SUGGESTED_MODELS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleAddModelToForm(preset)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-zinc-700 transition-colors"
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {keyFormData.models.map((model, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60"
                    >
                      <input
                        type="text"
                        required
                        placeholder="Model name (vd: gemini-3.5-flash-lite)"
                        value={model.modelName}
                        onChange={(e) => handleUpdateModelInForm(idx, 'modelName', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-400">RPM:</span>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          step="1"
                          value={model.rpm}
                          onChange={(e) => handleUpdateModelInForm(idx, 'rpm', parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono text-center"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-400">TPM:</span>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={model.tpm}
                          onChange={(e) => handleUpdateModelInForm(idx, 'tpm', parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono text-center"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveModelFromForm(idx)}
                        disabled={keyFormData.models.length <= 1}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                >
                  {editingKey ? 'Cập Nhật Key' : 'Tạo Key & Áp Dụng Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingKeyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Xác nhận xóa API Key này?
              </h3>
              <p className="text-xs text-zinc-500 mt-1.5">
                Các slot liên quan đến khóa này sẽ bị hủy khỏi pool xoay vòng ngay lập tức. Thao tác này không thể hoàn tác!
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingKeyId(null)}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteKey}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20"
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
