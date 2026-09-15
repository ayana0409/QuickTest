'use client';

import React, { useEffect } from 'react';
import { Ban, AlertOctagon, LogOut } from 'lucide-react';

interface ExamDisqualifiedOverlayProps {
  isOpen: boolean;
  reason?: string;
  onExit: () => void;
}

/**
 * Full-screen blocking overlay presented when candidate is disqualified
 * due to excessive proctoring violations or teacher manual intervention.
 */
export const ExamDisqualifiedOverlay: React.FC<ExamDisqualifiedOverlayProps> = ({
  isOpen,
  reason,
  onExit,
}) => {
  // Prevent any keyboard interaction except the exit button
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="disqualified-title"
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0D1117] p-6 text-center select-none animate-in fade-in zoom-in-95 duration-300"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#161B22] border-2 border-red-500/60 shadow-2xl shadow-red-500/20 p-8 text-zinc-100">
        {/* Glow accent */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Banned Icon */}
        <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center text-red-500 animate-pulse">
          <Ban className="w-10 h-10" />
        </div>

        {/* Heading */}
        <h1
          id="disqualified-title"
          className="text-2xl sm:text-3xl font-extrabold text-red-500 tracking-tight mb-3"
        >
          Đình Chỉ Thi
        </h1>

        {/* Reason */}
        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed mb-6 font-normal">
          {reason ||
            'Bài làm của bạn đã bị đình chỉ do vi phạm quy chế phòng thi vượt quá giới hạn cho phép hoặc bị giám thị khóa phiên thi.'}
        </p>

        {/* Details card */}
        <div className="p-4 rounded-xl bg-[#0D1117] border border-[#30363D] mb-6 text-left flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Phiên làm bài đã kết thúc. Toàn bộ đáp án đến thời điểm đình chỉ đã được niêm phong và gửi
            báo cáo vi phạm đến ban giám hiệu / giảng viên phụ trách.
          </div>
        </div>

        {/* Exit Button */}
        <button
          type="button"
          onClick={onExit}
          className="w-full py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm sm:text-base shadow-lg shadow-red-600/30 hover:shadow-red-600/40 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#161B22]"
        >
          <LogOut className="w-5 h-5" />
          Rời khỏi phòng thi
        </button>
      </div>
    </div>
  );
};
