/**
 * Global Fullscreen Safety & Programmatic Teardown Manager.
 * Distinguishes between intentional fullscreen exits (e.g. exam submission, auto-submit on countdown expire,
 * teacher disqualification, unmount cleanup) and unauthorized candidate fullscreen escapes (e.g. pressing ESC, F11).
 */

let isProgrammaticFullscreenExit = false;

/**
 * Safely exit browser fullscreen mode without triggering false proctoring violations.
 */
export async function exitFullscreenSafely(): Promise<void> {
  try {
    if (
      typeof document !== 'undefined' &&
      document.fullscreenElement &&
      typeof document.exitFullscreen === 'function'
    ) {
      isProgrammaticFullscreenExit = true;
      await document.exitFullscreen();
    }
  } catch (err) {
    console.warn('[FullscreenManager] Failed to exit fullscreen cleanly:', err);
  } finally {
    // Keep flag true for 600ms to cover all queued fullscreenchange browser events
    setTimeout(() => {
      isProgrammaticFullscreenExit = false;
    }, 600);
  }
}

/**
 * Check if the browser is currently exiting fullscreen intentionally via exam completion or system cleanup.
 */
export function isExitingFullscreenSafely(): boolean {
  return isProgrammaticFullscreenExit;
}

