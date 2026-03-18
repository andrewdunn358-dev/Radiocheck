'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// WebRTC Configuration
const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:free.expressturn.com:3478',
      username: '000000002087494108',
      credential: 'VGqVfeznpN8ZxyueC6MSG71Sso8='
    },
    {
      urls: 'turn:free.expressturn.com:3478?transport=tcp',
      username: '000000002087494108',
      credential: 'VGqVfeznpN8ZxyueC6MSG71Sso8='
    }
  ],
  iceCandidatePoolSize: 10,
};

export type WebRTCPhoneStatus = 'offline' | 'connecting' | 'online' | 'ringing' | 'incoming' | 'connected' | 'error';

interface UseWebRTCPhoneProps {
  serverUrl: string;
  userId?: string;
  userType?: string;
  userName?: string;
  enabled?: boolean;
}

interface WebRTCPhoneState {
  status: WebRTCPhoneStatus;
  statusText: string;
  isRegistered: boolean;
  isInCall: boolean;
  isMuted: boolean;
  callDuration: number;
  callerInfo?: {
    id: string;
    name: string;
    type: string;
  };
  hasIncomingCall: boolean;
}

interface OnlineUser {
  user_id: string;
  name: string;
  user_type: string;
  status: string;
}

export function useWebRTCPhone({ serverUrl, userId, userType, userName, enabled = true }: UseWebRTCPhoneProps) {
  const [state, setState] = useState<WebRTCPhoneState>({
    status: 'offline',
    statusText: 'Disconnected',
    isRegistered: false,
    isInCall: false,
    isMuted: false,
    callDuration: 0,
    hasIncomingCall: false,
  });

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescriptionRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update status helper
  const updateStatus = useCallback((status: WebRTCPhoneStatus, text: string) => {
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

  // Play ringtone
  const playRingtone = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/ringtone.mp3');
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.log('Could not play ringtone');
    }
  }, []);

  // Stop ringtone
  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection(WEBRTC_CONFIG);

    // Get local media stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } catch (error) {
      console.error('Failed to get microphone access:', error);
      throw new Error('Microphone access denied');
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track');
      const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;
      if (remoteAudio && event.streams[0]) {
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch(console.error);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && currentCallIdRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          call_id: currentCallIdRef.current,
          candidate: event.candidate.toJSON()
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        updateStatus('connected', 'In Call');
        setState(prev => ({ ...prev, isInCall: true }));
        startCallTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [updateStatus, startCallTimer]);

  // End call
  const endCall = useCallback(() => {
    stopRingtone();
    stopCallTimer();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (socketRef.current && currentCallIdRef.current) {
      socketRef.current.emit('webrtc_end_call', { call_id: currentCallIdRef.current });
    }

    currentCallIdRef.current = null;
    hasRemoteDescriptionRef.current = false;
    pendingIceCandidatesRef.current = [];

    updateStatus('online', 'Online');
    setState(prev => ({
      ...prev,
      isInCall: false,
      isMuted: false,
      hasIncomingCall: false,
      callerInfo: undefined,
    }));
  }, [stopRingtone, stopCallTimer, updateStatus]);

  // Make call
  const makeCall = useCallback(async (targetUserId: string) => {
    if (!socketRef.current || state.isInCall) return false;

    try {
      updateStatus('ringing', 'Calling...');
      const pc = await createPeerConnection();

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      currentCallIdRef.current = `${userId}-${targetUserId}-${Date.now()}`;

      socketRef.current.emit('webrtc_call', {
        call_id: currentCallIdRef.current,
        from_user_id: userId,
        to_user_id: targetUserId,
        offer: offer
      });

      return true;
    } catch (error) {
      console.error('Failed to make call:', error);
      updateStatus('error', 'Call failed');
      return false;
    }
  }, [userId, state.isInCall, createPeerConnection, updateStatus]);

  // Answer call
  const answerCall = useCallback(async () => {
    if (!socketRef.current || !currentCallIdRef.current) return;

    try {
      stopRingtone();
      updateStatus('connecting', 'Connecting...');

      const pc = await createPeerConnection();
      peerConnectionRef.current = pc;

      // The offer should have been set when receiving the incoming call
      // Now create and send the answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('webrtc_answer', {
        call_id: currentCallIdRef.current,
        answer: answer
      });

      setState(prev => ({ ...prev, hasIncomingCall: false }));
    } catch (error) {
      console.error('Failed to answer call:', error);
      endCall();
    }
  }, [createPeerConnection, endCall, stopRingtone, updateStatus]);

  // Reject call
  const rejectCall = useCallback(() => {
    stopRingtone();
    if (socketRef.current && currentCallIdRef.current) {
      socketRef.current.emit('webrtc_reject_call', { call_id: currentCallIdRef.current });
    }
    currentCallIdRef.current = null;
    updateStatus('online', 'Online');
    setState(prev => ({
      ...prev,
      hasIncomingCall: false,
      callerInfo: undefined,
    }));
  }, [stopRingtone, updateStatus]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = state.isMuted;
        setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
      }
    }
  }, [state.isMuted]);

  // Initialize socket connection
  useEffect(() => {
    if (!serverUrl || !userId || !userType || !userName || !enabled) {
      return;
    }

    updateStatus('connecting', 'Connecting...');

    const socket = io(serverUrl, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebRTC Socket connected');
      socket.emit('register', {
        user_id: userId,
        user_type: userType,
        name: userName,
        status: 'available'
      });
    });

    socket.on('registered', (data) => {
      console.log('Registered with WebRTC server:', data);
      updateStatus('online', 'Online');
      setState(prev => ({ ...prev, isRegistered: true }));
    });

    socket.on('online_users', (users: OnlineUser[]) => {
      console.log('Online users:', users);
      setOnlineUsers(users.filter(u => u.user_id !== userId));
    });

    socket.on('user_joined', (user: OnlineUser) => {
      setOnlineUsers(prev => {
        if (!prev.find(u => u.user_id === user.user_id)) {
          return [...prev, user];
        }
        return prev;
      });
    });

    socket.on('user_left', (data: { user_id: string }) => {
      setOnlineUsers(prev => prev.filter(u => u.user_id !== data.user_id));
    });

    // Incoming call
    socket.on('webrtc_incoming_call', async (data: { call_id: string; from_user_id: string; from_name: string; from_type: string; offer: RTCSessionDescriptionInit }) => {
      console.log('Incoming call from:', data.from_name);
      currentCallIdRef.current = data.call_id;
      playRingtone();
      updateStatus('incoming', `Call from ${data.from_name}`);
      setState(prev => ({
        ...prev,
        hasIncomingCall: true,
        callerInfo: {
          id: data.from_user_id,
          name: data.from_name,
          type: data.from_type,
        }
      }));

      // Create peer connection and set remote description
      try {
        const pc = await createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        hasRemoteDescriptionRef.current = true;

        // Process any pending ICE candidates
        for (const candidate of pendingIceCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceCandidatesRef.current = [];
      } catch (error) {
        console.error('Failed to handle incoming call:', error);
      }
    });

    // Call answered
    socket.on('webrtc_call_answered', async (data: { call_id: string; answer: RTCSessionDescriptionInit }) => {
      console.log('Call answered');
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        hasRemoteDescriptionRef.current = true;

        // Process any pending ICE candidates
        for (const candidate of pendingIceCandidatesRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceCandidatesRef.current = [];
      }
    });

    // ICE candidate received
    socket.on('webrtc_ice_candidate', async (data: { call_id: string; candidate: RTCIceCandidateInit }) => {
      if (hasRemoteDescriptionRef.current && peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        pendingIceCandidatesRef.current.push(data.candidate);
      }
    });

    // Call rejected
    socket.on('webrtc_call_rejected', () => {
      console.log('Call rejected');
      endCall();
      updateStatus('online', 'Call declined');
    });

    // Call ended
    socket.on('webrtc_call_ended', () => {
      console.log('Call ended by remote');
      endCall();
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      updateStatus('error', 'Connection Failed');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      updateStatus('offline', 'Disconnected');
      setState(prev => ({ ...prev, isRegistered: false }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      endCall();
    };
  }, [serverUrl, userId, userType, userName, enabled, updateStatus, createPeerConnection, playRingtone, endCall]);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    ...state,
    onlineUsers,
    formattedDuration: formatDuration(state.callDuration),
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
  };
}

export default useWebRTCPhone;
