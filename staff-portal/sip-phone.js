/**
 * Sipgate Click-to-Call Integration for Staff Portal
 * ===================================================
 * Makes external phone calls via Sipgate REST API
 * 
 * How it works:
 * 1. Staff clicks "Call" with a destination number
 * 2. Sipgate calls YOUR phone first (caller)
 * 3. When you answer, Sipgate bridges to the destination
 */

// Sipgate Configuration
const SIPGATE_CONFIG = {
    apiUrl: 'https://api.sipgate.com/v2',
    tokenId: 'token-0FVPNW',
    token: '4ac9a5dd-abf8-46c1-91a6-78b42c9c9ad9',
    // Your Sipgate phone number - this phone will ring first
    callerNumber: '01670898443',
    // Device ID - will be auto-detected
    deviceId: null,
    // Available devices (populated on init)
    devices: []
};

// State
let sipgateState = {
    isReady: false,
    currentSessionId: null,
    isInCall: false
};

// DOM Elements
let sipUI = {};

/**
 * Initialize Sipgate Click-to-Call
 */
async function initSIPPhone() {
    console.log('Initializing Sipgate Click-to-Call...');
    setupSipgateUI();
    updateSipgateStatus('connecting', 'Connecting to Sipgate...');
    
    // Fetch available devices from Sipgate
    try {
        const devices = await fetchSipgateDevices();
        
        if (devices && devices.length > 0) {
            SIPGATE_CONFIG.devices = devices;
            // Use the first available device
            SIPGATE_CONFIG.deviceId = devices[0].id;
            console.log('Using device:', SIPGATE_CONFIG.deviceId, devices[0]);
            sipgateState.isReady = true;
            updateSipgateStatus('online', 'Ready for external calls');
            populateDeviceSelector(devices);
        } else {
            console.warn('No devices found in Sipgate account');
            updateSipgateStatus('error', 'No devices found');
        }
    } catch (error) {
        console.error('Failed to fetch Sipgate devices:', error);
        updateSipgateStatus('error', 'Connection failed: ' + error.message);
    }
    
    return sipgateState.isReady;
}

/**
 * Fetch available devices from Sipgate API
 */
async function fetchSipgateDevices() {
    const response = await fetch(`${SIPGATE_CONFIG.apiUrl}/devices`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Basic ' + btoa(`${SIPGATE_CONFIG.tokenId}:${SIPGATE_CONFIG.token}`)
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Sipgate devices:', data);
    
    // Filter for phone-type devices (extensions, phones)
    return data.items || [];
}

/**
 * Populate device selector dropdown
 */
function populateDeviceSelector(devices) {
    const selector = document.getElementById('sip-device-selector');
    if (!selector) return;
    
    selector.innerHTML = '';
    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = `${device.alias || device.id} (${device.type})`;
        if (device.id === SIPGATE_CONFIG.deviceId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });
    
    selector.addEventListener('change', (e) => {
        SIPGATE_CONFIG.deviceId = e.target.value;
        console.log('Selected device:', SIPGATE_CONFIG.deviceId);
    });
}

/**
 * Make an external phone call via Sipgate Click-to-Call API
 * @param {string} phoneNumber - The phone number to call
 */
async function makeExternalCall(phoneNumber) {
    console.log('Making external call to:', phoneNumber);
    
    if (!sipgateState.isReady) {
        showSipgateNotification('Sipgate not ready. Please wait...', 'warning');
        return false;
    }
    
    if (!SIPGATE_CONFIG.deviceId) {
        showSipgateNotification('No device selected. Please refresh the page.', 'error');
        return false;
    }
    
    if (sipgateState.isInCall) {
        showSipgateNotification('Already in a call', 'warning');
        return false;
    }
    
    // Format phone number
    let formattedNumber = formatPhoneNumber(phoneNumber);
    console.log('Formatted number:', formattedNumber);
    
    // Format caller number
    let callerNumber = formatPhoneNumber(SIPGATE_CONFIG.callerNumber);
    
    try {
        sipgateState.isInCall = true;
        updateSipgateStatus('calling', 'Initiating call...');
        showDialingSipgateUI(phoneNumber);
        
        // Prepare request body - deviceId is REQUIRED when using phone number as caller
        const requestBody = {
            deviceId: SIPGATE_CONFIG.deviceId,  // Required!
            caller: callerNumber,               // Your phone - rings first
            callee: formattedNumber,            // Destination - connected after you answer
            callerId: callerNumber              // Displayed caller ID
        };
        
        console.log('Sipgate API request:', requestBody);
        
        // Make API call
        const response = await fetch(`${SIPGATE_CONFIG.apiUrl}/sessions/calls`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Basic ' + btoa(`${SIPGATE_CONFIG.tokenId}:${SIPGATE_CONFIG.token}`)
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Sipgate API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Sipgate API error:', errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Sipgate API response:', data);
        
        sipgateState.currentSessionId = data.sessionId;
        
        showActiveSipgateCall(phoneNumber);
        updateSipgateStatus('in-call', 'Your phone is ringing...');
        showSipgateNotification('Your phone is ringing! Answer to connect.', 'success');
        startSipgateCallTimer();
        
        return true;
        
    } catch (error) {
        console.error('Click-to-call failed:', error);
        showSipgateNotification('Call failed: ' + error.message, 'error');
        cleanupSipgateCall();
        updateSipgateStatus('online', 'Ready for external calls');
        return false;
    }
}

