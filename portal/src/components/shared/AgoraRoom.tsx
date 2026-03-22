'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Users, Mic, MicOff, Video, VideoOff, PhoneOff, Settings } from 'lucide-react';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';

interface AgoraRoomProps {
  roomName: string;
  displayName: string;
  onClose: () => void;
  eventTitle?: string;
}

// Configure Agora SDK
AgoraRTC.setLogLevel(3); // Warning level only

export default function AgoraRoom({ roomName, displayName, onClose, eventTitle }: AgoraRoomProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

  // Generate a clean channel name from room name
  const getChannelName = useCallback(() => {
    return `radiocheck_${roomName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
  }, [roomName]);

  // Handle remote user events
  const handleUserPublished = useCallback(async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
    const client = clientRef.current;
    if (!client) return;

    await client.subscribe(user, mediaType);
    console.log('[Agora] Subscribed to user:', user.uid, mediaType);

    if (mediaType === 'video') {
      setRemoteUsers(prev => {
        const exists = prev.find(u => u.uid === user.uid);
        if (exists) {
          return prev.map(u => u.uid === user.uid ? user : u);
        }
        return [...prev, user];
      });
    }

    if (mediaType === 'audio') {
      user.audioTrack?.play();
    }
  }, []);

  const handleUserUnpublished = useCallback((user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
    console.log('[Agora] User unpublished:', user.uid, mediaType);
    if (mediaType === 'video') {
      setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? user : u));
    }
  }, []);

  const handleUserLeft = useCallback((user: IAgoraRTCRemoteUser) => {
    console.log('[Agora] User left:', user.uid);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  }, []);

  const handleUserJoined = useCallback((user: IAgoraRTCRemoteUser) => {
    console.log('[Agora] User joined:', user.uid);
  }, []);

  // Initialize Agora
  useEffect(() => {
    if (!appId) {
      setError('Agora App ID not configured');
      setIsLoading(false);
      return;
    }

    const initAgora = async () => {
      try {
        console.log('[Agora] Initializing...');
        
        // Create Agora client
        const client = AgoraRTC.createClient({ 
          mode: 'rtc', 
          codec: 'vp8' 
        });
        clientRef.current = client;

        // Set up event handlers
        client.on('user-published', handleUserPublished);
        client.on('user-unpublished', handleUserUnpublished);
        client.on('user-left', handleUserLeft);
        client.on('user-joined', handleUserJoined);

        // Join channel (using null for token means no token authentication - for testing)
        const channelName = getChannelName();
        console.log('[Agora] Joining channel:', channelName);
        
        const uid = await client.join(appId, channelName, null, null);
        console.log('[Agora] Joined channel with UID:', uid);

        // Create local tracks
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          {
            encoderConfig: 'music_standard',
          },
          {
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 30,
              bitrateMax: 1000,
            },
          }
        );

        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        // Play local video
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }

        // Publish local tracks
        await client.publish([audioTrack, videoTrack]);
        console.log('[Agora] Published local tracks');

        setIsJoined(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('[Agora] Init error:', err);
        
        // Handle specific errors
        if (err.code === 'PERMISSION_DENIED' || err.message?.includes('Permission')) {
          setError('Camera/microphone access denied. Please allow access and try again.');
        } else if (err.code === 'DEVICE_NOT_FOUND') {
          setError('No camera or microphone found. Please connect a device and try again.');
        } else {
          setError(err.message || 'Failed to join video room');
        }
        setIsLoading(false);
      }
    };

    initAgora();

    // Cleanup
    return () => {
      const cleanup = async () => {
        console.log('[Agora] Cleaning up...');
        
        if (localAudioTrack) {
          localAudioTrack.close();
        }
        if (localVideoTrack) {
          localVideoTrack.close();
        }
        
        if (clientRef.current) {
          clientRef.current.removeAllListeners();
          await clientRef.current.leave();
          clientRef.current = null;
        }
      };
      cleanup();
    };
  }, [appId, getChannelName, handleUserPublished, handleUserUnpublished, handleUserLeft, handleUserJoined]);

  // Play local video when track is ready
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current && !isVideoOff) {
      localVideoTrack.play(localVideoRef.current);
    }
  }, [localVideoTrack, isVideoOff]);

  const handleToggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handleToggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleLeave = async () => {
    try {
      if (localAudioTrack) {
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }
      if (localVideoTrack) {
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch (err) {
      console.error('[Agora] Leave error:', err);
    }
    onClose();
  };

  const participantCount = remoteUsers.length + (isJoined ? 1 : 0);

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
            disabled={!isJoined}
            className={`p-2 rounded-lg transition disabled:opacity-50 ${
              isMuted ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <button
            onClick={handleToggleVideo}
            disabled={!isJoined}
            className={`p-2 rounded-lg transition disabled:opacity-50 ${
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
            <PhoneOff className="w-4 h-4" />
            Leave
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 relative p-4">
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
        
        {!isLoading && !error && (
          <div className="h-full grid gap-4" style={{
            gridTemplateColumns: remoteUsers.length === 0 ? '1fr' : 
              remoteUsers.length === 1 ? '1fr 1fr' :
              remoteUsers.length <= 3 ? 'repeat(2, 1fr)' :
              'repeat(3, 1fr)',
            gridTemplateRows: remoteUsers.length <= 2 ? '1fr' : 'repeat(2, 1fr)',
          }}>
            {/* Local Video */}
            <div className="relative bg-gray-800 rounded-xl overflow-hidden">
              <div 
                ref={localVideoRef}
                className="w-full h-full"
                style={{ display: isVideoOff ? 'none' : 'block' }}
              />
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                    <span className="text-2xl text-white font-semibold">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 rounded text-white text-sm flex items-center gap-2">
                <span>{displayName} (You)</span>
                {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
              </div>
            </div>

            {/* Remote Videos */}
            {remoteUsers.map(user => (
              <RemoteUser key={user.uid} user={user} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Remote user video component
function RemoteUser({ user }: { user: IAgoraRTCRemoteUser }) {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user.videoTrack && videoRef.current) {
      user.videoTrack.play(videoRef.current);
    }
    return () => {
      user.videoTrack?.stop();
    };
  }, [user.videoTrack]);

  const hasVideo = user.hasVideo && user.videoTrack;

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden">
      <div 
        ref={videoRef}
        className="w-full h-full"
        style={{ display: hasVideo ? 'block' : 'none' }}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-2xl text-white font-semibold">
              {String(user.uid).charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 rounded text-white text-sm flex items-center gap-2">
        <span>User {user.uid}</span>
        {!user.hasAudio && <MicOff className="w-3 h-3 text-red-400" />}
      </div>
    </div>
  );
}
