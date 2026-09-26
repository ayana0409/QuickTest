/**
 * Severity level of the logged action.
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Execution outcome status of the logged action.
 */
export type LogStatus = 'SUCCESS' | 'FAILURE';

/**
 * Summary representation of a system log entry for tabular listing.
 */
export interface AdminSystemLog {
  id: string;
  level: LogLevel;
  module: string;
  action: string;
  status: LogStatus;
  actorId?: string | null;
  actorUsername?: string | null;
  actorRole?: string | null;
  endpoint?: string | null;
  httpMethod?: string | null;
  ipAddress?: string | null;
  errorMessage?: string | null;
  executionTimeMs?: number | null;
  createdAt: string;
  hasDetails: boolean;
}

/**
 * Comprehensive details of a system log entry including payload and stacktrace.
 */
export interface AdminSystemLogDetail extends AdminSystemLog {
  details?: string | null;
}

/**
 * Real-time operational KPI metrics and system health indicators.
 */
export interface AdminSystemLogStats {
  totalLogs: number;
  successCount: number;
  failureCount: number;
  errorRate: number;
  infoCount: number;
  warnCount: number;
  errorCount: number;
  averageExecutionTimeMs: number;
  moduleCounts: Record<string, number>;
}

/**
 * Distinct modules and action tags discovered in the database for dynamic filters.
 */
export interface AdminSystemLogMetadata {
  modules: string[];
  actions: string[];
}

/**
 * Query and filter parameters for searchLogs API.
 */
export interface SystemLogFilterParams {
  level?: string;
  status?: string;
  module?: string;
  action?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}