/**
 * Format phone number for Sipgate API
 * Converts UK numbers to E.164 format
 */
function formatPhoneNumber(number) {
    // Remove spaces, dashes, parentheses
    let formatted = number.replace(/[\s\-\(\)]/g, '');
    
    // Convert UK local to international format
    if (formatted.startsWith('0')) {
        formatted = '+44' + formatted.substring(1);
    }
    
    // Add + if missing
    if (!formatted.startsWith('+')) {
        formatted = '+44' + formatted;
    }
    
    return formatted;
}

/**
 * End the current call
 * Note: Sipgate click-to-call is controlled by hanging up your phone
 */
function endSipgateCall() {
    showSipgateNotification('Hang up your phone to end the call', 'info');
    cleanupSipgateCall();
}

/**
 * Cleanup call state
 */
function cleanupSipgateCall() {
    sipgateState.currentSessionId = null;
    sipgateState.isInCall = false;
    stopSipgateCallTimer();
    hideSipgateCallUI();
    updateSipgateStatus('online', 'Ready for external calls');
}

// ============ UI Functions ============

let sipgateCallTimer = null;
let sipgateCallStartTime = null;

function setupSipgateUI() {
    // Create Sipgate phone UI container
    let container = document.getElementById('sip-phone-section');
    if (!container) {
        container = document.createElement('div');
        container.id = 'sip-phone-section';
        container.className = 'section sip-phone-section';
        container.innerHTML = `
            <div class="sip-phone-header">
                <div class="sip-phone-icon">
                    <i class="fas fa-phone-square-alt"></i>
                </div>
                <div class="sip-phone-info">
                    <h3>External Calls (Sipgate)</h3>
                    <div id="sip-status" class="sip-status">
                        <span class="status-dot offline"></span>
                        <span id="sip-status-text">Connecting...</span>
                    </div>
                </div>
            </div>
            
            <div class="sip-dial-section">
                <div class="sip-device-row">
                    <label for="sip-device-selector">Device:</label>
                    <select id="sip-device-selector" class="sip-device-select">
                        <option value="">Loading devices...</option>
                    </select>
                </div>
                <div class="sip-input-group">
                    <input type="tel" id="sip-phone-number" placeholder="Enter phone number (e.g. 07911123456)" class="sip-phone-input">
                    <button id="sip-call-btn" class="btn btn-success" onclick="dialSipgateNumber()" disabled>
                        <i class="fas fa-phone"></i> Call
                    </button>
                </div>
                <div class="sip-how-it-works">
                    <i class="fas fa-info-circle"></i>
                    <span>Click Call → Your selected device rings → Answer → Connected to destination</span>
                </div>
            </div>
            
            <div id="sip-active-call" class="sip-active-call hidden">
                <div class="sip-call-info">
                    <i class="fas fa-phone-alt sip-call-icon ringing"></i>
                    <div class="sip-call-details">
                        <span id="sip-call-number" class="sip-call-number">Calling...</span>
                        <span id="sip-call-timer" class="sip-call-timer">00:00</span>
                        <span id="sip-call-hint" class="sip-call-hint">Answer your phone to connect</span>
                    </div>
                </div>
                <div class="sip-call-controls">
                    <button class="btn btn-danger" onclick="endSipgateCall()">
                        <i class="fas fa-phone-slash"></i> End / Cancel
                    </button>
                </div>
            </div>
        `;
        
        // Insert after webrtc-phone-section
        const webrtcSection = document.getElementById('webrtc-phone-section');
        if (webrtcSection) {
            webrtcSection.parentNode.insertBefore(container, webrtcSection.nextSibling);
        } else {
            const portalContent = document.querySelector('.portal-content');
            if (portalContent) {
                portalContent.prepend(container);
            }
        }
    }
    
    sipUI = {
        container: container,
        phoneInput: document.getElementById('sip-phone-number'),
        callBtn: document.getElementById('sip-call-btn'),
        activeCall: document.getElementById('sip-active-call'),
        callNumber: document.getElementById('sip-call-number'),
        callTimer: document.getElementById('sip-call-timer'),
        callHint: document.getElementById('sip-call-hint'),
        deviceSelector: document.getElementById('sip-device-selector')
    };
    
    // Enter key to dial
    if (sipUI.phoneInput) {
        sipUI.phoneInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                dialSipgateNumber();
            }
        });
    }
}

