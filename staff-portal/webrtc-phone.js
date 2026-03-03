/**
 * WebRTC Phone for Staff Portal
 * =============================
 * Free peer-to-peer audio calls using WebRTC
 * No PBX required - uses Socket.IO for signaling
 */

// Configuration - STUN + TURN servers for NAT traversal
const WEBRTC_CONFIG = {
    iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // ExpressTURN - your account
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
    iceTransportPolicy: 'all'
};

// State
let socket = null;
let localStream = null;
let peerConnection = null;
let currentCallId = null;
let isRegistered = false;
let ringtone = null;
let pendingIceCandidates = []; // Queue for ICE candidates that arrive before remote description is set
let hasRemoteDescription = false;

// DOM Elements (will be set on init)
let phoneUI = {
    container: null,
    status: null,
    callerInfo: null,
    callActions: null,
    incomingActions: null,
    callTimer: null
};

let callStartTime = null;
let callTimerInterval = null;

/**
 * Initialize WebRTC Phone
 */
function initWebRTCPhone(serverUrl, userId, userType, userName) {
    console.log('Initializing WebRTC Phone...');
    console.log('Server URL:', serverUrl);
    
    // Connect to signaling server with the correct path
    socket = io(serverUrl, {
        path: '/api/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000
    });
    
    // Setup socket event handlers
    setupSocketHandlers();
    
    // Register with server
    socket.on('connect', () => {
        console.log('Connected to signaling server');
        socket.emit('register', {
            user_id: userId,
            user_type: userType,
            name: userName,
            status: 'available'
        });
    });
    
    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        updatePhoneStatus('offline', 'Connection Failed');
    });
    
    // Setup UI
    setupPhoneUI();
    
    // Create ringtone
    createRingtone();
    
    return true;
}

/**
 * Setup Socket.IO event handlers
 */
