'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sliders,
  Shield,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  RotateCcw,
  Save,
  X,
  AlertTriangle,
  Plus,
  Minus,
  SlidersHorizontal,
  FileCheck2,
} from 'lucide-react';
import { systemConfigService } from '@/services/systemConfigService';
import type { SystemConfigItem, SystemConfigCategory } from '@/types/systemConfig';

// Human-friendly metadata mapping for technical config keys
interface ConfigDisplayMeta {
  title: string;
  categoryLabel: string;
  description: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

const CONFIG_DISPLAY_MAP: Record<string, ConfigDisplayMeta> = {
  'app.rate-limit.enabled': {
    title: 'Giới hạn số lượt yêu cầu',
    categoryLabel: 'Giới hạn truy cập',
    description: 'Bảo vệ hệ thống khỏi tình trạng gửi yêu cầu dồn dập hoặc spam làm chậm máy chủ.',
  },
  'app.rate-limit.global.enabled': {
    title: 'Áp dụng giới hạn chung',
    categoryLabel: 'Giới hạn truy cập',
    description: 'Tự động áp dụng mức giới hạn an toàn cho người dùng khi sử dụng các tính năng thông thường.',
  },
  'app.rate-limit.global.limit': {
    title: 'Số yêu cầu tối đa mỗi phút',
    categoryLabel: 'Giới hạn truy cập',
    description: 'Số lượt gửi yêu cầu tối đa mà một máy người dùng có thể thực hiện trong 1 phút.',
    unit: 'lượt/phút',
    min: 10,
    max: 1000,
    step: 10,
  },
  'app.rate-limit.global.period-seconds': {
    title: 'Thời gian làm mới lượt',
    categoryLabel: 'Giới hạn truy cập',
    description: 'Khoảng thời gian đếm trước khi đặt lại số lượt yêu cầu được phép gửi về ban đầu.',
    unit: 'giây',
    min: 10,
    max: 3600,
    step: 5,
  },
  'gemini.batch-size': {
    title: 'Số bài chấm cùng lúc (AI)',
    categoryLabel: 'Trí tuệ nhân tạo (AI)',
    description: 'Gom nhóm các bài thi tự luận để AI chấm điểm trong một lượt, giúp tiết kiệm thời gian xử lý.',
    unit: 'bài làm',
    min: 1,
    max: 50,
    step: 1,
  },
  'gemini.moderation-batch-size': {
    title: 'Số câu hỏi duyệt cùng lúc (AI)',
    categoryLabel: 'Trí tuệ nhân tạo (AI)',
    description: 'Số câu hỏi được AI kiểm tra tính phù hợp và an toàn trong mỗi đợt quét tự động.',
    unit: 'câu hỏi',
    min: 5,
    max: 100,
    step: 5,
  },
  'gemini.timeout-seconds': {
    title: 'Thời gian chờ AI phản hồi',
    categoryLabel: 'Trí tuệ nhân tạo (AI)',
    description: 'Số giây tối đa hệ thống chờ AI trả lời trước khi thông báo thử lại.',
    unit: 'giây',
    min: 10,
    max: 300,
    step: 5,
  },
  'gemini.max-concurrent-tasks-per-user': {
    title: 'Số hàng đợi AI tối đa mỗi tài khoản',
    categoryLabel: 'Trí tuệ nhân tạo (AI)',
    description: 'Số lượng tác vụ chạy ngầm (chấm điểm hoặc tạo đề AI) tối đa mà mỗi tài khoản được phép chạy cùng lúc.',
    unit: 'hàng đợi',
    min: 1,
    max: 10,
    step: 1,
  },
};

export default function AdminSettingsPage() {
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Filter & Search states
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'RATE_LIMIT' | 'GEMINI_AI' | 'CUSTOMIZED'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Confirmation modal state for resetting to default
  const [targetResetConfig, setTargetResetConfig] = useState<SystemConfigItem | null>(null);
  const [isSubmittingReset, setIsSubmittingReset] = useState<boolean>(false);

  // Load configs
  const fetchConfigs = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await systemConfigService.getAllConfigs();
      setConfigs(data);

      const initialDrafts: Record<string, string> = {};
      data.forEach((item) => {
        initialDrafts[item.key] = item.value;
      });
      setDraftValues(initialDrafts);
    } catch {
      // Error is automatically handled and displayed by axios interceptor
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Handle draft value changes
  const handleValueChange = (key: string, value: string) => {
    setDraftValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Adjust numeric value with stepper (+ / -)
  const handleNumericStep = (item: SystemConfigItem, delta: number) => {
    const meta = CONFIG_DISPLAY_MAP[item.key];
    const currentVal = parseInt(draftValues[item.key] ?? item.value, 10) || 0;
    const step = meta?.step || 1;
    let nextVal = currentVal + delta * step;

    if (meta?.min !== undefined && nextVal < meta.min) nextVal = meta.min;
    if (meta?.max !== undefined && nextVal > meta.max) nextVal = meta.max;

    handleValueChange(item.key, String(nextVal));
  };

  // Save changes for a single config
  const handleSaveConfig = async (item: SystemConfigItem) => {
    const currentDraft = draftValues[item.key] ?? item.value;
    setSavingKey(item.key);

    try {
      const updated = await systemConfigService.updateConfig(item.key, currentDraft);
      // Success toast is automatically displayed by axios interceptor
      setConfigs((prev) => prev.map((c) => (c.key === item.key ? updated : c)));
      handleValueChange(item.key, updated.value);
    } catch {
      // Error is automatically handled and displayed by axios interceptor
    } finally {
      setSavingKey(null);
    }
  };

  // Confirm and reset config to environment default
  const handleConfirmReset = async () => {
    if (!targetResetConfig) return;
    setIsSubmittingReset(true);

    try {
      await systemConfigService.resetConfig(targetResetConfig.key);
      // Success toast is automatically displayed by axios interceptor
      setTargetResetConfig(null);
      await fetchConfigs(true);
    } catch {
      // Error is automatically handled and displayed by axios interceptor
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Statistics for top metric cards
  const stats = useMemo(() => {
    const total = configs.length;
    const rateLimitCount = configs.filter((c) => c.category === 'RATE_LIMIT').length;
    const geminiCount = configs.filter((c) => c.category === 'GEMINI_AI').length;
    const customizedCount = configs.filter((c) => c.source === 'DATABASE').length;
    return { total, rateLimitCount, geminiCount, customizedCount };
  }, [configs]);

  // Filtered list
  const filteredConfigs = useMemo(() => {
    return configs.filter((item) => {
      // Category filter
      if (selectedFilter === 'RATE_LIMIT' && item.category !== 'RATE_LIMIT') return false;
      if (selectedFilter === 'GEMINI_AI' && item.category !== 'GEMINI_AI') return false;
      if (selectedFilter === 'CUSTOMIZED' && item.source !== 'DATABASE') return false;

      // Keyword search
      const q = searchKeyword.toLowerCase().trim();
      if (!q) return true;

      const meta = CONFIG_DISPLAY_MAP[item.key];
      const title = (meta?.title || item.label).toLowerCase();
      const desc = (meta?.description || item.description || '').toLowerCase();
      return title.includes(q) || desc.includes(q) || item.key.toLowerCase().includes(q);
    });
  }, [configs, selectedFilter, searchKeyword]);

  return (
    <div className="p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* 1. Header Bar (Consistent with existing admin pages) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
              Cài đặt hệ thống
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Hiệu lực tức thì
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Tùy chỉnh thông số vận hành như giới hạn truy cập và xử lý AI. Thay đổi có hiệu lực ngay mà không cần khởi động lại.
          </p>
        </div>

        {/* Action Button: Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => fetchConfigs(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all disabled:opacity-60 cursor-pointer shrink-0 border border-zinc-200/60 dark:border-zinc-700/60"
            title="Làm mới danh sách cài đặt"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
            <span>{isRefreshing ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* 2. Four Interactive Metric Cards (Click to filter, identical to Admin Users/Exams) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: All Settings */}
        <button
          type="button"
          onClick={() => setSelectedFilter('ALL')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedFilter === 'ALL'
              ? 'border-indigo-600 bg-white dark:bg-zinc-900 ring-2 ring-indigo-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
              Tất cả cài đặt
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.total}
            </span>
          </div>
        </button>

        {/* Card 2: Rate Limit */}
        <button
          type="button"
          onClick={() => setSelectedFilter((prev) => (prev === 'RATE_LIMIT' ? 'ALL' : 'RATE_LIMIT'))}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedFilter === 'RATE_LIMIT'
              ? 'border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 ring-2 ring-amber-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-amber-300 dark:hover:border-amber-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400 truncate">
              Giới hạn truy cập
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.rateLimitCount}
            </span>
          </div>
        </button>

        {/* Card 3: Gemini AI */}
        <button
          type="button"
          onClick={() => setSelectedFilter((prev) => (prev === 'GEMINI_AI' ? 'ALL' : 'GEMINI_AI'))}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedFilter === 'GEMINI_AI'
              ? 'border-purple-500 bg-purple-50/20 dark:bg-purple-950/20 ring-2 ring-purple-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-purple-300 dark:hover:border-purple-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-purple-600 dark:text-purple-400 truncate">
              Trí tuệ nhân tạo (AI)
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.geminiCount}
            </span>
          </div>
        </button>

        {/* Card 4: Customized Settings */}
        <button
          type="button"
          onClick={() => setSelectedFilter((prev) => (prev === 'CUSTOMIZED' ? 'ALL' : 'CUSTOMIZED'))}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedFilter === 'CUSTOMIZED'
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-300 dark:hover:border-emerald-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              Đã tùy chỉnh
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.customizedCount}
            </span>
          </div>
        </button>
      </div>

      {/* 3. Search Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Tìm kiếm cài đặt theo tên hoặc mô tả..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/50 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {selectedFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => setSelectedFilter('ALL')}
            className="px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
          >
            Hiện tất cả
          </button>
        )}
      </div>

      {/* 4. Settings List (Clean, Minimalist, Human-Friendly) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs text-zinc-500">Đang tải danh sách cài đặt...</p>
          </div>
        ) : filteredConfigs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Sliders className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Không tìm thấy cài đặt nào</p>
            <p className="text-xs text-zinc-400">Hãy thử nhập từ khóa khác hoặc chuyển danh mục.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filteredConfigs.map((item) => {
              const meta = CONFIG_DISPLAY_MAP[item.key] || {
                title: item.label,
                categoryLabel: item.category === 'RATE_LIMIT' ? 'Giới hạn truy cập' : 'Trí tuệ nhân tạo (AI)',
                description: item.description || '',
              };

              const currentDraft = draftValues[item.key] ?? item.value;
              const hasChanged = currentDraft !== item.value;
              const isCustomized = item.source === 'DATABASE';
              const isSaving = savingKey === item.key;

              return (
                <div
                  key={item.key}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                >
                  {/* Left Column: Title & Description */}
                  <div className="space-y-1.5 flex-1 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                        {meta.categoryLabel}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>

                      {/* Status Badge */}
                      {isCustomized ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Check className="w-2.5 h-2.5" />
                          Đã tùy chỉnh
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                          Mặc định
                        </span>
                      )}

                      {hasChanged && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                          Chưa lưu
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {meta.title}
                    </h2>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {meta.description}
                    </p>

                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-0.5">
                      Giá trị mặc định:{' '}
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">
                        {item.valueType === 'BOOLEAN'
                          ? item.defaultValue === 'true'
                            ? 'Bật'
                            : 'Tắt'
                          : `${item.defaultValue} ${meta.unit || ''}`}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Interactive Editor Control & Action Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0">
                    {/* Control by value type */}
                    {item.valueType === 'BOOLEAN' ? (
                      <div className="flex items-center gap-2.5">
                        <span className={`text-xs font-semibold ${currentDraft === 'true' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                          {currentDraft === 'true' ? 'Đang bật' : 'Đang tắt'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleValueChange(item.key, currentDraft === 'true' ? 'false' : 'true')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-hidden ${
                            currentDraft === 'true' ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              currentDraft === 'true' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ) : item.valueType === 'INTEGER' ? (
                      <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
                        <button
                          type="button"
                          onClick={() => handleNumericStep(item, -1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-200 hover:bg-zinc-100 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                          title="Giảm giá trị"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center px-2 min-w-[70px] justify-center">
                          <input
                            type="number"
                            value={currentDraft}
                            onChange={(e) => handleValueChange(item.key, e.target.value)}
                            className="w-14 text-center font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 bg-transparent focus:outline-hidden"
                          />
                          {meta.unit && (
                            <span className="text-[11px] text-zinc-400 ml-1 select-none">
                              {meta.unit.split('/')[0]}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleNumericStep(item, 1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-200 hover:bg-zinc-100 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                          title="Tăng giá trị"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={currentDraft}
                        onChange={(e) => handleValueChange(item.key, e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-36"
                      />
                    )}

                    {/* Action buttons: Save & Reset */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveConfig(item)}
                        disabled={!hasChanged || isSaving}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                          hasChanged
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                        }`}
                        title="Lưu thay đổi cho cài đặt này"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
                      </button>

                      {isCustomized && (
                        <button
                          type="button"
                          onClick={() => setTargetResetConfig(item)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          title="Đặt lại về mặc định"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Confirmation Modal for Resetting to Default (Consistent with Admin Delete/Status Modals) */}
      {targetResetConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Đặt lại cài đặt
                  </h3>
                  <p className="text-[11px] text-zinc-400">Khôi phục về giá trị mặc định ban đầu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTargetResetConfig(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Bạn có chắc chắn muốn đặt lại mục{' '}
              <strong>"{CONFIG_DISPLAY_MAP[targetResetConfig.key]?.title || targetResetConfig.label}"</strong>{' '}
              về giá trị mặc định (
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {targetResetConfig.defaultValue}
              </span>
              ) không?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetResetConfig(null)}
                disabled={isSubmittingReset}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isSubmittingReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isSubmittingReset ? 'animate-spin' : ''}`} />
                <span>{isSubmittingReset ? 'Đang đặt lại...' : 'Xác nhận đặt lại'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
