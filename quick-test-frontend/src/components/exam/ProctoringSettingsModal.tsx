'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldOff,
  X,
  Check,
  RotateCcw,
  Sliders,
  AppWindow,
  Maximize,
  Copy,
  Terminal,
} from 'lucide-react';
import {
  type ProctoringSettings,
  DEFAULT_PROCTORING_SETTINGS,
} from '@/types/proctoring';
import { cn } from '@/lib/utils';

interface ProctoringSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProctoringSettings;
  onSaveSettings: (newSettings: ProctoringSettings) => void;
}

/**
 * ProctoringSettingsModal Component:
 * Allows candidates, invigilators, or developers to configure anti-cheat policies,
 * offering a Master Switch and granular switches for individual detection rules.
 */
export const ProctoringSettingsModal: React.FC<ProctoringSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<ProctoringSettings>(settings);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof ProctoringSettings) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleResetDefaults = () => {
    setLocalSettings({ ...DEFAULT_PROCTORING_SETTINGS });
  };

  const handleTurnOffAll = () => {
    setLocalSettings({
      enabled: false,
      detectTabSwitch: false,
      detectFullscreenExit: false,
      blockCopyPaste: false,
      blockDevTools: false,
    });
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proctor-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#161B22] border border-[#30363D] shadow-2xl p-6 text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 mb-4 border-b border-[#30363D]">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                localSettings.enabled
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              )}
            >
              {localSettings.enabled ? (
                <Shield className="w-5 h-5" />
              ) : (
                <ShieldOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3
                id="proctor-settings-title"
                className="text-lg font-bold text-[#E6EDF3] tracking-tight"
              >
                Cài Đặt Bắt Gian Lận (Proctoring)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tùy chỉnh các quy tắc kiểm soát và giám sát phòng thi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#21262D] transition-colors focus:outline-none"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Switch */}
        <div className="mb-5 p-4 rounded-xl bg-[#0D1117] border border-[#30363D] flex items-center justify-between">
          <div className="pr-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#E6EDF3]">
                Kích hoạt Chế độ Giám sát (Master Switch)
              </span>
              {localSettings.enabled ? (
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Đang Bật
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Đang Tắt
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Bật hoặc tắt toàn bộ các tính năng theo dõi, bắt vi phạm và chặn thao tác bàn phím/chuột.
            </p>
          </div>

          {/* Master Toggle Button */}
          <button
            type="button"
            role="switch"
            aria-checked={localSettings.enabled}
            onClick={() => handleToggle('enabled')}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              localSettings.enabled ? 'bg-indigo-600' : 'bg-zinc-700'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                localSettings.enabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {/* Granular Feature Toggles */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">
            Quy tắc giám sát chi tiết
          </div>

          {/* 1. Tab Switch Detection */}
          <div
            className={cn(
              'p-3.5 rounded-xl border transition-all flex items-center justify-between',
              !localSettings.enabled
                ? 'opacity-40 pointer-events-none bg-[#0D1117] border-[#30363D]'
                : 'bg-[#0D1117] border-[#30363D]'
            )}
          >
            <div className="flex items-start gap-3 pr-3">
              <AppWindow className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  Phát hiện chuyển Tab & Rời trình duyệt
                </div>
                <div className="text-[11px] text-zinc-400">
                  Cảnh báo và gửi telemetry khi thí sinh chuyển sang tab hoặc ứng dụng khác
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              disabled={!localSettings.enabled}
              aria-checked={localSettings.detectTabSwitch}
              onClick={() => handleToggle('detectTabSwitch')}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                localSettings.detectTabSwitch ? 'bg-indigo-600' : 'bg-zinc-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localSettings.detectTabSwitch ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* 2. Fullscreen Exit Detection */}
          <div
            className={cn(
              'p-3.5 rounded-xl border transition-all flex items-center justify-between',
              !localSettings.enabled
                ? 'opacity-40 pointer-events-none bg-[#0D1117] border-[#30363D]'
                : 'bg-[#0D1117] border-[#30363D]'
            )}
          >
            <div className="flex items-start gap-3 pr-3">
              <Maximize className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  Phát hiện thoát Toàn màn hình
                </div>
                <div className="text-[11px] text-zinc-400">
                  Cảnh báo khi người dùng nhấn ESC hoặc thoát chế độ toàn màn hình
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              disabled={!localSettings.enabled}
              aria-checked={localSettings.detectFullscreenExit}
              onClick={() => handleToggle('detectFullscreenExit')}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                localSettings.detectFullscreenExit ? 'bg-indigo-600' : 'bg-zinc-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localSettings.detectFullscreenExit ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* 3. Block Copy/Paste & Context Menu */}
          <div
            className={cn(
              'p-3.5 rounded-xl border transition-all flex items-center justify-between',
              !localSettings.enabled
                ? 'opacity-40 pointer-events-none bg-[#0D1117] border-[#30363D]'
                : 'bg-[#0D1117] border-[#30363D]'
            )}
          >
            <div className="flex items-start gap-3 pr-3">
              <Copy className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  Chặn Sao chép, Cắt, Dán & Chuột phải
                </div>
                <div className="text-[11px] text-zinc-400">
                  Khóa bôi đen nội dung câu hỏi, ngăn clipboard và menu ngữ cảnh
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              disabled={!localSettings.enabled}
              aria-checked={localSettings.blockCopyPaste}
              onClick={() => handleToggle('blockCopyPaste')}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                localSettings.blockCopyPaste ? 'bg-indigo-600' : 'bg-zinc-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localSettings.blockCopyPaste ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* 4. Block DevTools */}
          <div
            className={cn(
              'p-3.5 rounded-xl border transition-all flex items-center justify-between',
              !localSettings.enabled
                ? 'opacity-40 pointer-events-none bg-[#0D1117] border-[#30363D]'
                : 'bg-[#0D1117] border-[#30363D]'
            )}
          >
            <div className="flex items-start gap-3 pr-3">
              <Terminal className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  Chặn Phím tắt DevTools & Nguồn trang
                </div>
                <div className="text-[11px] text-zinc-400">
                  Vô hiệu hóa F12, Ctrl+Shift+I/J/C và Ctrl+U
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              disabled={!localSettings.enabled}
              aria-checked={localSettings.blockDevTools}
              onClick={() => handleToggle('blockDevTools')}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                localSettings.blockDevTools ? 'bg-indigo-600' : 'bg-zinc-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localSettings.blockDevTools ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </div>

        {/* Quick Action Presets */}
        <div className="flex items-center justify-between text-xs text-zinc-400 pb-5 pt-2 border-t border-[#30363D]">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định</span>
          </button>

          <button
            type="button"
            onClick={handleTurnOffAll}
            className="hover:text-amber-400 transition-colors cursor-pointer"
          >
            Tắt tất cả
          </button>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30363D]">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-[#0D1117] hover:bg-[#21262D] text-zinc-300 border border-[#30363D] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Áp dụng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