function updateSipgateStatus(status, text) {
    const statusDot = document.querySelector('#sip-status .status-dot');
    const statusText = document.getElementById('sip-status-text');
    
    if (statusDot) {
        statusDot.className = 'status-dot ' + status;
    }
    if (statusText) {
        statusText.textContent = text;
    }
    
    // Enable/disable call button based on ready state
    const callBtn = document.getElementById('sip-call-btn');
    if (callBtn) {
        callBtn.disabled = !sipgateState.isReady || sipgateState.isInCall;
    }
}

function dialSipgateNumber() {
    const phoneInput = document.getElementById('sip-phone-number');
    if (phoneInput && phoneInput.value.trim()) {
        makeExternalCall(phoneInput.value.trim());
    } else {
        showSipgateNotification('Please enter a phone number', 'warning');
    }
}

function showDialingSipgateUI(phoneNumber) {
    const activeCall = document.getElementById('sip-active-call');
    const callNumber = document.getElementById('sip-call-number');
    const callHint = document.getElementById('sip-call-hint');
    const callIcon = document.querySelector('.sip-call-icon');
    
    if (activeCall) activeCall.classList.remove('hidden');
    if (callNumber) callNumber.textContent = 'Calling: ' + phoneNumber;
    if (callHint) callHint.textContent = 'Your phone is ringing - answer to connect';
    if (callIcon) callIcon.classList.add('ringing');
}

function showActiveSipgateCall(phoneNumber) {
    const activeCall = document.getElementById('sip-active-call');
    const callNumber = document.getElementById('sip-call-number');
    const callHint = document.getElementById('sip-call-hint');
    const callIcon = document.querySelector('.sip-call-icon');
    
    if (activeCall) activeCall.classList.remove('hidden');
    if (callNumber) callNumber.textContent = 'To: ' + phoneNumber;
    if (callHint) callHint.textContent = 'Hang up your phone when done';
    if (callIcon) callIcon.classList.remove('ringing');
}

function hideSipgateCallUI() {
    const activeCall = document.getElementById('sip-active-call');
    if (activeCall) activeCall.classList.add('hidden');
    
    const callTimer = document.getElementById('sip-call-timer');
    if (callTimer) callTimer.textContent = '00:00';
}

function startSipgateCallTimer() {
    sipgateCallStartTime = Date.now();
    sipgateCallTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sipgateCallStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        
        const timerEl = document.getElementById('sip-call-timer');
        if (timerEl) {
            timerEl.textContent = `${mins}:${secs}`;
        }
    }, 1000);
}

function stopSipgateCallTimer() {
    if (sipgateCallTimer) {
        clearInterval(sipgateCallTimer);
        sipgateCallTimer = null;
    }
    sipgateCallStartTime = null;
}

function showSipgateNotification(message, type = 'info') {
    // Use existing notification system if available
    if (typeof showNotification === 'function') {
        showNotification(message, type);
    } else {
        console.log(`[Sipgate ${type}] ${message}`);
        alert(message);
    }
}

// Export for use
window.SIPPhone = {
    init: initSIPPhone,
    makeCall: makeExternalCall,
    endCall: endSipgateCall,
    isInCall: () => sipgateState.isInCall
};

// Also keep initSIPPhone as global for app.js
window.initSIPPhone = initSIPPhone;
