'use client';

import { AlertTriangle } from 'lucide-react';

interface PanicModalProps {
  panicReason: string;
  onPanicReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isTriggering: boolean;
}

export default function PanicModal({
  panicReason,
  onPanicReasonChange,
  onCancel,
  onConfirm,
  isTriggering,
}: PanicModalProps) {
  return (
    <div data-testid="panic-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-red-500">Trigger Panic Alert</h2>
          <p className="text-gray-400 mt-2">This will immediately notify all available counsellors</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Reason (optional)</label>
          <textarea
            data-testid="panic-reason"
            value={panicReason}
            onChange={(e) => onPanicReasonChange(e.target.value)}
            className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
            placeholder="Describe the situation..."
            rows={3}
          />
        </div>
        <div className="flex gap-4">
          <button
            data-testid="cancel-panic-btn"
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-primary-dark transition"
          >
            Cancel
          </button>
          <button
            data-testid="confirm-panic-btn"
            onClick={onConfirm}
            disabled={isTriggering}
            className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isTriggering ? 'Sending...' : (
              <>
                <AlertTriangle className="w-5 h-5" />
                Send Alert
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
