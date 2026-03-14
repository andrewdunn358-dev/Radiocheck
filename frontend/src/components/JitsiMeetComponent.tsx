/**
 * JitsiMeetComponent - Embeds Jitsi Meet for video conferencing
 * 
 * Used for virtual coffee mornings and community events.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface JitsiConfig {
  startWithAudioMuted?: boolean;
  startWithVideoMuted?: boolean;
  subject?: string;
  prejoinPageEnabled?: boolean;
  toolbarButtons?: string[];
  interfaceConfigOverwrite?: Record<string, any>;
}

interface JitsiMeetProps {
  roomName: string;
  domain?: string;
  displayName: string;
  onClose: () => void;
  onParticipantJoined?: (participant: any) => void;
  onParticipantLeft?: (participant: any) => void;
  config?: JitsiConfig;
  isModerator?: boolean;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function JitsiMeetComponent({
  roomName,
  domain = 'meet.jit.si',
  displayName,
  onClose,
  onParticipantJoined,
  onParticipantLeft,
  config = {},
  isModerator = false,
}: JitsiMeetProps) {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(1);

  // Track if component is mounted to prevent state updates after unmount
  const [isContainerReady, setIsContainerReady] = useState(false);
  const isMountedRef = useRef(true);

  // Delay initialization until container is ready
  useEffect(() => {
    isMountedRef.current = true;
    
    if (Platform.OS !== 'web') {
      setError('Video calls are only available on web browsers');
      setIsLoading(false);
      return;
    }

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
    if (Platform.OS !== 'web' || !isContainerReady) {
      return;
    }

    // Load Jitsi Meet External API script
    const loadJitsiScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://${domain}/external_api.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Jitsi Meet'));
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

        // Default Jitsi configuration - optimized for public meet.jit.si
        const defaultConfig = {
          startWithAudioMuted: true,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          prejoinPageEnabled: true,
          enableClosePage: false,
          hideConferenceSubject: false,
          // Disable features that cause warnings on public Jitsi
          disableAudioLevels: true, // Prevents audio level related warnings
          enableNoAudioDetection: false, // Disable to prevent errors
          enableNoisyMicDetection: false, // Disable to prevent errors
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
          // Video settings
          resolution: 720,
          constraints: {
            video: {
              height: {
                ideal: 720,
                max: 1080,
                min: 240
              }
            }
          },
          // Disable large video optimization issues
          channelLastN: -1,
          ...config,
        };

        // Interface configuration - avoid deprecated features
        const defaultInterfaceConfig = {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_ALWAYS_VISIBLE: true,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
          MOBILE_APP_PROMO: false,
          FILM_STRIP_MAX_HEIGHT: 120,
          // Minimal settings sections to avoid unsupported features
          SETTINGS_SECTIONS: ['devices', 'language', 'profile'],
          // Disable speaker stats UI completely
          DISABLE_SPEAKER_STATS: true,
          // Disable video quality label (can cause issues)
          DISABLE_VIDEO_QUALITY_LABEL: true,
          // Use simpler toolbar without problematic features
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'chat', 'raisehand',
            'tileview', 'videoquality', 'filmstrip', 'settings'
          ],
          ...config.interfaceConfigOverwrite,
        };

        console.log('[Jitsi] Initializing with room:', roomName);

        // Create Jitsi Meet instance
        const api = new window.JitsiMeetExternalAPI(domain, {
          roomName: roomName,
          parentNode: jitsiContainerRef.current,
          width: '100%',
          height: '100%',
          userInfo: {
            displayName: displayName,
          },
          configOverwrite: defaultConfig,
          interfaceConfigOverwrite: defaultInterfaceConfig,
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

        api.addListener('videoConferenceLeft', () => {
          console.log('[Jitsi] Left conference');
          onClose();
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
          // Suppress non-critical warnings like:
          // - speaker-selection (deprecated feature)
          // - large-video-not-initialized (timing issue, usually resolves)
          // - analytics errors (when disabled)
        });

        api.addListener('participantJoined', (participant: any) => {
          if (isMountedRef.current) {
            setParticipantCount(prev => prev + 1);
          }
          onParticipantJoined?.(participant);
        });

        api.addListener('participantLeft', (participant: any) => {
          if (isMountedRef.current) {
            setParticipantCount(prev => Math.max(1, prev - 1));
          }
          onParticipantLeft?.(participant);
        });

        api.addListener('readyToClose', () => {
          onClose();
        });

        // Moderator controls
        if (isModerator) {
          api.addListener('participantRoleChanged', (event: any) => {
            if (event.role === 'moderator') {
              console.log('[Jitsi] User became moderator');
            }
          });
        }

      } catch (err) {
        console.error('[Jitsi] Init error:', err);
        if (isMountedRef.current) {
          setError('Failed to load video chat. Please try again.');
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
  }, [roomName, domain, displayName, config, isModerator, onClose, onParticipantJoined, onParticipantLeft, isContainerReady]);

  const handleLeave = () => {
    if (apiRef.current) {
      apiRef.current.executeCommand('hangup');
    }
    onClose();
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="videocam-off" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Video calls are only available in web browsers
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.participantBadge}>
            <Ionicons name="people" size={16} color="#fff" />
            <Text style={styles.participantCount}>{participantCount}</Text>
          </View>
          {config.subject && (
            <Text style={styles.roomTitle} numberOfLines={1}>{config.subject}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
          <Ionicons name="exit-outline" size={20} color="#fff" />
          <Text style={styles.leaveText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Jitsi Container */}
      <View style={styles.jitsiWrapper}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Connecting to video chat...</Text>
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

        <div
          ref={jitsiContainerRef}
          style={{
            width: '100%',
            height: '100%',
            display: isLoading || error ? 'none' : 'block',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
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
  jitsiWrapper: {
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
    backgroundColor: '#3b82f6',
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
