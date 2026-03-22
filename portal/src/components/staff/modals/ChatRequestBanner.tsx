'use client';

import { MessageSquare } from 'lucide-react';

interface PendingRequest {
  user_name: string;
  risk_level?: string;
}

interface ChatRequestBannerProps {
  pendingRequest: PendingRequest | null;
  onDismiss: () => void;
  onAccept: () => void;
}

export default function ChatRequestBanner({
  pendingRequest,
  onDismiss,
  onAccept,
}: ChatRequestBannerProps) {
  if (!pendingRequest) return null;

  return (
    <div data-testid="incoming-chat-request-banner" className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4 z-50 shadow-lg animate-pulse">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-lg">Incoming Chat Request</p>
            <p className="text-sm opacity-90">
              {pendingRequest.user_name} needs to chat with staff
              {pendingRequest.risk_level && (
                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                  pendingRequest.risk_level === 'RED' ? 'bg-red-500' :
                  pendingRequest.risk_level === 'AMBER' ? 'bg-amber-500' :
                  'bg-yellow-500'
                }`}>
                  {pendingRequest.risk_level}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            data-testid="dismiss-chat-request-btn"
            onClick={onDismiss}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
          >
            Dismiss
          </button>
          <button
            data-testid="accept-chat-request-btn"
            onClick={onAccept}
            className="px-4 py-2 bg-white text-blue-600 hover:bg-gray-100 rounded-lg text-sm font-semibold"
          >
            Accept Chat
          </button>
        </div>
      </div>
    </div>
  );
}
