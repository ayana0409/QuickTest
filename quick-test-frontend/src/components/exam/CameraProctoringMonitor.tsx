'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  AlertTriangle,
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
  CheckCircle2,
  Minimize2,
  Maximize2,
  RefreshCw,
  Video,
} from 'lucide-react';
import { candidateSessionService } from '@/services/candidateSession.service';
import type { ViolationType } from '@/types/proctoring';
import {
  registerActiveWebcamStream,
  stopWebcamStream,
  stopAllAppWebcams,
} from '@/lib/webcamManager';
import { cn } from '@/lib/utils';

interface CameraProctoringMonitorProps {
  attemptId: string;
  isCameraProctoringEnabled: boolean;
  isTerminated?: boolean; // When exam is submitted or candidate disqualified, shut down camera immediately
  onViolation: (violationType: ViolationType, description: string, evidenceUrl?: string) => Promise<void> | void;
  onCameraGatePassed?: () => void;
  onCameraReadyChange?: (isReady: boolean) => void;
}

type FaceStatus = 'INITIALIZING' | 'OK' | 'NO_FACE' | 'MULTIPLE_FACES' | 'CAMERA_ERROR';

export const CameraProctoringMonitor: React.FC<CameraProctoringMonitorProps> = ({
  attemptId,
  isCameraProctoringEnabled,
  isTerminated = false,
  onViolation,
  onCameraGatePassed,
  onCameraReadyChange,
}) => {
  // Gate & stream states
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [gatePassed, setGatePassed] = useState<boolean>(false);
  const [isVerifyingGate, setIsVerifyingGate] = useState<boolean>(false);
  const [gateFaceCount, setGateFaceCount] = useState<number | null>(null);

  // Synchronize camera ready state to parent exam runner
  useEffect(() => {
    const isReady = Boolean(gatePassed && streamActive);
    onCameraReadyChange?.(isReady);
  }, [gatePassed, streamActive, onCameraReadyChange]);

  // Runtime monitor states
  const [faceStatus, setFaceStatus] = useState<FaceStatus>('INITIALIZING');
  const [detectedFaces, setDetectedFaces] = useState<number>(1);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isCapturingBurst, setIsCapturingBurst] = useState<boolean>(false);

  // Element and worker refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const isModelLoadedRef = useRef<boolean>(false);
  const isCameraDesiredRef = useRef<boolean>(true);

  // Rolling frame queue: retains up to 10 canvas snapshots (sampled every 2s)
  const frameQueueRef = useRef<HTMLCanvasElement[]>([]);

  // Violation anti-flicker counters & cooldowns
  const noFaceCyclesRef = useRef<number>(0);
  const multipleFacesCyclesRef = useRef<number>(0);
  const lastViolationTimeRef = useRef<number>(0);
  const isProcessingViolationRef = useRef<boolean>(false);

  const FRAME_WIDTH = 320;
  const FRAME_HEIGHT = 240;
  const COOLDOWN_MS = 25000; // 25s cooldown between same-source camera violations

  // Helper to load MediaPipe Face Detector
  const loadDetector = async () => {
    if (detectorRef.current || isModelLoadedRef.current) return detectorRef.current;

    try {
      let visionModule: any;
      try {
        // First try local npm package
        // @ts-ignore
        visionModule = await import('@mediapipe/tasks-vision');
      } catch {
        // Fallback to dynamic CDN import for resilient runtime loading
        // @ts-ignore
        visionModule = await (Function('return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm")')());
      }

      const { FilesetResolver, FaceDetector } = visionModule;
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });

      detectorRef.current = detector;
      isModelLoadedRef.current = true;
      return detector;
    } catch (err) {
      console.error('[CameraProctoring] Failed to load MediaPipe FaceDetector:', err);
      return null;
    }
  };

  // Start webcam stream
  const startCamera = useCallback(async () => {
    isCameraDesiredRef.current = true;
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập máy ảnh (getUserMedia).');
      }

      // Terminate any previous existing stream before requesting a new one
      if (streamRef.current) {
        stopWebcamStream(streamRef.current);
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: FRAME_WIDTH },
          height: { ideal: FRAME_HEIGHT },
          frameRate: { ideal: 10, max: 15 },
        },
        audio: false,
      });

      // If camera was stopped or unmounted while getUserMedia was resolving, stop immediately
      if (!isCameraDesiredRef.current || isTerminated) {
        stopWebcamStream(stream);
        return;
      }

      registerActiveWebcamStream(stream);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }

      // Track camera disconnect / revocation
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          // Ignore track end triggered by intentional camera teardown on submit/disqualification
          if (!isCameraDesiredRef.current || isTerminated) return;
          console.warn('[CameraProctoring] Camera stream track ended unexpectedly.');
          setStreamActive(false);
          setCameraError('Tín hiệu camera đã bị ngắt. Vui lòng kết nối lại để tiếp tục.');
        };
      }

      setStreamActive(true);
      await loadDetector();
    } catch (err: any) {
      console.error('[CameraProctoring] Error accessing webcam:', err);
      setStreamActive(false);
      setCameraError(
        err?.message ||
        'Không thể truy cập máy ảnh. Vui lòng cấp quyền truy cập camera trong cài đặt trình duyệt.'
      );
    }
  }, [isTerminated]);

  // Stop camera stream cleanly and wipe all memory/caches
  const stopCamera = useCallback(() => {
    isCameraDesiredRef.current = false;
    if (streamRef.current) {
      stopWebcamStream(streamRef.current);
      streamRef.current = null;
    }
    stopAllAppWebcams();
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch { }
    }
    // Wipe all cached frame snapshots immediately to prevent memory retention
    frameQueueRef.current = [];
    if (detectorRef.current && typeof detectorRef.current.close === 'function') {
      try {
        detectorRef.current.close();
      } catch { }
      detectorRef.current = null;
      isModelLoadedRef.current = false;
    }
    setStreamActive(false);
  }, []);

  // Instantly stop camera and wipe memory if terminated (submitted or disqualified)
  useEffect(() => {
    if (isTerminated) {
      stopCamera();
    }
  }, [isTerminated, stopCamera]);

  // Initialize camera on mount if camera proctoring enabled
  useEffect(() => {
    if (!isCameraProctoringEnabled || isTerminated) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isCameraProctoringEnabled, isTerminated, startCamera, stopCamera]);

  // Assign and synchronize video element whenever it mounts
  const assignVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (!node) {
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          videoRef.current.srcObject = null;
        } catch { }
      }
      videoRef.current = null;
      return;
    }
    videoRef.current = node;

    // Enforce properties directly on DOM element so Chromium/Edge never block autoplay
    node.muted = true;
    node.defaultMuted = true;
    node.playsInline = true;
    node.setAttribute('playsinline', 'true');
    node.setAttribute('webkit-playsinline', 'true');

    if (streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
      }
      node.play().catch((err) => {
        console.warn('[CameraProctoring] Play on assign deferred to loadedmetadata:', err);
      });
    }
  }, []);

  // Keep video source synchronized if stream is re-established or UI view changes
  useEffect(() => {
    const video = videoRef.current;
    if (streamActive && streamRef.current && video) {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.play().catch(() => { });
    }
  }, [streamActive, gatePassed, isMinimized]);

  // Helper to draw current video frame to a new offscreen canvas
  const captureCurrentFrameCanvas = (): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = document.createElement('canvas');
    canvas.width = FRAME_WIDTH;
    canvas.height = FRAME_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    return canvas;
  };

  // Helper to convert canvas to WebP/JPEG blob
  const canvasToBlob = (canvas: HTMLCanvasElement, quality = 0.55): Promise<Blob | null> => {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/webp',
        quality
      );
    });
  };

  // Helper to convert blob to Base64 data URL as resilient fallback
  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Gate verification: Check single face before allowing candidate into exam
  const handleVerifyGate = async () => {
    setIsVerifyingGate(true);
    setGateFaceCount(null);

    const detector = detectorRef.current || (await loadDetector());
    const video = videoRef.current;

    if (!detector || !video || video.readyState < 2) {
      setIsVerifyingGate(false);
      return;
    }

    try {
      const detections = detector.detect(video);
      const count = detections.detections?.length || 0;
      setGateFaceCount(count);

      if (count === 1) {
        // Direct synchronous call inside user gesture to reliably request fullscreen
        if (
          typeof document !== 'undefined' &&
          !document.fullscreenElement &&
          typeof document.documentElement?.requestFullscreen === 'function'
        ) {
          try {
            await document.documentElement.requestFullscreen();
          } catch (fsErr) {
            console.warn('[CameraProctoring] Fullscreen request rejected on gate pass:', fsErr);
          }
        }

        setGatePassed(true);
        setIsVerifyingGate(false);
        onCameraGatePassed?.();
      } else {
        setIsVerifyingGate(false);
      }
    } catch (err) {
      console.error('[CameraProctoring] Gate detection error:', err);
      setIsVerifyingGate(false);
    }
  };

  // Execute 15-frame burst capture and stitch into 5x3 sprite sheet
  const captureAndStitch15FrameSprite = async (): Promise<Blob | null> => {
    setIsCapturingBurst(true);

    try {
      // 1. Keep last 5 frames from rolling queue
      const existingQueue = frameQueueRef.current;
      const pastFrames = existingQueue.slice(-5);

      // 2. Capture 10 new frames at 5 FPS (every 200ms)
      const newFrames: HTMLCanvasElement[] = [];
      for (let i = 0; i < 10; i++) {
        const frame = captureCurrentFrameCanvas();
        if (frame) {
          newFrames.push(frame);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const all15Frames = [...pastFrames, ...newFrames];

      // Pad if less than 15
      while (all15Frames.length < 15 && all15Frames.length > 0) {
        all15Frames.push(all15Frames[all15Frames.length - 1]);
      }

      // 3. Assemble 5 columns x 3 rows sprite sheet (1600 x 720)
      const spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = FRAME_WIDTH * 5; // 1600
      spriteCanvas.height = FRAME_HEIGHT * 3; // 720
      const ctx = spriteCanvas.getContext('2d');
      if (!ctx) return null;

      for (let idx = 0; idx < all15Frames.length; idx++) {
        const frame = all15Frames[idx];
        const col = idx % 5;
        const row = Math.floor(idx / 5);
        const sx = col * FRAME_WIDTH;
        const sy = row * FRAME_HEIGHT;
        ctx.drawImage(frame, sx, sy, FRAME_WIDTH, FRAME_HEIGHT);
      }

      // 4. Compress to WebP quality 0.55 (~60-90KB)
      return await canvasToBlob(spriteCanvas, 0.55);
    } finally {
      setIsCapturingBurst(false);
    }
  };

  // Trigger violation: upload evidence directly to Cloudinary and notify backend
  const triggerViolation = async (type: 'NO_FACE_DETECTED' | 'MULTIPLE_FACES', count: number) => {
    if (isProcessingViolationRef.current) return;
    const now = Date.now();
    if (now - lastViolationTimeRef.current < COOLDOWN_MS) return;

    isProcessingViolationRef.current = true;
    lastViolationTimeRef.current = now;

    try {
      let evidenceBlob: Blob | null = null;
      let description = '';

      if (type === 'NO_FACE_DETECTED') {
        const singleFrame = captureCurrentFrameCanvas();
        if (singleFrame) {
          evidenceBlob = await canvasToBlob(singleFrame, 0.55);
        }
        description = 'Không phát hiện khuôn mặt thí sinh trong khung hình camera quá 6 giây.';
      } else {
        evidenceBlob = await captureAndStitch15FrameSprite();
        description = `Phát hiện có ${count} người xuất hiện trong khu vực làm bài thi.`;
      }

      let evidenceUrl: string | undefined = undefined;

      if (evidenceBlob) {
        try {
          const sig = await candidateSessionService.getUploadSignature(attemptId);
          if (sig && sig.apiKey && sig.cloudName) {
            evidenceUrl = await candidateSessionService.uploadEvidenceToCloudinary(
              sig,
              evidenceBlob,
              `${type.toLowerCase()}_${Date.now()}.webp`
            );
          }
        } catch (uploadErr) {
          console.warn('[CameraProctoring] Direct Cloudinary upload failed, falling back to data URL:', uploadErr);
        }

        // Resilient Fallback: If Cloudinary is unconfigured or upload fails, serialize blob to Data URL
        // Ensures proctoring evidence images/videos are NEVER LOST!
        if (!evidenceUrl) {
          try {
            evidenceUrl = await blobToDataUrl(evidenceBlob);
          } catch (dataUrlErr) {
            console.warn('[CameraProctoring] Failed to create data URL fallback:', dataUrlErr);
          }
        }
      }

      await onViolation(type, description, evidenceUrl);
    } catch (err) {
      console.error('[CameraProctoring] Failed to process camera violation:', err);
    } finally {
      isProcessingViolationRef.current = false;
    }
  };

  // Main monitoring interval: Every 2 seconds
  useEffect(() => {
    if (!isCameraProctoringEnabled || !gatePassed || !streamActive || isTerminated) return;

    const intervalId = setInterval(async () => {
      if (isTerminated) {
        clearInterval(intervalId);
        return;
      }

      const video = videoRef.current;
      const detector = detectorRef.current || (await loadDetector());

      if (!video || !detector || isProcessingViolationRef.current) {
        return;
      }

      // If video playback was paused by browser or detached, actively revive playback
      if (video.paused || video.readyState < 2) {
        video.muted = true;
        if (streamRef.current && video.srcObject !== streamRef.current) {
          video.srcObject = streamRef.current;
        }
        video.play().catch(() => { });
        return;
      }

      // 1. Snapshot current frame and push to rolling queue (max 10)
      const currentFrame = captureCurrentFrameCanvas();
      if (currentFrame) {
        frameQueueRef.current.push(currentFrame);
        if (frameQueueRef.current.length > 10) {
          frameQueueRef.current.shift();
        }
      }

      // 2. Perform Face Detection
      try {
        const detections = detector.detect(video);
        const count = detections.detections?.length || 0;
        setDetectedFaces(count);

        if (count === 1) {
          setFaceStatus('OK');
          noFaceCyclesRef.current = 0;
          multipleFacesCyclesRef.current = 0;
        } else if (count === 0) {
          noFaceCyclesRef.current += 1;
          multipleFacesCyclesRef.current = 0;
          setFaceStatus('NO_FACE');

          // Trigger after 3 consecutive cycles (6s)
          if (noFaceCyclesRef.current >= 3) {
            triggerViolation('NO_FACE_DETECTED', 0);
          }
        } else {
          // count > 1
          multipleFacesCyclesRef.current += 1;
          noFaceCyclesRef.current = 0;
          setFaceStatus('MULTIPLE_FACES');

          // Trigger after 2 consecutive cycles (4s)
          if (multipleFacesCyclesRef.current >= 2) {
            triggerViolation('MULTIPLE_FACES', count);
          }
        }
      } catch (detErr) {
        console.warn('[CameraProctoring] Face detection loop error:', detErr);
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isCameraProctoringEnabled, gatePassed, streamActive, isTerminated, attemptId]);

  if (!isCameraProctoringEnabled || isTerminated) return null;

  // ==========================================
  // 1. Mandatory Unified Entry Gate (Camera & Fullscreen)
  // ==========================================
  if (!gatePassed || !streamActive) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 select-none animate-in fade-in">
        <div className="w-full max-w-md bg-[#161B22] border border-[#30363D] rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Top glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            {streamActive ? <Maximize2 className="w-8 h-8" /> : <CameraOff className="w-8 h-8" />}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Yêu cầu Camera
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 mb-5 leading-relaxed">
            Camera sẽ hoạt động trong suốt thời gian làm bài.
          </p>

          {/* Camera Preview Box in Gate */}
          <div className="relative mx-auto w-64 h-48 rounded-2xl overflow-hidden bg-zinc-900 border-2 border-zinc-700 shadow-inner mb-4 flex items-center justify-center">
            <video
              ref={assignVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                transform: 'scaleX(-1)',
                backfaceVisibility: 'visible',
                WebkitBackfaceVisibility: 'visible',
              }}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                v.muted = true;
                v.play().catch(() => { });
              }}
              onCanPlay={(e) => {
                const v = e.currentTarget;
                v.muted = true;
                v.play().catch(() => { });
              }}
              className="w-full h-full object-cover"
            />

            {!streamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-zinc-900/90 text-zinc-400 text-center">
                <CameraOff className="w-8 h-8 text-rose-400 mb-2" />
                <p className="text-xs">{cameraError || 'Chưa nhận được tín hiệu máy ảnh'}</p>
              </div>
            )}

            {streamActive && gateFaceCount !== null && (
              <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg backdrop-blur-md text-xs font-medium text-center">
                {gateFaceCount === 1 ? (
                  <span className="text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    ✓ Đã nhận diện thí sinh
                  </span>
                ) : gateFaceCount === 0 ? (
                  <span className="text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                    ⚠ Vui lòng nhìn thẳng vào camera
                  </span>
                ) : (
                  <span className="text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                    ⚠ Có nhiều người trước camera
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Checklist reminder */}
          <div className="bg-[#0D1117] border border-zinc-800 rounded-xl p-3 mb-5 text-left text-xs text-zinc-300 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={streamActive ? "text-emerald-400 font-bold" : "text-zinc-500"}>
                {streamActive ? "✓" : "○"}
              </span>
              <span>Camera giám sát: {streamActive ? "Đã sẵn sàng" : "Chưa kết nối"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-bold">✓</span>
              <span>Chế độ thi: Tự động bật Toàn màn hình khi bắt đầu</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!streamActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-semibold text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Cho phép truy cập máy ảnh</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleVerifyGate}
                disabled={isVerifyingGate}
                className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isVerifyingGate ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    <span>Xác nhận & Bắt đầu làm bài</span>
                  </>
                )}
              </button>
            )}

            <p className="text-[11px] text-zinc-500">
              Hãy ngồi ngay ngắn trước camera và đảm bảo không có người khác xung quanh.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. PiP Floating Camera Box (During Exam)
  // ==========================================
  const getStatusBorder = () => {
    if (faceStatus === 'MULTIPLE_FACES') return 'border-rose-500 shadow-rose-500/30 animate-pulse';
    if (faceStatus === 'NO_FACE') return 'border-amber-500 shadow-amber-500/30 animate-pulse';
    if (faceStatus === 'INITIALIZING') return 'border-indigo-500/50 shadow-indigo-500/10';
    return 'border-emerald-500/50 shadow-emerald-500/10';
  };

  const getStatusBadge = () => {
    if (faceStatus === 'MULTIPLE_FACES') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-800">
          <Users className="w-3 h-3" />
          Có người lạ
        </span>
      );
    }
    if (faceStatus === 'NO_FACE') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800">
          <UserX className="w-3 h-3" />
          Không thấy thí sinh
        </span>
      );
    }
    if (faceStatus === 'INITIALIZING') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-800">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Đang kết nối...
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
        <UserCheck className="w-3 h-3" />
        Đang giám sát
      </span>
    );
  };

  return (
    <div
      className={cn(
        'fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 transition-all duration-200 select-none',
        // On mobile: auto width, takes minimal space in the corner
        'w-auto sm:w-56',
        isMinimized && 'sm:w-40'
      )}
    >
      {/* 1. Mobile-only View: Sleek compact warning capsule only */}
      <div className="sm:hidden flex items-center shadow-lg">
        <div
          className={cn(
            'px-2.5 py-1 rounded-full bg-[#161B22]/95 border shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-all',
            getStatusBorder()
          )}
        >
          {getStatusBadge()}
        </div>
      </div>

      {/* 2. Desktop View / Background Video Pipeline */}
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden transition-all',
          // Mobile: no border or background, container collapses so only mobile capsule is seen
          'border-0 bg-transparent shadow-none',
          // Desktop: full styled PiP container
          'sm:border-2 sm:bg-[#161B22] sm:shadow-2xl',
          getStatusBorder()
        )}
      >
        {/* Desktop Header bar */}
        <div className="hidden sm:flex items-center justify-between px-2.5 py-1.5 bg-[#0D1117] border-b border-zinc-800/80 text-zinc-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-[11px] font-medium tracking-tight">Giám sát Camera</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title={isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
            >
              {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Video feed (Offscreen 320x240 on mobile to keep MediaPipe active; styled PiP preview on desktop) */}
        <div
          className={cn(
            'overflow-hidden transition-all',
            // Mobile: keep in DOM offscreen so Chromium video decoder & MediaPipe face detector never pause
            'fixed -top-[9999px] -left-[9999px] w-[320px] h-[240px] pointer-events-none opacity-0',
            // Desktop: normal preview dimensions inside PiP
            'sm:relative sm:top-auto sm:left-auto sm:opacity-100 sm:pointer-events-auto sm:w-full sm:bg-zinc-900',
            isMinimized ? 'sm:h-24' : 'sm:h-36'
          )}
        >
          <video
            ref={assignVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              transform: 'scaleX(-1)',
              backfaceVisibility: 'visible',
              WebkitBackfaceVisibility: 'visible',
            }}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              v.muted = true;
              v.play().catch(() => { });
            }}
            onCanPlay={(e) => {
              const v = e.currentTarget;
              v.muted = true;
              v.play().catch(() => { });
            }}
            className="w-full h-full object-cover"
          />

          {/* Burst recording indicator */}
          {isCapturingBurst && (
            <div className="absolute inset-0 z-10 bg-rose-950/40 backdrop-blur-xs flex items-center justify-center">
              <span className="text-[11px] font-bold text-rose-300 animate-pulse px-2 py-1 rounded bg-black/70">
                Đang lưu lại khoảnh khắc...
              </span>
            </div>
          )}

          {/* Status pill on video (desktop) */}
          <div className="hidden sm:flex absolute bottom-2 left-2 right-2 z-10 justify-center">
            {getStatusBadge()}
          </div>
        </div>
      </div>
    </div>
  );
};

