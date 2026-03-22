'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Users, Mic, MicOff, Video, VideoOff } from 'lucide-react';

// Declare Jitsi types
declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

interface JitsiRoomProps {
  roomName: string;
  displayName: string;
  onClose: () => void;
  eventTitle?: string;
}

export default function JitsiRoom({ roomName, displayName, onClose, eventTitle }: JitsiRoomProps) {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [participantCount, setParticipantCount] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Jitsi Meet External API script
    const loadJitsiScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Jitsi API'));
        document.head.appendChild(script);
      });
    };

    const initJitsi = async () => {
      try {
        await loadJitsiScript();
        
        // Wait for DOM to be ready
        if (!jitsiContainerRef.current) {
          console.error('Jitsi container not found');
          return;
        }

        // Generate a clean room name (alphanumeric only)
        const cleanRoomName = roomName.replace(/[^a-zA-Z0-9]/g, '');
        
        // Initialize Jitsi Meet
        const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName: `RadioCheck_${cleanRoomName}`,
          parentNode: jitsiContainerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            // Disable lobby - instant access like TikTok Live
            prejoinPageEnabled: false,
            lobbyModeEnabled: false,
            
            // Start with audio muted by default
            startWithAudioMuted: true,
            startWithVideoMuted: false,
            
            // Disable features not needed
            disableInviteFunctions: true,
            disableDeepLinking: true,
            
            // Enable useful features
            enableWelcomePage: false,
            enableClosePage: false,
            
            // Toolbar configuration
            toolbarButtons: [
              'microphone',
              'camera',
              'desktop',
              'fullscreen',
              'fodeviceselection',
              'hangup',
              'chat',
              'raisehand',
              'tileview',
              'participants-pane',
            ],
            
            // Hide some UI elements for cleaner experience
            hideConferenceSubject: false,
            hideConferenceTimer: false,
            
            // Disable notifications we don't need
            notifications: [],
            
            // Quality settings
            resolution: 720,
            constraints: {
              video: {
                height: { ideal: 720, max: 720, min: 180 }
              }
            },
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: '',
            SHOW_POWERED_BY: false,
            SHOW_PROMOTIONAL_CLOSE_PAGE: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
            TOOLBAR_ALWAYS_VISIBLE: true,
            DEFAULT_BACKGROUND: '#1a1a2e',
            DISABLE_VIDEO_BACKGROUND: true,
          },
          userInfo: {
            displayName: displayName,
          },
        });

        apiRef.current = api;

        // Event listeners
        api.addListener('videoConferenceJoined', () => {
          setIsLoading(false);
          // Mute audio by default
          api.executeCommand('toggleAudio');
        });

        api.addListener('participantJoined', () => {
          setParticipantCount(prev => prev + 1);
        });

        api.addListener('participantLeft', () => {
          setParticipantCount(prev => Math.max(1, prev - 1));
        });

        api.addListener('audioMuteStatusChanged', (data: { muted: boolean }) => {
          setIsMuted(data.muted);
        });

        api.addListener('videoMuteStatusChanged', (data: { muted: boolean }) => {
          setIsVideoOff(data.muted);
        });

        api.addListener('readyToClose', () => {
          onClose();
        });

      } catch (err: any) {
        console.error('Failed to initialize Jitsi:', err);
        setError(err.message || 'Failed to load video room');
        setIsLoading(false);
      }
    };

    initJitsi();

    // Cleanup
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [roomName, displayName, onClose]);

  const handleToggleAudio = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleAudio');
    }
  };

  const handleToggleVideo = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('toggleVideo');
    }
  };

  const handleLeave = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('hangup');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">
            {eventTitle || 'Virtual Event'}
          </h2>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Users className="w-4 h-4" />
            <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick controls in header */}
          <button
            onClick={handleToggleAudio}
            className={`p-2 rounded-lg transition ${
              isMuted ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <button
            onClick={handleToggleVideo}
            className={`p-2 rounded-lg transition ${
              isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
          
          <button
            onClick={handleLeave}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition"
          >
            <X className="w-4 h-4" />
            Leave
          </button>
        </div>
      </div>

      {/* Jitsi Container */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Joining virtual event...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
        
        <div 
          ref={jitsiContainerRef} 
          className="w-full h-full"
          style={{ display: isLoading || error ? 'none' : 'block' }}
        />
      </div>
    </div>
  );
}