function setupSocketHandlers() {
    socket.on('registered', (data) => {
        console.log('Registered with signaling server:', data);
        isRegistered = true;
        updatePhoneStatus('online', 'Ready for calls');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        isRegistered = false;
        updatePhoneStatus('offline', 'Disconnected');
        cleanupCall();
    });
    
    socket.on('reconnect', () => {
        console.log('Reconnected to signaling server');
    });
    
    // Incoming chat request - someone wants to chat with staff
    socket.on('incoming_chat_request', (data) => {
        console.log('Incoming chat request:', data);
        
        // Play alert sound
        if (typeof playAlertSound === 'function') {
            playAlertSound();
        }
        
        // Show chat request notification
        showIncomingChatRequest(data);
    });
    
    // Chat request confirmed - staff accepted and room is ready
    socket.on('chat_request_confirmed', (data) => {
        console.log('=== CHAT REQUEST CONFIRMED ===');
        console.log('Chat confirmed data:', data);
        
        var roomId = data.room_id;
        var userId = data.user_id;
        
        if (roomId) {
            // Set current room globally
            window.currentChatRoom = roomId;
            
            // Join the Socket.IO room for real-time messages
            // Get staff user with localStorage fallback
            var staffUser = window.currentUser || JSON.parse(localStorage.getItem('staff_user') || '{}') || {};
            socket.emit('join_chat_room', {
                room_id: roomId,
                user_id: staffUser.id || 'staff',
                user_type: staffUser.role || 'counsellor',
                name: staffUser.name || 'Staff'
            });
            console.log('Joined Socket.IO room:', roomId);
            
            // Open the live chat modal with this room
            if (typeof showLiveChatModal === 'function') {
                console.log('Opening live chat modal for room:', roomId);
                showLiveChatModal(roomId);
            } else if (typeof joinLiveChat === 'function') {
                console.log('Joining live chat room:', roomId);
                joinLiveChat(roomId);
            } else {
                console.log('Live chat functions not available, switching to Live Chat tab');
                // Fallback: switch to Live Chat tab and reload chats
                if (typeof switchTab === 'function') {
                    switchTab('livechat');
                    if (typeof loadLiveChats === 'function') {
                        setTimeout(function() { loadLiveChats(false); }, 500);
                    }
                }
            }
        }
    });
    
    // Chat request claimed by another staff member
    socket.on('chat_request_claimed', (data) => {
        console.log('=== CHAT REQUEST CLAIMED BY ANOTHER STAFF ===');
        console.log('Claimed by:', data.claimed_by);
        
        // Dismiss the chat request banner if it's for this request
        var pending = window.pendingChatRequest;
        if (pending && pending.request_id === data.request_id) {
            dismissChatRequest();
            if (typeof showNotification === 'function') {
                showNotification('Chat taken by ' + data.claimed_by, 'info');
            }
        }
    });
    
    // Handle case where staff tries to accept an already-claimed request
    socket.on('chat_request_already_claimed', (data) => {
        console.log('=== CHAT REQUEST ALREADY CLAIMED ===');
        dismissChatRequest();
        if (typeof showNotification === 'function') {
            showNotification('This chat has already been taken by another staff member', 'warning');
        }
    });
    
    // Real-time chat messages
    socket.on('new_chat_message', (data) => {
        console.log('New chat message received via socket:', data);
        console.log('Current room:', window.currentChatRoom, 'Message room:', data.room_id);
        // Get staff user with localStorage fallback to fix "Staff ID: undefined" issue
        var staffUser = window.currentUser || JSON.parse(localStorage.getItem('staff_user') || '{}') || {};
        console.log('Staff ID:', staffUser.id, 'Sender ID:', data.sender_id);
        
        // Only process if we're in a chat and message is not from us
        if (window.currentChatRoom && data.room_id === window.currentChatRoom) {
            // Skip our own messages (we already show them locally)
            if (data.sender_id === staffUser.id) {
                console.log('Skipping own message');
                return;
            }
            
            // Add message to the live chat modal
            var messagesDiv = document.getElementById('livechat-messages');
            console.log('Messages div found:', !!messagesDiv);
            if (messagesDiv) {
                var msgHtml = '<div class="chat-message user">' +
                    '<span class="msg-sender">' + (data.sender_name || 'User') + '</span>' +
                    '<span class="msg-text">' + (typeof escapeHtml === 'function' ? escapeHtml(data.message) : data.message) + '</span>' +
                    '<span class="msg-time">' + new Date(data.timestamp).toLocaleTimeString() + '</span>' +
                '</div>';
                messagesDiv.insertAdjacentHTML('beforeend', msgHtml);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                console.log('Message added to UI');
            } else {
                console.error('livechat-messages div not found!');
            }
        } else {
            console.log('Message ignored - room mismatch or no current room');
        }
    });
    
    // User left chat notification
    socket.on('user_left_chat', (data) => {
        console.log('User left chat:', data);
        if (window.currentChatRoom && data.room_id === window.currentChatRoom) {
            if (typeof showNotification === 'function') {
                showNotification(data.user_name + ' has left the chat', 'info');
            }
            // Add system message
            var messagesDiv = document.getElementById('livechat-messages');
            if (messagesDiv) {
                var msgHtml = '<div class="chat-message system">' +
                    '<span class="msg-text" style="font-style: italic; color: #666;">' + (data.user_name || 'User') + ' has left the chat</span>' +
                '</div>';
                messagesDiv.insertAdjacentHTML('beforeend', msgHtml);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        }
    });
    
    // Incoming call
    socket.on('incoming_call', async (data) => {
        console.log('Incoming call:', data);
        currentCallId = data.call_id;
        
        // Play ringtone
        playRingtone();
        
        // Show incoming call UI
        showIncomingCall(data.caller_name, data.call_type);
    });
    
    // Call ringing - staff initiated call, server sends back the authoritative call_id
    socket.on('call_ringing', (data) => {
        console.log('Call ringing - server assigned call_id:', data);
        // IMPORTANT: Update to the server's authoritative call_id
        // This ensures WebRTC signaling uses the correct ID
        if (data.call_id) {
            console.log('Updating currentCallId from', currentCallId, 'to', data.call_id);
            currentCallId = data.call_id;
        }
    });
    
    // Call accepted - start WebRTC negotiation
    socket.on('call_accepted', async (data) => {
        console.log('=== CALL ACCEPTED EVENT ===');
        console.log('Call accepted data:', data);
        console.log('OLD currentCallId:', currentCallId);
        stopRingtone();
        
        // CRITICAL FIX: Update to server's authoritative call_id
        // This ensures WebRTC signaling uses the correct ID that the server knows about
        if (data.call_id) {
            console.log('Updating currentCallId to server call_id:', data.call_id);
            currentCallId = data.call_id;
        }
        console.log('NEW currentCallId:', currentCallId);
        
        // If we're the callee, we wait for the offer (don't create one)
        // If we're the caller, we create the offer
        const shouldCreateOffer = !data.is_callee;
        console.log('Should create offer:', shouldCreateOffer);
        
        try {
            await startWebRTCConnection(shouldCreateOffer);
            console.log('WebRTC connection started, shouldCreateOffer:', shouldCreateOffer);
        } catch (err) {
            console.error('Error starting WebRTC connection:', err);
        }
        
        // Update UI to show connecting state
        if (data.is_callee) {
            updatePhoneStatus('in-call', 'Connecting...');
        }
    });
    
    // Call connected
    socket.on('call_connected', (data) => {
        console.log('Call connected:', data);
        showActiveCall(data.peer_name);
        startCallTimer();
    });
    
    // Call rejected
    socket.on('call_rejected', (data) => {
        console.log('Call rejected:', data);
        stopRingtone();
        showNotification('Call was declined', 'info');
        cleanupCall();
        updatePhoneStatus('online', 'Ready for calls');
    });
    
    // Call ended
    socket.on('call_ended', (data) => {
        console.log('Call ended:', data);
        stopRingtone();
        showNotification('Call ended', 'info');
        cleanupCall();
        updatePhoneStatus('online', 'Ready for calls');
    });
    
    // Call failed
    socket.on('call_failed', (data) => {
        console.log('Call failed:', data);
        stopRingtone();
        showNotification(data.message || 'Call failed', 'error');
        cleanupCall();
        updatePhoneStatus('online', 'Ready for calls');
    });
    
    // WebRTC error
    socket.on('webrtc_error', (data) => {
        console.error('=== WEBRTC ERROR ===');
        console.error('WebRTC error:', data);
        showNotification(data.message || 'WebRTC connection error', 'error');
        cleanupCall();
        updatePhoneStatus('online', 'Ready for calls');
    });
    
    // WebRTC signaling
    socket.on('webrtc_offer', async (data) => {
        console.log('Received WebRTC offer');
        await handleOffer(data.offer);
    });
    
    socket.on('webrtc_answer', async (data) => {
        console.log('Received WebRTC answer');
        await handleAnswer(data.answer);
    });
    
    socket.on('webrtc_ice_candidate', async (data) => {
        console.log('Received ICE candidate');
        await handleIceCandidate(data.candidate);
    });
}

/**
 * Start WebRTC Connection
 */
async function startWebRTCConnection(createOffer) {
    try {
        // Get local audio stream with specific constraints
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
            video: false
        });
        
        // Ensure audio tracks are enabled
        localStream.getAudioTracks().forEach(track => {
            track.enabled = true;
            console.log('Local audio track:', track.label, 'enabled:', track.enabled, 'muted:', track.muted);
        });
        
        // Monitor actual audio levels from microphone
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(localStream);
            microphone.connect(analyser);
            analyser.fftSize = 256;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            // Check audio levels every second
            const levelCheck = setInterval(() => {
                if (!localStream) {
                    clearInterval(levelCheck);
                    return;
                }
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                console.log('Mic audio level:', average.toFixed(1), average > 5 ? '(SOUND DETECTED)' : '(silence)');
            }, 1000);
        } catch (e) {
            console.log('Could not create audio level monitor:', e);
        }
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);
        
        // Add local stream tracks
        localStream.getTracks().forEach(track => {
            console.log('Adding track to peer connection:', track.kind);
            const sender = peerConnection.addTrack(track, localStream);
            
            // Monitor audio levels being sent
            if (track.kind === 'audio') {
                setInterval(() => {
                    if (peerConnection && sender) {
                        sender.getStats().then(stats => {
                            stats.forEach(report => {
                                if (report.type === 'outbound-rtp' && report.kind === 'audio') {
                                    console.log('Audio sending - bytes:', report.bytesSent, 'packets:', report.packetsSent);
                                }
                            });
                        });
                    }
                    // Also check inbound (receiving) stats
                    if (peerConnection) {
                        peerConnection.getStats().then(stats => {
                            stats.forEach(report => {
                                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                                    console.log('Audio RECEIVING - bytes:', report.bytesReceived, 'packets:', report.packetsReceived, 'lost:', report.packetsLost || 0);
                                }
                            });
                        });
                    }
                }, 3000);
            }
        });
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Log the type of candidate (helps debug TURN issues)
                const candidateType = event.candidate.candidate.includes('relay') ? 'TURN relay' : 
                                     event.candidate.candidate.includes('srflx') ? 'STUN reflexive' : 'host';
                console.log('Generated ICE candidate:', candidateType, event.candidate.candidate.substring(0, 100));
                
                socket.emit('webrtc_ice_candidate', {
                    call_id: currentCallId,
                    candidate: event.candidate
                });
            } else {
                console.log('ICE candidate gathering complete');
            }
        };
        
        // Log ICE gathering state
        peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', peerConnection.iceGatheringState);
        };
        
        // Log ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', peerConnection.iceConnectionState);
        };
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind, 'enabled:', event.track.enabled);
            
            // Ensure remote track is enabled
            event.track.enabled = true;
            
            const remoteAudio = document.getElementById('remote-audio') || createAudioElement();
            if (event.streams[0]) {
                console.log('Setting audio srcObject with', event.streams[0].getAudioTracks().length, 'audio tracks');
                remoteAudio.srcObject = event.streams[0];
                // Unmute and set volume explicitly
                remoteAudio.muted = false;
                remoteAudio.volume = 1.0;
                
                console.log('Audio element state - muted:', remoteAudio.muted, 'volume:', remoteAudio.volume);
                
                // Play with error handling
                const playPromise = remoteAudio.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log('Audio playback started successfully');
                    }).catch(e => {
                        console.error('Error playing audio:', e);
                        // Try to play on next user interaction
                        document.addEventListener('click', () => {
                            remoteAudio.play().catch(console.error);
                        }, { once: true });
                    });
                }
            }
        };
        
        // Handle connection state
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                updatePhoneStatus('in-call', 'In Call');
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                cleanupCall();
            }
        };
        
        // Create offer if we're the initiator
        if (createOffer) {
            console.log('=== CREATING WEBRTC OFFER ===');
            console.log('Creating offer for call_id:', currentCallId);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log('Offer created, emitting webrtc_offer event');
            console.log('Socket connected:', socket.connected);
            socket.emit('webrtc_offer', {
                call_id: currentCallId,
                offer: offer
            });
            console.log('webrtc_offer event emitted');
        }
        
    } catch (error) {
        console.error('Error starting WebRTC:', error);
        showNotification('Could not access microphone', 'error');
        cleanupCall();
    }
}

