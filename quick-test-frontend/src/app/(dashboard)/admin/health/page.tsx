'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Box,
  Layers,
  Inbox,
  Zap,
} from 'lucide-react';
import {
  adminHealthService,
  SystemHealthResponse,
  QueueInfo,
} from '@/services/adminHealthService';

export default function AdminHealthCheckPage() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Fetch system health metrics
  const fetchHealth = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    try {
      const data = await adminHealthService.getSystemHealth();
      if (isMountedRef.current) {
        setHealth(data);
        setIsError(false);
      }
    } catch {
      if (isMountedRef.current) {
        setIsError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, []);

  // Polling every 10s
  useEffect(() => {
    isMountedRef.current = true;
    fetchHealth(true);

    const intervalId = setInterval(() => {
      fetchHealth(false);
    }, 10000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchHealth]);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'UP') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Khỏe mạnh</span>
        </span>
      );
    }
    if (status === 'DOWN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60">
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>Mất kết nối</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span>Chờ tín hiệu</span>
      </span>
    );
  };

  const getLatencyBadge = (latencyMs: number | undefined) => {
    if (latencyMs === undefined) {
      return (
        <span className="font-mono text-[11px] text-zinc-400 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">
          N/A
        </span>
      );
    }

    let color = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/60';
    if (latencyMs >= 50 && latencyMs < 200) {
      color = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-900/60';
    } else if (latencyMs >= 200) {
      color = 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-900/60';
    }

    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border ${color}`}>
        <Zap className="w-3 h-3" />
        {latencyMs} ms
      </span>
    );
  };

  const renderHairlineProgressBar = (percent: number) => {
    let colorClass = 'bg-emerald-500';
    if (percent > 70) colorClass = 'bg-amber-500';
    if (percent > 90) colorClass = 'bg-rose-500';

    return (
      <div className="w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full ${colorClass} transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    );
  };

  // Loading Skeleton
  if (isLoading && !health) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-56" />
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded-md w-40" />
          </div>
          <div className="h-9 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-28" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-zinc-100 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-zinc-100 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  const isGlobalError = isError || (!health && !isLoading);
  const sys = health?.system;
  const comps = health?.components;
  const globalStatus = isGlobalError ? 'DOWN' : health?.status;

  const activeServicesCount = [
    comps?.database?.status === 'UP',
    comps?.redis?.status === 'UP',
    comps?.rabbitmq?.status === 'UP',
  ].filter(Boolean).length;

  return (
    <div className="p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      
      {/* 1. Hero Header & Live Heartbeat Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
              Giám sát Hệ thống
            </h1>
            {getStatusBadge(globalStatus)}
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>{activeServicesCount}/3 Dịch vụ hoạt động</span>
            </span>

            {health?.timestamp && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                <Clock className="w-3 h-3" />
                {new Date(health.timestamp).toLocaleTimeString('vi-VN')}
              </span>
            )}
          </div>
        </div>

        {/* Action Button: Refresh with Live Animation */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => fetchHealth(false)}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all disabled:opacity-60 cursor-pointer shrink-0 border border-zinc-200/60 dark:border-zinc-700/60"
            title="Làm mới dữ liệu ngay"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 ${isFetching ? 'animate-spin text-indigo-500' : ''}`} />
            <span>{isFetching ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {isGlobalError ? (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-400">
              Không thể kết nối đến máy chủ API
            </h3>
            <p className="text-xs text-rose-600/80 dark:text-rose-400/80 max-w-md">
              Backend máy chủ có thể đang khởi động lại hoặc tạm thời mất liên lạc.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchHealth(true)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
          >
            Thử kết nối lại
          </button>
        </div>
      ) : (
        <>
          {/* 2. Hardware Resources: 3 Compact Columns on Mobile & Desktop */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <Server className="w-4 h-4 text-indigo-500" />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Tài nguyên Phần cứng
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {/* CPU Metric Card */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">
                      CPU
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                    {sys?.cpu?.usagePercent ?? 0}%
                  </div>
                  <div className="mt-2">
                    {renderHairlineProgressBar(sys?.cpu?.usagePercent ?? 0)}
                  </div>
                </div>

                <div className="text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-500 truncate pt-0.5">
                  Tải vi xử lý
                </div>
              </div>

              {/* RAM Metric Card */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">
                      RAM
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                    {sys?.ram?.usagePercent ?? 0}%
                  </div>
                  <div className="mt-2">
                    {renderHairlineProgressBar(sys?.ram?.usagePercent ?? 0)}
                  </div>
                </div>

                <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate pt-0.5">
                  {formatBytes(sys?.ram?.used ?? 0)} / {formatBytes(sys?.ram?.total ?? 0)}
                </div>
              </div>

              {/* Disk Metric Card */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                      <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">
                      DISK
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                    {sys?.disk?.usagePercent ?? 0}%
                  </div>
                  <div className="mt-2">
                    {renderHairlineProgressBar(sys?.disk?.usagePercent ?? 0)}
                  </div>
                </div>

                <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate pt-0.5">
                  Trống {formatBytes(sys?.disk?.free ?? 0)}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Platform Services: Full Inline Details Directly on Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-sky-500" />
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Dịch vụ Nền tảng
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              
              {/* PostgreSQL Card - Full Details Inline */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                          PostgreSQL
                        </h3>
                        <p className="text-[11px] text-zinc-400">Cơ sở dữ liệu chính</p>
                      </div>
                    </div>
                    {getStatusBadge(comps?.database?.status)}
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Độ trễ kết nối (Ping)</span>
                      {getLatencyBadge(comps?.database?.latencyMs)}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-200/40 dark:border-zinc-700/40">
                      <span className="text-zinc-500 dark:text-zinc-400">Động cơ lưu trữ</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        PostgreSQL 16 RDBMS
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-200/40 dark:border-zinc-700/40">
                      <span className="text-zinc-500 dark:text-zinc-400">Trạng thái Pool</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Sẵn sàng xử lý
                      </span>
                    </div>
                  </div>

                  {comps?.database?.error && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs border border-rose-200/60 dark:border-rose-900/60 font-mono">
                      <span className="font-bold block mb-0.5">Lỗi ghi nhận:</span>
                      {comps.database.error}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span>Kết nối SQL Pool</span>
                  <span className="font-mono text-zinc-500">Port 5432</span>
                </div>
              </div>

              {/* Redis Card - Full Details Inline */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                          Redis Cache
                        </h3>
                        <p className="text-[11px] text-zinc-400">Bộ nhớ đệm phiên & OTP</p>
                      </div>
                    </div>
                    {getStatusBadge(comps?.redis?.status)}
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Độ trễ kết nối (Ping)</span>
                      {getLatencyBadge(comps?.redis?.latencyMs)}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-200/40 dark:border-zinc-700/40">
                      <span className="text-zinc-500 dark:text-zinc-400">Dung lượng sử dụng</span>
                      <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                        {comps?.redis?.usedMemoryHuman || '0 B'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-200/40 dark:border-zinc-700/40">
                      <span className="text-zinc-500 dark:text-zinc-400">Tổng bản ghi đệm</span>
                      <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                        {comps?.redis?.totalKeys !== undefined ? comps.redis.totalKeys.toLocaleString() : '0'} keys
                      </span>
                    </div>
                  </div>

                  {comps?.redis?.error && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs border border-rose-200/60 dark:border-rose-900/60 font-mono">
                      <span className="font-bold block mb-0.5">Lỗi ghi nhận:</span>
                      {comps.redis.error}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span>Khóa đệm phiên & OTP</span>
                  <span className="font-mono text-zinc-500">In-Memory</span>
                </div>
              </div>

              {/* RabbitMQ Card - Full Details Inline with Queue List */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Inbox className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                          RabbitMQ
                        </h3>
                        <p className="text-[11px] text-zinc-400">Hàng đợi truyền thông điệp</p>
                      </div>
                    </div>
                    {getStatusBadge(comps?.rabbitmq?.status)}
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Độ trễ kết nối (Ping)</span>
                      {getLatencyBadge(comps?.rabbitmq?.latencyMs)}
                    </div>
                    
                    {/* Inline Queues List */}
                    <div className="pt-2 border-t border-zinc-200/40 dark:border-zinc-700/40 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                        <span>Hàng đợi ({comps?.rabbitmq?.queues?.length ?? 0})</span>
                        <span>Tin nhắn</span>
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                        {comps?.rabbitmq?.queues?.length ? (
                          comps.rabbitmq.queues.map((q: QueueInfo) => (
                            <div
                              key={q.name}
                              className="flex items-center justify-between py-1 px-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 text-xs"
                            >
                              <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate pr-2 max-w-[170px]" title={q.name}>
                                {q.name.replace('.queue', '')}
                              </span>
                              <span
                                className={`font-mono px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                  q.messageCount > 0
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                }`}
                              >
                                {q.messageCount} msg
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-zinc-400 italic text-center py-1">
                            Không có hàng đợi đang chạy
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {comps?.rabbitmq?.error && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs border border-rose-200/60 dark:border-rose-900/60 font-mono">
                      <span className="font-bold block mb-0.5">Lỗi ghi nhận:</span>
                      {comps.rabbitmq.error}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span>Hàng đợi async tasks</span>
                  <span className="font-mono text-zinc-500">AMQP</span>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
