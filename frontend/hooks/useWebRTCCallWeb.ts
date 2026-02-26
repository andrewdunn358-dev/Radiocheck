/**
 * WebRTC Calling Hook for Expo Web
 * Handles in-app audio calls using WebRTC and Socket.IO
 * Works in browser environment
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../src/config/api';

// Web-compatible alert helper
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    // Import Alert dynamically for native
    import('react-native').then(({ Alert }) => {
      Alert.alert(title, message);
    });
  }
};

// WebRTC configuration - STUN + TURN servers for NAT traversal
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (reliable)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Metered.ca free TURN servers (required for NAT traversal behind symmetric NATs)
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: 'e8dd65c92eb8e17532e90b5d',
      credential: 'uWdWNmkhvyqTW1QC',
    },
    {
      urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
      username: 'e8dd65c92eb8e17532e90b5d',
      credential: 'uWdWNmkhvyqTW1QC',
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: 'e8dd65c92eb8e17532e90b5d',
      credential: 'uWdWNmkhvyqTW1QC',
    },
    {
      urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
      username: 'e8dd65c92eb8e17532e90b5d',
      credential: 'uWdWNmkhvyqTW1QC',
    },
  ],
  iceCandidatePoolSize: 10,
};

export type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended';

interface CallInfo {
  callId: string;
  peerName: string;
  callType: 'audio' | 'video';
  isIncoming: boolean;
}

interface DebugInfo {
  remoteTrackReceived: boolean;
  audioPlaying: boolean;
  iceState: string;
  connectionState: string;
}

interface UseWebRTCCallReturn {
  callState: CallState;
  callInfo: CallInfo | null;
  isConnected: boolean;
  callDuration: number;
  debugInfo: DebugInfo;
  initiateCall: (targetUserId: string, targetName: string) => Promise<void>;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  register: (userId: string, userType: string, userName: string) => void;
}

export function useWebRTCCall(): UseWebRTCCallReturn {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    remoteTrackReceived: false,
    audioPlaying: false,
    iceState: 'new',
    connectionState: 'new',
  });
  
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescriptionRef = useRef<boolean>(false);

  // Define cleanupCall first since it's used by many other functions
  const cleanupCallFn = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    currentCallIdRef.current = null;
    pendingIceCandidatesRef.current = [];
    hasRemoteDescriptionRef.current = false;
    setCallState('idle');
    setCallInfo(null);
    setCallDuration(0);
  };

  // Use ref for cleanup to avoid closure issues
  const cleanupCallRef = useRef(cleanupCallFn);
  cleanupCallRef.current = cleanupCallFn;

  const cleanupCall = useCallback(() => {
    cleanupCallRef.current();
  }, []);

  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (socketRef.current?.connected) {
      console.log('WebRTC: Socket already connected');
      return;
    }
    
    // Don't create duplicate sockets
    if (socketRef.current) {
      console.log('WebRTC: Socket exists but not connected, reconnecting...');
      socketRef.current.connect();
      return;
    }
    
    // The backend URL already doesn't have /api suffix
    const backendUrl = API_URL;
    console.log('WebRTC: Connecting to signaling server at', backendUrl);
    
    socketRef.current = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
      path: '/api/socket.io',  // Use /api path for Kubernetes ingress routing
    });

    socketRef.current.on('connect', () => {
      console.log('WebRTC: Connected to signaling server');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('WebRTC: Disconnected');
      setIsConnected(false);
      cleanupCall();
    });

    socketRef.current.on('registered', (data: any) => {
      console.log('WebRTC: Registered', data);
    });

    // Incoming call
    socketRef.current.on('incoming_call', (data: any) => {
      console.log('WebRTC: Incoming call', data);
      currentCallIdRef.current = data.call_id;
      setCallInfo({
        callId: data.call_id,
        peerName: data.caller_name,
        callType: data.call_type || 'audio',
        isIncoming: true,
      });
      setCallState('ringing');
    });

    // Call accepted
    socketRef.current.on('call_accepted', async (data: any) => {
      console.log('WebRTC: Call accepted', data);
      if (data.call_id) {
        currentCallIdRef.current = data.call_id;
      }
      setCallState('connecting');
      
      // If we're the callee (is_callee=true), we wait for offer, don't create one
      // If we're the caller, we create the offer
      const shouldCreateOffer = !data.is_callee;
      console.log('WebRTC: Starting connection, createOffer:', shouldCreateOffer);
      await startWebRTCConnection(shouldCreateOffer);
    });

    // Call connected
    socketRef.current.on('call_connected', () => {
      console.log('WebRTC: Call connected');
      setCallState('connected');
      startCallTimer();
    });

    // Call rejected/ended/failed
    socketRef.current.on('call_rejected', () => {
      showAlert('Call Declined', 'The call was declined.');
      cleanupCall();
    });

    socketRef.current.on('call_ended', () => {
      console.log('WebRTC: Call ended by other party');
      cleanupCall();
    });

    socketRef.current.on('call_failed', (data: any) => {
      console.log('WebRTC: Call failed', data);
      showAlert('Call Failed', data.message || 'The person you are trying to call is not available. They may need to log into the staff portal first.');
      cleanupCall();
    });

    // Call ringing - store the call ID
    socketRef.current.on('call_ringing', (data: any) => {
      console.log('WebRTC: Call ringing', data);
      if (data.call_id) {
        currentCallIdRef.current = data.call_id;
        setCallInfo(prev => prev ? { ...prev, callId: data.call_id } : null);
      }
      setCallState('ringing');
    });

    // WebRTC signaling
    socketRef.current.on('webrtc_offer', async (data: any) => {
      await handleOffer(data.offer);
    });

    socketRef.current.on('webrtc_answer', async (data: any) => {
      await handleAnswer(data.answer);
    });

    socketRef.current.on('webrtc_ice_candidate', async (data: any) => {
      await handleIceCandidate(data.candidate);
    });
  }, []);

  // Register with signaling server
  const register = useCallback((userId: string, userType: string, userName: string) => {
    if (Platform.OS !== 'web') return;
    
    initializeSocket();
    
    setTimeout(() => {
      socketRef.current?.emit('register', {
        user_id: userId,
        user_type: userType,
        name: userName,
        status: 'available',
      });
    }, 1000);
  }, [initializeSocket]);

  // Create remote audio element
  const ensureRemoteAudio = () => {
    if (Platform.OS !== 'web') return null;
    
    if (!remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true; // Required for mobile browsers
      audio.id = 'webrtc-remote-audio';
      
      // Force speaker output on mobile (not earpiece)
      (audio as any).setSinkId?.('default').catch(() => {});
      
      // Important: Don't hide the audio element on mobile as it can cause issues
      audio.style.position = 'fixed';
      audio.style.bottom = '0';
      audio.style.left = '0';
      audio.style.width = '1px';
      audio.style.height = '1px';
      audio.style.opacity = '0.01'; // Nearly invisible but not hidden
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
      console.log('WebRTC: Created audio element');
    }
    return remoteAudioRef.current;
  };

  // Start WebRTC connection
  const startWebRTCConnection = async (createOffer: boolean) => {
    if (Platform.OS !== 'web') return;
    
    try {
      // Get audio with specific constraints for better compatibility
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }, 
        video: false 
      });
      localStreamRef.current = stream;
      
      // Ensure audio tracks are enabled
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        console.log('WebRTC: Local audio track:', track.label, 'enabled:', track.enabled, 'muted:', track.muted);
      });

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;

      // Add tracks with explicit stream reference
      stream.getTracks().forEach((track) => {
        console.log('WebRTC: Adding track to peer connection:', track.kind);
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit('webrtc_ice_candidate', {
            call_id: currentCallIdRef.current,
            candidate: event.candidate,
          });
        }
      };
      
      // Log ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('WebRTC: ICE connection state:', pc.iceConnectionState);
        setDebugInfo(prev => ({ ...prev, iceState: pc.iceConnectionState }));
      };

      pc.ontrack = (event) => {
        console.log('WebRTC: Received remote track', event.track.kind, 'enabled:', event.track.enabled);
        setDebugInfo(prev => ({ ...prev, remoteTrackReceived: true }));
        
        // Ensure the remote track is enabled
        event.track.enabled = true;
        
        if (event.streams[0]) {
          console.log('WebRTC: Setting audio srcObject with', event.streams[0].getAudioTracks().length, 'audio tracks');
          
          // Method 1: Standard audio element
          const audio = ensureRemoteAudio();
          if (audio) {
            audio.srcObject = event.streams[0];
            audio.muted = false;
            audio.volume = 1.0;
            
            // Method 2: Also use Web Audio API to force speaker output on mobile
            try {
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              const source = audioContext.createMediaStreamSource(event.streams[0]);
              source.connect(audioContext.destination);
              console.log('WebRTC: Web Audio API connected for speaker output');
            } catch (e) {
              console.log('WebRTC: Web Audio API fallback failed, using standard audio element');
            }
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                console.log('WebRTC: Audio playback started successfully');
                setDebugInfo(prev => ({ ...prev, audioPlaying: true }));
              }).catch((error) => {
                console.error('WebRTC: Audio play failed:', error);
                setDebugInfo(prev => ({ ...prev, audioPlaying: false }));
                document.addEventListener('click', () => {
                  audio.play().then(() => {
                    setDebugInfo(prev => ({ ...prev, audioPlaying: true }));
                  }).catch(console.error);
                }, { once: true });
              });
            }
          }
        }
      };

      pc.onconnectionstatechange = () => {
        setDebugInfo(prev => ({ ...prev, connectionState: pc.connectionState }));
        if (pc.connectionState === 'connected') {
          setCallState('connected');
          startCallTimer();
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          cleanupCall();
        }
      };

      if (createOffer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('webrtc_offer', {
          call_id: currentCallIdRef.current,
          offer: offer,
        });
      }
    } catch (error) {
      console.error('WebRTC error:', error);
      showAlert('Microphone Error', 'Could not access microphone. Please allow microphone access in your browser settings.');
      cleanupCall();
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (Platform.OS !== 'web') return;
    
    if (!peerConnectionRef.current) {
      await startWebRTCConnection(false);
    }
    
    await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(offer));
    hasRemoteDescriptionRef.current = true;
    console.log('WebRTC: Remote description set (offer)');
    
    // Process pending ICE candidates
    await processPendingIceCandidates();
    
    const answer = await peerConnectionRef.current?.createAnswer();
    await peerConnectionRef.current?.setLocalDescription(answer);
    
    socketRef.current?.emit('webrtc_answer', {
      call_id: currentCallIdRef.current,
      answer: answer,
    });
    
    setCallState('connected');
    startCallTimer();
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (Platform.OS !== 'web') return;
    await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    hasRemoteDescriptionRef.current = true;
    console.log('WebRTC: Remote description set (answer)');
    
    // Process pending ICE candidates
    await processPendingIceCandidates();
    
    setCallState('connected');
    startCallTimer();
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (Platform.OS !== 'web' || !candidate) return;
    
    if (peerConnectionRef.current && hasRemoteDescriptionRef.current) {
      // Remote description is set, add candidate immediately
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('WebRTC: Added ICE candidate immediately');
    } else {
      // Queue the candidate for later
      pendingIceCandidatesRef.current.push(candidate);
      console.log('WebRTC: Queued ICE candidate, waiting for remote description');
    }
  };

  const processPendingIceCandidates = async () => {
    const pending = pendingIceCandidatesRef.current;
    console.log('WebRTC: Processing', pending.length, 'pending ICE candidates');
    
    for (const candidate of pending) {
      try {
        await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('WebRTC: Error adding queued ICE candidate:', error);
      }
    }
    pendingIceCandidatesRef.current = [];
  };

  const initiateCall = async (targetUserId: string, targetName: string) => {
    if (Platform.OS !== 'web') {
      showAlert('Not Supported', 'In-app calling is only available on web.');
      return;
    }
    
    if (callState !== 'idle') {
      showAlert('Busy', 'You are already in a call');
      return;
    }

    // Initialize socket connection
    initializeSocket();
    
    setCallInfo({
      callId: '',
      peerName: targetName,
      callType: 'audio',
      isIncoming: false,
    });
    setCallState('connecting');

    // Wait for socket to connect
    let attempts = 0;
    while (!socketRef.current?.connected && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      attempts++;
    }

    if (!socketRef.current?.connected) {
      showAlert('Connection Error', 'Could not connect to call server. Please try again.');
      cleanupCall();
      return;
    }

    // Generate a temporary caller ID for anonymous users
    const callerId = `app_user_${Date.now()}`;
    
    // Register the caller with the signaling server first
    socketRef.current?.emit('register', {
      user_id: callerId,
      user_type: 'user',
      name: 'App User',
      status: 'available',
    });

    // Give time for registration to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Now initiate the call
    socketRef.current?.emit('call_initiate', {
      target_user_id: targetUserId,
      caller_name: 'App User',
      call_type: 'audio',
    });
  };

  const acceptCall = useCallback(() => {
    if (!currentCallIdRef.current) return;
    console.log('WebRTC: Accepting call', currentCallIdRef.current);
    socketRef.current?.emit('call_accept', { call_id: currentCallIdRef.current });
    setCallState('connecting');
    // Don't start WebRTC here - wait for call_accepted event to avoid race condition
    // The call_accepted handler will trigger startWebRTCConnection
  }, []);

  const rejectCall = useCallback(() => {
    if (currentCallIdRef.current) {
      socketRef.current?.emit('call_reject', {
        call_id: currentCallIdRef.current,
        reason: 'rejected',
      });
    }
    cleanupCall();
  }, [cleanupCall]);

  const endCall = useCallback(() => {
    console.log('WebRTC: Ending call, callId:', currentCallIdRef.current);
    if (currentCallIdRef.current) {
      socketRef.current?.emit('call_end', { call_id: currentCallIdRef.current });
    }
    // Always cleanup even if no call ID (allows cancel during connecting)
    cleanupCall();
  }, [cleanupCall]);

  useEffect(() => {
    return () => {
      cleanupCall();
      socketRef.current?.disconnect();
    };
  }, [cleanupCall]);

  return {
    callState,
    callInfo,
    isConnected,
    callDuration,
    debugInfo,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    register,
  };
}

export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
