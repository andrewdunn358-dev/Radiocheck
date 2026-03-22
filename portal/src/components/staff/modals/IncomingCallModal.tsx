'use client';

import { Phone, PhoneIncoming, PhoneOff } from 'lucide-react';

interface IncomingCallModalProps {
  callerInfo: { name: string } | null;
  onAnswer: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({
  callerInfo,
  onAnswer,
  onReject,
}: IncomingCallModalProps) {
  if (!callerInfo) return null;

  return (
    <div data-testid="incoming-call-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <PhoneIncoming className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>
        <p data-testid="caller-name" className="text-gray-400 mb-6">{callerInfo.name}</p>
        <div className="flex gap-4 justify-center">
          <button
            data-testid="decline-call-btn"
            onClick={onReject}
            className="px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center gap-2"
          >
            <PhoneOff className="w-5 h-5" />
            Decline
          </button>
          <button
            data-testid="answer-call-btn"
            onClick={onAnswer}
            className="px-6 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 flex items-center gap-2"
          >
            <Phone className="w-5 h-5" />
            Answer
          </button>
        </div>
      </div>
    </div>
  );
}
