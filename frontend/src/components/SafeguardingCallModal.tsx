/**
 * Safeguarding Call Modal Component
 * 
 * A reusable in-page call modal that allows users to make voice calls
 * directly from the chat page without navigating away.
 * 
 * Used for safeguarding calls when AI detects concerning content.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useWebRTCCall, formatCallDuration } from '../../hooks/useWebRTCCallWeb';
import { useTheme } from '../context/ThemeContext';
import { useLocationPermission } from '../context/LocationPermissionContext';
import { API_URL } from '../config/api';

interface SafeguardingCallModalProps {
  visible: boolean;
  alertId: string | null;
  sessionId: string;
  onClose: () => void;
  onCallEnded?: () => void;
}

export default function SafeguardingCallModal({
  visible,
  alertId,
  sessionId,
  onClose,
  onCallEnded,
}: SafeguardingCallModalProps) {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const { requestLocation, locationCoords } = useLocationPermission();
  
  // WebRTC state
  const { callState, callInfo, callDuration, debugInfo, register, acceptCall, rejectCall, endCall } = useWebRTCCall();
  
  // Local state
  const [isWaiting, setIsWaiting] = useState(true);
  const [waitingMessage, setWaitingMessage] = useState('Connecting you to a supporter...');
  const [hasRegistered, setHasRegistered] = useState(false);
  
  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulse animation
  useEffect(() => {
    if (visible && isWaiting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, isWaiting, pulseAnim]);

  // Register with WebRTC and request location when modal opens
  useEffect(() => {
    if (visible && !hasRegistered) {
      console.log('[CallModal] Registering for WebRTC calls...');
      
      // Get GPS location for safeguarding
      sendLocationToBackend();
      
      // Register with WebRTC signaling
      register(sessionId, 'user', 'Veteran in need');
      setHasRegistered(true);
      
      // Notify staff that we need a call
      const notifyStaff = () => {
        const socket = typeof window !== 'undefined' ? (window as any).__webrtc_socket : null;
        if (socket?.connected) {
          console.log('[CallModal] Notifying staff of call request...');
          socket.emit('request_human_call', {
            user_id: sessionId,
            user_name: 'Veteran in need',
            session_id: sessionId,
            alert_id: alertId || ''
          });
          setWaitingMessage('Request sent - a supporter will call you shortly...');
          return true;
        }
        return false;
      };
      
      // Retry socket connection
      let attempts = 0;
      const maxAttempts = 20;
      const retryInterval = setInterval(() => {
        attempts++;
        if (notifyStaff() || attempts >= maxAttempts) {
          clearInterval(retryInterval);
          if (attempts >= maxAttempts) {
            setWaitingMessage('Connection issue - please try again');
          }
        }
      }, 500);
      
      // Update message after a few seconds
      setTimeout(() => {
        if (isWaiting) {
          setWaitingMessage('Please stay here to receive your call');
        }
      }, 8000);
      
      return () => {
        clearInterval(retryInterval);
      };
    }
  }, [visible, hasRegistered, sessionId, alertId, register]);

  // Handle incoming call
  useEffect(() => {
    if (callState === 'ringing' && callInfo?.isIncoming) {
      console.log('[CallModal] Incoming call detected!');
      setIsWaiting(false);
    }
  }, [callState, callInfo]);

  // Handle call end
  useEffect(() => {
    if (callState === 'idle' && !isWaiting && hasRegistered) {
      // Call just ended
      onCallEnded?.();
    }
  }, [callState, isWaiting, hasRegistered, onCallEnded]);

  // Send location to backend
  const sendLocationToBackend = async () => {
    if (!alertId) return;
    
    try {
      // First try to get fresh location
      const coords = await requestLocation();
      
      if (coords) {
        console.log('[CallModal] Sending GPS location:', coords);
        await fetch(`${API_URL}/api/safeguarding-alerts/${alertId}/location`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gps_lat: coords.lat,
            gps_lon: coords.lon,
            gps_accuracy: coords.accuracy,
            location_source: 'gps'
          }),
        });
      } else if (locationCoords) {
        // Fall back to cached location
        console.log('[CallModal] Using cached location:', locationCoords);
        await fetch(`${API_URL}/api/safeguarding-alerts/${alertId}/location`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gps_lat: locationCoords.lat,
            gps_lon: locationCoords.lon,
            gps_accuracy: locationCoords.accuracy,
            location_source: 'gps_cached'
          }),
        });
      }
    } catch (err) {
      console.error('[CallModal] Failed to send location:', err);
    }
  };

  const handleAcceptCall = () => {
    console.log('[CallModal] Accepting call...');
    acceptCall();
  };

  const handleRejectCall = () => {
    console.log('[CallModal] Rejecting call...');
    rejectCall();
    setIsWaiting(true);
    setHasRegistered(false);
    onClose();
  };

  const handleEndCall = () => {
    console.log('[CallModal] Ending call...');
    endCall();
  };

  const handleCancel = () => {
    if (callState !== 'idle') {
      endCall();
    }
    setIsWaiting(true);
    setHasRegistered(false);
    onClose();
  };

  const showCallModal = callState !== 'idle' || isWaiting;

  return (
    <Modal visible={visible && showCallModal} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Waiting State */}
          {isWaiting && callState === 'idle' && (
            <View style={styles.waitingContent}>
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.iconOuter, { borderColor: '#16a34a' }]}>
                  <Ionicons name="call" size={48} color="#16a34a" />
                </View>
              </Animated.View>
              
              <Text style={[styles.title, { color: colors.text }]}>
                Waiting for Support
              </Text>
              
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {waitingMessage}
              </Text>
              
              <View style={styles.steps}>
                <View style={styles.step}>
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>Request received</Text>
                </View>
                <View style={styles.step}>
                  <ActivityIndicator size="small" color="#16a34a" />
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>Finding available supporter</Text>
                </View>
                <View style={styles.step}>
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>You'll receive a call shortly</Text>
                </View>
              </View>
              
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Please stay on this screen to receive your call.
              </Text>
              
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel & Go Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Incoming Call State */}
          {callState === 'ringing' && callInfo?.isIncoming && (
            <View style={styles.callContent}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(22, 163, 74, 0.1)' }]}>
                <Ionicons name="call" size={48} color="#16a34a" />
              </View>
              
              <Text style={[styles.title, { color: colors.text }]}>Incoming Call</Text>
              <Text style={[styles.peerName, { color: colors.textSecondary }]}>
                {callInfo.peerName || 'Support Staff'}
              </Text>
              
              <View style={styles.callButtons}>
                <TouchableOpacity
                  style={[styles.callButton, styles.rejectButton]}
                  onPress={handleRejectCall}
                  data-testid="reject-call-btn"
                >
                  <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.callButtonText}>Decline</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.callButton, styles.acceptButton]}
                  onPress={handleAcceptCall}
                  data-testid="accept-call-btn"
                >
                  <Ionicons name="call" size={28} color="#fff" />
                  <Text style={styles.callButtonText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Connecting State */}
          {(callState === 'connecting' || (callState === 'ringing' && !callInfo?.isIncoming)) && (
            <View style={styles.callContent}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="call-outline" size={48} color="#3b82f6" />
              </View>
              
              <Text style={[styles.title, { color: colors.text }]}>Connecting...</Text>
              <Text style={[styles.peerName, { color: colors.textSecondary }]}>
                {callInfo?.peerName || 'Support Staff'}
              </Text>
              
              <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
              
              <TouchableOpacity style={[styles.endCallButton, { marginTop: 32 }]} onPress={handleCancel}>
                <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.endCallText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Connected State */}
          {callState === 'connected' && (
            <View style={styles.callContent}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Ionicons name="call" size={48} color="#22c55e" />
              </View>
              
              <Text style={[styles.title, { color: colors.text }]}>Connected</Text>
              <Text style={[styles.peerName, { color: colors.textSecondary }]}>
                {callInfo?.peerName || 'Support Staff'}
              </Text>
              
              <Text style={styles.duration}>{formatCallDuration(callDuration)}</Text>
              
              {/* Debug Info */}
              <View style={styles.debugContainer}>
                <Text style={styles.debugText}>Track: {debugInfo.remoteTrackReceived ? '✓' : '✗'}</Text>
                <Text style={styles.debugText}>Audio: {debugInfo.audioPlaying ? '✓' : '✗'}</Text>
                <Text style={styles.debugText}>ICE: {debugInfo.iceState}</Text>
              </View>
              
              <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
                <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.endCallText}>End Call</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  waitingContent: {
    alignItems: 'center',
    width: '100%',
  },
  callContent: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  peerName: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  steps: {
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepText: {
    fontSize: 14,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#94a3b8',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  callButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 32,
  },
  callButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#22c55e',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  endCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 10,
    marginTop: 24,
  },
  endCallText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  duration: {
    fontSize: 40,
    fontWeight: '300',
    color: '#22c55e',
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginTop: 16,
    gap: 16,
  },
  debugText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
