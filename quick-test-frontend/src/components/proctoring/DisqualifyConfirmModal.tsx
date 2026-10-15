import React, { useState } from 'react';
import { AlertTriangle, UserX, Loader2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';

interface DisqualifyConfirmModalProps {
  isOpen: boolean;
  candidateName?: string;
  attemptId: string | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (attemptId: string, reason?: string) => Promise<void>;
}

/**
 * Safety confirmation modal for manually disqualifying a candidate from an active exam.
 */
export const DisqualifyConfirmModal: React.FC<DisqualifyConfirmModalProps> = ({
  isOpen,
  candidateName,
  attemptId,
  isLoading = false,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState<string>('');

  if (!isOpen || !attemptId) return null;

  const handleConfirm = async () => {
    await onConfirm(attemptId, reason.trim() || undefined);
    setReason('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) {
          setReason('');
          onClose();
        }
      }}
      size="md"
      title={
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Confirm Disqualification</span>
        </div>
      }
      description="Revoking candidate attempt access"
    >
      <div className="space-y-4">
        <div className="rounded-xl p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
          <p className="font-semibold mb-1">
            Are you sure you want to disqualify{' '}
            <span className="underline decoration-rose-400 font-bold">
              {candidateName || 'this candidate'}
            </span>
            ?
          </p>
          <p className="text-rose-700 dark:text-rose-300">
            This action will immediately terminate the candidate&apos;s exam session,
            change their status to <strong>DISQUALIFIED</strong>, and block further
            submissions.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Reason for Disqualification (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. Caught using unauthorized secondary device or severe repeated tab switching..."
            rows={3}
            className="w-full text-xs rounded-xl p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all resize-none"
          />
        </div>

        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setReason('');
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] shadow-sm shadow-rose-600/20 disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserX className="w-4 h-4" />
            )}
            <span>Confirm & Disqualify</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