/**
 * Handle incoming WebRTC offer
 */
async function handleOffer(offer) {
    try {
        if (!peerConnection) {
            await startWebRTCConnection(false);
        }
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        hasRemoteDescription = true;
        console.log('Remote description set (offer)');
        
        // Process any ICE candidates that arrived before remote description was set
        await processPendingIceCandidates();
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc_answer', {
            call_id: currentCallId,
            answer: answer
        });
        
        showActiveCall('Caller');
        startCallTimer();
        
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

/**
 * Handle WebRTC answer
 */
async function handleAnswer(answer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        hasRemoteDescription = true;
        console.log('Remote description set (answer)');
        
        // Process any ICE candidates that arrived before remote description was set
        await processPendingIceCandidates();
        
        showActiveCall('Connected');
        startCallTimer();
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

/**
 * Handle ICE candidate
 */
async function handleIceCandidate(candidate) {
    try {
        if (peerConnection && candidate) {
            if (hasRemoteDescription) {
                // Remote description is set, add candidate immediately
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('Added ICE candidate immediately');
            } else {
                // Queue the candidate for later
                pendingIceCandidates.push(candidate);
                console.log('Queued ICE candidate, waiting for remote description');
            }
        }
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
}

/**
 * Process queued ICE candidates after remote description is set
 */
async function processPendingIceCandidates() {
    console.log('Processing', pendingIceCandidates.length, 'pending ICE candidates');
    for (const candidate of pendingIceCandidates) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding queued ICE candidate:', error);
        }
    }
    pendingIceCandidates = [];
}

