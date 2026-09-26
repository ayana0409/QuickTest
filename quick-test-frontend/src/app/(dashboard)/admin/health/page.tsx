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
  Inbox
} from 'lucide-react';
import {
  adminHealthService,
  SystemHealthResponse,
  QueueInfo
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

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'UP') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          HOẠT ĐỘNG
        </span>
      );
    }
    if (status === 'DOWN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60">
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          MẤT KẾT NỐI
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        CHỜ DỮ LIỆU
      </span>
    );
  };

  const getLatencyColor = (latencyMs: number | undefined) => {
    if (latencyMs === undefined) return 'text-slate-500';
    if (latencyMs < 50) return 'text-emerald-600 dark:text-emerald-400';
    if (latencyMs < 200) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const renderProgressBar = (percent: number) => {
    let colorClass = 'bg-sky-500';
    if (percent > 70) colorClass = 'bg-amber-500';
    if (percent > 90) colorClass = 'bg-rose-500';

    return (
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mb-1 overflow-hidden border border-slate-200 dark:border-slate-700">
        <div
          className={`h-2.5 rounded-full ${colorClass} transition-all duration-500 ease-in-out relative overflow-hidden`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    );
  };

  // 1. Loading Skeleton
  if (isLoading && !health) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse flex items-center justify-between">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-64"></div>
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-32"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse border border-slate-200 dark:border-slate-700"></div>
          ))}
        </div>
      </div>
    );
  }

  const isGlobalError = isError || (!health && !isLoading);
  const sys = health?.system;
  const comps = health?.components;
  const globalStatus = isGlobalError ? 'DOWN' : health?.status;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Activity className="w-7 h-7 text-sky-500" />
            Giám sát Hệ thống
            {getStatusBadge(globalStatus)}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
            Theo dõi thời gian thực tài nguyên phần cứng và các dịch vụ nền tảng.
            {health?.timestamp && (
              <span className="inline-flex items-center gap-1 ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> Cập nhật lúc {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        
        <button
          onClick={() => fetchHealth(false)}
          disabled={isFetching}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-sm shadow-sky-200 dark:shadow-none"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {isGlobalError ? (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
          <h3 className="text-lg font-bold text-rose-700 dark:text-rose-400">Không thể kết nối đến máy chủ</h3>
          <p className="text-rose-600/80 dark:text-rose-400/80 mt-1">Backend có thể đang tắt hoặc gặp sự cố mạng.</p>
        </div>
      ) : (
        <>
          {/* Section: Hardware Resources */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              Tài nguyên Phần cứng
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* CPU Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{sys?.cpu?.usagePercent ?? 0}%</span>
                </div>
                <h3 className="font-medium text-slate-700 dark:text-slate-200 mb-2">CPU Usage</h3>
                {renderProgressBar(sys?.cpu?.usagePercent ?? 0)}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Chỉ số tải hệ thống CPU tổng thể.
                </p>
              </div>

              {/* RAM Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{sys?.ram?.usagePercent ?? 0}%</span>
                </div>
                <h3 className="font-medium text-slate-700 dark:text-slate-200 mb-2">System Memory (RAM)</h3>
                {renderProgressBar(sys?.ram?.usagePercent ?? 0)}
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <span>Sử dụng: <strong className="text-slate-700 dark:text-slate-300">{formatBytes(sys?.ram?.used ?? 0)}</strong></span>
                  <span>Tổng: {formatBytes(sys?.ram?.total ?? 0)}</span>
                </div>
              </div>

              {/* Disk Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-xl">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{sys?.disk?.usagePercent ?? 0}%</span>
                </div>
                <h3 className="font-medium text-slate-700 dark:text-slate-200 mb-2">Storage (Disk)</h3>
                {renderProgressBar(sys?.disk?.usagePercent ?? 0)}
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <span>Trống: <strong className="text-slate-700 dark:text-slate-300">{formatBytes(sys?.disk?.free ?? 0)}</strong></span>
                  <span>Tổng: {formatBytes(sys?.disk?.total ?? 0)}</span>
                </div>
              </div>

            </div>
          </div>

          {/* Section: Infrastructure */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Box className="w-5 h-5 text-sky-500" />
              Thành phần Hạ tầng
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Database */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">PostgreSQL</h3>
                      <p className="text-xs text-slate-500">Primary Database</p>
                    </div>
                  </div>
                  {getStatusBadge(comps?.database?.status)}
                </div>
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Độ trễ kết nối (Latency)</span>
                    <span className={`font-mono font-medium ${getLatencyColor(comps?.database?.latencyMs)}`}>
                      {comps?.database?.latencyMs !== undefined ? `${comps.database.latencyMs} ms` : 'N/A'}
                    </span>
                  </div>
                  {comps?.database?.error && (
                    <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs rounded-lg border border-rose-100 dark:border-rose-900">
                      <strong className="block mb-1">Lỗi:</strong> {comps.database.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Redis */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Redis Cache</h3>
                      <p className="text-xs text-slate-500">In-memory Store</p>
                    </div>
                  </div>
                  {getStatusBadge(comps?.redis?.status)}
                </div>
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Độ trễ kết nối</span>
                    <span className={`font-mono font-medium ${getLatencyColor(comps?.redis?.latencyMs)}`}>
                      {comps?.redis?.latencyMs !== undefined ? `${comps.redis.latencyMs} ms` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Dung lượng sử dụng</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {comps?.redis?.usedMemoryHuman || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Tổng số Keys</span>
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                      {comps?.redis?.totalKeys !== undefined ? comps.redis.totalKeys.toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* RabbitMQ */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">RabbitMQ</h3>
                      <p className="text-xs text-slate-500">Message Broker</p>
                    </div>
                  </div>
                  {getStatusBadge(comps?.rabbitmq?.status)}
                </div>
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Độ trễ kết nối</span>
                    <span className={`font-mono font-medium ${getLatencyColor(comps?.rabbitmq?.latencyMs)}`}>
                      {comps?.rabbitmq?.latencyMs !== undefined ? `${comps.rabbitmq.latencyMs} ms` : 'N/A'}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 block">Hàng đợi (Queues) đang hoạt động</span>
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                      {comps?.rabbitmq?.queues?.length ? (
                        comps.rabbitmq.queues.map((q: QueueInfo) => (
                          <div key={q.name} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400 truncate pr-2 max-w-[180px]" title={q.name}>
                              {q.name.replace('.queue', '')}
                            </span>
                            <span className={`font-mono px-2 py-0.5 rounded-full text-xs ${
                              q.messageCount > 0 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 font-bold' 
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {q.messageCount} msg
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 italic text-center py-2">Không thể tải thông tin Queues</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* Footer Info */}
      <div className="text-center pt-4">
        <p className="text-xs text-slate-400">
          Dữ liệu được cập nhật tự động mỗi 10 giây thông qua Actuator & OSHI.
        </p>
      </div>

    </div>
  );
}
