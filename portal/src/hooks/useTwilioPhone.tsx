'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { staffApi } from '@/lib/api';

export type PhoneStatus = 'initializing' | 'ready' | 'offline' | 'error' | 'unavailable' | 'calling' | 'connected';

interface UseTwilioPhoneProps {
  staffId?: string;
  staffName?: string;
  enabled?: boolean;
}

interface TwilioPhoneState {
  status: PhoneStatus;
  statusText: string;
  isReady: boolean;
  isInCall: boolean;
  isMuted: boolean;
  callDuration: number;
  currentCallNumber?: string;
}

export function useTwilioPhone({ staffId, staffName, enabled = true }: UseTwilioPhoneProps) {
  const [state, setState] = useState<TwilioPhoneState>({
    status: 'initializing',
    statusText: 'Initializing...',
    isReady: false,
    isInCall: false,
    isMuted: false,
    callDuration: 0,
  });

  const deviceRef = useRef<Device | null>(null);
  const currentCallRef = useRef<Call | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);

  // Update status helper
  const updateStatus = useCallback((status: PhoneStatus, text: string) => {
    setState(prev => ({ ...prev, status, statusText: text }));
  }, []);

  // Start call timer
  const startCallTimer = useCallback(() => {
    callStartTimeRef.current = new Date();
    callTimerRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const duration = Math.floor((Date.now() - callStartTimeRef.current.getTime()) / 1000);
        setState(prev => ({ ...prev, callDuration: duration }));
      }
    }, 1000);
  }, []);

  // Stop call timer
  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    callStartTimeRef.current = null;
    setState(prev => ({ ...prev, callDuration: 0 }));
  }, []);

  // Initialize Twilio Device
  const initializeDevice = useCallback(async () => {
    if (!staffId || !staffName || !enabled) {
      updateStatus('offline', 'Not logged in');
      return;
    }

    try {
      updateStatus('initializing', 'Checking Twilio status...');

      // Check if Twilio is configured
      const twilioStatus = await staffApi.getTwilioStatus();
      if (!twilioStatus?.configured) {
        updateStatus('unavailable', 'Phone not configured');
        return;
      }

      // Get access token
      updateStatus('initializing', 'Getting token...');
      const tokenResponse = await staffApi.getTwilioToken(staffId, staffName);
      if (!tokenResponse?.token) {
        updateStatus('error', 'Token failed');
        return;
      }

      // Create Twilio Device
      updateStatus('initializing', 'Connecting...');
      const device = new Device(tokenResponse.token, {
        logLevel: 1,
        edge: 'dublin', // UK edge location
      });

      // Setup device event handlers
      device.on('registered', () => {
        console.log('Twilio Device registered');
        updateStatus('ready', 'Ready');
        setState(prev => ({ ...prev, isReady: true }));
      });

      device.on('unregistered', () => {
        console.log('Twilio Device unregistered');
        updateStatus('offline', 'Disconnected');
        setState(prev => ({ ...prev, isReady: false }));
      });

      device.on('error', (error) => {
        console.error('Twilio Device error:', error);
        updateStatus('error', `Error: ${error.message || 'Unknown'}`);
      });

      device.on('incoming', (call: Call) => {
        console.log('Incoming call from:', call.parameters.From);
        // Handle incoming call if needed
        currentCallRef.current = call;
        setState(prev => ({
          ...prev,
          isInCall: true,
          currentCallNumber: call.parameters.From,
        }));
        updateStatus('calling', `Incoming: ${call.parameters.From}`);
      });

      // Register the device
      await device.register();
      deviceRef.current = device;

    } catch (error) {
      console.error('Twilio init error:', error);
      updateStatus('error', 'Init failed');
    }
  }, [staffId, staffName, enabled, updateStatus]);

  // Make a call
  const makeCall = useCallback(async (phoneNumber: string) => {
    if (!deviceRef.current || !state.isReady) {
      console.error('Device not ready');
      return false;
    }

    try {
      updateStatus('calling', `Calling ${phoneNumber}...`);
      setState(prev => ({ ...prev, currentCallNumber: phoneNumber }));

      const call = await deviceRef.current.connect({
        params: {
          To: phoneNumber,
          StaffId: staffId || '',
          StaffName: staffName || '',
        }
      });

      currentCallRef.current = call;

      // Setup call event handlers
      call.on('accept', () => {
        console.log('Call accepted');
        updateStatus('connected', 'Connected');
        setState(prev => ({ ...prev, isInCall: true }));
        startCallTimer();
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        updateStatus('ready', 'Ready');
        setState(prev => ({
          ...prev,
          isInCall: false,
          isMuted: false,
          currentCallNumber: undefined,
        }));
        stopCallTimer();
        currentCallRef.current = null;
      });

      call.on('cancel', () => {
        console.log('Call cancelled');
        updateStatus('ready', 'Ready');
        setState(prev => ({
          ...prev,
          isInCall: false,
          currentCallNumber: undefined,
        }));
        currentCallRef.current = null;
      });

      call.on('error', (error) => {
        console.error('Call error:', error);
        updateStatus('error', `Call error: ${error.message || 'Unknown'}`);
        setState(prev => ({
          ...prev,
          isInCall: false,
          currentCallNumber: undefined,
        }));
        stopCallTimer();
        currentCallRef.current = null;
      });

      return true;
    } catch (error) {
      console.error('Failed to make call:', error);
      updateStatus('error', 'Call failed');
      return false;
    }
  }, [state.isReady, staffId, staffName, updateStatus, startCallTimer, stopCallTimer]);

  // Hang up
  const hangUp = useCallback(() => {
    if (currentCallRef.current) {
      currentCallRef.current.disconnect();
      currentCallRef.current = null;
    }
    stopCallTimer();
    updateStatus('ready', 'Ready');
    setState(prev => ({
      ...prev,
      isInCall: false,
      isMuted: false,
      currentCallNumber: undefined,
    }));
  }, [stopCallTimer, updateStatus]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (currentCallRef.current) {
      const newMuteState = !state.isMuted;
      currentCallRef.current.mute(newMuteState);
      setState(prev => ({ ...prev, isMuted: newMuteState }));
    }
  }, [state.isMuted]);

  // Answer incoming call
  const answerCall = useCallback(() => {
    if (currentCallRef.current) {
      currentCallRef.current.accept();
      startCallTimer();
    }
  }, [startCallTimer]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (currentCallRef.current) {
      currentCallRef.current.reject();
      currentCallRef.current = null;
      updateStatus('ready', 'Ready');
      setState(prev => ({
        ...prev,
        isInCall: false,
        currentCallNumber: undefined,
      }));
    }
  }, [updateStatus]);

  // Initialize on mount
  useEffect(() => {
    initializeDevice();

    return () => {
      // Cleanup
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      stopCallTimer();
    };
  }, [initializeDevice, stopCallTimer]);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    ...state,
    formattedDuration: formatDuration(state.callDuration),
    makeCall,
    hangUp,
    toggleMute,
    answerCall,
    rejectCall,
    reinitialize: initializeDevice,
  };
}

export default useTwilioPhone;