/**
 * Accept incoming call
 */
function acceptCall() {
    if (!currentCallId) return;
    
    stopRingtone();
    socket.emit('call_accept', { call_id: currentCallId });
    // Don't start WebRTC here - wait for call_accepted event to avoid race condition
    updatePhoneStatus('in-call', 'Connecting...');
}

/**
 * Reject incoming call
 */
function rejectCall() {
    if (!currentCallId) return;
    
    stopRingtone();
    socket.emit('call_reject', { 
        call_id: currentCallId,
        reason: 'rejected'
    });
    cleanupCall();
    updatePhoneStatus('online', 'Ready for calls');
}

/**
 * End current call
 */
function endCall() {
    if (!currentCallId) return;
    
    socket.emit('call_end', { call_id: currentCallId });
    cleanupCall();
    updatePhoneStatus('online', 'Ready for calls');
    showNotification('Call ended', 'info');
}

/**
 * Make outbound call to a user
 * @param {string} targetUserId - The user ID or session ID to call
 */
function makeOutboundCall(targetUserId) {
    console.log('=== MAKE OUTBOUND CALL ===');
    console.log('Target user:', targetUserId);
    console.log('Socket connected:', socket?.connected);
    console.log('Is registered:', isRegistered);
    console.log('Current call ID:', currentCallId);
    console.log('Peer connection state:', peerConnection?.connectionState);
    
    if (!socket || !isRegistered) {
        showNotification('Phone not connected. Please wait...', 'error');
        return;
    }
    
    if (currentCallId) {
        // Check if we're actually in an active call
        var isActiveCall = peerConnection && 
            (peerConnection.connectionState === 'connected' || 
             peerConnection.connectionState === 'connecting');
        
        if (isActiveCall) {
            showNotification('Already in a call', 'warning');
            return;
        } else {
            // Stale call ID - clean it up
            console.log('Stale call ID detected, cleaning up...');
            cleanupCall();
        }
    }
    
    // Double-check cleanup happened
    if (currentCallId) {
        console.log('Force clearing currentCallId');
        currentCallId = null;
    }
    
    console.log('Initiating call to:', targetUserId);
    
    // Generate a call ID
    currentCallId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Emit call request to server
    socket.emit('call_initiate', {
        call_id: currentCallId,
        target_user_id: targetUserId,
        call_type: 'voice'
    });
    
    // Update UI to show dialing
    updatePhoneStatus('dialing', 'Calling...');
    showDialingUI(targetUserId);
    
    // Play ringback tone (optional)
    // playRingbackTone();
    
    showNotification('Calling user...', 'info');
}

