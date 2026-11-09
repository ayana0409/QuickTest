import type { AttemptStatus, ExamStatus } from '@/types/exam';
import type { ViolationType } from '@/types/proctoring';
import type { BadgeProps } from '@/components/common/Badge';
import {
  MonitorX,
  AlertTriangle,
  Maximize2,
  Terminal,
  Copy,
  UserX,
  Users,
} from 'lucide-react';

/**
 * Format candidate attempt status into compact, natural Vietnamese UI text.
 * Strictly designed to be concise and prevent overflow in badges and tables.
 */
export function formatAttemptStatus(status: AttemptStatus | string): {
  label: string;
  shortLabel: string;
  variant: BadgeProps['variant'];
} {
  switch (status) {
    case 'IN_PROGRESS':
      return {
        label: 'Đang làm bài',
        shortLabel: 'Đang thi',
        variant: 'IN_PROGRESS',
      };
    case 'SUBMITTED':
      return {
        label: 'Đã nộp bài',
        shortLabel: 'Đã nộp',
        variant: 'SUBMITTED',
      };
    case 'AWAITING_MANUAL_GRADING':
      return {
        label: 'Chờ chấm tự luận',
        shortLabel: 'Chờ chấm',
        variant: 'AWAITING_MANUAL_GRADING',
      };
    case 'DISQUALIFIED':
      return {
        label: 'Bị đình chỉ thi',
        shortLabel: 'Đình chỉ',
        variant: 'DISQUALIFIED',
      };
    default:
      return {
        label: status || 'Không xác định',
        shortLabel: status || '—',
        variant: 'neutral',
      };
  }
}

/**
 * Format exam publication status into clean Vietnamese text without unnecessary English parentheses.
 */
export function formatExamStatus(status: ExamStatus | string): {
  label: string;
  variant: BadgeProps['variant'];
} {
  switch (status) {
    case 'PUBLISHED':
      return {
        label: 'Đang mở',
        variant: 'PUBLISHED',
      };
    case 'DRAFT':
      return {
        label: 'Bản nháp',
        variant: 'DRAFT',
      };
    case 'CLOSED':
      return {
        label: 'Đã đóng',
        variant: 'CLOSED',
      };
    case 'ARCHIVED':
      return {
        label: 'Đã lưu trữ',
        variant: 'ARCHIVED',
      };
    default:
      return {
        label: status || 'Không xác định',
        variant: 'neutral',
      };
  }
}

/**
 * Format online/offline heartbeat connection state.
 * Uses user-confirmed "Trực tuyến" / "Ngoại tuyến".
 */
export function formatConnectionStatus(isOnline: boolean): {
  label: string;
  colorClass: string;
} {
  if (isOnline) {
    return {
      label: 'Trực tuyến',
      colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200/60 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800/40',
    };
  }
  return {
    label: 'Ngoại tuyến',
    colorClass: 'text-zinc-500 bg-zinc-100 border-zinc-200 dark:text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700',
  };
}

/**
 * Format violation type into clear, human-friendly Vietnamese label, icon and theme styles.
 * Replaces developer jargon (DevTools, Telemetry, etc.) with familiar terms.
 */
export function formatViolationType(type: ViolationType | string) {
  switch (type) {
    case 'TAB_SWITCH':
      return {
        label: 'Chuyển tab bài thi',
        shortLabel: 'Chuyển tab',
        icon: MonitorX,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      };
    case 'WINDOW_BLUR':
      return {
        label: 'Rời cửa sổ làm bài',
        shortLabel: 'Rời cửa sổ',
        icon: MonitorX,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      };
    case 'MULTI_SCREEN_DETECTED':
    case 'MULTI_SCREEN':
      return {
        label: 'Dùng nhiều màn hình',
        shortLabel: 'Nhiều màn hình',
        icon: AlertTriangle,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
      };
    case 'EXIT_FULLSCREEN':
      return {
        label: 'Thoát toàn màn hình',
        shortLabel: 'Thoát toàn màn hình',
        icon: Maximize2,
        color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20',
      };
    case 'DEVTOOLS_OPEN':
      return {
        label: 'Mở công cụ F12',
        shortLabel: 'Mở F12',
        icon: Terminal,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
      };
    case 'COPY_PASTE_ATTEMPT':
      return {
        label: 'Sao chép / Dán bài',
        shortLabel: 'Sao chép / Dán',
        icon: Copy,
        color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20',
      };
    case 'NO_FACE_DETECTED':
      return {
        label: 'Không thấy khuôn mặt',
        shortLabel: 'Không thấy mặt',
        icon: UserX,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      };
    case 'MULTIPLE_FACES':
      return {
        label: 'Có người lạ trước máy',
        shortLabel: 'Có người lạ',
        icon: Users,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
      };
    case 'TEACHER_DISQUALIFY':
      return {
        label: 'Giám thị đình chỉ',
        shortLabel: 'Giám thị đình chỉ',
        icon: UserX,
        color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20',
      };
    default:
      return {
        label: 'Vi phạm quy chế thi',
        shortLabel: 'Vi phạm',
        icon: AlertTriangle,
        color: 'text-zinc-600 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
      };
  }
}

/**
 * Format duration seconds into human-readable compact format.
 * Replaces technical "1g 2p 3s" with clear notation "1h 02m 03s" or "2m 15s".
 */
export function formatDurationCompact(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return '—';
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

/**
 * Cleanly format candidate avatar initials without parenthesis, numbers or special characters.
 * Fixes the issue where candidate names with room/test code suffixes (e.g. "Hồ Thanh Hiếu (BRY3EE...)")
 * inadvertently rendered trailing "(" as their avatar initial ("H(").
 */
export function formatCandidateInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'TS';

  // 1. Remove bracketed/parenthesized content like "(BRY3EE-1-0-XYZ)"
  const withoutParentheses = name.replace(/\(.*?\)/g, ' ').replace(/\[.*?\]/g, ' ');

  // 2. Keep only letters and spaces (supports Vietnamese diacritics)
  const lettersOnly = withoutParentheses.replace(/[^a-zA-ZÀ-ỹ\s]/g, ' ').trim();

  const words = lettersOnly.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    // Pick first letters of the last two words (Middle name + Given name in VN convention)
    return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  // Fallback for purely alphanumeric identifiers without standard words (e.g. "guest_ts_01")
  const rawClean = name.replace(/[^a-zA-Z0-9]/g, '');
  return (rawClean.slice(0, 2) || 'TS').toUpperCase();
}
