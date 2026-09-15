'use client';

import React, { useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExamWarningModalProps {
  isOpen: boolean;
  violationCount: number;
  maxAllowed?: number;
  message?: string;
  onAcknowledge: () => void;
}

/**
 * Non-dismissable high-priority warning modal shown when a proctoring violation occurs.
 * Prevents candidate from interacting with the exam until they explicitly acknowledge the infraction.
 */
export const ExamWarningModal: React.FC<ExamWarningModalProps> = ({
  isOpen,
  violationCount,
  maxAllowed = 3,
  message,
  onAcknowledge,
}) => {
  // Prevent escape key dismissal and trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Block background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const remaining = Math.max(0, maxAllowed - violationCount);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="warning-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 select-none animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#161B22] border-2 border-amber-500/50 shadow-2xl shadow-amber-500/10 p-6 sm:p-8 text-center text-zinc-100 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Warning Icon with Pulsing Effect */}
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
          <ShieldAlert className="w-9 h-9" />
        </div>

        {/* Title */}
        <h2
          id="warning-modal-title"
          className="text-xl sm:text-2xl font-bold text-amber-400 tracking-tight mb-2"
        >
          Cảnh Báo Vi Phạm Quy Chế
        </h2>

        {/* Violation Message */}
        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed mb-6 font-normal">
          {message ||
            'Hệ thống ghi nhận hành vi bất thường trong quá trình làm bài. Toàn bộ nhật ký vi phạm đã được gửi đến giám thị phòng thi.'}
        </p>

        {/* Violation Counter Badge */}
        <div className="mb-6 p-4 rounded-xl bg-[#0D1117] border border-[#30363D] flex items-center justify-between text-left">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                Lượt cảnh báo hiện tại
              </div>
              <div className="text-sm font-bold text-zinc-100">
                Lần {violationCount} / {maxAllowed}
              </div>
            </div>
          </div>
          <div
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full border',
              remaining > 1
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-red-500/15 text-red-400 border-red-500/40 animate-pulse'
            )}
          >
            {remaining > 0 ? `Còn ${remaining} lần vi phạm` : 'Nguy cơ đình chỉ ngay lập tức'}
          </div>
        </div>

        {/* Strict Caution Note */}
        <div className="text-xs text-zinc-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-6 leading-relaxed">
          <strong className="text-amber-300">Lưu ý quan trọng:</strong> Nếu tiếp tục chuyển tab,
          thoát toàn màn hình hoặc can thiệp công cụ lập trình, hệ thống sẽ tự động đình chỉ thi và
          hủy kết quả làm bài.
        </div>

        {/* Acknowledge Button */}
        <button
          type="button"
          onClick={onAcknowledge}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold text-sm sm:text-base shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#161B22]"
        >
          <CheckCircle2 className="w-5 h-5" />
          Tôi hiểu và cam kết tuân thủ
        </button>
      </div>
    </div>
  );
};