/**
 * Show dialing UI
 */
function showDialingUI(targetId) {
    if (phoneUI.container) {
        phoneUI.container.style.display = 'block';
    }
    if (phoneUI.callerInfo) {
        phoneUI.callerInfo.innerHTML = '<i class="fas fa-phone-alt fa-spin"></i> Calling: ' + targetId.substring(0, 20) + '...';
    }
    if (phoneUI.callActions) {
        phoneUI.callActions.style.display = 'block';
        phoneUI.callActions.innerHTML = '<button class="phone-btn phone-btn-hangup" onclick="endCall()"><i class="fas fa-phone-slash"></i> Cancel</button>';
    }
    if (phoneUI.incomingActions) {
        phoneUI.incomingActions.style.display = 'none';
    }
}

/**
 * Cleanup call resources
 */
function cleanupCall() {
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Clear call state
    currentCallId = null;
    hasRemoteDescription = false;
    pendingIceCandidates = [];
    
    // Stop timer
    stopCallTimer();
    
    // Reset UI
    hideCallUI();
}

/**
 * Update availability status
 */
function setAvailability(status) {
    if (socket && isRegistered) {
        socket.emit('update_status', { status: status });
        updatePhoneStatus(status === 'available' ? 'online' : 'busy', 
                         status === 'available' ? 'Ready for calls' : 'Busy');
    }
}

