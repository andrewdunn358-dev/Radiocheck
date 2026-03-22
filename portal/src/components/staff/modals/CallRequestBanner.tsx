'use client';

import { Phone } from 'lucide-react';

interface PendingRequest {
  user_name: string;
  risk_level?: string;
}

interface CallRequestBannerProps {
  pendingRequest: PendingRequest | null;
  onDismiss: () => void;
  onAccept: () => void;
}

export default function CallRequestBanner({
  pendingRequest,
  onDismiss,
  onAccept,
}: CallRequestBannerProps) {
  if (!pendingRequest) return null;

  return (
    <div data-testid="incoming-call-request-banner" className="fixed top-0 left-0 right-0 bg-gradient-to-r from-red-600 to-red-500 text-white p-4 z-50 shadow-lg animate-pulse">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-lg">🚨 URGENT: Call Request</p>
            <p className="text-sm opacity-90">
              {pendingRequest.user_name} needs to speak with someone urgently
              {pendingRequest.risk_level && (
                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                  pendingRequest.risk_level === 'RED' ? 'bg-white text-red-600' :
                  pendingRequest.risk_level === 'AMBER' ? 'bg-amber-300 text-amber-800' :
                  'bg-yellow-300 text-yellow-800'
                }`}>
                  {pendingRequest.risk_level} RISK
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            data-testid="dismiss-call-request-btn"
            onClick={onDismiss}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
          >
            Dismiss
          </button>
          <button
            data-testid="accept-call-request-btn"
            onClick={onAccept}
            className="px-4 py-2 bg-white text-red-600 hover:bg-gray-100 rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            <Phone className="w-4 h-4" />
            Accept & Call
          </button>
        </div>
      </div>
    </div>
  );
}
