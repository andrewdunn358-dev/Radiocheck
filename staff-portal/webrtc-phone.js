/**
 * WebRTC Phone for Staff Portal
 * =============================
 * Free peer-to-peer audio calls using WebRTC
 * No PBX required - uses Socket.IO for signaling
 */

// Configuration - STUN + TURN servers for NAT traversal
// Multiple TURN providers for reliability - if one fails, others will work
const WEBRTC_CONFIG = {
    iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Twilio free STUN
        { urls: 'stun:global.stun.twilio.com:3478' },
        // OpenRelay public TURN (no auth required)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        // Cloudflare public STUN
        { urls: 'stun:stun.cloudflare.com:3478' }
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
    
    // Incoming call
    socket.on('incoming_call', async (data) => {
        console.log('Incoming call:', data);
        currentCallId = data.call_id;
        
        // Play ringtone
        playRingtone();
        
        // Show incoming call UI
        showIncomingCall(data.caller_name, data.call_type);
    });
    
    // Call accepted - start WebRTC negotiation
    socket.on('call_accepted', async (data) => {
        console.log('Call accepted:', data);
        stopRingtone();
        
        // If we're the callee, we wait for the offer (don't create one)
        // If we're the caller, we create the offer
        const shouldCreateOffer = !data.is_callee;
        await startWebRTCConnection(shouldCreateOffer);
        
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
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('webrtc_offer', {
                call_id: currentCallId,
                offer: offer
            });
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
    if (!socket || !isRegistered) {
        showNotification('Phone not connected. Please wait...', 'error');
        return;
    }
    
    if (currentCallId) {
        showNotification('Already in a call', 'warning');
        return;
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
    // Use HTML5 Audio with a data URL for the ringtone
    // This works better with browser autoplay policies
    ringtone = {
        audio: null,
        isPlaying: false
    };
    
    // Create audio element with a simple beep tone as base64
    // This is a short beep that we'll loop
    const audio = new Audio();
    audio.loop = true;
    // UK phone ring tone - generated as base64 WAV
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkI2Coverage+bnZ2dnZycm5uampqam5ydnZ6enp6enp2dnJybm5qamZmZmZqbnJ2en5+fn5+enZ2cm5qZmZiYmZqbnJ2eoKCgoKCfnp2cmpmYl5eYmZqcnZ6goaGhoaCfnpyamJeWlpeYmpydn6ChoqKioJ+dnJqYlpWVlpeZm52foKKjo6OioJ6cmpiWlJSUlZeZm52foaKjo6OioJ6cmpeTk5OTlZeZm52goaOkpKOioJ6cmpiUkpKSk5WYmp2foaOkpaWjoaCempiUkZGRkpSXmp2goaOlpaWjoJ6cmZWSj4+PkJOWmZyfoaSkpaWjoJ6bmpWRj46OkJKVmZyfoaOlpaWkoZ+cmZaSkI6Oj5GTlpmcn6KkpaaloqCdmpiUkI6NjY+Sk5ebnqGkpaamo6GempeUkI2Li42QkpaanqGkpqampKGempeUj4yKio2PkpaanqGkpqenpaKfnJeTjoqJiYuOkZWZnaCkpqenpqOfnJmVkIyJiIiLjpGVmZ2hpKanp6ainpuYk46KhYSFiIyPlJidoaSlp6inoqCcl5GPioWCgYOGi4+UmJyhoqSlp6ejoZ2Zk46JhICAgIKFio6TmJyfpKWnqKajn5yXko2HgX19foGFio6Tl5ygoqWnqKako5+al5GKhX55eHl8gYWKj5SYnKCjpqepp6SgnJeSjIV/eXZ1d3qAhIqPk5idoKOmp6qopaSgnJaRioN9d3Nyd3qAhYqPk5ebn6KlqKqqqKWhnpiSi4R+dnJvcHR5gISJj5OXm56ho6aoqqimop+Zk4uEfHVwbW1wd3yBhouPk5ebnqGjpaeppqOgnpmSi4J7c21ramxxd3yBhYqOkpWZnaChpKampqOgm5eTjIR8dG5qaWtwd3yBhYmNkZWZnJ+io6WmpqShnpiRioJ5cWtoaGtwd3yAhIiMkJSYm56goqSlpaShn5mSioF4cGlnZmpvdnuAhIiMkJOXmp2foaOlpqWjoJ2WjoZ9dW1oZWZpb3V7gISIjJCTlpmcn6GjpKWko6CclpCHfnVtaGVkZmtwdnuAhIiLj5KVmJueoKGjpKSjoZ6ZkYqBd29pZWNkZ21zeICDh4uOkpWYm52foaKjo6KgnpqTi4J5cGpmY2JkZ21zeoCAhIeMj5KVmJqcnp+goaGgnpuVjoV8c2xnYmFjZmpwd3yBhYmMj5GUl5mbnZ6fn5+enJmUjYR7c2xnYmBiZGlud3yBhIiLjpGTlpiamp2en56enJqWkImAd3BqZGFgYmVpb3Z8gYSHi42QkpSXmZqcnZ6dnJuYk4yDenJrZWFfYGJlaXB3fIGFiIuOkJOVl5mam5ycnJuZlo+IgHlyamRgXl9hZGlwd3yBhYiLjpCSlJaYmpqcnJybmZWQiIF4cmpiXl1eYGRobnd8gYWIi42PkpSWl5mam5ubmpiVkIiBd3FpY15dXF5hZWtyd3yBhYiKjY+RlJaXmZqam5qYlZCKgnh0bGZhXV1eYGNobHR5foKFiIqNj5GSk5SWl5iYl5aUkYuDe3RsZmBdXF5gY2htdHl+goWIi42Pj5CRkpSVlpaWlJGNh4B4cWtmYF1cXWBkZ2xzeX6ChYiKjY6Pj5CRkpOTk5KQjIiCenNsZmJfXV1gYmVqcHV7f4KEh4qMjo+PkJCRkZCPjouGgHlybGdhXlxdX2JlaW90eX+ChYaJi4yOjY2Oj46NjIqGgXt1b2lkYF5dXmBkZ21ydnx/goWHiYuLjIyMjIyLioiFgXx2cGtlYV9eXmFkZ2txdnp+gYSGiIqKi4qKiomIhoOAfXhzbmllYV9eX2FkZ2xwd3p+gYOGh4iJiYmIh4aEgX57dnJuamZiYF9gYmVobHF2en2AgoSGh4iHh4aFg4F+e3d0cGxpZWJgYGFjZmltcXV5fH+BgoSFhYWEg4GAfXp4dXJva2hmY2FhY2VobXF0eHt+gIGDg4OEg4GAf316eHZzcW5rZ2VkZGRmaWxvcnZ5fH5/gYGCgYGAfn17enl3dXNwbmtpaGdnZ2ltcHN2enx+gICAf399fHt5eHd2dHJwbmxqaWhoaWttcHJ1d3t8fn9/f359fHp5eHd2dXRycXBubWxra2xrbnBxc3V4enx9fn5+fXx7enp5eHd3dnV0c3JxcHBvcHFyc3V2eHp8fH19fX19fHx7e3p6eXl4eHd3dnZ2dnZ3d3h5enp7fHx8fXx8fHx7e3t7e3p6';
    ringtone.audio = audio;
}

function playRingtone() {
    try {
        if (ringtone.isPlaying) return;
        ringtone.isPlaying = true;
        
        if (ringtone.audio) {
            ringtone.audio.currentTime = 0;
            const playPromise = ringtone.audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.log('Ringtone autoplay blocked, will play on user interaction');
                    // Add click listener to play on first interaction
                    const playOnClick = () => {
                        if (ringtone.isPlaying && ringtone.audio) {
                            ringtone.audio.play().catch(console.error);
                        }
                        document.removeEventListener('click', playOnClick);
                    };
                    document.addEventListener('click', playOnClick);
                });
            }
        }
    } catch (e) {
        console.log('Could not play ringtone:', e);
    }
}

function stopRingtone() {
    ringtone.isPlaying = false;
    if (ringtone.audio) {
        ringtone.audio.pause();
        ringtone.audio.currentTime = 0;
    }
}

// Export for use
window.webRTCPhone = {
    init: initWebRTCPhone,
    acceptCall: acceptCall,
    rejectCall: rejectCall,
    endCall: endCall,
    setAvailability: setAvailability,
    isConnected: () => isRegistered,
    get isRegistered() { return isRegistered; },
    get socket() { return socket; }  // Expose socket for live chat
};

// Also keep old name for compatibility
window.WebRTCPhone = window.webRTCPhone;