// ============ UI Functions ============

function setupPhoneUI() {
    // Create phone UI container if it doesn't exist
    let container = document.getElementById('webrtc-phone');
    if (!container) {
        container = document.createElement('div');
        container.id = 'webrtc-phone';
        container.className = 'webrtc-phone';
        container.innerHTML = `
            <div class="phone-header">
                <i class="fas fa-phone-alt"></i>
                <span id="phone-status-text">Connecting...</span>
                <span id="phone-status-dot" class="status-dot offline"></span>
            </div>
            <div id="call-info" class="call-info hidden">
                <div id="caller-name" class="caller-name"></div>
                <div id="call-timer" class="call-timer">00:00</div>
            </div>
            <div id="incoming-actions" class="call-actions hidden">
                <button class="btn-accept" onclick="acceptCall()">
                    <i class="fas fa-phone"></i> Accept
                </button>
                <button class="btn-reject" onclick="rejectCall()">
                    <i class="fas fa-phone-slash"></i> Decline
                </button>
            </div>
            <div id="active-actions" class="call-actions hidden">
                <button class="btn-end" onclick="endCall()">
                    <i class="fas fa-phone-slash"></i> End Call
                </button>
            </div>
            <audio id="remote-audio" autoplay></audio>
        `;
        document.body.appendChild(container);
    }
    
    phoneUI.container = container;
    phoneUI.status = document.getElementById('phone-status-text');
    phoneUI.statusDot = document.getElementById('phone-status-dot');
    phoneUI.callInfo = document.getElementById('call-info');
    phoneUI.callerName = document.getElementById('caller-name');
    phoneUI.callTimer = document.getElementById('call-timer');
    phoneUI.incomingActions = document.getElementById('incoming-actions');
    phoneUI.activeActions = document.getElementById('active-actions');
}

function updatePhoneStatus(status, text) {
    // Update the floating widget
    if (phoneUI.status) {
        phoneUI.status.textContent = text;
    }
    if (phoneUI.statusDot) {
        phoneUI.statusDot.className = 'status-dot ' + status;
    }
    
    // Also update the top-of-page phone section
    var topStatusText = document.getElementById('webrtc-status-text');
    var topStatusDot = document.querySelector('#webrtc-status .status-dot');
    var topPhoneIcon = document.querySelector('.phone-icon');
    
    if (topStatusText) {
        topStatusText.textContent = text;
    }
    if (topStatusDot) {
        topStatusDot.className = 'status-dot ' + status;
    }
    if (topPhoneIcon) {
        topPhoneIcon.className = 'phone-icon ' + (status === 'online' ? '' : status);
    }
}

function showIncomingCall(callerName, callType) {
    // Update floating widget
    if (phoneUI.callInfo) phoneUI.callInfo.classList.remove('hidden');
    if (phoneUI.callerName) phoneUI.callerName.textContent = `Incoming: ${callerName}`;
    if (phoneUI.incomingActions) phoneUI.incomingActions.classList.remove('hidden');
    if (phoneUI.activeActions) phoneUI.activeActions.classList.add('hidden');
    if (phoneUI.container) phoneUI.container.classList.add('ringing');
    
    // Update top-of-page incoming call banner
    var incomingBanner = document.getElementById('webrtc-incoming-call');
    var incomingCallerName = document.getElementById('incoming-caller-name');
    var phoneIcon = document.querySelector('.phone-icon');
    
    if (incomingBanner) {
        incomingBanner.classList.remove('hidden');
    }
    if (incomingCallerName) {
        incomingCallerName.textContent = 'Incoming Call: ' + callerName;
    }
    if (phoneIcon) {
        phoneIcon.classList.add('ringing');
    }
}

