import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class names cleanly avoiding conflicting utility classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format remaining seconds into a user-friendly countdown timer string (mm:ss or hh:mm:ss).
 *
 * @param totalSeconds - Total number of seconds remaining.
 * @returns Formatted time string e.g. "45:30" or "01:15:00".
 */
export function formatSeconds(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num: number): string => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format ISO datetime string to localized readable date-time string.
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Format HTML datetime-local input string (YYYY-MM-DDTHH:mm) into backend LocalDateTime string (YYYY-MM-DDTHH:mm:ss).
 */
export function formatDateTimeForPayload(dt?: string | null): string | null {
  if (!dt) return null;
  const trimmed = dt.trim();
  if (!trimmed) return null;
  if (trimmed.length === 16) {
    return `${trimmed}:00`;
  }
  return trimmed;
}
