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
  // User request states (from mobile app users)
  hasIncomingChatRequest: boolean;
  hasIncomingCallRequest: boolean;
  pendingRequest?: {
    request_id: string;
    user_id: string;
    user_name: string;
    session_id?: string;
    room_id?: string;
    type: 'chat' | 'call';
    risk_level?: string;
    timestamp: string;
  };
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
    hasIncomingChatRequest: false,
    hasIncomingCallRequest: false,
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
  
  // Ringtone state using Web Audio API (no file needed)
  const ringtoneRef = useRef<{
    context: AudioContext | null;
    isPlaying: boolean;
    intervalId: NodeJS.Timeout | null;
    isEnabled: boolean;
  }>({
    context: null,
    isPlaying: false,
    intervalId: null,
    isEnabled: false
  });

  // Update status helper
  const updateStatus = useCallback((status: WebRTCPhoneStatus, text: string) => {
    setState(prev => ({ ...prev, status, statusText: text }));
  }, []);

  // Enable audio context on first user interaction (required by browsers)
  useEffect(() => {
    const enableAudio = () => {
      if (!ringtoneRef.current.isEnabled) {
        try {
          ringtoneRef.current.context = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (ringtoneRef.current.context.state === 'suspended') {
            ringtoneRef.current.context.resume();
          }
          ringtoneRef.current.isEnabled = true;
          console.log('[WebRTCPhone] Audio context enabled');
        } catch (e) {
          console.log('[WebRTCPhone] Could not enable audio context:', e);
        }
      }
    };

    document.addEventListener('click', enableAudio, { once: true });
    document.addEventListener('keydown', enableAudio, { once: true });
    document.addEventListener('touchstart', enableAudio, { once: true });

    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
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

  // Play ringtone using Web Audio API (UK-style double ring)
  const playRingtone = useCallback(() => {
    if (ringtoneRef.current.isPlaying) return;
    ringtoneRef.current.isPlaying = true;
    console.log('[WebRTCPhone] Playing ringtone');

    try {
      // Create audio context if not exists
      if (!ringtoneRef.current.context) {
        ringtoneRef.current.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume if suspended
      if (ringtoneRef.current.context.state === 'suspended') {
        ringtoneRef.current.context.resume();
      }

      // UK-style double ring pattern
      const playRing = () => {
        if (!ringtoneRef.current.isPlaying || !ringtoneRef.current.context) return;

        const ctx = ringtoneRef.current.context;
        const now = ctx.currentTime;

        // Create two oscillators for UK ring tone (400Hz + 450Hz)
        const playBurst = (startTime: number, duration: number) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.frequency.value = 400;
          osc2.frequency.value = 450;
          osc1.type = 'sine';
          osc2.type = 'sine';
          gain.gain.value = 0.15; // Volume

          osc1.start(startTime);
          osc2.start(startTime);
          osc1.stop(startTime + duration);
          osc2.stop(startTime + duration);
        };

        // Double ring: burst, gap, burst
        playBurst(now, 0.4);
        playBurst(now + 0.6, 0.4);
      };

      // Play immediately and repeat every 2 seconds
      playRing();
      ringtoneRef.current.intervalId = setInterval(playRing, 2000);

    } catch (e) {
      console.log('[WebRTCPhone] Could not play ringtone:', e);
    }
  }, []);

  // Stop ringtone
  const stopRingtone = useCallback(() => {
    console.log('[WebRTCPhone] Stopping ringtone');
    ringtoneRef.current.isPlaying = false;
    if (ringtoneRef.current.intervalId) {
      clearInterval(ringtoneRef.current.intervalId);
      ringtoneRef.current.intervalId = null;
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

  // Accept chat request from user
  const acceptChatRequest = useCallback(() => {
    if (!socketRef.current || !state.pendingRequest) return;
    
    console.log('[WebRTCPhone] Accepting chat request:', state.pendingRequest.request_id);
    stopRingtone();
    
    socketRef.current.emit('accept_chat_request', {
      request_id: state.pendingRequest.request_id,
      user_id: state.pendingRequest.user_id,
      staff_id: userId,
      staff_name: userName,
    });
    
    // The chat_request_confirmed event will update the state with room_id
  }, [state.pendingRequest, userId, userName, stopRingtone]);

  // Dismiss chat/call request
  const dismissRequest = useCallback(() => {
    console.log('[WebRTCPhone] Dismissing request');
    stopRingtone();
    setState(prev => ({
      ...prev,
      hasIncomingChatRequest: false,
      hasIncomingCallRequest: false,
      pendingRequest: undefined,
    }));
  }, [stopRingtone]);

  // Accept call request from user (safeguarding)
  const acceptCallRequest = useCallback(() => {
    if (!socketRef.current || !state.pendingRequest) return;
    
    console.log('[WebRTCPhone] Accepting call request:', state.pendingRequest.request_id);
    stopRingtone();
    
    socketRef.current.emit('accept_call_request', {
      request_id: state.pendingRequest.request_id,
      user_id: state.pendingRequest.user_id,
      staff_id: userId,
      staff_name: userName,
    });
    
    setState(prev => ({
      ...prev,
      hasIncomingCallRequest: false,
    }));
  }, [state.pendingRequest, userId, userName, stopRingtone]);

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

    // Staff status changed - sync across all portals
    socket.on('staff_status_changed', (data: { user_id: string; status: string }) => {
      console.log('[WebRTCPhone] Staff status changed:', data);
      // If this is our own status change, update local state
      if (data.user_id === userId) {
        console.log('[WebRTCPhone] Own status synced to:', data.status);
        // Dispatch a custom event so the page can react
        window.dispatchEvent(new CustomEvent('staff_status_sync', { detail: data }));
      }
    });

    // Staff went online
    socket.on('staff_online', (data: { user_id: string; name: string; status: string }) => {
      console.log('[WebRTCPhone] Staff online:', data);
      window.dispatchEvent(new CustomEvent('staff_online', { detail: data }));
    });

    // Staff went offline
    socket.on('staff_offline', (data: { user_id: string; name: string }) => {
      console.log('[WebRTCPhone] Staff offline:', data);
      window.dispatchEvent(new CustomEvent('staff_offline', { detail: data }));
    });

    // Incoming CHAT request from user (mobile app user wants to chat with staff)
    socket.on('incoming_chat_request', (data: { 
      request_id: string; 
      user_id: string; 
      user_name: string; 
      session_id?: string;
      risk_level?: string;
    }) => {
      console.log('[WebRTCPhone] *** INCOMING CHAT REQUEST ***', data);
      playRingtone();
      
      const requestData = {
        request_id: data.request_id,
        user_id: data.user_id,
        user_name: data.user_name || 'Veteran',
        session_id: data.session_id,
        risk_level: data.risk_level,
        type: 'chat' as const,
        timestamp: new Date().toISOString(),
      };
      
      // Store in window for access in chat_request_confirmed handler
      (window as any).__webrtc_pending_request = requestData;
      
      setState(prev => ({
        ...prev,
        hasIncomingChatRequest: true,
        pendingRequest: requestData
      }));
    });

    // Incoming CALL request from user (mobile app user wants to call staff - safeguarding flow)
    socket.on('incoming_call_request', (data: { 
      request_id: string; 
      user_id: string; 
      user_name: string; 
      session_id?: string;
      risk_level?: string;
    }) => {
      console.log('[WebRTCPhone] *** INCOMING CALL REQUEST (safeguarding) ***', data);
      playRingtone();
      setState(prev => ({
        ...prev,
        hasIncomingCallRequest: true,
        pendingRequest: {
          request_id: data.request_id,
          user_id: data.user_id,
          user_name: data.user_name || 'Veteran',
          session_id: data.session_id,
          risk_level: data.risk_level,
          type: 'call',
          timestamp: new Date().toISOString(),
        }
      }));
    });

    // Backend tells staff to initiate call to user (after staff accepted call request)
    socket.on('initiate_call_to_user', async (data: {
      request_id: string;
      call_id: string;
      user_id: string;
      user_socket_id: string;
      user_name: string;
    }) => {
      console.log('[WebRTCPhone] *** INITIATE CALL TO USER ***', data);
      
      // Store the call ID
      currentCallIdRef.current = data.call_id;
      
      try {
        updateStatus('ringing', `Calling ${data.user_name}...`);
        
        // Create peer connection and get local media
        const pc = await createPeerConnection();
        
        // Create and send WebRTC offer to the user
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        console.log('[WebRTCPhone] Sending WebRTC offer to user:', data.user_id);
        socket.emit('webrtc_offer', {
          call_id: data.call_id,
          offer: offer,
          target_user_id: data.user_id,
          target_socket_id: data.user_socket_id,
        });
        
        setState(prev => ({
          ...prev,
          isInCall: true,
          callerInfo: {
            id: data.user_id,
            name: data.user_name,
            type: 'safeguarding_call',
          }
        }));
        
      } catch (error) {
        console.error('[WebRTCPhone] Failed to initiate call to user:', error);
        updateStatus('error', 'Failed to start call');
        
        // Notify user that call failed
        socket.emit('call_failed', {
          call_id: data.call_id,
          user_id: data.user_id,
          reason: 'Staff failed to initialize call',
        });
      }
    });

    // Chat request confirmed - staff accepted and room is ready
    socket.on('chat_request_confirmed', (data: { room_id: string; user_id: string }) => {
      console.log('[WebRTCPhone] Chat request confirmed, room:', data.room_id);
      stopRingtone();
      
      // Get the current pending request info before clearing (from window global)
      const currentRequest = (window as any).__webrtc_pending_request as {
        user_name?: string;
        session_id?: string;
      } | undefined;
      
      // Update state and keep room_id
      setState(prev => ({
        ...prev,
        hasIncomingChatRequest: false,
        pendingRequest: prev.pendingRequest ? { ...prev.pendingRequest, room_id: data.room_id } : undefined,
      }));
      
      // CRITICAL: Dispatch custom event to open chat immediately (like legacy portal)
      // This ensures the chat window opens even if React's dependency tracking misses the change
      window.dispatchEvent(new CustomEvent('chat_request_confirmed', { 
        detail: { 
          room_id: data.room_id, 
          user_id: data.user_id,
          user_name: currentRequest?.user_name || 'Veteran',
          session_id: currentRequest?.session_id
        } 
      }));
    });

    // Chat request claimed by another staff member
    socket.on('chat_request_claimed', (data: { request_id: string; claimed_by: string }) => {
      console.log('[WebRTCPhone] Chat request claimed by:', data.claimed_by);
      stopRingtone();
      setState(prev => ({
        ...prev,
        hasIncomingChatRequest: false,
        hasIncomingCallRequest: false,
        pendingRequest: undefined,
      }));
    });

    // Chat request already claimed
    socket.on('chat_request_already_claimed', () => {
      console.log('[WebRTCPhone] Chat request already claimed');
      stopRingtone();
      setState(prev => ({
        ...prev,
        hasIncomingChatRequest: false,
        hasIncomingCallRequest: false,
        pendingRequest: undefined,
      }));
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
    // NOTE: Server sends this to BOTH parties, but only the CALLER should create the offer
    socket.on('call_accepted', async (data: { call_id: string; callee_name?: string; is_callee?: boolean }) => {
      console.log('[WebRTCPhone] Call accepted by:', data.callee_name, 'is_callee:', data.is_callee);
      stopRingtone();
      
      // If we're the callee, we should NOT create an offer - wait for the caller's offer
      if (data.is_callee) {
        console.log('[WebRTCPhone] We are the callee - waiting for offer from caller');
        updateStatus('connecting', 'Connecting...');
        return;
      }
      
      // We are the caller - create the WebRTC offer
      updateStatus('connected', 'Connected');
      setState(prev => ({ ...prev, hasIncomingCall: false, isInCall: true }));
      
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

    // WebRTC answer received - ONLY process if we're the caller (waiting for answer)
    // If we're the callee (answered an incoming call), we should NOT receive an answer
    socket.on('webrtc_answer', async (data: { call_id: string; answer: RTCSessionDescriptionInit }) => {
      console.log('[WebRTCPhone] WebRTC answer received');
      if (peerConnectionRef.current) {
        // Check if connection is in the right state to receive an answer
        const signalingState = peerConnectionRef.current.signalingState;
        if (signalingState === 'have-local-offer') {
          // We made an offer, waiting for answer - this is correct
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          hasRemoteDescriptionRef.current = true;

          // Process any pending ICE candidates
          for (const candidate of pendingIceCandidatesRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingIceCandidatesRef.current = [];
        } else {
          console.log('[WebRTCPhone] Ignoring answer - signaling state is:', signalingState);
        }
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
        callerInfo: undefined
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
        callerInfo: undefined
      }));
      updateStatus('online', 'Online');
    });

    // ===== CHAT MESSAGE EVENTS =====
    // Listen for incoming chat messages (real-time via Socket.IO)
    socket.on('new_chat_message', (data: {
      room_id: string;
      message: string;
      sender_id: string;
      sender_name: string;
      sender_type: string;
      timestamp: string;
      message_id: string;
    }) => {
      console.log('[WebRTCPhone] New chat message:', data);
      // Dispatch event so the chat UI can update
      window.dispatchEvent(new CustomEvent('new_chat_message', { detail: data }));
    });

    // Listen for typing indicators
    socket.on('user_typing', (data: { room_id: string; user_id: string; user_name: string; is_typing: boolean }) => {
      window.dispatchEvent(new CustomEvent('user_typing', { detail: data }));
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

  // Send a chat message via Socket.IO (for real-time delivery)
  const sendChatMessage = (roomId: string, message: string, senderId: string, senderName: string, senderType: string = 'staff') => {
    if (socketRef.current?.connected) {
      const messageData = {
        room_id: roomId,
        message: message,
        sender_id: senderId,
        sender_name: senderName,
        sender_type: senderType
      };
      console.log('[WebRTCPhone] Sending chat_message:', messageData);
      socketRef.current.emit('chat_message', messageData);
      return true;
    } else {
      console.error('[WebRTCPhone] Socket not connected - cannot send message');
      return false;
    }
  };

  // Start/stop typing indicator
  const sendTypingIndicator = (roomId: string, isTyping: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(isTyping ? 'typing_start' : 'typing_stop', {
        room_id: roomId,
        user_id: userId,
        user_name: userName
      });
    }
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
    // User request functions
    acceptChatRequest,
    acceptCallRequest,
    dismissRequest,
    // Chat functions
    sendChatMessage,
    sendTypingIndicator,
    // Socket reference (for checking connection state)
    isSocketConnected: socketRef.current?.connected || false,
  };
}

export default useWebRTCPhone;