function showActiveCall(peerName) {
    // Hide incoming call UI first
    var incomingBanner = document.getElementById('webrtc-incoming-call');
    if (incomingBanner) {
        incomingBanner.classList.add('hidden');
    }
    
    // Update floating widget
    if (phoneUI.callInfo) phoneUI.callInfo.classList.remove('hidden');
    if (phoneUI.callerName) phoneUI.callerName.textContent = `On call: ${peerName}`;
    if (phoneUI.incomingActions) phoneUI.incomingActions.classList.add('hidden');
    if (phoneUI.activeActions) phoneUI.activeActions.classList.remove('hidden');
    if (phoneUI.container) phoneUI.container.classList.remove('ringing');
    if (phoneUI.container) phoneUI.container.classList.add('in-call');
    
    // Show active call controls in top-of-page section
    var callControls = document.getElementById('webrtc-call-controls');
    var phoneIcon = document.querySelector('.phone-icon');
    
    if (callControls) {
        callControls.classList.remove('hidden');
    }
    if (phoneIcon) {
        phoneIcon.classList.remove('ringing');
        phoneIcon.classList.add('in-call');
    }
    
    // Update status
    updatePhoneStatus('in-call', 'In Call');
}

function hideCallUI() {
    // Hide floating widget elements
    if (phoneUI.callInfo) phoneUI.callInfo.classList.add('hidden');
    if (phoneUI.incomingActions) phoneUI.incomingActions.classList.add('hidden');
    if (phoneUI.activeActions) phoneUI.activeActions.classList.add('hidden');
    if (phoneUI.container) phoneUI.container.classList.remove('ringing', 'in-call');
    if (phoneUI.callTimer) phoneUI.callTimer.textContent = '00:00';
    
    // Hide top-of-page elements
    var incomingBanner = document.getElementById('webrtc-incoming-call');
    var phoneIcon = document.querySelector('.phone-icon');
    var callControls = document.getElementById('webrtc-call-controls');
    
    if (incomingBanner) {
        incomingBanner.classList.add('hidden');
    }
    if (phoneIcon) {
        phoneIcon.classList.remove('ringing', 'in-call');
    }
    if (callControls) {
        callControls.classList.add('hidden');
    }
}

function startCallTimer() {
    callStartTime = Date.now();
    callTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        if (phoneUI.callTimer) {
            phoneUI.callTimer.textContent = `${mins}:${secs}`;
        }
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callStartTime = null;
}

function createAudioElement() {
    const audio = document.createElement('audio');
    audio.id = 'remote-audio';
    audio.autoplay = true;
    document.body.appendChild(audio);
    return audio;
}

function createRingtone() {
    // Create ringtone using Web Audio API (works better than base64)
    ringtone = {
        context: null,
        isPlaying: false,
        intervalId: null,
        isEnabled: false
    };
    
    // Pre-enable audio context on first user interaction
    const enableAudio = () => {
        if (!ringtone.isEnabled) {
            try {
                ringtone.context = new (window.AudioContext || window.webkitAudioContext)();
                // Resume if suspended
                if (ringtone.context.state === 'suspended') {
                    ringtone.context.resume();
                }
                ringtone.isEnabled = true;
                console.log('Audio context enabled');
            } catch (e) {
                console.log('Could not enable audio context:', e);
            }
        }
    };
    
    // Enable on any user interaction
    document.addEventListener('click', enableAudio, { once: true });
    document.addEventListener('keydown', enableAudio, { once: true });
    document.addEventListener('touchstart', enableAudio, { once: true });
}

