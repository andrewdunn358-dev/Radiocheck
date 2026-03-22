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
  const [isContainerReady, setIsContainerReady] = useState(false);
  const isMountedRef = useRef(true);

  // Delay initialization until container is ready
  useEffect(() => {
    isMountedRef.current = true;
    
    // Give the DOM a moment to render the container
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setIsContainerReady(true);
      }
    }, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!isContainerReady) return;

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
        
        // Double-check container exists and component is still mounted
        if (!jitsiContainerRef.current || !isMountedRef.current) {
          console.log('[Jitsi] Container not ready or component unmounted');
          return;
        }

        // Generate a clean room name (alphanumeric only)
        const cleanRoomName = roomName.replace(/[^a-zA-Z0-9]/g, '');
        
        console.log('[Jitsi] Initializing with room:', `RadioCheck_${cleanRoomName}`);

        // Initialize Jitsi Meet with optimized config for public meet.jit.si
        const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName: `RadioCheck_${cleanRoomName}`,
          parentNode: jitsiContainerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            // Start with audio muted by default
            startWithAudioMuted: true,
            startWithVideoMuted: false,
            
            // Disable features not needed
            disableInviteFunctions: true,
            disableDeepLinking: true,
            
            // Enable useful features
            enableWelcomePage: false,
            enableClosePage: false,
            
            // Hide some UI elements for cleaner experience
            hideConferenceSubject: false,
            hideConferenceTimer: false,
            
            // Disable features that cause warnings on public Jitsi
            disableAudioLevels: true,
            enableNoAudioDetection: false,
            enableNoisyMicDetection: false,
            
            // Disable speaker stats completely (fixes speaker-selection error)
            disableSpeakerStatsSearch: true,
            speakerStats: {
              disabled: true,
            },
            
            // Disable features not supported on public meet.jit.si
            disableThirdPartyRequests: true,
            analytics: {
              disabled: true,
            },
            
            // Disable large video optimization issues
            channelLastN: -1,
            
            // Quality settings
            resolution: 720,
            constraints: {
              video: {
                height: { ideal: 720, max: 1080, min: 240 }
              }
            },
            
            // Toolbar configuration
            toolbarButtons: [
              'microphone',
              'camera',
              'desktop',
              'fullscreen',
              'hangup',
              'chat',
              'raisehand',
              'tileview',
              'participants-pane',
              'settings',
              'toggle-camera',
            ],
            
            // CRITICAL: Always enforce prejoin settings LAST to prevent overrides
            prejoinPageEnabled: false,
            lobbyModeEnabled: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: '',
            SHOW_POWERED_BY: false,
            SHOW_PROMOTIONAL_CLOSE_PAGE: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
            TOOLBAR_ALWAYS_VISIBLE: true,
            DEFAULT_BACKGROUND: '#1a1a2e',
            FILM_STRIP_MAX_HEIGHT: 120,
            // Minimal settings sections to avoid unsupported features
            SETTINGS_SECTIONS: ['devices', 'language', 'profile'],
            // Use simpler toolbar without problematic features
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'chat', 'raisehand',
              'tileview', 'videoquality', 'filmstrip', 'settings'
            ],
          },
          userInfo: {
            displayName: displayName,
          },
        });

        apiRef.current = api;

        // Event listeners
        api.addListener('videoConferenceJoined', () => {
          console.log('[Jitsi] Joined conference');
          // Give Jitsi more time to fully initialize all video components
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsLoading(false);
            }
          }, 1000);
        });

        // Handle Jitsi errors gracefully - suppress non-critical warnings
        api.addListener('errorOccurred', (error: any) => {
          const errorName = error?.error?.name || error?.name || '';
          const errorMessage = error?.error?.message || error?.message || '';
          
          console.warn('[Jitsi] Error/Warning:', errorName, errorMessage);
          
          // Only show error to user for critical issues
          if (errorName === 'gum.general' || errorName === 'gum.permission_denied') {
            if (isMountedRef.current) {
              setError('Camera/microphone access denied. Please allow access and try again.');
            }
          }
        });

        api.addListener('participantJoined', () => {
          if (isMountedRef.current) {
            setParticipantCount(prev => prev + 1);
          }
        });

        api.addListener('participantLeft', () => {
          if (isMountedRef.current) {
            setParticipantCount(prev => Math.max(1, prev - 1));
          }
        });

        api.addListener('audioMuteStatusChanged', (data: { muted: boolean }) => {
          if (isMountedRef.current) {
            setIsMuted(data.muted);
          }
        });

        api.addListener('videoMuteStatusChanged', (data: { muted: boolean }) => {
          if (isMountedRef.current) {
            setIsVideoOff(data.muted);
          }
        });

        api.addListener('readyToClose', () => {
          onClose();
        });

      } catch (err: any) {
        console.error('[Jitsi] Failed to initialize:', err);
        if (isMountedRef.current) {
          setError(err.message || 'Failed to load video room');
          setIsLoading(false);
        }
      }
    };

    initJitsi();

    // Cleanup
    return () => {
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch (e) {
          console.warn('[Jitsi] Dispose error:', e);
        }
        apiRef.current = null;
      }
    };
  }, [roomName, displayName, onClose, isContainerReady]);

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
