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
      console.log('[WebRTCPhone] Initiating call to:', targetUserId);
      updateStatus('ringing', 'Calling...');
      
      currentCallIdRef.current = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Send call initiate event (backend will notify the target)
      socketRef.current.emit('call_initiate', {
        target_user_id: targetUserId,
        call_type: 'audio',
        call_id: currentCallIdRef.current
      });

      return true;
    } catch (error) {
      console.error('[WebRTCPhone] Failed to make call:', error);
      updateStatus('error', 'Call failed');
      return false;
    }
  }, [state.isInCall, updateStatus]);

  // Answer call
  const answerCall = useCallback(async () => {
    if (!socketRef.current || !currentCallIdRef.current) return;

    try {
      console.log('[WebRTCPhone] Accepting call:', currentCallIdRef.current);
      stopRingtone();
      updateStatus('connecting', 'Connecting...');

      // Send call accept event
      socketRef.current.emit('call_accept', {
        call_id: currentCallIdRef.current
      });

      setState(prev => ({ ...prev, hasIncomingCall: false, isInCall: true }));
    } catch (error) {
      console.error('Failed to answer call:', error);
      endCall();
    }
  }, [createPeerConnection, endCall, stopRingtone, updateStatus]);

  // Reject call
  const rejectCall = useCallback(() => {
    console.log('[WebRTCPhone] Rejecting call:', currentCallIdRef.current);
    stopRingtone();
    if (socketRef.current && currentCallIdRef.current) {
      socketRef.current.emit('call_reject', { call_id: currentCallIdRef.current });
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
    console.log('[WebRTCPhone] Init check:', { serverUrl, userId, userType, userName, enabled });
    
    if (!serverUrl || !userId || !userType || !userName || !enabled) {
      console.log('[WebRTCPhone] Skipping init - missing params');
      return;
    }

    console.log('[WebRTCPhone] Starting Socket.IO connection to:', serverUrl);
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
      console.log('[WebRTCPhone] Socket connected! Registering...');
      socket.emit('register', {
        user_id: userId,
        user_type: userType,
        name: userName,
        status: 'available'
      });
    });

    socket.on('registered', (data) => {
      console.log('[WebRTCPhone] Registered with server:', data);
      updateStatus('online', 'Online');
      setState(prev => ({ ...prev, isRegistered: true }));
    });

    socket.on('connect_error', (error) => {
      console.error('[WebRTCPhone] Connection error:', error.message);
      updateStatus('error', 'Connection Failed');
    });

    socket.on('online_users', (users: OnlineUser[]) => {
      console.log('[WebRTCPhone] Online users:', users);
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

    // Online staff list
    socket.on('online_staff_list', (data: { staff: any[] }) => {
      console.log('[WebRTCPhone] Online staff list:', data.staff);
    });

    // Incoming call (from backend)
    socket.on('incoming_call', async (data: { call_id: string; caller_id: string; caller_name: string; call_type: string }) => {
      console.log('[WebRTCPhone] *** INCOMING CALL ***', data);
      currentCallIdRef.current = data.call_id;
      playRingtone();
      updateStatus('incoming', `Call from ${data.caller_name}`);
      setState(prev => ({
        ...prev,
        hasIncomingCall: true,
        callerInfo: {
          id: data.caller_id,
          name: data.caller_name,
          type: data.call_type,
        }
      }));
    });

    // WebRTC offer received (when call is established)
    socket.on('webrtc_offer', async (data: { call_id: string; offer: RTCSessionDescriptionInit }) => {
      console.log('[WebRTCPhone] WebRTC offer received');
      try {
        const pc = await createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        hasRemoteDescriptionRef.current = true;

        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          call_id: data.call_id,
          answer: answer
        });

        // Process any pending ICE candidates
        for (const candidate of pendingIceCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceCandidatesRef.current = [];
      } catch (error) {
        console.error('[WebRTCPhone] Failed to handle WebRTC offer:', error);
      }
    });

    // Call accepted (caller receives this)
    socket.on('call_accepted', async (data: { call_id: string; callee_name?: string }) => {
      console.log('[WebRTCPhone] Call accepted by:', data.callee_name);
      stopRingtone();
      updateStatus('connected', 'Connected');
      setState(prev => ({ ...prev, hasIncomingCall: false, isInCall: true }));
      
      // Caller creates the WebRTC offer
      try {
        const pc = await createPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        socket.emit('webrtc_offer', {
          call_id: data.call_id,
          offer: offer
        });
      } catch (error) {
        console.error('[WebRTCPhone] Failed to create offer:', error);
      }
    });

    // Call ringing (caller receives this)
    socket.on('call_ringing', (data: { call_id: string; target_name?: string }) => {
      console.log('[WebRTCPhone] Call ringing to:', data.target_name);
      updateStatus('ringing', `Ringing ${data.target_name || ''}...`);
    });

    // WebRTC answer received
    socket.on('webrtc_answer', async (data: { call_id: string; answer: RTCSessionDescriptionInit }) => {
      console.log('[WebRTCPhone] WebRTC answer received');
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
      console.log('[WebRTCPhone] ICE candidate received');
      if (hasRemoteDescriptionRef.current && peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        pendingIceCandidatesRef.current.push(data.candidate);
      }
    });

    // Call rejected
    socket.on('call_rejected', (data: { call_id: string; reason?: string }) => {
      console.log('[WebRTCPhone] Call rejected:', data.reason);
      stopRingtone();
      endCall();
      updateStatus('online', 'Call declined');
    });

    // Call ended
    socket.on('call_ended', (data: { call_id: string; reason?: string }) => {
      console.log('[WebRTCPhone] Call ended:', data.reason);
      endCall();
    });

    // Call answered on another device (multi-device support)
    socket.on('call_answered_elsewhere', (data: { call_id: string; message?: string }) => {
      console.log('[WebRTCPhone] Call answered on another device:', data.message);
      stopRingtone();
      setState(prev => ({
        ...prev,
        hasIncomingCall: false,
        callerInfo: null
      }));
      updateStatus('online', 'Call answered elsewhere');
    });

    // Call cancelled (e.g., rejected on another device)
    socket.on('call_cancelled', (data: { call_id: string; reason?: string }) => {
      console.log('[WebRTCPhone] Call cancelled:', data.reason);
      stopRingtone();
      setState(prev => ({
        ...prev,
        hasIncomingCall: false,
        callerInfo: null
      }));
      updateStatus('online', 'Online');
    });

    socket.on('disconnect', () => {
      console.log('[WebRTCPhone] Socket disconnected');
      updateStatus('offline', 'Disconnected');
      setState(prev => ({ ...prev, isRegistered: false }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      endCall();
    };
  }, [serverUrl, userId, userType, userName, enabled, updateStatus, createPeerConnection, playRingtone, stopRingtone, endCall]);

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
