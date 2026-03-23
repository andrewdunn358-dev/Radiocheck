/**
 * AgoraMeetComponent - Agora Video SDK for virtual events
 * 
 * Replaces JitsiMeetComponent. Used for virtual coffee mornings and community events.
 * Runs on Expo Web (browser-based), using agora-rtc-sdk-ng.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AgoraMeetProps {
  roomName: string;
  displayName: string;
  onClose: () => void;
  eventTitle?: string;
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || 'cfd84eb3fcd7490cbe366d8cd1a4d974';

export default function AgoraMeetComponent({
  roomName,
  displayName,
  onClose,
  eventTitle,
}: AgoraMeetProps) {
  const clientRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const isMountedRef = useRef(true);

  const getChannelName = useCallback(() => {
    return `radiocheck_${roomName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
  }, [roomName]);

  const handleUserPublished = useCallback(async (user: any, mediaType: 'audio' | 'video') => {
    const client = clientRef.current;
    if (!client) return;
    await client.subscribe(user, mediaType);
    if (mediaType === 'video') {
      setRemoteUsers(prev => {
        const exists = prev.find((u: any) => u.uid === user.uid);
        if (exists) return prev.map((u: any) => u.uid === user.uid ? user : u);
        return [...prev, user];
      });
    }
    if (mediaType === 'audio') {
      user.audioTrack?.play();
    }
  }, []);

  const handleUserUnpublished = useCallback((user: any, mediaType: 'audio' | 'video') => {
    if (mediaType === 'video') {
      setRemoteUsers(prev => prev.map((u: any) => u.uid === user.uid ? user : u));
    }
  }, []);

  const handleUserLeft = useCallback((user: any) => {
    setRemoteUsers(prev => prev.filter((u: any) => u.uid !== user.uid));
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (Platform.OS !== 'web') {
      setError('Video calls are only available on web browsers');
      setIsLoading(false);
      return;
    }

    if (!AGORA_APP_ID) {
      setError('Video configuration missing. Please contact support.');
      setIsLoading(false);
      return;
    }

    let audioTrack: any = null;
    let videoTrack: any = null;

    const initAgora = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        AgoraRTC.setLogLevel(3);

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        client.on('user-published', handleUserPublished);
        client.on('user-unpublished', handleUserUnpublished);
        client.on('user-left', handleUserLeft);

        const channelName = getChannelName();
        console.log('[Agora] Joining channel:', channelName);

        await client.join(AGORA_APP_ID, channelName, null, null);
        console.log('[Agora] Joined channel');

        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
          { encoderConfig: 'music_standard' },
          { encoderConfig: { width: 640, height: 480, frameRate: 30, bitrateMax: 1000 } }
        );
        audioTrack = tracks[0];
        videoTrack = tracks[1];

        if (isMountedRef.current) {
          setLocalAudioTrack(audioTrack);
          setLocalVideoTrack(videoTrack);
        }

        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }

        await client.publish([audioTrack, videoTrack]);
        console.log('[Agora] Published local tracks');

        if (isMountedRef.current) {
          setIsJoined(true);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[Agora] Init error:', err);
        if (isMountedRef.current) {
          if (err.code === 'PERMISSION_DENIED' || err.message?.includes('Permission')) {
            setError('Camera/microphone access denied. Please allow access and try again.');
          } else if (err.code === 'DEVICE_NOT_FOUND') {
            setError('No camera or microphone found.');
          } else {
            setError(err.message || 'Failed to join video room');
          }
          setIsLoading(false);
        }
      }
    };

    initAgora();

    return () => {
      isMountedRef.current = false;
      const cleanup = async () => {
        if (audioTrack) audioTrack.close();
        if (videoTrack) videoTrack.close();
        if (clientRef.current) {
          clientRef.current.removeAllListeners();
          await clientRef.current.leave().catch(() => {});
          clientRef.current = null;
        }
      };
      cleanup();
    };
  }, [AGORA_APP_ID, getChannelName, handleUserPublished, handleUserUnpublished, handleUserLeft]);

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
      if (localAudioTrack) { localAudioTrack.close(); setLocalAudioTrack(null); }
      if (localVideoTrack) { localVideoTrack.close(); setLocalVideoTrack(null); }
      if (clientRef.current) { await clientRef.current.leave(); clientRef.current = null; }
    } catch (err) {
      console.error('[Agora] Leave error:', err);
    }
    onClose();
  };

  const participantCount = remoteUsers.length + (isJoined ? 1 : 0);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="videocam-off" size={48} color="#94a3b8" />
          <Text style={styles.errorText}>Video calls are only available in web browsers</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.participantBadge}>
            <Ionicons name="people" size={16} color="#fff" />
            <Text style={styles.participantCount}>{participantCount}</Text>
          </View>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {eventTitle || 'Virtual Event'}
          </Text>
        </View>

        <View style={styles.headerControls}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={handleToggleAudio}
            disabled={!isJoined}
            data-testid="agora-mute-btn"
          >
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
            onPress={handleToggleVideo}
            disabled={!isJoined}
            data-testid="agora-video-btn"
          >
            <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.leaveButton} onPress={handleLeave} data-testid="agora-leave-btn">
            <Ionicons name="exit-outline" size={20} color="#fff" />
            <Text style={styles.leaveText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Video Area */}
      <View style={styles.videoWrapper}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>Joining virtual event...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onClose}>
              <Text style={styles.retryText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !error && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap' as const, 
            gap: '8px', 
            width: '100%', 
            height: '100%', 
            padding: '8px',
          }}>
            {/* Local Video */}
            <div style={{
              flex: remoteUsers.length === 0 ? '1 1 100%' : '1 1 48%',
              minHeight: '200px',
              position: 'relative' as const,
              backgroundColor: '#1f2937',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              <div
                ref={localVideoRef}
                style={{
                  width: '100%',
                  height: '100%',
                  display: isVideoOff ? 'none' : 'block',
                }}
              />
              {isVideoOff && (
                <div style={{
                  position: 'absolute' as const, inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#1f2937',
                }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: '#374151',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, color: '#fff', fontWeight: 'bold',
                  }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div style={{
                position: 'absolute' as const, bottom: 8, left: 8,
                padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: 4, color: '#fff', fontSize: 13,
              }}>
                {displayName} (You){isMuted ? ' 🔇' : ''}
              </div>
            </div>

            {/* Remote Videos */}
            {remoteUsers.map((user: any) => (
              <RemoteUserVideo key={user.uid} user={user} />
            ))}
          </div>
        )}
      </View>
    </View>
  );
}

function RemoteUserVideo({ user }: { user: any }) {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user.videoTrack && videoRef.current) {
      user.videoTrack.play(videoRef.current);
    }
    return () => { user.videoTrack?.stop(); };
  }, [user.videoTrack]);

  const hasVideo = user.hasVideo && user.videoTrack;

  return (
    <div style={{
      flex: '1 1 48%',
      minHeight: '200px',
      position: 'relative' as const,
      backgroundColor: '#1f2937',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <div
        ref={videoRef}
        style={{ width: '100%', height: '100%', display: hasVideo ? 'block' : 'none' }}
      />
      {!hasVideo && (
        <div style={{
          position: 'absolute' as const, inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#1f2937',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: '#374151',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: '#fff', fontWeight: 'bold',
          }}>
            {String(user.uid).charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div style={{
        position: 'absolute' as const, bottom: 8, left: 8,
        padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4, color: '#fff', fontSize: 13,
      }}>
        User {user.uid}
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  participantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  participantCount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  roomTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  leaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
