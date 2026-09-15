'use client';

import React, { useState, useEffect } from 'react';
import { User, IdCard, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

interface GuestInfoModalProps {
  isOpen: boolean;
  accessCode?: string;
  onConfirm: (guestName: string, guestIdentifier: string) => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
  onCancel?: () => void;
}

/**
 * GuestInfoModal:
 * Prompt displayed to unauthenticated candidates entering an exam directly with an access code.
 * Collects required Candidate Full Name and Identifier (Student ID, Email, or Phone Number)
 * to register an anonymous ExamAttempt in Spring Boot backend.
 */
export const GuestInfoModal: React.FC<GuestInfoModalProps> = ({
  isOpen,
  accessCode,
  onConfirm,
  isLoading = false,
  title = 'Thông tin thí sinh làm bài',
  description = 'Bạn đang tham gia kỳ thi mà không cần đăng nhập. Vui lòng cung cấp thông tin để hệ thống ghi nhận kết quả bài làm.',
  onCancel,
}) => {
  const [guestName, setGuestName] = useState('');
  const [guestIdentifier, setGuestIdentifier] = useState('');
  const [errors, setErrors] = useState<{ guestName?: string; guestIdentifier?: string }>({});

  // Prefill existing guest details from localStorage if previously stored
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const savedName = localStorage.getItem('quicktest_guest_name') || '';
      const savedId = localStorage.getItem('quicktest_guest_id') || '';
      if (savedName) setGuestName(savedName);
      if (savedId) setGuestIdentifier(savedId);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: { guestName?: string; guestIdentifier?: string } = {};

    if (!guestName.trim()) {
      errs.guestName = 'Vui lòng nhập họ và tên của bạn';
    } else if (guestName.trim().length < 2) {
      errs.guestName = 'Họ và tên phải có ít nhất 2 ký tự';
    }

    if (!guestIdentifier.trim()) {
      errs.guestIdentifier = 'Vui lòng nhập Mã sinh viên, Email hoặc Số điện thoại';
    } else if (guestIdentifier.trim().length < 3) {
      errs.guestIdentifier = 'Mã định danh phải có ít nhất 3 ký tự';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const trimmedName = guestName.trim();
    const trimmedId = guestIdentifier.trim();

    // Persist into localStorage for session persistence & resume operations
    if (typeof window !== 'undefined') {
      localStorage.setItem('quicktest_guest_name', trimmedName);
      localStorage.setItem('quicktest_guest_id', trimmedId);
    }

    onConfirm(trimmedName, trimmedId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#161B22] border border-[#30363D] rounded-2xl p-6 md:p-8 shadow-2xl text-[#E6EDF3] overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-b-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            {accessCode && (
              <div className="text-xs text-indigo-400 font-mono mt-0.5">
                Mã phòng thi: <span className="font-bold tracking-wider">{accessCode.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          {description}
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <Input
              label="Họ và tên thí sinh *"
              type="text"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                if (errors.guestName) {
                  setErrors((prev) => ({ ...prev, guestName: undefined }));
                }
              }}
              error={errors.guestName}
              placeholder="Ví dụ: Nguyễn Văn An"
              leftIcon={<User className="w-4 h-4 text-zinc-400" />}
              autoComplete="name"
              autoFocus
            />
          </div>

          <div>
            <Input
              label="Mã định danh (MSSV / Email / SĐT) *"
              type="text"
              value={guestIdentifier}
              onChange={(e) => {
                setGuestIdentifier(e.target.value);
                if (errors.guestIdentifier) {
                  setErrors((prev) => ({ ...prev, guestIdentifier: undefined }));
                }
              }}
              error={errors.guestIdentifier}
              placeholder="Ví dụ: B20DCCN001 hoặc email/sđt..."
              leftIcon={<IdCard className="w-4 h-4 text-zinc-400" />}
              autoComplete="off"
            />
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-zinc-400">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Dùng để xác thực và khôi phục bài thi nếu tải lại trang hoặc mất mạng.</span>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isLoading}
                className="text-zinc-400 hover:text-white"
              >
                Hủy bỏ
              </Button>
            )}
            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Vào phòng thi ngay
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
