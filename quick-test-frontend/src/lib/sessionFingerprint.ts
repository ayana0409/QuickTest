/**
 * Utilities for per-tab exam session token generation and device fingerprinting
 * to enforce Redis-backed Single Active Session (Độc quyền Phiên).
 */

const SESSION_TOKEN_KEY = 'quicktest_exam_session_token';
const DEVICE_FINGERPRINT_KEY = 'quicktest_device_fingerprint';

/**
 * Generates or retrieves the unique session token for the current browser tab.
 * Stored in sessionStorage so that:
 * - Refreshing (F5) the same tab preserves the session token.
 * - Opening a new tab, incognito window, different browser, or different device
 *   creates a brand-new token and evicts the previous session in Redis.
 */
export function getOrCreateExamSessionToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    let token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      const randomPart =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`;
      token = `qtsess_${randomPart}`;
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return `qtsess_fallback_${Date.now()}`;
  }
}

/**
 * Computes a deterministic device/browser fingerprint hash from hardware and environment traits.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'ssr';
  }

  try {
    const cached = sessionStorage.getItem(DEVICE_FINGERPRINT_KEY);
    if (cached) {
      return cached;
    }

    const rawTraits = [
      navigator.userAgent || '',
      navigator.language || '',
      String(navigator.hardwareConcurrency || ''),
      typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : '',
      Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone || '',
    ].join('|');

    // Fast DJB2 / FNV-1a style 32-bit hash
    let hash = 2166136261;
    for (let i = 0; i < rawTraits.length; i++) {
      hash ^= rawTraits.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const fingerprint = `fp_${(hash >>> 0).toString(16).padStart(8, '0')}`;
    sessionStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
    return fingerprint;
  } catch {
    return 'fp_unknown';
  }
}

