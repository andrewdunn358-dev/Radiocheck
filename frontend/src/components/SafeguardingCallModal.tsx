/**
 * Safeguarding Call Modal Component
 * 
 * A React Native modal that allows users to request a voice call with
 * a supporter directly from the AI chat screen during safeguarding alerts.
 * 
 * Uses Socket.IO for real-time communication with the backend.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Animated,
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
  | 'connecting'      // Initial state - connecting to socket
  | 'waiting'         // Request sent, waiting for staff
  | 'supporter_found' // Staff accepted the call request
  | 'no_staff'        // No staff available
  | 'timeout'         // Request timed out
  | 'error';          // Connection error

const TIMEOUT_SECONDS = 30;

export default function SafeguardingCallModal({
  visible,
  alertId,
  sessionId,
  userId,
  userName = 'Veteran',
  onClose,
  onCallEnded,
}: SafeguardingCallModalProps) {
  const [modalState, setModalState] = useState<ModalState>('connecting');
  const [staffName, setStaffName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const socketRef = useRef<Socket | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRequestedRef = useRef(false);
  
  // Pulse animation for waiting state
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulse animation
  useEffect(() => {
    if (visible && (modalState === 'connecting' || modalState === 'waiting')) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, modalState, pulseAnim]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[SafeguardingCallModal] Cleaning up...');
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    hasRequestedRef.current = false;
  }, []);

  // Connect to Socket.IO and request call when modal opens
  useEffect(() => {
    if (!visible) {
      cleanup();
      setModalState('connecting');
      return;
    }

    // Prevent duplicate requests
    if (hasRequestedRef.current) {
      return;
    }
    hasRequestedRef.current = true;

    console.log('[SafeguardingCallModal] Modal opened, connecting to Socket.IO...');
    console.log('[SafeguardingCallModal] API_URL:', API_URL);
    console.log('[SafeguardingCallModal] Session ID:', sessionId);
    console.log('[SafeguardingCallModal] Alert ID:', alertId);

    setModalState('connecting');
    setErrorMessage('');

    // Connect to Socket.IO server
    const socket = io(API_URL, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('[SafeguardingCallModal] Socket connected:', socket.id);
      
      // Register the user
      const anonymousUserId = userId || `anon_${sessionId}`;
      console.log('[SafeguardingCallModal] Registering user:', anonymousUserId);
      
      socket.emit('register', {
        user_id: anonymousUserId,
        user_type: 'user',
        name: userName,
        status: 'available',
      });

      // Small delay to ensure registration is processed
      setTimeout(() => {
        // Request human call
        console.log('[SafeguardingCallModal] Emitting request_human_call...');
        socket.emit('request_human_call', {
          session_id: sessionId,
          alert_id: alertId || '',
          user_id: anonymousUserId,
          user_name: userName,
          request_type: 'call',
        });

        setModalState('waiting');

        // Start timeout timer
        timeoutRef.current = setTimeout(() => {
          console.log('[SafeguardingCallModal] Request timed out');
          setModalState('timeout');
        }, TIMEOUT_SECONDS * 1000);
      }, 500);
    });

    socket.on('connect_error', (error) => {
      console.error('[SafeguardingCallModal] Socket connection error:', error);
      setModalState('error');
      setErrorMessage('Could not connect to support service');
    });

    socket.on('disconnect', (reason) => {
      console.log('[SafeguardingCallModal] Socket disconnected:', reason);
      if (modalState === 'waiting' || modalState === 'connecting') {
        setModalState('error');
        setErrorMessage('Connection lost');
      }
    });

    // Listen for call request accepted
    socket.on('call_request_accepted', (data: any) => {
      console.log('[SafeguardingCallModal] Call request accepted:', data);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setStaffName(data?.staff_name || data?.acceptor_name || 'Support Staff');
      setModalState('supporter_found');
    });

    // Listen for no staff available
    socket.on('no_staff_available', (data: any) => {
      console.log('[SafeguardingCallModal] No staff available:', data);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setModalState('no_staff');
    });

    // Listen for incoming call (alternative success path)
    socket.on('incoming_call', (data: any) => {
      console.log('[SafeguardingCallModal] Incoming call:', data);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setStaffName(data?.caller_name || 'Support Staff');
      setModalState('supporter_found');
    });

    return cleanup;
  }, [visible, sessionId, alertId, userId, userName, cleanup]);

  // Handle close
  const handleClose = () => {
    cleanup();
    onClose();
  };

  // Handle call ended
  const handleCallEnded = () => {
    cleanup();
    onCallEnded?.();
  };

  // Crisis helpline handlers
  const callSamaritans = () => {
    Linking.openURL('tel:116123');
  };

  const callNHS = () => {
    Linking.openURL('tel:111');
  };

  const callEmergency = () => {
    Linking.openURL('tel:999');
  };

  // Render crisis line fallback screen
  const renderCrisisLines = () => (
    <View style={styles.crisisContainer}>
      <View style={styles.iconContainer}>
        <View style={[styles.iconOuter, { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
          <FontAwesome5 name="phone-alt" size={32} color="#f59e0b" />
        </View>
      </View>
      
      <Text style={styles.title}>
        {modalState === 'no_staff' ? 'No Supporters Available' : 'Still Here For You'}
      </Text>
      
      <Text style={styles.message}>
        {modalState === 'no_staff' 
          ? "Our team isn't available right now, but help is still available 24/7."
          : "We couldn't connect you right now, but these services are always available:"}
      </Text>

      <View style={styles.crisisButtons}>
        <TouchableOpacity 
          style={[styles.crisisButton, { backgroundColor: '#16a34a' }]}
          onPress={callSamaritans}
          data-testid="call-samaritans-btn"
        >
          <FontAwesome5 name="phone-alt" size={20} color="#fff" />
          <View style={styles.crisisButtonText}>
            <Text style={styles.crisisButtonTitle}>Samaritans</Text>
            <Text style={styles.crisisButtonNumber}>116 123 (24/7)</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.crisisButton, { backgroundColor: '#2563eb' }]}
          onPress={callNHS}
          data-testid="call-nhs-btn"
        >
          <FontAwesome5 name="phone-alt" size={20} color="#fff" />
          <View style={styles.crisisButtonText}>
            <Text style={styles.crisisButtonTitle}>NHS 111</Text>
            <Text style={styles.crisisButtonNumber}>Mental Health</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.crisisButton, { backgroundColor: '#dc2626' }]}
          onPress={callEmergency}
          data-testid="call-999-btn"
        >
          <FontAwesome5 name="phone-alt" size={20} color="#fff" />
          <View style={styles.crisisButtonText}>
            <Text style={styles.crisisButtonTitle}>Emergency</Text>
            <Text style={styles.crisisButtonNumber}>999</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Connecting State */}
          {modalState === 'connecting' && (
            <View style={styles.content}>
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.iconOuter, { borderColor: '#3b82f6' }]}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                </View>
              </Animated.View>
              
              <Text style={styles.title}>Connecting...</Text>
              <Text style={styles.message}>
                Setting up a secure connection to our support team.
              </Text>
              
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Waiting State */}
          {modalState === 'waiting' && (
            <View style={styles.content}>
              <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.iconOuter, { borderColor: '#16a34a' }]}>
                  <Ionicons name="call" size={40} color="#16a34a" />
                </View>
              </Animated.View>
              
              <Text style={styles.title}>Finding a Supporter</Text>
              <Text style={styles.message}>
                We're connecting you with an available team member. Please stay on this screen.
              </Text>
              
              <View style={styles.steps}>
                <View style={styles.step}>
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  <Text style={styles.stepText}>Request received</Text>
                </View>
                <View style={styles.step}>
                  <ActivityIndicator size="small" color="#16a34a" />
                  <Text style={styles.stepText}>Finding available supporter...</Text>
                </View>
              </View>

              <Text style={styles.hint}>
                This usually takes less than 30 seconds.
              </Text>
              
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel & Go Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Supporter Found State */}
          {modalState === 'supporter_found' && (
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <View style={[styles.iconOuter, { borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                  <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                </View>
              </View>
              
              <Text style={styles.title}>Supporter Found!</Text>
              <Text style={styles.staffName}>{staffName}</Text>
              <Text style={styles.message}>
                A supporter is ready to talk with you. They will call you shortly.
              </Text>
              
              <View style={styles.successNote}>
                <FontAwesome5 name="info-circle" size={16} color="#22c55e" />
                <Text style={styles.successNoteText}>
                  Keep your phone nearby - you'll receive an incoming call.
                </Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.closeButton, { backgroundColor: '#22c55e' }]} 
                onPress={handleCallEnded}
              >
                <Text style={styles.closeButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* No Staff Available State */}
          {modalState === 'no_staff' && renderCrisisLines()}

          {/* Timeout State */}
          {modalState === 'timeout' && renderCrisisLines()}

          {/* Error State */}
          {modalState === 'error' && (
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <View style={[styles.iconOuter, { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Ionicons name="alert-circle" size={48} color="#ef4444" />
                </View>
              </View>
              
              <Text style={styles.title}>Connection Issue</Text>
              <Text style={styles.message}>
                {errorMessage || "We couldn't connect to our support service."}
              </Text>
              
              {renderCrisisLines()}
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
    backgroundColor: '#1f2937',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  crisisContainer: {
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
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  staffName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
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
    color: '#9ca3af',
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },
  closeButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  successNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  successNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#22c55e',
    lineHeight: 18,
  },
  crisisButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  crisisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  crisisButtonText: {
    flex: 1,
  },
  crisisButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  crisisButtonNumber: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
