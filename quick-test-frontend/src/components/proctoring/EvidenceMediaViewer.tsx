'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  AlertTriangle,
} from 'lucide-react';

interface EvidenceMediaViewerProps {
  evidenceUrl?: string | null;
  violationType?: string;
  candidateName?: string;
  timestamp?: string;
  onClose?: () => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
  className?: string;
}

/**
 * Component viewing proctoring violation evidence.
 * Supports:
 * 1. Single static frame (for NO_FACE_DETECTED, TAB_SWITCH, etc.)
 * 2. 15-frame 5 FPS animated player sliced from a 5x3 sprite sheet canvas (for MULTIPLE_FACES)
 */
export const EvidenceMediaViewer: React.FC<EvidenceMediaViewerProps> = ({
  evidenceUrl,
  violationType,
  candidateName,
  timestamp,
  hideHeader = false,
  hideFooter = false,
  className = '',
}) => {
  const isMultipleFaces = violationType === 'MULTIPLE_FACES';
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [showFullSprite, setShowFullSprite] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);

  const TOTAL_FRAMES = 15;
  const COLS = 5;
  const FRAME_WIDTH = 320;
  const FRAME_HEIGHT = 240;
  const FPS_INTERVAL_MS = 200; // 5 FPS = 200ms per frame

  // Load evidence image
  useEffect(() => {
    if (!evidenceUrl) return;

    setImageLoaded(false);
    setImageError(false);
    setCurrentFrame(0);

    const img = new Image();
    if (!evidenceUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = evidenceUrl;

    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      drawFrame(0, img);
    };

    img.onerror = () => {
      setImageError(true);
    };

    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    };
  }, [evidenceUrl]);

  // Draw specific frame from 5x3 sprite sheet
  const drawFrame = (frameIdx: number, sourceImg?: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const img = sourceImg || imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const col = frameIdx % COLS;
    const row = Math.floor(frameIdx / COLS);
    const sx = col * FRAME_WIDTH;
    const sy = row * FRAME_HEIGHT;

    ctx.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    ctx.drawImage(img, sx, sy, FRAME_WIDTH, FRAME_HEIGHT, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  };

  // Playback timer (5 FPS)
  useEffect(() => {
    if (!isMultipleFaces || !imageLoaded || !isPlaying || showFullSprite) {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      return;
    }

    animTimerRef.current = setInterval(() => {
      setCurrentFrame((prev) => {
        const next = (prev + 1) % TOTAL_FRAMES;
        drawFrame(next);
        return next;
      });
    }, FPS_INTERVAL_MS);

    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    };
  }, [isMultipleFaces, imageLoaded, isPlaying, showFullSprite]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value, 10);
    setCurrentFrame(frame);
    drawFrame(frame);
    setIsPlaying(false);
  };

  if (!evidenceUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/60 rounded-2xl border border-zinc-800 text-zinc-400">
        <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
        <p className="text-sm font-medium">Không có bằng chứng hình ảnh cho sự kiện này.</p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-zinc-950 dark:bg-black rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl text-zinc-200 ${className}`}
    >
      {/* Optional Standalone Header (hidden when embedded inside a modal) */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 min-w-0">
            {isMultipleFaces ? (
              <Film className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
              {isMultipleFaces ? 'Video vi phạm' : 'Ảnh chụp vi phạm'}
            </span>
            {candidateName && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-medium truncate max-w-[140px]">
                {candidateName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Mở ảnh gốc trong tab mới"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Media Canvas / Viewer Screen */}
      <div className="relative flex items-center justify-center bg-black min-h-[220px] sm:min-h-[280px] p-2 sm:p-3 overflow-hidden">
        {imageError ? (
          <div className="text-center p-6 text-zinc-400">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm">Không thể tải ảnh bằng chứng.</p>
          </div>
        ) : !imageLoaded ? (
          <div className="flex flex-col items-center justify-center p-6 text-zinc-400 space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Đang tải bằng chứng...</p>
          </div>
        ) : isMultipleFaces ? (
          showFullSprite ? (
            <div className="w-full max-h-[420px] overflow-auto rounded-xl border border-zinc-800/80 bg-zinc-950 p-1">
              <img
                src={evidenceUrl}
                alt="Toàn bộ khung ảnh sprite"
                className="w-full h-auto rounded-lg object-contain"
              />
            </div>
          ) : (
            <div className="relative w-full max-w-lg mx-auto rounded-xl overflow-hidden border border-zinc-800/80 shadow-2xl bg-zinc-950 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={FRAME_WIDTH}
                height={FRAME_HEIGHT}
                className="w-full h-auto aspect-[4/3] object-contain block mx-auto bg-black"
              />
            </div>
          )
        ) : (
          <div className="relative w-full max-w-lg mx-auto rounded-xl overflow-hidden border border-zinc-800/80 shadow-2xl bg-zinc-950 flex items-center justify-center">
            <img
              src={evidenceUrl}
              alt="Ảnh chụp vi phạm"
              className="w-full h-auto aspect-[4/3] object-contain"
            />
          </div>
        )}
      </div>

      {/* Video Sprite Playback Controls Bar */}
      {isMultipleFaces && imageLoaded && (
        <div className="px-3 sm:px-4 py-2.5 bg-zinc-900/90 border-t border-zinc-800/80 space-y-2">
          {!showFullSprite && (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Play / Pause Button */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
                title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              {/* Replay Button */}
              <button
                type="button"
                onClick={() => {
                  setCurrentFrame(0);
                  drawFrame(0);
                }}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 transition-all cursor-pointer flex items-center justify-center shrink-0"
                title="Xem lại từ đầu"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Frame Slider & Badge */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <input
                  type="range"
                  min={0}
                  max={TOTAL_FRAMES - 1}
                  value={currentFrame}
                  onChange={handleSliderChange}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
                />
                <span className="text-[10px] font-mono text-zinc-400 shrink-0 px-1.5 py-0.5 rounded bg-zinc-800">
                  {currentFrame + 1}/{TOTAL_FRAMES}
                </span>
              </div>
            </div>
          )}

          {/* Mode Switcher Segmented Control */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/60">
            <span className="text-[11px] text-rose-400 font-medium truncate">
              Phát hiện nhiều khuôn mặt
            </span>

            {/* Segmented Control Pill */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-800/90 border border-zinc-700/60 shrink-0">
              <button
                type="button"
                onClick={() => setShowFullSprite(false)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  !showFullSprite
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Film className="w-3 h-3" />
                <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFullSprite(true)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  showFullSprite
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Lưới ảnh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optional Standalone Footer (hidden when embedded inside a modal) */}
      {!hideFooter && timestamp && (
        <div className="px-4 py-2 bg-zinc-950/70 border-t border-zinc-900 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Thời điểm: {new Date(timestamp).toLocaleString('vi-VN')}</span>
          <span className="text-zinc-500 font-mono text-[10px]">AI Proctor</span>
        </div>
      )}
    </div>
  );
};
