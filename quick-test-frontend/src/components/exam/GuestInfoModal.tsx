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
  title = 'Thông tin thí sinh',
  description = 'Vui lòng cung cấp họ tên và mã định danh để hệ thống ghi nhận và tự động lưu bài làm của bạn.',
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

    if (typeof window !== 'undefined') {
      localStorage.setItem('quicktest_guest_name', trimmedName);
      localStorage.setItem('quicktest_guest_id', trimmedId);
    }

    onConfirm(trimmedName, trimmedId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl text-zinc-900 dark:text-zinc-100 overflow-hidden">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-b-full" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">{title}</h3>
            {accessCode && (
              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                Mã phòng: <span className="font-bold tracking-wider">#{accessCode.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">
          {description}
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
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
              placeholder="Ví dụ: B20DCCN001 hoặc email..."
              leftIcon={<IdCard className="w-4 h-4 text-zinc-400" />}
              autoComplete="off"
            />
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Dùng để khôi phục phiên thi nếu tải lại trang hoặc mất kết nối.</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isLoading}
                className="rounded-xl text-xs h-9 px-3.5"
              >
                Hủy bỏ
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              isLoading={isLoading}
              className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-9 text-xs shadow-2xs"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Vào phòng thi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
