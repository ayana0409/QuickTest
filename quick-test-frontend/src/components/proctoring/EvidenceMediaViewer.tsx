'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  ExternalLink,
  Film,
  Image as ImageIcon,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Button } from '@/components/common/Button';

interface EvidenceMediaViewerProps {
  evidenceUrl?: string | null;
  violationType?: string;
  candidateName?: string;
  timestamp?: string;
  onClose?: () => void;
}

/**
 * Component viewing proctoring violation evidence.
 * Supports:
 * 1. Single static frame (for NO_FACE_DETECTED, etc.)
 * 2. 15-frame 5 FPS animated player sliced from a 5x3 sprite sheet canvas (for MULTIPLE_FACES)
 */
export const EvidenceMediaViewer: React.FC<EvidenceMediaViewerProps> = ({
  evidenceUrl,
  violationType,
  candidateName,
  timestamp,
  onClose,
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
      <div className="flex flex-col items-center justify-center p-6 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-400">
        <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
        <p className="text-sm font-medium">Không có bằng chứng hình ảnh cho sự kiện này.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0D1117] border-b border-[#30363D]">
        <div className="flex items-center gap-2">
          {isMultipleFaces ? (
            <Film className="w-4 h-4 text-rose-400" />
          ) : (
            <ImageIcon className="w-4 h-4 text-indigo-400" />
          )}
          <span className="text-sm font-semibold text-zinc-100">
            {isMultipleFaces ? 'Video ghi nhận vi phạm' : 'Ảnh chụp vi phạm'}
          </span>
          {candidateName && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
              {candidateName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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

      {/* Media Canvas / Viewer */}
      <div className="relative flex items-center justify-center bg-black/60 p-2 min-h-[260px]">
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
            <div className="max-h-[360px] overflow-auto">
              <img
                src={evidenceUrl}
                alt="Hình ảnh bằng chứng"
                className="w-full max-w-full rounded border border-zinc-800"
              />
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-zinc-700/80 shadow-lg">
              <canvas
                ref={canvasRef}
                width={FRAME_WIDTH}
                height={FRAME_HEIGHT}
                className="w-full max-w-[360px] h-auto aspect-[4/3] block bg-black"
              />
            </div>
          )
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-zinc-700/80 shadow-lg max-w-[360px]">
            <img
              src={evidenceUrl}
              alt="Ảnh chụp vi phạm"
              className="w-full h-auto aspect-[4/3] object-cover"
            />
          </div>
        )}
      </div>

      {/* Controls Bar (for animation) */}
      {isMultipleFaces && imageLoaded && (
        <div className="px-4 py-3 bg-[#0D1117] border-t border-[#30363D] space-y-2">
          {!showFullSprite && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all cursor-pointer flex items-center justify-center"
                title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentFrame(0);
                  drawFrame(0);
                }}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                title="Xem lại từ đầu"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={TOTAL_FRAMES - 1}
                  value={currentFrame}
                  onChange={handleSliderChange}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-800/80">
            <span className="text-rose-400 font-medium">
              Ghi nhận có người lạ xuất hiện trước màn hình
            </span>

            <button
              type="button"
              onClick={() => setShowFullSprite(!showFullSprite)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2 cursor-pointer"
            >
              {showFullSprite ? 'Xem dạng video' : 'Xem từng ảnh chụp'}
            </button>
          </div>
        </div>
      )}

      {/* Footer Info */}
      {timestamp && (
        <div className="px-4 py-2 bg-zinc-950/50 border-t border-zinc-900 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>Thời điểm: {new Date(timestamp).toLocaleString('vi-VN')}</span>
          <span className="text-[11px] text-zinc-500">Tự động ghi nhận</span>
        </div>
      )}
    </div>
  );
};

