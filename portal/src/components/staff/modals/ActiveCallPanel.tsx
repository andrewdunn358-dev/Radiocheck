'use client';

import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';

interface ActiveCallPanelProps {
  formattedDuration: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export default function ActiveCallPanel({
  formattedDuration,
  isMuted,
  onToggleMute,
  onEndCall,
}: ActiveCallPanelProps) {
  return (
    <div data-testid="active-call-ui" className="fixed bottom-4 right-4 bg-card rounded-xl p-4 shadow-lg z-40 border border-border">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
          <Phone className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <p className="font-semibold">In Call</p>
          <p data-testid="call-duration" className="text-sm text-gray-400">{formattedDuration}</p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="mute-btn"
            onClick={onToggleMute}
            className={`p-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-600'}`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            data-testid="end-call-btn"
            onClick={onEndCall}
            className="p-2 rounded-full bg-red-500 hover:bg-red-600"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
