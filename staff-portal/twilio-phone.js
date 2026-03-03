/**
 * Twilio Phone Module for Staff Portal
 * =====================================
 * Enables browser-to-phone calling using Twilio Client SDK.
 * Staff can call users directly from the portal.
 */

var TwilioPhone = (function() {
    // State
    var device = null;
    var currentCall = null;
    var isReady = false;
    var callStartTime = null;
    var callTimer = null;
    var isMuted = false;
    var currentUserRef = null;  // Store user reference
    
    // Configuration
    var config = {
        tokenEndpoint: '/api/twilio/token',
        callEndpoint: '/api/twilio/call'
    };
    
    /**
     * Initialize Twilio Device
     */
    async function init() {
        console.log('=== Twilio Phone Init ===');
        
        // Try to get currentUser from window or localStorage
        var user = window.currentUser;
        if (!user || !user.id) {
            // Try localStorage fallback
            try {
                var storedUser = localStorage.getItem('staff_user');
                if (storedUser) {
                    user = JSON.parse(storedUser);
                    console.log('Twilio Phone: Using user from localStorage:', user.name);
                }
            } catch (e) {
                console.error('Failed to parse stored user:', e);
            }
        }
        
        if (!user || !user.id) {
            console.error('Twilio Phone: No current user - waiting for login');
            return false;
        }
        
        // Store reference for later use
        currentUserRef = user;
        
        try {
            // Check if Twilio is configured on the backend
            var statusResponse = await fetch(CONFIG.API_URL + '/api/twilio/status');
            var status = await statusResponse.json();
            
            if (!status.configured) {
                console.log('Twilio not configured on backend');
                updatePhoneUI('unavailable', 'Phone not configured');
                return false;
            }
            
            // Get access token
            var token = await getAccessToken();
            if (!token) {
                console.error('Failed to get Twilio token');
                updatePhoneUI('error', 'Token failed');
                return false;
            }
            
            // Check if Twilio SDK is loaded (Voice SDK 2.x)
            // The new SDK exports Device directly or under Twilio namespace
            var TwilioDevice = null;
            if (typeof Twilio !== 'undefined' && Twilio.Device) {
                TwilioDevice = Twilio.Device;
            } else if (typeof Device !== 'undefined') {
                TwilioDevice = Device;
            }
            
            if (!TwilioDevice) {
                console.error('Twilio SDK not loaded - check script tag');
                console.log('Twilio object:', typeof Twilio, Twilio);
                updatePhoneUI('unavailable', 'SDK not loaded');
                return false;
            }
            
            console.log('Twilio Device found:', TwilioDevice);
            
            // Initialize device with Voice SDK 2.x
            device = new TwilioDevice(token, {
                logLevel: 1,
                edge: 'dublin'  // Use Dublin edge for UK
            });
            
            // Setup event handlers
            setupDeviceEvents();
            
            // Register the device (Voice SDK 2.x)
            device.register();
            
            console.log('Twilio Device initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Twilio Phone init error:', error);
            updatePhoneUI('error', 'Init failed');
            return false;
        }
    }
    
    /**
     * Get access token from backend
     */
    async function getAccessToken() {
        try {
            // Use stored reference or get from window/localStorage
            var user = currentUserRef || window.currentUser;
            if (!user || !user.id) {
                try {
                    var storedUser = localStorage.getItem('staff_user');
                    if (storedUser) {
                        user = JSON.parse(storedUser);
                    }
                } catch (e) {
                    console.error('Failed to get user for token:', e);
                }
            }
            
            if (!user || !user.id) {
                console.error('No user available for token request');
                return null;
            }
            
            var formData = new FormData();
            formData.append('staff_id', user.id);
            formData.append('staff_name', user.name || 'Staff');
            
            var response = await fetch(CONFIG.API_URL + config.tokenEndpoint, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Token request failed: ' + response.status);
            }
            
            var data = await response.json();
            console.log('Got Twilio access token');
            return data.token;
            
        } catch (error) {
            console.error('Failed to get access token:', error);
            return null;
        }
    }
    
    /**
     * Setup device event handlers
     */
    function setupDeviceEvents() {
        device.on('registered', function() {
            console.log('Twilio Device registered');
            isReady = true;
            updatePhoneUI('ready', 'Ready to call');
        });
        
        device.on('unregistered', function() {
            console.log('Twilio Device unregistered');
            isReady = false;
            updatePhoneUI('offline', 'Disconnected');
        });
        
        device.on('error', function(error) {
            console.error('Twilio Device error:', error);
            updatePhoneUI('error', 'Error: ' + error.message);
        });
        
        device.on('incoming', function(call) {
            console.log('Incoming call from:', call.parameters.From);
            handleIncomingCall(call);
        });
        
        device.on('tokenWillExpire', async function() {
            console.log('Twilio token expiring - refreshing...');
            var newToken = await getAccessToken();
            if (newToken) {
                device.updateToken(newToken);
            }
        });
    }
    
    /**
     * Make an outbound call
     */
    async function makeCall(phoneNumber, userName, callbackId) {
        if (!isReady) {
            showNotification('Phone not ready. Please wait...', 'error');
            return;
        }
        
        if (currentCall) {
            showNotification('Already on a call', 'warning');
            return;
        }
        
        console.log('Making call to:', phoneNumber);
        
        try {
            // Format phone number
            var cleanNumber = phoneNumber.replace(/\s/g, '');
            if (!cleanNumber.startsWith('+')) {
                if (cleanNumber.startsWith('0')) {
                    cleanNumber = '+44' + cleanNumber.substring(1);
                } else {
                    cleanNumber = '+44' + cleanNumber;
                }
            }
            
            // Show calling UI
            showCallModal('calling', userName, cleanNumber);
            updatePhoneUI('calling', 'Calling...');
            
            // Use device.connect for browser-based call
            var callParams = {
                To: cleanNumber
            };
            
            currentCall = await device.connect({ params: callParams });
            
            // Setup call event handlers
            setupCallEvents(currentCall, userName, callbackId);
            
        } catch (error) {
            console.error('Call failed:', error);
            showNotification('Call failed: ' + error.message, 'error');
            hideCallModal();
            updatePhoneUI('ready', 'Ready to call');
            currentCall = null;
        }
    }
    
    /**
     * Make call via REST API (alternative method)
     */
    async function makeCallViaAPI(phoneNumber, userName, callbackId) {
        if (currentCall) {
            showNotification('Already on a call', 'warning');
            return;
        }
        
        console.log('Making REST API call to:', phoneNumber);
        
        // Get user from stored reference, window, or localStorage
        var user = currentUserRef || window.currentUser;
        if (!user || !user.id) {
            try {
                var storedUser = localStorage.getItem('staff_user');
                if (storedUser) {
                    user = JSON.parse(storedUser);
                }
            } catch (e) {
                console.error('Failed to get user:', e);
            }
        }
        
        if (!user || !user.id) {
            showNotification('Please log in again to make calls', 'error');
            console.error('No user found for Twilio call');
            return;
        }
        
        try {
            // Show calling UI
            showCallModal('calling', userName, phoneNumber);
            updatePhoneUI('calling', 'Calling...');
            
            var formData = new FormData();
            formData.append('to_number', phoneNumber);
            formData.append('staff_id', user.id);
            formData.append('staff_name', user.name || 'Staff');
            formData.append('user_name', userName || 'User');
            if (callbackId) formData.append('callback_id', callbackId);
            
            var response = await fetch(CONFIG.API_URL + config.callEndpoint, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                var error = await response.json();
                throw new Error(error.detail || 'Call failed');
            }
            
            var data = await response.json();
            console.log('Call initiated:', data);
            
            currentCall = {
                sid: data.call_sid,
                to: data.to_number,
                userName: userName,
                callbackId: callbackId
            };
            
            showCallModal('ringing', userName, phoneNumber);
            showNotification('Calling ' + userName + '...', 'info');
            
            // Start timer when call connects
            // In production, you'd poll for status or use webhooks
            setTimeout(function() {
                if (currentCall && currentCall.sid === data.call_sid) {
                    startCallTimer();
                    showCallModal('connected', userName, phoneNumber);
                }
            }, 3000);
            
        } catch (error) {
            console.error('Call failed:', error);
            showNotification('Call failed: ' + error.message, 'error');
            hideCallModal();
            updatePhoneUI('ready', 'Ready to call');
            currentCall = null;
        }
    }
    
    /**
     * Setup call event handlers
     */
    function setupCallEvents(call, userName, callbackId) {
        call.on('accept', function() {
            console.log('Call accepted/connected');
            showCallModal('connected', userName, call.parameters.To);
            updatePhoneUI('in-call', 'On call');
            startCallTimer();
        });
        
        call.on('disconnect', function() {
            console.log('Call disconnected');
            endCallCleanup();
        });
        
        call.on('cancel', function() {
            console.log('Call cancelled');
            endCallCleanup();
        });
        
        call.on('reject', function() {
            console.log('Call rejected');
            showNotification('Call was declined', 'info');
            endCallCleanup();
        });
        
        call.on('error', function(error) {
            console.error('Call error:', error);
            showNotification('Call error: ' + error.message, 'error');
            endCallCleanup();
        });
        
        call.on('ringing', function() {
            console.log('Call ringing');
            showCallModal('ringing', userName, call.parameters.To);
        });
    }
    
    /**
     * Handle incoming call
     */
    function handleIncomingCall(call) {
        // For now, we'll auto-accept or show UI
        // This could be expanded to show an incoming call modal
        showNotification('Incoming call from ' + call.parameters.From, 'info');
        
        // Auto-accept for demo - in production you'd show accept/reject UI
        // call.accept();
    }
    
    /**
     * End the current call
     */
    function endCall() {
        if (currentCall) {
            if (currentCall.disconnect) {
                // Twilio Call object
                currentCall.disconnect();
            } else if (currentCall.sid) {
                // REST API call - end via API
                endCallViaAPI(currentCall.sid);
            }
        }
        endCallCleanup();
    }
    
    /**
     * End call via REST API
     */
    async function endCallViaAPI(callSid) {
        try {
            var formData = new FormData();
            formData.append('call_sid', callSid);
            
            await fetch(CONFIG.API_URL + '/api/twilio/end-call', {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            console.error('Failed to end call via API:', error);
        }
    }
    
    /**
     * Cleanup after call ends
     */
    function endCallCleanup() {
        stopCallTimer();
        hideCallModal();
        updatePhoneUI('ready', 'Ready to call');
        currentCall = null;
        isMuted = false;
        showNotification('Call ended', 'info');
    }
    
    /**
     * Toggle mute
     */
    function toggleMute() {
        if (currentCall && currentCall.mute) {
            isMuted = !isMuted;
            currentCall.mute(isMuted);
            updateMuteButton();
        }
    }
    
    /**
     * Update mute button UI
     */
    function updateMuteButton() {
        var muteBtn = document.getElementById('twilio-mute-btn');
        if (muteBtn) {
            if (isMuted) {
                muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Unmute';
                muteBtn.classList.add('muted');
            } else {
                muteBtn.innerHTML = '<i class="fas fa-microphone"></i> Mute';
                muteBtn.classList.remove('muted');
            }
        }
    }
    
    /**
     * Start call duration timer
     */
    function startCallTimer() {
        callStartTime = Date.now();
        callTimer = setInterval(function() {
            var elapsed = Math.floor((Date.now() - callStartTime) / 1000);
            var mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
            var secs = (elapsed % 60).toString().padStart(2, '0');
            var timerEl = document.getElementById('twilio-call-timer');
            if (timerEl) {
                timerEl.textContent = mins + ':' + secs;
            }
        }, 1000);
    }
    
    /**
     * Stop call timer
     */
    function stopCallTimer() {
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
        callStartTime = null;
    }
    
    /**
     * Update phone status UI
     */
    function updatePhoneUI(status, text) {
        var statusEl = document.getElementById('twilio-phone-status');
        var indicatorEl = document.getElementById('twilio-status-indicator');
        
        if (statusEl) {
            statusEl.textContent = text;
        }
        
        if (indicatorEl) {
            indicatorEl.className = 'status-dot ' + status;
        }
    }
    
    /**
     * Show call modal
     */
    function showCallModal(state, userName, phoneNumber) {
        var modal = document.getElementById('twilio-call-modal');
        if (!modal) {
            // Create modal if it doesn't exist
            modal = document.createElement('div');
            modal.id = 'twilio-call-modal';
            modal.className = 'twilio-call-modal';
            document.body.appendChild(modal);
        }
        
        var stateText = state === 'calling' ? 'Calling...' :
                        state === 'ringing' ? 'Ringing...' :
                        state === 'connected' ? 'Connected' : 'Call';
        
        var stateIcon = state === 'connected' ? 'fa-phone-volume' : 'fa-phone-alt';
        var stateClass = state === 'connected' ? 'connected' : (state === 'calling' || state === 'ringing' ? 'calling' : '');
        
        modal.innerHTML = 
            '<div class="twilio-call-modal-content ' + stateClass + '">' +
                '<div class="call-header">' +
                    '<i class="fas ' + stateIcon + ' call-icon ' + (state === 'calling' || state === 'ringing' ? 'pulsing' : '') + '"></i>' +
                    '<div class="call-status">' + stateText + '</div>' +
                '</div>' +
                '<div class="call-info">' +
                    '<div class="call-user-name">' + (userName || 'User') + '</div>' +
                    '<div class="call-phone-number">' + phoneNumber + '</div>' +
                    (state === 'connected' ? '<div class="call-timer" id="twilio-call-timer">00:00</div>' : '') +
                '</div>' +
                '<div class="call-actions">' +
                    (state === 'connected' ? 
                        '<button id="twilio-mute-btn" class="call-btn mute" onclick="TwilioPhone.toggleMute()">' +
                            '<i class="fas fa-microphone"></i> Mute' +
                        '</button>' : '') +
                    '<button class="call-btn end" onclick="TwilioPhone.endCall()">' +
                        '<i class="fas fa-phone-slash"></i> ' + (state === 'connected' ? 'End Call' : 'Cancel') +
                    '</button>' +
                '</div>' +
            '</div>';
        
        modal.style.display = 'flex';
        
        // Restart timer if connected
        if (state === 'connected' && callStartTime) {
            // Timer will update from the interval
        }
    }
    
    /**
     * Hide call modal
     */
    function hideCallModal() {
        var modal = document.getElementById('twilio-call-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    /**
     * Check if Twilio is ready
     */
    function isPhoneReady() {
        return isReady;
    }
    
    // Public API
    return {
        init: init,
        makeCall: makeCall,
        makeCallViaAPI: makeCallViaAPI,
        endCall: endCall,
        toggleMute: toggleMute,
        isReady: isPhoneReady
    };
})();

// Global function to call from callback buttons
function twilioCallUser(phone, name, callbackId) {
    // Try Device SDK first (browser-to-phone), fall back to REST API
    if (TwilioPhone.isReady()) {
        console.log('Using Twilio Device SDK for call');
        TwilioPhone.makeCall(phone, name, callbackId);
    } else {
        console.log('Device not ready, using REST API (one-way call)');
        TwilioPhone.makeCallViaAPI(phone, name, callbackId);
    }
}
