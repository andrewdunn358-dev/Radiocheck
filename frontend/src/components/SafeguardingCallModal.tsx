/**
 * Safeguarding Call Modal Component
 * 
 * Handles the full call flow when user taps "Call a Supporter":
 * 1. Connect to Socket.IO, emit request_human_call
 * 2. When staff accepts → auto-connect WebRTC (no user interaction needed)
 * 3. If no staff/timeout → show callback form + crisis lines
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Linking,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config/api';

interface SafeguardingCallModalProps {
  visible: boolean;
  alertId: string | null;
  sessionId: string;
  userId?: string;
  userName?: string;
  onClose: () => void;
  onCallEnded?: () => void;
}

type ModalState = 
  | 'finding'         // Looking for available staff
  | 'connecting'      // Staff accepted, setting up WebRTC
  | 'connected'       // In call
  | 'no_staff'        // No staff available - show fallback options
  | 'callback_form'   // User wants to request a callback
  | 'callback_sent'   // Callback request submitted
  | 'error';          // Connection error

const TIMEOUT_SECONDS = 30;

// Enhanced ICE server configuration with TURN servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  // Free TURN servers for NAT traversal (cross-network calls)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// Audio constraints for better call quality
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
};

export default function SafeguardingCallModal({
  visible,
  alertId,
  sessionId,
  userId,
  userName = 'Veteran',
  onClose,
  onCallEnded,
}: SafeguardingCallModalProps) {
  const [modalState, setModalState] = useState<ModalState>('finding');
  const [staffName, setStaffName] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Callback form state
  const [callbackName, setCallbackName] = useState(userName || '');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  
  // Refs - these persist across renders and don't cause re-renders
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callIdRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const propsRef = useRef({ alertId, sessionId, userId, userName, onClose, onCallEnded });

  // Update props ref when they change
  useEffect(() => {
    propsRef.current = { alertId, sessionId, userId, userName, onClose, onCallEnded };
  }, [alertId, sessionId, userId, userName, onClose, onCallEnded]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Main effect - ONLY depends on `visible`
  useEffect(() => {
    // Don't do anything if not visible
    if (!visible) {
      return;
    }

    // Prevent double initialization
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;

    const { alertId, sessionId, userId, userName } = propsRef.current;
    const anonymousUserId = userId || `anon_${sessionId}`;

    console.log('[SafeguardingCallModal] Modal opened, connecting to Socket.IO...');
    console.log('[SafeguardingCallModal] API_URL:', API_URL);
    console.log('[SafeguardingCallModal] Session:', sessionId, 'Alert:', alertId);

    setModalState('finding');
    setErrorMessage('');

    // Connect to Socket.IO
    const socket = io(API_URL, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SafeguardingCallModal] Socket connected:', socket.id);
      
      // Register user
      socket.emit('register', {
        user_id: anonymousUserId,
        user_type: 'user',
        name: userName,
        status: 'available',
      });

      // Request human call after a short delay
      setTimeout(() => {
        console.log('[SafeguardingCallModal] Emitting request_human_call');
        socket.emit('request_human_call', {
          session_id: sessionId,
          alert_id: alertId || '',
          user_id: anonymousUserId,
          user_name: userName,
          request_type: 'call',
        });

        // Start timeout
        timeoutRef.current = setTimeout(() => {
          console.log('[SafeguardingCallModal] Request timed out');
          setModalState('no_staff');
        }, TIMEOUT_SECONDS * 1000);
      }, 300);
    });

    socket.on('connect_error', (error) => {
      console.error('[SafeguardingCallModal] Socket error:', error);
      setErrorMessage('Could not connect to support service');
      setModalState('error');
    });

    // Staff accepted - start WebRTC immediately
    socket.on('call_request_accepted', async (data: any) => {
      console.log('[SafeguardingCallModal] Call accepted:', data);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setStaffName(data?.staff_name || 'Support Staff');
      callIdRef.current = data?.call_id || '';
      setModalState('connecting');
      
      // Setup WebRTC - get user's microphone ready with quality constraints
      try {
        console.log('[SafeguardingCallModal] Setting up WebRTC with enhanced audio...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: AUDIO_CONSTRAINTS, 
          video: false 
        });
        localStreamRef.current = stream;
        console.log('[SafeguardingCallModal] Got local audio stream with noise suppression');
        
        // Create peer connection with enhanced config
        const pc = new RTCPeerConnection({ 
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
        });
        pcRef.current = pc;
        
        // Add local tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
        
        // Queue for ICE candidates received before remote description is set
        const pendingCandidates: RTCIceCandidate[] = [];
        let hasRemoteDescription = false;
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            console.log('[SafeguardingCallModal] Sending ICE candidate');
            socketRef.current.emit('webrtc_ice_candidate', {
              call_id: callIdRef.current,
              candidate: event.candidate,
              user_id: anonymousUserId,
            });
          }
        };
        
        // ICE gathering state monitoring
        pc.onicegatheringstatechange = () => {
          console.log('[SafeguardingCallModal] ICE gathering state:', pc.iceGatheringState);
        };
        
        // ICE connection state monitoring  
        pc.oniceconnectionstatechange = () => {
          console.log('[SafeguardingCallModal] ICE connection state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'failed') {
            console.log('[SafeguardingCallModal] ICE connection failed, attempting restart...');
            pc.restartIce();
          }
        };
        
        // Handle connection state
        pc.onconnectionstatechange = () => {
          console.log('[SafeguardingCallModal] Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setModalState('connected');
            // Start call timer
            callTimerRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);
          } else if (pc.connectionState === 'failed') {
            setErrorMessage('Call connection failed - please try again');
            setModalState('error');
          } else if (pc.connectionState === 'disconnected') {
            // Wait a moment before declaring error - might reconnect
            setTimeout(() => {
              if (pcRef.current?.connectionState === 'disconnected') {
                setErrorMessage('Call connection lost');
                setModalState('error');
              }
            }, 3000);
          }
        };
        
        // Handle incoming audio with proper cleanup
        pc.ontrack = (event) => {
          console.log('[SafeguardingCallModal] Received remote track:', event.track.kind);
          if (event.streams && event.streams[0] && Platform.OS === 'web') {
            // Clean up existing audio element
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = null;
              remoteAudioRef.current = null;
            }
            
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.autoplay = true;
            audio.volume = 1.0;
            audio.play().catch(err => console.error('Audio play error:', err));
            remoteAudioRef.current = audio;
          }
        };
        
      } catch (err: any) {
        console.error('[SafeguardingCallModal] WebRTC setup error:', err);
        setErrorMessage('Could not access microphone');
        setModalState('error');
      }
    });

    // No staff available
    socket.on('no_staff_available', () => {
      console.log('[SafeguardingCallModal] No staff available');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setModalState('no_staff');
    });

    // WebRTC offer from staff
    socket.on('webrtc_offer', async (data: any) => {
      console.log('[SafeguardingCallModal] Received WebRTC offer');
      if (!data?.offer || !pcRef.current) {
        console.error('[SafeguardingCallModal] No offer or no peer connection');
        return;
      }
      
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('[SafeguardingCallModal] Set remote description');
        
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        console.log('[SafeguardingCallModal] Created answer');
        
        socket.emit('webrtc_answer', {
          call_id: callIdRef.current,
          answer: answer,
          user_id: anonymousUserId,
        });
      } catch (err) {
        console.error('[SafeguardingCallModal] Error handling offer:', err);
        setErrorMessage('Failed to connect call');
        setModalState('error');
      }
    });

    // ICE candidate from staff
    socket.on('webrtc_ice_candidate', async (data: any) => {
      if (data?.candidate && pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('[SafeguardingCallModal] Error adding ICE candidate:', err);
        }
      }
    });

    // Call ended by staff
    socket.on('call_ended', () => {
      console.log('[SafeguardingCallModal] Call ended by staff');
      cleanup();
      propsRef.current.onCallEnded?.();
      propsRef.current.onClose();
    });

    // Cleanup function
    function cleanup() {
      console.log('[SafeguardingCallModal] Cleaning up...');
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      callIdRef.current = '';
      setCallDuration(0);
    }

    // Cleanup on unmount or when modal closes
    return () => {
      isInitializedRef.current = false;
      cleanup();
    };
  }, [visible]); // ONLY depend on visible!

  // Reset state when modal becomes visible
  useEffect(() => {
    if (visible) {
      setModalState('finding');
      setCallbackName(userName || '');
      setCallbackPhone('');
      setCallDuration(0);
      setStaffName('');
      setErrorMessage('');
    }
  }, [visible, userName]);

  // End the call
  const endCall = () => {
    console.log('[SafeguardingCallModal] User ending call...');
    
    if (socketRef.current && callIdRef.current) {
      socketRef.current.emit('call_end', {
        call_id: callIdRef.current,
        user_id: userId || `anon_${sessionId}`,
      });
    }
    
    // Cleanup will be handled by the useEffect return
    onCallEnded?.();
    onClose();
  };

  // Submit callback request
  const submitCallbackRequest = async () => {
    if (!callbackName.trim() || !callbackPhone.trim()) return;
    
    setIsSubmittingCallback(true);
    
    try {
      const response = await fetch(`${API_URL}/api/callbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: callbackName.trim(),
          phone: callbackPhone.trim(),
          message: 'Safeguarding - Requested call when no staff available',
          request_type: 'counsellor', // Default to counsellor for safeguarding callbacks
          is_urgent: true,
          safeguarding_alert_id: alertId,
        }),
      });
      
      if (response.ok) {
        setModalState('callback_sent');
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('[SafeguardingCallModal] Callback error:', errorData);
        setErrorMessage('Failed to submit callback request');
      }
    } catch (err) {
      console.error('[SafeguardingCallModal] Callback submit error:', err);
      setErrorMessage('Failed to submit callback request');
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  // Crisis line handlers
  const callNHS = () => Linking.openURL('tel:111');
  const callSamaritans = () => Linking.openURL('tel:116123');
  const callEmergency = () => Linking.openURL('tel:999');

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          
          {/* FINDING STAFF */}
          {modalState === 'finding' && (
            <View style={styles.content}>
              <View style={styles.pulseContainer}>
                <ActivityIndicator size="large" color="#22c55e" />
              </View>
              <Text style={styles.title}>Finding someone for you...</Text>
              <Text style={styles.message}>
                Please hold on while we connect you with an available supporter.
              </Text>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* CONNECTING WebRTC */}
          {modalState === 'connecting' && (
            <View style={styles.content}>
              <View style={styles.pulseContainer}>
                <View style={styles.connectingIcon}>
                  <Ionicons name="call" size={32} color="#22c55e" />
                </View>
              </View>
              <Text style={styles.title}>Connecting you now...</Text>
              <Text style={styles.staffName}>{staffName}</Text>
              <Text style={styles.message}>
                Setting up your call with {staffName}
              </Text>
              <ActivityIndicator size="small" color="#22c55e" style={{ marginTop: 16 }} />
            </View>
          )}

          {/* CONNECTED - IN CALL */}
          {modalState === 'connected' && (
            <View style={styles.content}>
              <View style={styles.connectedIcon}>
                <Ionicons name="call" size={40} color="#fff" />
              </View>
              <Text style={styles.title}>Connected</Text>
              <Text style={styles.staffName}>{staffName}</Text>
              <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
              
              <TouchableOpacity 
                style={styles.endCallButton} 
                onPress={endCall}
                data-testid="end-call-btn"
              >
                <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.endCallText}>End Call</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* NO STAFF - FALLBACK OPTIONS */}
          {modalState === 'no_staff' && (
            <View style={styles.content}>
              <View style={styles.noStaffIcon}>
                <FontAwesome5 name="user-clock" size={32} color="#f59e0b" />
              </View>
              <Text style={styles.title}>No Supporters Available</Text>
              <Text style={styles.message}>
                Our team isn't available right now, but help is still here for you.
              </Text>

              <View style={styles.fallbackOptions}>
                <TouchableOpacity 
                  style={[styles.fallbackButton, { backgroundColor: '#3b82f6' }]}
                  onPress={() => setModalState('callback_form')}
                  data-testid="request-callback-btn"
                >
                  <FontAwesome5 name="phone-alt" size={18} color="#fff" />
                  <Text style={styles.fallbackButtonText}>Request a Callback</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.fallbackButton, { backgroundColor: '#0ea5e9' }]}
                  onPress={callNHS}
                  data-testid="call-nhs-btn"
                >
                  <FontAwesome5 name="phone-alt" size={18} color="#fff" />
                  <View style={styles.fallbackButtonContent}>
                    <Text style={styles.fallbackButtonText}>NHS 111</Text>
                    <Text style={styles.fallbackButtonSub}>Press Option 2 for Mental Health</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.fallbackButton, { backgroundColor: '#16a34a' }]}
                  onPress={callSamaritans}
                  data-testid="call-samaritans-btn"
                >
                  <FontAwesome5 name="phone-alt" size={18} color="#fff" />
                  <View style={styles.fallbackButtonContent}>
                    <Text style={styles.fallbackButtonText}>Samaritans</Text>
                    <Text style={styles.fallbackButtonSub}>116 123 (Free, 24/7)</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.fallbackButton, { backgroundColor: '#dc2626' }]}
                  onPress={callEmergency}
                  data-testid="call-999-btn"
                >
                  <FontAwesome5 name="phone-alt" size={18} color="#fff" />
                  <View style={styles.fallbackButtonContent}>
                    <Text style={styles.fallbackButtonText}>Emergency</Text>
                    <Text style={styles.fallbackButtonSub}>999</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* CALLBACK FORM */}
          {modalState === 'callback_form' && (
            <View style={styles.content}>
              <Text style={styles.title}>Request a Callback</Text>
              <Text style={styles.message}>
                We'll call you back as soon as someone is available.
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  value={callbackName}
                  onChangeText={setCallbackName}
                  placeholder="Enter your name"
                  placeholderTextColor="#6b7280"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={callbackPhone}
                  onChangeText={setCallbackPhone}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#6b7280"
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, (!callbackName.trim() || !callbackPhone.trim()) && styles.submitButtonDisabled]}
                onPress={submitCallbackRequest}
                disabled={!callbackName.trim() || !callbackPhone.trim() || isSubmittingCallback}
                data-testid="submit-callback-btn"
              >
                {isSubmittingCallback ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Request</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalState('no_staff')}>
                <Text style={styles.cancelText}>Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* CALLBACK SENT */}
          {modalState === 'callback_sent' && (
            <View style={styles.content}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              </View>
              <Text style={styles.title}>Callback Requested</Text>
              <Text style={styles.message}>
                We've received your request and will call you back as soon as possible.
              </Text>
              <Text style={styles.hint}>
                If you need immediate help, please use the crisis lines below.
              </Text>

              <View style={styles.fallbackOptions}>
                <TouchableOpacity 
                  style={[styles.fallbackButton, { backgroundColor: '#16a34a' }]}
                  onPress={callSamaritans}
                >
                  <FontAwesome5 name="phone-alt" size={18} color="#fff" />
                  <Text style={styles.fallbackButtonText}>Samaritans: 116 123</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ERROR STATE */}
          {modalState === 'error' && (
            <View style={styles.content}>
              <View style={styles.errorIcon}>
                <Ionicons name="alert-circle" size={48} color="#ef4444" />
              </View>
              <Text style={styles.title}>Connection Issue</Text>
              <Text style={styles.message}>
                {errorMessage || "We couldn't connect your call."}
              </Text>

              <View style={styles.fallbackOptions}>
                <TouchableOpacity 
                  style={[styles.fallbackButton, { backgroundColor: '#3b82f6' }]}
                  onPress={() => setModalState('callback_form')}
                >
                  <FontAwesome5 name="phone-alt" size={18} color="#fff" />
                  <Text style={styles.fallbackButtonText}>Request a Callback Instead</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.fallbackButton, { backgroundColor: '#16a34a' }]}
                  onPress={callSamaritans}
                >
                  <FontAwesome5 name="phone-alt" size={18} color="#fff" />
                  <Text style={styles.fallbackButtonText}>Samaritans: 116 123</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Close</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1f2937',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
  },
  content: {
    alignItems: 'center',
  },
  pulseContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  connectingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  noStaffIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 24,
  },
  errorIcon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  staffName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
    textAlign: 'center',
    marginBottom: 8,
  },
  duration: {
    fontSize: 32,
    fontWeight: '300',
    color: '#9ca3af',
    marginBottom: 32,
    fontVariant: ['tabular-nums'],
  },
  message: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  endCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 40,
    gap: 12,
  },
  endCallText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  fallbackOptions: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  fallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  fallbackButtonContent: {
    flex: 1,
  },
  fallbackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  fallbackButtonSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  closeButton: {
    width: '100%',
    backgroundColor: '#374151',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  formGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#4b5563',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
