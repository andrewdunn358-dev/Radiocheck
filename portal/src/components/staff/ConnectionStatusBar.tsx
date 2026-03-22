'use client';

import { PhoneCall, Wifi, WifiOff, AlertTriangle, PhoneOff, Mic, MicOff } from 'lucide-react';

interface ConnectionStatusBarProps {
  phoneStatus: 'connecting' | 'ready' | 'error' | 'unavailable';
  chatConnected: boolean;
  profile: any;
  user: any;
  twilioPhone: {
    isInCall: boolean;
    currentCallNumber?: string;
    formattedDuration: string;
    isMuted: boolean;
    toggleMute: () => void;
    hangUp: () => void;
  };
}

export default function ConnectionStatusBar({
  phoneStatus,
  chatConnected,
  profile,
  user,
  twilioPhone,
}: ConnectionStatusBarProps) {
  return (
    <>
      {/* Connection Status Banner */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        {/* In-App Calling Status */}
        <div className={`flex items-center justify-between p-4 rounded-xl border ${
          phoneStatus === 'ready' ? 'bg-green-500/10 border-green-500' :
          phoneStatus === 'connecting' ? 'bg-yellow-500/10 border-yellow-500' :
          'bg-red-500/10 border-red-500'
        }`}>
          <div className="flex items-center gap-3">
            <PhoneCall className={`w-5 h-5 ${
              phoneStatus === 'ready' ? 'text-green-400' :
              phoneStatus === 'connecting' ? 'text-yellow-400' :
              'text-red-400'
            }`} />
            <div>
              <p className="font-semibold text-sm">In-App Calling</p>
              <p className="text-xs text-gray-400">
                {phoneStatus === 'ready' ? 'Ready for calls' :
                 phoneStatus === 'connecting' ? 'Connecting...' :
                 phoneStatus === 'unavailable' ? 'Not configured' :
                 'Connection error'}
              </p>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${
            phoneStatus === 'ready' ? 'bg-green-500' :
            phoneStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500'
          }`} />
        </div>

        {/* Live Chat Status */}
        <div className={`flex items-center justify-between p-4 rounded-xl border ${
          chatConnected ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'
        }`}>
          <div className="flex items-center gap-3">
            {chatConnected ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
            <div>
              <p className="font-semibold text-sm">Live Chat</p>
              <p className="text-xs text-gray-400">
                {chatConnected ? 'Connected - monitoring for requests' : 'Disconnected'}
              </p>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${chatConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>

      {/* Profile Warning Banner */}
      {!profile && user && (
        <div data-testid="no-profile-warning" className="mb-6 p-4 rounded-xl border border-amber-500 bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-400">No Staff Profile Linked</p>
              <p className="text-sm text-gray-400 mt-1">
                Your login (<span className="font-mono">{user.email}</span>) doesn&apos;t have a linked counsellor or peer supporter profile. 
                Some features like status updates and taking callbacks are disabled. 
                Please contact an administrator to link your profile.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Floating Indicator */}
      {twilioPhone.isInCall && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-4 animate-pulse">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">Call in Progress</p>
              <p className="text-xs opacity-80">{twilioPhone.currentCallNumber || 'Unknown'} • {twilioPhone.formattedDuration}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-white/30 pl-4">
            <button 
              onClick={twilioPhone.toggleMute}
              className={`p-2 rounded-lg ${twilioPhone.isMuted ? 'bg-yellow-500' : 'bg-white/20 hover:bg-white/30'}`}
              title={twilioPhone.isMuted ? 'Unmute' : 'Mute'}
            >
              {twilioPhone.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button 
              onClick={twilioPhone.hangUp}
              className="p-2 rounded-lg bg-red-500 hover:bg-red-600"
              title="Hang Up"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Socket Conflict Warning - shown when calls fail repeatedly */}
      {phoneStatus === 'error' && (
        <div data-testid="socket-error-warning" className="mb-6 p-4 rounded-xl border border-red-500 bg-red-500/10">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400">Connection Issue</p>
              <p className="text-sm text-gray-400 mt-1">
                Could not connect to the calling service. If you have another staff portal tab open 
                (including the old legacy portal), please close it and refresh this page.
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
