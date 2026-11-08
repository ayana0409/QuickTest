/**
 * Global Webcam Stream Registry & Hardware Teardown Manager.
 * Ensures every MediaStream and hardware MediaStreamTrack opened by the browser
 * is strictly registered and can be instantly terminated upon exam finish,
 * disqualification, or navigation to any non-exam page (e.g. homepage, result page).
 */

const globalStreams = new Set<MediaStream>();

/**
 * Register an active MediaStream obtained from getUserMedia.
 */
export function registerActiveWebcamStream(stream: MediaStream): void {
  if (!stream) return;
  globalStreams.add(stream);

  // If all tracks in this stream end on their own, remove from registry
  stream.getTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      const allEnded = stream.getTracks().every((t) => t.readyState === 'ended');
      if (allEnded) {
        globalStreams.delete(stream);
      }
    });
  });
}

/**
 * Unregister a MediaStream from the registry.
 */
export function unregisterActiveWebcamStream(stream: MediaStream): void {
  if (!stream) return;
  globalStreams.delete(stream);
}

/**
 * Stop and terminate all tracks in a specific MediaStream.
 */
export function stopWebcamStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
        track.enabled = false;
      } catch (err) {
        console.warn('[WebcamManager] Error stopping track:', err);
      }
    });
  } catch (err) {
    console.warn('[WebcamManager] Error in stopWebcamStream:', err);
  } finally {
    globalStreams.delete(stream);
  }
}

/**
 * Force stop all active webcam hardware tracks across the entire application.
 * 1. Stops all registered MediaStreams in memory.
 * 2. Traverses all <video> elements in the DOM, detaches and stops their srcObjects.
 * 3. Immediately shuts down the physical webcam hardware indicator LED.
 */
export function stopAllAppWebcams(): void {
  try {
    // 1. Stop all registered streams in memory
    globalStreams.forEach((stream) => {
      try {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {}
        });
      } catch {}
    });
    globalStreams.clear();

    // 2. Scan all video elements in the DOM
    if (typeof document !== 'undefined') {
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        try {
          video.pause();
          const srcObj = video.srcObject;
          if (srcObj && srcObj instanceof MediaStream) {
            srcObj.getTracks().forEach((track) => {
              try {
                track.stop();
                track.enabled = false;
              } catch {}
            });
            video.srcObject = null;
          }
          video.removeAttribute('src');
          video.load();
        } catch {}
      });
    }
  } catch (err) {
    console.warn('[WebcamManager] Error during stopAllAppWebcams:', err);
  }
}

// Auto-cleanup on window unload or page navigation
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => stopAllAppWebcams());
  window.addEventListener('pagehide', () => stopAllAppWebcams());
}