function playRingtone() {
    if (ringtone.isPlaying) return;
    ringtone.isPlaying = true;
    
    try {
        // Create audio context if not exists
        if (!ringtone.context) {
            ringtone.context = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume if suspended
        if (ringtone.context.state === 'suspended') {
            ringtone.context.resume();
        }
        
        // UK-style double ring pattern
        const playRing = () => {
            if (!ringtone.isPlaying) return;
            
            const ctx = ringtone.context;
            const now = ctx.currentTime;
            
            // Create two oscillators for UK ring tone (400Hz + 450Hz)
            const playBurst = (startTime, duration) => {
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
                gain.gain.value = 0.1;
                
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
        ringtone.intervalId = setInterval(playRing, 2000);
        
    } catch (e) {
        console.log('Could not play ringtone:', e);
    }
}

function stopRingtone() {
    ringtone.isPlaying = false;
    if (ringtone.intervalId) {
        clearInterval(ringtone.intervalId);
        ringtone.intervalId = null;
    }
}

// Show incoming chat request notification
function showIncomingChatRequest(data) {
    console.log('Showing incoming chat request:', data);
    
    // Create or get the chat request banner
    var banner = document.getElementById('incoming-chat-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'incoming-chat-banner';
        banner.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 20px 30px; border-radius: 16px; box-shadow: 0 10px 40px rgba(37, 99, 235, 0.4); z-index: 10000; text-align: center; animation: pulse 2s infinite;';
        document.body.appendChild(banner);
        
        // Add animation
        var style = document.createElement('style');
        style.textContent = '@keyframes pulse { 0%, 100% { box-shadow: 0 10px 40px rgba(37, 99, 235, 0.4); } 50% { box-shadow: 0 10px 60px rgba(37, 99, 235, 0.7); } }';
        document.head.appendChild(style);
    }
    
    var reasonText = data.reason || 'Someone needs to chat';
    var userName = data.user_name || 'A veteran';
    
    banner.innerHTML = '<div style="font-size: 24px; margin-bottom: 8px;">💬 Incoming Chat Request</div>' +
        '<div style="font-size: 16px; margin-bottom: 8px;"><strong>' + userName + '</strong></div>' +
        '<div style="font-size: 14px; opacity: 0.9; margin-bottom: 16px;">' + reasonText + '</div>' +
        '<div style="display: flex; gap: 12px; justify-content: center;">' +
            '<button onclick="acceptChatRequest(\'' + data.request_id + '\', \'' + data.user_id + '\', \'' + userName.replace(/'/g, "\\'") + '\')" style="background: #22c55e; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;"><i class="fas fa-comments"></i> Accept Chat</button>' +
            '<button onclick="dismissChatRequest()" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">Dismiss</button>' +
        '</div>';
    
    banner.style.display = 'block';
    
    // Store request data globally for accepting
    window.pendingChatRequest = data;
}

// Accept a chat request
function acceptChatRequest(requestId, userId, userName) {
    console.log('Accepting chat request:', requestId);
    
    if (!socket || !socket.connected) {
        console.error('Socket not connected');
        return;
    }
    
    // Get current user from window or localStorage fallback
    var staffUser = window.currentUser || JSON.parse(localStorage.getItem('staff_user') || '{}') || {};
    
    // Emit accept event
    socket.emit('accept_chat_request', {
        request_id: requestId,
        user_id: userId,
        staff_id: staffUser.id || 'unknown',
        staff_name: staffUser.name || 'Staff',
        staff_type: staffUser.role || 'counsellor'
    });
    
    // Hide banner
    dismissChatRequest();
    
    // Show notification
    if (typeof showNotification === 'function') {
        showNotification('Chat request accepted. Opening chat...', 'success');
    }
    
    // Note: The actual chat opening happens when we receive 'chat_request_confirmed' from the server
}

// Dismiss chat request banner
function dismissChatRequest() {
    var banner = document.getElementById('incoming-chat-banner');
    if (banner) {
        banner.style.display = 'none';
    }
    window.pendingChatRequest = null;
}

// Expose functions globally
window.acceptChatRequest = acceptChatRequest;
window.dismissChatRequest = dismissChatRequest;


// Update status via Socket.IO
function updateSocketStatus(status) {
    if (socket && socket.connected) {
        socket.emit('update_status', { status: status });
        console.log('Socket.IO status updated to:', status);
    } else {
        console.warn('Socket not connected, cannot update status');
    }
}

// Export for use
window.webRTCPhone = {
    init: initWebRTCPhone,
    acceptCall: acceptCall,
    rejectCall: rejectCall,
    endCall: endCall,
    setAvailability: setAvailability,
    updateStatus: updateSocketStatus,  // For syncing status with Socket.IO
    cleanupCall: cleanupCall,  // Expose for manual cleanup
    isConnected: () => isRegistered,
    get isRegistered() { return isRegistered; },
    get socket() { return socket; },  // Expose socket for live chat
    get currentCallId() { return currentCallId; }  // Check if in call
};

// Also keep old name for compatibility
window.WebRTCPhone = window.webRTCPhone;
