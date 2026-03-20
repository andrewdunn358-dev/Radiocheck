// Staff Portal - Radio Check Veterans Support
// For Counsellors and Peer Supporters

// State - Check both storages for existing session
// Uses sessionStorage by default unless "Remember me" was checked
function getStorage() {
    return localStorage.getItem('staff_remember_me') === 'true' ? localStorage : sessionStorage;
}

function getAuthData(key) {
    // Check localStorage first (for remembered sessions), then sessionStorage
    return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function setAuthData(key, value, rememberMe) {
    if (rememberMe !== undefined) {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem(key, value);
        // Clear from other storage
        const other = rememberMe ? sessionStorage : localStorage;
        other.removeItem(key);
    } else {
        getStorage().setItem(key, value);
    }
}

function clearAuthData(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
}

let token = getAuthData('staff_token');
let currentUser = JSON.parse(getAuthData('staff_user') || 'null');
let myProfile = null;

// Session timeout - 2 hours of inactivity
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
let inactivityTimer = null;
let lastActivityTime = Date.now();

// Check if session has expired on page load
function checkSessionExpiry() {
    const lastActivity = getAuthData('staff_last_activity');
    const tokenTime = getAuthData('staff_token_time');
    
    if (lastActivity) {
        const timeSinceActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceActivity > SESSION_TIMEOUT_MS) {
            // Session expired - force logout
            console.log('Session expired due to inactivity');
            logout(true); // silent logout
            return true;
        }
    }
    
    // Also check if token is older than 24 hours (absolute expiry)
    if (tokenTime) {
        const tokenAge = Date.now() - parseInt(tokenTime);
        if (tokenAge > 24 * 60 * 60 * 1000) {
            console.log('Token expired (24 hour limit)');
            logout(true);
            return true;
        }
    }
    
    return false;
}

// Reset inactivity timer on user activity
function resetInactivityTimer() {
    lastActivityTime = Date.now();
    setAuthData('staff_last_activity', lastActivityTime.toString());
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    // Only set timer if user is logged in
    if (token && currentUser) {
        inactivityTimer = setTimeout(function() {
            console.log('Session timeout - logging out due to inactivity');
            showNotification('Session expired due to inactivity', 'warning');
            setTimeout(function() {
                logout();
            }, 2000);
        }, SESSION_TIMEOUT_MS);
    }
}

// Setup activity listeners
function setupActivityListeners() {
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(function(event) {
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
}

// Real-time alert tracking
let knownAlertIds = new Set();
let alertPollingInterval = null;
let soundEnabled = localStorage.getItem('alert_sound') !== 'false';

// Alert sound (using Web Audio API for more reliable playback)
let audioContext = null;
function playAlertSound() {
    if (!soundEnabled) return;
    
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Create an urgent alert tone (three ascending beeps)
        var now = audioContext.currentTime;
        
        for (var i = 0; i < 3; i++) {
            var oscillator = audioContext.createOscillator();
            var gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800 + (i * 200); // 800Hz, 1000Hz, 1200Hz
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, now + (i * 0.15));
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.15) + 0.12);
            
            oscillator.start(now + (i * 0.15));
            oscillator.stop(now + (i * 0.15) + 0.12);
        }
    } catch (e) {
        console.log('Audio playback failed:', e);
    }
}

// Toggle sound
function toggleAlertSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('alert_sound', soundEnabled);
    updateSoundButton();
    if (soundEnabled) {
        playAlertSound(); // Play test sound
    }
}

function updateSoundButton() {
    var btn = document.getElementById('sound-toggle');
    if (btn) {
        btn.innerHTML = soundEnabled ? 
            '<i class="fas fa-volume-up"></i>' : 
            '<i class="fas fa-volume-mute"></i>';
        btn.title = soundEnabled ? 'Sound ON - Click to mute' : 'Sound OFF - Click to enable';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Setup activity tracking for session timeout
    setupActivityListeners();
    
    if (token && currentUser) {
        // Check if session has expired while away
        if (checkSessionExpiry()) {
            return; // Will show login screen after logout
        }
        // Session still valid - initialize portal
        resetInactivityTimer();
        initPortal();
    } else {
        showScreen('login-screen');
    }
});

// Show Screen
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(function(s) {
        s.classList.remove('active');
    });
    var screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
    } else {
        console.error('Screen not found:', screenId);
    }
}

// Show Notification
function showNotification(message, type) {
    type = type || 'success';
    var notif = document.getElementById('notification');
    if (!notif) {
        console.error('Notification element not found');
        alert(message);
        return;
    }
    notif.textContent = message;
    notif.className = 'notification ' + type;
    setTimeout(function() {
        notif.classList.add('hidden');
    }, 3000);
}

// API Call
async function apiCall(endpoint, options) {
    options = options || {};
    
    // Don't make API calls if not logged in (except for login)
    if (!token && !endpoint.includes('/auth/login')) {
        console.log('Skipping API call - not logged in:', endpoint);
        throw new Error('Not authenticated');
    }
    
    var headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    var response = await fetch(CONFIG.API_URL + '/api' + endpoint, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body
    });
    
    var data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.detail || 'Request failed');
    }
    
    return data;
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    var errorEl = document.getElementById('login-error');
    
    try {
        errorEl.classList.add('hidden');
        
        var response = await fetch(CONFIG.API_URL + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });
        
        var data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Invalid credentials');
        }
        
        // Check role - only allow counsellor, peer, supervisor, or admin
        var role = data.user.role;
        if (!['counsellor', 'peer', 'supervisor', 'admin'].includes(role)) {
            throw new Error('Access denied. This portal is for staff only.');
        }
        
        // Save auth - support both 'token' and 'access_token' response formats
        token = data.token || data.access_token;
        currentUser = data.user;
        
        // Expose to window for other scripts (webrtc-phone.js)
        window.currentUser = currentUser;
        window.staffToken = token;
        
        // Check if "Remember me" checkbox is checked
        var rememberMe = document.getElementById('remember-me')?.checked || false;
        if (rememberMe) {
            localStorage.setItem('staff_remember_me', 'true');
        } else {
            localStorage.removeItem('staff_remember_me');
        }
        
        setAuthData('staff_token', token, rememberMe);
        setAuthData('staff_user', JSON.stringify(currentUser), rememberMe);
        setAuthData('staff_token_time', Date.now().toString(), rememberMe);
        setAuthData('staff_last_activity', Date.now().toString(), rememberMe);
        
        // Start session timer
        resetInactivityTimer();
        
        initPortal();
        
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
    
    return false;
}

// Logout
function logout(silent) {
    // Clear inactivity timer
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    
    token = null;
    currentUser = null;
    myProfile = null;
    
    // Clear from both storages
    clearAuthData('staff_token');
    clearAuthData('staff_user');
    clearAuthData('staff_last_activity');
    clearAuthData('staff_token_time');
    localStorage.removeItem('staff_remember_me');
    
    if (!silent) {
        showNotification('Logged out successfully', 'success');
    }
    showScreen('login-screen');
}

// Keep old function name for backwards compatibility
function handleLogout() {
    logout();
}

// Initialize Portal
async function initPortal() {
    showScreen('portal-screen');
    
    var role = currentUser.role;
    
    // Set header info
    document.getElementById('user-name').textContent = 'Welcome, ' + currentUser.name;
    document.getElementById('portal-title').textContent = 
        role === 'counsellor' ? 'Counsellor Portal' : 
        role === 'peer' ? 'Peer Support Portal' : 
        role === 'supervisor' ? 'Supervisor Portal' : 'Staff Portal';
    
    // Set role badge
    var badge = document.getElementById('user-role-badge');
    badge.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    badge.className = 'role-badge role-' + role;
    
    // Show/hide sections based on role
    // Panic ALERTS section - counsellors, supervisors, and admins see alerts FROM peers
    document.getElementById('panic-section').style.display = 
        (role === 'counsellor' || role === 'supervisor' || role === 'admin') ? 'block' : 'none';
    // Safeguarding section - ALL staff should see safeguarding alerts
    document.getElementById('safeguarding-section').style.display = 
        (role === 'counsellor' || role === 'supervisor' || role === 'admin' || role === 'peer') ? 'block' : 'none';
    // Panic BUTTON - only peers can trigger panic to counsellors/supervisors
    document.getElementById('panic-button-section').style.display = 
        role === 'peer' ? 'block' : 'none';
    
    // Show supervisor-specific sections
    var supervisorSection = document.getElementById('supervisor-section');
    if (supervisorSection) {
        supervisorSection.style.display = (role === 'supervisor' || role === 'admin') ? 'block' : 'none';
    }
    
    // Show escalate button for counsellors and peers
    var escalateSection = document.getElementById('escalate-section');
    if (escalateSection) {
        escalateSection.style.display = (role === 'counsellor' || role === 'peer') ? 'block' : 'none';
    }
    
    // Show supervisor tab for supervisors and admins
    var supervisorTab = document.getElementById('supervisor-tab');
    if (supervisorTab) {
        supervisorTab.style.display = (role === 'supervisor' || role === 'admin') ? 'inline-flex' : 'none';
    }
    
    // Load profile to get current status
    await loadMyProfile();
    
    // Load staff users for sharing
    await loadStaffUsers();
    
    // Initialize SIP phone if credentials available
    await initializeWebRTCPhone();
    
    // Initialize Twilio phone for browser-to-phone calling
    // Add small delay to ensure window.currentUser is fully set
    setTimeout(function() {
        if (typeof TwilioPhone !== 'undefined' && TwilioPhone.init) {
            console.log('Initializing Twilio Phone, currentUser:', window.currentUser);
            TwilioPhone.init().then(function(ready) {
                if (ready) {
                    console.log('Twilio Phone ready for calling');
                } else {
                    console.log('Twilio Phone not available - will use REST API fallback');
                }
            }).catch(function(err) {
                console.error('Twilio Phone init error:', err);
            });
        }
    }, 500);
    
    // Load data
    loadCallbacks();
    loadNotes();
    
    // All staff (counsellors, supervisors, peers, and admins) can see live chats and safeguarding
    if (role === 'counsellor' || role === 'supervisor' || role === 'admin' || role === 'peer') {
        loadPanicAlerts();
        loadSafeguardingAlerts(false); // Initial load, no sound
        loadLiveChats(false); // Initial load, no sound
        startAlertPolling(); // Start real-time polling for safeguarding
        startLiveChatPolling(); // Start real-time polling for live chats
        updateSoundButton(); // Update sound toggle button
        
        // Show sections
        document.getElementById('livechat-section').style.display = 'block';
        document.getElementById('safeguarding-section').style.display = 'block';
    }
    
    // Load supervisor-specific data
    if (role === 'supervisor' || role === 'admin') {
        loadTeamMembers();
        loadSupervisionNotes();
        loadEscalations();
    }
    
    // Auto-refresh every 30 seconds for callbacks/notes
    setInterval(function() {
        loadCallbacks();
        loadNotes();
        if (role === 'counsellor' || role === 'supervisor' || role === 'admin' || role === 'peer') {
            loadPanicAlerts();
            // Note: Safeguarding and live chats are polled separately with sound support
        }
        // Refresh supervisor data
        if (role === 'supervisor' || role === 'admin') {
            loadTeamMembers();
            loadEscalations();
        }
    }, 30000);
}

// Initialize SIP Phone with user's credentials
async function initializeWebRTCPhone() {
    try {
        console.log('=== WebRTC Phone Init Starting ===');
        
        // Check if WebRTCPhone is available
        if (typeof WebRTCPhone === 'undefined') {
            console.error('WebRTC Phone module not loaded - check if webrtc-phone.js is included');
            updatePhoneStatusUI('unavailable');
            alert('WebRTC Phone Error: Module not loaded. Check browser console.');
            return;
        }
        
        // Get the backend URL for WebSocket connection
        var backendUrl = CONFIG.API_URL;
        console.log('Backend URL for WebRTC:', backendUrl);
        console.log('Current User:', currentUser);
        console.log('My Profile:', myProfile);
        
        // Use the staff's actual status from their profile, or default to 'available'
        // This ensures Socket.IO status matches the database status
        var initialStatus = (myProfile && myProfile.status === 'available') ? 'available' : 'available';
        console.log('Initial Socket.IO status:', initialStatus);
        
        // Initialize WebRTC phone
        var success = WebRTCPhone.init(
            backendUrl,
            currentUser.id,
            currentUser.role === 'counsellor' ? 'counsellor' : 'peer',
            currentUser.name
        );
        
        if (success) {
            console.log('WebRTC Phone initialized for:', currentUser.name);
            
            // After a short delay, sync the Socket.IO status with the profile status
            // This ensures the staff's availability in Socket.IO matches their profile
            setTimeout(function() {
                if (myProfile && myProfile.status && window.webRTCPhone && window.webRTCPhone.updateStatus) {
                    console.log('Syncing Socket.IO status with profile status:', myProfile.status);
                    window.webRTCPhone.updateStatus(myProfile.status);
                }
            }, 1000);
        }
        
    } catch (error) {
        console.error('WebRTC Phone initialization failed:', error);
        updatePhoneStatusUI('error');
        alert('WebRTC Phone Error: ' + error.message);
    }
}

// Update phone status in UI
function updatePhoneStatusUI(status) {
    var statusEl = document.getElementById('phone-status');
    if (!statusEl) return;
    
    var statusMap = {
        'unavailable': { text: 'Phone N/A', class: 'status-offline' },
        'no-extension': { text: 'No Ext', class: 'status-offline' },
        'error': { text: 'Phone Error', class: 'status-error' },
        'connecting': { text: 'Connecting...', class: 'status-connecting' },
        'registered': { text: 'Online', class: 'status-online' },
        'disconnected': { text: 'Offline', class: 'status-offline' }
    };
    
    var info = statusMap[status] || { text: status, class: '' };
    statusEl.textContent = info.text;
    statusEl.className = 'phone-status ' + info.class;
}

// Load My Profile
async function loadMyProfile() {
    try {
        var role = currentUser.role;
        var profiles;
        
        if (role === 'counsellor') {
            profiles = await apiCall('/counsellors');
            myProfile = profiles.find(function(p) { return p.user_id === currentUser.id; });
        } else if (role === 'peer') {
            profiles = await apiCall('/peer-supporters');
            myProfile = profiles.find(function(p) { return p.user_id === currentUser.id; });
        }
        
        if (myProfile) {
            updateStatusUI(myProfile.status);
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Update Status UI
function updateStatusUI(status) {
    // Update buttons - map API values to button classes
    document.querySelectorAll('.status-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    // Map API status values to button CSS classes
    var btnClass = status === 'available' ? 'available' : 
                   status === 'limited' ? 'busy' : 
                   status === 'unavailable' ? 'off' : status;
    var activeBtn = document.querySelector('.status-btn.' + btnClass);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Update current status display
    var statusEl = document.getElementById('current-status');
    // Map API values to display names
    var displayName = status === 'available' ? 'Available' : 
                      status === 'limited' ? 'Busy' : 
                      status === 'unavailable' ? 'Off Duty' : status;
    statusEl.textContent = displayName;
    statusEl.style.background = 
        status === 'available' ? 'var(--success-light)' :
        status === 'limited' ? 'var(--warning-light)' : 'var(--danger-light)';
    statusEl.style.color = 
        status === 'available' ? 'var(--success)' :
        status === 'limited' ? 'var(--warning)' : 'var(--danger)';
}

// Update My Status
async function updateMyStatus(newStatus) {
    try {
        // Use the unified staff status endpoint with auth user ID
        var endpoint = '/staff/' + currentUser.id + '/status';
        
        await apiCall(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (myProfile) {
            myProfile.status = newStatus;
        }
        updateStatusUI(newStatus);
        
        // Also update Socket.IO status so chat requests work
        if (typeof window.webRTCPhone !== 'undefined' && window.webRTCPhone.updateStatus) {
            window.webRTCPhone.updateStatus(newStatus);
        }
        
        showNotification('Status updated to ' + newStatus);
        
    } catch (error) {
        showNotification('Failed to update status: ' + error.message, 'error');
    }
}

// Load Callbacks
async function loadCallbacks() {
    try {
        var callbacks = await apiCall('/callbacks');
        allCallbacks = callbacks; // Store for notes dropdown
        var role = currentUser.role;
        var userId = currentUser.id;
        
        // Filter by type based on role
        var filtered = callbacks;
        if (role === 'peer') {
            filtered = callbacks.filter(function(c) { return c.request_type === 'peer'; });
        } else if (role === 'counsellor') {
            filtered = callbacks.filter(function(c) { return c.request_type === 'counsellor'; });
        }
        
        // Split into active and pending
        var myActive = filtered.filter(function(c) { 
            return c.assigned_to === userId && c.status === 'in_progress'; 
        });
        var pending = filtered.filter(function(c) { return c.status === 'pending'; });
        
        renderCallbacks('active-callbacks', myActive, true);
        renderCallbacks('pending-callbacks', pending, false);
        
        // Update counts
        document.getElementById('active-count').textContent = myActive.length || '';
        document.getElementById('pending-count').textContent = pending.length || '';
        
    } catch (error) {
        console.error('Error loading callbacks:', error);
    }
}

// Render Callbacks
function renderCallbacks(containerId, callbacks, isActive) {
    var container = document.getElementById(containerId);
    
    if (callbacks.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>' + 
            (isActive ? 'No active callbacks' : 'No pending callbacks') + '</p></div>';
        return;
    }
    
    container.innerHTML = callbacks.map(function(cb) {
        // Add call button for active callbacks with phone numbers
        var callButton = isActive && cb.phone ? 
            '<button class="btn-call-twilio" onclick="twilioCallUser(\'' + cb.phone + '\', \'' + cb.name.replace(/'/g, "\\'") + '\', \'' + cb.id + '\')" data-testid="call-btn-' + cb.id + '">' +
            '<i class="fas fa-phone"></i> Call Now</button>' : '';
        
        var actions = isActive 
            ? callButton +
              '<button class="btn btn-success" onclick="completeCallback(\'' + cb.id + '\')"><i class="fas fa-check"></i> Complete</button>' +
              '<button class="btn btn-secondary" onclick="releaseCallback(\'' + cb.id + '\')"><i class="fas fa-undo"></i> Release</button>'
            : '<button class="btn btn-primary" onclick="takeCallback(\'' + cb.id + '\')"><i class="fas fa-hand-paper"></i> Take Callback</button>';
        
        return '<div class="card" data-testid="callback-card-' + cb.id + '">' +
            '<div class="card-header">' +
                '<span class="card-name">' + cb.name + '</span>' +
                '<span class="card-status ' + cb.status + '">' + cb.status.replace('_', ' ') + '</span>' +
            '</div>' +
            '<div class="card-phone"><i class="fas fa-phone"></i> ' + cb.phone + '</div>' +
            '<div class="card-message">' + (cb.message || 'No message') + '</div>' +
            '<div class="card-time">' + new Date(cb.created_at).toLocaleString() + '</div>' +
            '<div class="card-actions">' + actions + '</div>' +
        '</div>';
    }).join('');
}

// Take Callback
async function takeCallback(id) {
    try {
        await apiCall('/callbacks/' + id + '/take', { method: 'PATCH' });
        showNotification('Callback assigned to you');
        loadCallbacks();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Complete Callback
async function completeCallback(id) {
    try {
        await apiCall('/callbacks/' + id + '/complete', { method: 'PATCH' });
        showNotification('Callback completed');
        loadCallbacks();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Release Callback
async function releaseCallback(id) {
    try {
        await apiCall('/callbacks/' + id + '/release', { method: 'PATCH' });
        showNotification('Callback released');
        loadCallbacks();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Load Panic Alerts (Counsellors)
async function loadPanicAlerts() {
    try {
        var alerts = await apiCall('/panic-alerts');
        var active = alerts.filter(function(a) { 
            return a.status === 'active' || a.status === 'acknowledged'; 
        });
        
        renderPanicAlerts(active);
        document.getElementById('panic-count').textContent = active.length || '';
        
    } catch (error) {
        console.error('Error loading panic alerts:', error);
    }
}

// Render Panic Alerts
function renderPanicAlerts(alerts) {
    var container = document.getElementById('panic-list');
    
    if (alerts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No active alerts</p></div>';
        return;
    }
    
    container.innerHTML = alerts.map(function(alert) {
        var actions = '';
        // Add call button if phone number available
        if (alert.user_phone) {
            actions += '<button class="btn-call-twilio" onclick="twilioCallUser(\'' + alert.user_phone + '\', \'' + (alert.user_name || 'User').replace(/'/g, "\\'") + '\', null)" data-testid="call-alert-' + alert.id + '">' +
                '<i class="fas fa-phone"></i> Call Now</button>';
        }
        if (alert.status === 'active') {
            actions += '<button class="btn btn-warning" onclick="acknowledgeAlert(\'' + alert.id + '\')"><i class="fas fa-hand-paper"></i> Acknowledge</button>';
        }
        actions += '<button class="btn btn-success" onclick="resolveAlert(\'' + alert.id + '\')"><i class="fas fa-check"></i> Resolve</button>';
        
        return '<div class="card alert-card" data-testid="alert-card-' + alert.id + '">' +
            '<div class="card-header">' +
                '<span class="card-name">' + (alert.user_name || 'Peer Supporter') + '</span>' +
                '<span class="card-status ' + alert.status + '">' + alert.status + '</span>' +
            '</div>' +
            (alert.user_phone ? '<div class="card-phone"><i class="fas fa-phone"></i> ' + alert.user_phone + '</div>' : '') +
            '<div class="card-message">' + (alert.message || 'Needs immediate assistance') + '</div>' +
            '<div class="card-time">' + new Date(alert.created_at).toLocaleString() + '</div>' +
            '<div class="card-actions">' + actions + '</div>' +
        '</div>';
    }).join('');
}

// Acknowledge Alert
async function acknowledgeAlert(id) {
    try {
        await apiCall('/panic-alerts/' + id + '/acknowledge', { method: 'PATCH' });
        showNotification('Alert acknowledged');
        loadPanicAlerts();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Resolve Alert
async function resolveAlert(id) {
    try {
        await apiCall('/panic-alerts/' + id + '/resolve', { method: 'PATCH' });
        showNotification('Alert resolved');
        loadPanicAlerts();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Trigger Panic (Peers)
async function triggerPanic() {
    var message = prompt('What do you need help with? (optional)');
    
    try {
        await fetch(CONFIG.API_URL + '/api/panic-alert', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                user_name: currentUser.name,
                user_phone: myProfile ? myProfile.phone : null,
                message: message || 'Peer supporter needs counsellor assistance'
            })
        });
        
        showNotification('Alert sent! A counsellor has been notified.');
        
    } catch (error) {
        showNotification('Failed to send alert', 'error');
    }
}

// ============ SAFEGUARDING ALERTS ============

// Load Safeguarding Alerts (Counsellors/Admins)
async function loadSafeguardingAlerts(isPolling) {
    try {
        var alerts = await apiCall('/safeguarding-alerts');
        var active = alerts.filter(function(a) { 
            return a.status === 'active' || a.status === 'acknowledged'; 
        });
        
        // Check for new alerts (only during polling)
        if (isPolling) {
            var newAlerts = active.filter(function(a) {
                return a.status === 'active' && !knownAlertIds.has(a.id);
            });
            
            if (newAlerts.length > 0) {
                // Play sound for new alerts
                playAlertSound();
                
                // Show notification banner
                showNewAlertBanner(newAlerts.length);
                
                // Highlight new alert cards
                newAlerts.forEach(function(a) {
                    knownAlertIds.add(a.id);
                });
            }
        } else {
            // Initial load - just track IDs without alerting
            active.forEach(function(a) {
                knownAlertIds.add(a.id);
            });
        }
        
        renderSafeguardingAlerts(active);
        document.getElementById('safeguarding-count').textContent = active.length || '';
        
        // Add pulsing effect if there are active alerts
        var section = document.getElementById('safeguarding-section');
        if (active.filter(function(a) { return a.status === 'active'; }).length > 0) {
            section.classList.add('has-active');
        } else {
            section.classList.remove('has-active');
        }
        
    } catch (error) {
        console.error('Error loading safeguarding alerts:', error);
    }
}

// Show new alert notification banner
function showNewAlertBanner(count) {
    var banner = document.getElementById('new-alert-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'new-alert-banner';
        banner.className = 'new-alert-banner';
        document.body.appendChild(banner);
    }
    
    banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + count + ' NEW SAFEGUARDING ALERT' + (count > 1 ? 'S' : '') + ' <button onclick="dismissAlertBanner()">View</button>';
    banner.classList.add('show');
    
    // Auto-dismiss after 10 seconds
    setTimeout(function() {
        banner.classList.remove('show');
    }, 10000);
}

function dismissAlertBanner() {
    var banner = document.getElementById('new-alert-banner');
    if (banner) {
        banner.classList.remove('show');
    }
    // Make sure safeguarding section is visible and scroll to it
    var safeguardingSection = document.getElementById('safeguarding-section');
    if (safeguardingSection) {
        safeguardingSection.style.display = 'block';
        safeguardingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Flash the section to draw attention
        safeguardingSection.style.animation = 'flash 0.5s ease 2';
        setTimeout(function() {
            safeguardingSection.style.animation = '';
        }, 1000);
    }
}

// Start/stop alert polling
function startAlertPolling() {
    if (alertPollingInterval) return;
    alertPollingInterval = setInterval(function() {
        loadSafeguardingAlerts(true);
    }, 30000); // Poll every 30 seconds
}

function stopAlertPolling() {
    if (alertPollingInterval) {
        clearInterval(alertPollingInterval);
        alertPollingInterval = null;
    }
}

// Render Safeguarding Alerts
function renderSafeguardingAlerts(alerts) {
    var container = document.getElementById('safeguarding-list');
    
    if (alerts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-shield-alt"></i><p>No active safeguarding alerts</p></div>';
        return;
    }
    
    container.innerHTML = alerts.map(function(alert) {
        var actions = '';
        if (alert.status === 'active') {
            actions = '<button class="btn btn-warning" onclick="acknowledgeSafeguardingAlert(\'' + alert.id + '\')"><i class="fas fa-hand-paper"></i> Acknowledge</button>';
        }
        actions += '<button class="btn btn-success" onclick="resolveSafeguardingAlert(\'' + alert.id + '\')"><i class="fas fa-check"></i> Resolve</button>';
        
        var characterIcon = alert.character === 'tommy' ? 'fa-user' : 'fa-user-circle';
        var characterName = alert.character === 'tommy' ? 'Tommy' : 'Rachel';
        
        // Risk level styling
        var riskLevel = alert.risk_level || 'AMBER';
        var riskScore = alert.risk_score || 0;
        var riskClass = riskLevel.toLowerCase();
        var riskBadgeColor = riskLevel === 'RED' ? '#dc2626' : (riskLevel === 'AMBER' ? '#f59e0b' : '#eab308');
        
        // Format indicators
        var indicatorsHtml = '';
        if (alert.triggered_indicators && alert.triggered_indicators.length > 0) {
            indicatorsHtml = '<div class="card-indicators"><i class="fas fa-exclamation-circle"></i> ' + alert.triggered_indicators.slice(0, 5).join(', ') + '</div>';
        }
        
        // Contact captured status
        var contactStatus = alert.contact_captured ? 
            '<div class="contact-captured"><i class="fas fa-check-circle" style="color:#22c55e"></i> Contact details captured</div>' :
            '<div class="contact-not-captured"><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i> NO CONTACT DETAILS - Anonymous user</div>';
        
        // Geolocation info with map
        var locationHtml = '';
        if (alert.geo_city || alert.geo_country) {
            var locationParts = [];
            if (alert.geo_city) locationParts.push(alert.geo_city);
            if (alert.geo_region) locationParts.push(alert.geo_region);
            if (alert.geo_country) locationParts.push(alert.geo_country);
            locationHtml = '<div class="location-info"><i class="fas fa-map-marker-alt"></i> <strong>Location:</strong> ' + locationParts.join(', ') + '</div>';
            if (alert.geo_isp) {
                locationHtml += '<div class="location-info"><i class="fas fa-wifi"></i> <strong>ISP:</strong> ' + escapeHtml(alert.geo_isp) + '</div>';
            }
            if (alert.geo_timezone) {
                locationHtml += '<div class="location-info"><i class="fas fa-clock"></i> <strong>Timezone:</strong> ' + alert.geo_timezone + '</div>';
            }
            // Add map if we have coordinates
            if (alert.geo_lat && alert.geo_lon) {
                locationHtml += '<div class="location-map" id="map-' + alert.id + '" data-lat="' + alert.geo_lat + '" data-lon="' + alert.geo_lon + '" data-city="' + escapeHtml(alert.geo_city || 'Unknown') + '"></div>';
            }
        }
        
        // Client tracking info
        var trackingInfo = '';
        if (alert.client_ip || alert.user_agent || locationHtml) {
            trackingInfo = '<div class="tracking-info">' +
                '<div class="tracking-header"><i class="fas fa-fingerprint"></i> Tracking Information</div>' +
                locationHtml +
                (alert.client_ip ? '<div class="tracking-item"><strong>IP Address:</strong> ' + alert.client_ip + '</div>' : '') +
                (alert.user_agent ? '<div class="tracking-item"><strong>Device:</strong> ' + escapeHtml(alert.user_agent.substring(0, 100)) + (alert.user_agent.length > 100 ? '...' : '') + '</div>' : '') +
            '</div>';
        }
        
        // Conversation history preview
        var historyHtml = '';
        if (alert.conversation_history && alert.conversation_history.length > 0) {
            var lastMessages = alert.conversation_history.slice(-6);
            historyHtml = '<div class="conversation-history">' +
                '<div class="history-header" onclick="toggleHistory(\'' + alert.id + '\')">' +
                    '<i class="fas fa-comments"></i> View Conversation History (' + alert.conversation_history.length + ' messages)' +
                    '<i class="fas fa-chevron-down"></i>' +
                '</div>' +
                '<div class="history-content" id="history-' + alert.id + '" style="display:none;">' +
                lastMessages.map(function(msg) {
                    var isUser = msg.role === 'user';
                    return '<div class="history-message ' + (isUser ? 'user' : 'assistant') + '">' +
                        '<span class="msg-role">' + (isUser ? 'User' : characterName) + ':</span> ' +
                        escapeHtml(msg.content.substring(0, 200)) + (msg.content.length > 200 ? '...' : '') +
                    '</div>';
                }).join('') +
                '</div>' +
            '</div>';
        }
        
        return '<div class="card safeguarding-card ' + alert.status + ' risk-' + riskClass + '" data-alert-id="' + alert.id + '">' +
            '<div class="card-header">' +
                '<span class="card-name"><i class="fas ' + characterIcon + '"></i> Chat with ' + characterName + '</span>' +
                '<span class="risk-badge" style="background-color:' + riskBadgeColor + '">' + riskLevel + ' (' + riskScore + ')</span>' +
            '</div>' +
            contactStatus +
            '<div class="card-session"><i class="fas fa-fingerprint"></i> Session: ' + alert.session_id + '</div>' +
            indicatorsHtml +
            '<div class="card-trigger">' +
                '<label><i class="fas fa-quote-left"></i> Triggering Message:</label>' +
                '<div class="trigger-message">"' + escapeHtml(alert.triggering_message) + '"</div>' +
            '</div>' +
            trackingInfo +
            historyHtml +
            '<div class="card-time"><i class="fas fa-clock"></i> ' + new Date(alert.created_at).toLocaleString() + '</div>' +
            (alert.acknowledged_by ? '<div class="card-ack"><i class="fas fa-user-check"></i> Acknowledged by ' + alert.acknowledged_by + '</div>' : '') +
            '<div class="card-actions">' + actions + 
                '<button class="btn btn-primary" onclick="createCaseFromSafeguardingAlert(\'' + alert.id + '\', \'' + escapeHtml(alert.session_id || '').replace(/'/g, "\\'") + '\', \'' + escapeHtml(alert.triggering_message || '').replace(/'/g, "\\'").substring(0, 100) + '\', \'' + (alert.risk_level || 'AMBER') + '\')"><i class="fas fa-folder-plus"></i> Create Case</button>' +
            '</div>' +
        '</div>';
    }).join('');
    
    // Initialize maps after rendering
    setTimeout(initializeAlertMaps, 100);
}

// Toggle conversation history visibility
function toggleHistory(alertId) {
    var historyEl = document.getElementById('history-' + alertId);
    if (historyEl) {
        historyEl.style.display = historyEl.style.display === 'none' ? 'block' : 'none';
    }
}

// Initialize maps for all alert cards
var alertMaps = {};
function initializeAlertMaps() {
    document.querySelectorAll('.location-map').forEach(function(mapDiv) {
        var alertId = mapDiv.id.replace('map-', '');
        var lat = parseFloat(mapDiv.dataset.lat);
        var lon = parseFloat(mapDiv.dataset.lon);
        var city = mapDiv.dataset.city;
        
        if (lat && lon && !alertMaps[alertId]) {
            var map = L.map(mapDiv.id, {
                zoomControl: true,
                scrollWheelZoom: false
            }).setView([lat, lon], 10);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);
            
            L.marker([lat, lon])
                .addTo(map)
                .bindPopup('<strong>' + city + '</strong><br>Approximate location')
                .openPopup();
            
            alertMaps[alertId] = map;
        }
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Acknowledge Safeguarding Alert
async function acknowledgeSafeguardingAlert(id) {
    try {
        await apiCall('/safeguarding-alerts/' + id + '/acknowledge', { method: 'PATCH' });
        showNotification('Safeguarding alert acknowledged');
        loadSafeguardingAlerts();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Resolve Safeguarding Alert
async function resolveSafeguardingAlert(id) {
    var notes = prompt('Resolution notes (optional - what action was taken?):');
    
    try {
        var url = '/safeguarding-alerts/' + id + '/resolve';
        if (notes) {
            url += '?notes=' + encodeURIComponent(notes);
        }
        await apiCall(url, { method: 'PATCH' });
        showNotification('Safeguarding alert resolved');
        loadSafeguardingAlerts();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Create Case from Safeguarding Alert
async function createCaseFromSafeguardingAlert(alertId, sessionId, triggerMessage, riskLevel) {
    // Show modal to collect additional info
    var content = '<div style="padding: 20px; background: #ffffff;">' +
        '<p style="color: #6b7280; margin-bottom: 16px;">Create a case from this safeguarding alert. The case will be assigned to you.</p>' +
        '<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 16px;">' +
            '<div style="font-weight: 600; color: #92400e;"><i class="fas fa-exclamation-triangle"></i> Alert Info</div>' +
            '<div style="font-size: 14px; color: #78350f; margin-top: 8px;">Session: ' + escapeHtml(sessionId || 'Unknown') + '</div>' +
            '<div style="font-size: 14px; color: #78350f;">Risk Level: ' + escapeHtml(riskLevel || 'AMBER') + '</div>' +
            (triggerMessage ? '<div style="font-size: 14px; color: #78350f; margin-top: 8px;"><em>"' + escapeHtml(triggerMessage) + '..."</em></div>' : '') +
        '</div>' +
        '<form id="create-case-form" onsubmit="return submitCreateCaseFromAlert(event, \'' + alertId + '\')">' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">User Name (if known)</label>' +
                '<input type="text" id="case-user-name" placeholder="e.g., John D. or Anonymous" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Initial Notes</label>' +
                '<textarea id="case-initial-notes" rows="3" placeholder="Brief summary of the situation..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">Case created from safeguarding alert. Risk level: ' + escapeHtml(riskLevel || 'AMBER') + '. Trigger: ' + escapeHtml(triggerMessage || 'N/A') + '</textarea>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 20px;">' +
                '<button type="submit" class="btn btn-primary" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-folder-plus"></i> Create Case</button>' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()" style="background: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;">Cancel</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    openGenericModal('Create Case from Alert', content);
}

// Submit create case from alert
async function submitCreateCaseFromAlert(event, alertId) {
    event.preventDefault();
    
    var userName = document.getElementById('case-user-name').value || 'Anonymous User';
    var initialNotes = document.getElementById('case-initial-notes').value || 'Case created from safeguarding alert';
    
    try {
        var result = await apiCall('/cases', 'POST', {
            safeguarding_alert_id: alertId,
            initial_notes: initialNotes,
            user_name: userName
        });
        
        showNotification('Case created successfully!', 'success');
        closeModal();
        
        // Refresh alerts and cases
        loadSafeguardingAlerts();
        loadCases();
        
        // Switch to Cases tab and open the new case
        switchTab('cases');
        
        if (result && result.id) {
            setTimeout(function() {
                openCaseDetail(result.id);
            }, 500);
        }
        
    } catch (error) {
        console.error('Error creating case:', error);
        showNotification('Failed to create case: ' + error.message, 'error');
    }
    
    return false;
}

// ============ LIVE CHAT FUNCTIONALITY ============

var activeLiveChats = [];
var knownLiveChatIds = new Set();
var currentChatRoom = null;
var chatPollingInterval = null;
var liveChatPollingInterval = null;

// Start polling for new live chats (with sound alerts)
function startLiveChatPolling() {
    if (liveChatPollingInterval) return;
    liveChatPollingInterval = setInterval(function() {
        loadLiveChats(true); // true = check for new chats with sound
    }, 10000); // Poll every 10 seconds for live chats (more urgent than safeguarding)
}

// Load Live Chats
async function loadLiveChats(isPolling) {
    try {
        var rooms = await apiCall('/live-chat/rooms');
        var activeRooms = rooms.filter(function(r) { return r.status === 'active'; });
        
        // Check for new chats (only during polling)
        if (isPolling) {
            var newChats = activeRooms.filter(function(r) {
                return !knownLiveChatIds.has(r.id);
            });
            
            if (newChats.length > 0) {
                // Play sound alert
                playAlertSound();
                
                // Show notification banner
                showNewLiveChatBanner(newChats.length);
                
                // Track new chats
                newChats.forEach(function(r) {
                    knownLiveChatIds.add(r.id);
                });
            }
        } else {
            // Initial load - track IDs without alerting
            activeRooms.forEach(function(r) {
                knownLiveChatIds.add(r.id);
            });
        }
        
        activeLiveChats = activeRooms;
        renderLiveChats(activeRooms);
        document.getElementById('livechat-count').textContent = activeRooms.length || '';
        
        // Add pulsing effect if there are active chats waiting
        var waitingChats = activeRooms.filter(function(r) {
            return !r.messages || r.messages.length === 0 || 
                   r.messages.every(function(m) { return m.sender === 'user'; });
        });
        
        var section = document.getElementById('livechat-section');
        if (waitingChats.length > 0) {
            section.classList.add('has-waiting');
        } else {
            section.classList.remove('has-waiting');
        }
        
    } catch (error) {
        console.error('Error loading live chats:', error);
    }
}

// Show new live chat notification banner
function showNewLiveChatBanner(count) {
    var banner = document.getElementById('new-livechat-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'new-livechat-banner';
        banner.className = 'new-livechat-banner';
        document.body.appendChild(banner);
    }
    
    banner.innerHTML = '<i class="fas fa-comments"></i> ' + count + ' NEW LIVE CHAT' + (count > 1 ? 'S' : '') + ' - Someone needs help now! <button onclick="dismissLiveChatBanner()">View</button>';
    banner.classList.add('show');
    
    // Auto-dismiss after 15 seconds
    setTimeout(function() {
        banner.classList.remove('show');
    }, 15000);
}

function dismissLiveChatBanner() {
    var banner = document.getElementById('new-livechat-banner');
    if (banner) {
        banner.classList.remove('show');
    }
    // Scroll to live chat section
    document.getElementById('livechat-section').scrollIntoView({ behavior: 'smooth' });
}

// Render Live Chats
function renderLiveChats(rooms) {
    var container = document.getElementById('livechat-list');
    
    if (rooms.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>No active live chats</p><span>When users request live support, they will appear here</span></div>';
        return;
    }
    
    container.innerHTML = rooms.map(function(room) {
        var staffType = room.staff_type === 'counsellor' ? 'Counsellor' : 'Peer';
        var messageCount = room.messages ? room.messages.length : 0;
        var lastMessage = room.messages && room.messages.length > 0 ? 
            room.messages[room.messages.length - 1] : null;
        var waitingTime = getWaitingTime(room.created_at);
        
        return '<div class="card livechat-card" data-room-id="' + room.id + '">' +
            '<div class="card-header">' +
                '<span class="card-name"><i class="fas fa-comment-dots"></i> Live Chat Request</span>' +
                '<span class="badge primary">' + staffType + ' Request</span>' +
            '</div>' +
            '<div class="livechat-meta">' +
                '<span><i class="fas fa-clock"></i> Waiting: ' + waitingTime + '</span>' +
                '<span><i class="fas fa-comments"></i> ' + messageCount + ' messages</span>' +
            '</div>' +
            (room.safeguarding_alert_id ? 
                '<div class="livechat-safeguarding"><i class="fas fa-shield-alt"></i> Linked to Safeguarding Alert</div>' : '') +
            (lastMessage ? 
                '<div class="livechat-preview">' +
                    '<label>Latest message:</label>' +
                    '<div class="preview-text">"' + escapeHtml(lastMessage.text.substring(0, 100)) + (lastMessage.text.length > 100 ? '...' : '') + '"</div>' +
                '</div>' : 
                '<div class="livechat-preview"><label>No messages yet - user just connected</label></div>') +
            '<div class="card-time"><i class="fas fa-calendar"></i> Started: ' + new Date(room.created_at).toLocaleString() + '</div>' +
            '<div class="card-actions">' +
                '<button class="btn btn-primary" onclick="joinLiveChat(\'' + room.id + '\')">' +
                    '<i class="fas fa-headset"></i> Join Chat' +
                '</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

// Get waiting time string
function getWaitingTime(createdAt) {
    var created = new Date(createdAt);
    var now = new Date();
    var diff = Math.floor((now - created) / 1000); // seconds
    
    if (diff < 60) return diff + ' seconds';
    if (diff < 3600) return Math.floor(diff / 60) + ' minutes';
    return Math.floor(diff / 3600) + ' hours';
}

// Join Live Chat
async function joinLiveChat(roomId) {
    try {
        // First, join the chat room (assign this staff member)
        await apiCall('/live-chat/rooms/' + roomId + '/join', {
            method: 'POST',
            body: JSON.stringify({
                staff_id: currentUser.id,
                staff_name: currentUser.name
            })
        });
        
        currentChatRoom = roomId;
        showLiveChatModal(roomId);
        showNotification('You have joined the chat', 'success');
        
        // Refresh the live chats list
        loadLiveChats(false);
        
    } catch (error) {
        console.error('Error joining chat:', error);
        if (error.message && error.message.includes('already has a staff member')) {
            showNotification('This chat has already been taken by another staff member', 'error');
            loadLiveChats(false); // Refresh list
        } else {
            showNotification('Failed to join chat: ' + error.message, 'error');
        }
    }
}

// Show Live Chat Modal
async function showLiveChatModal(roomId, userId) {
    console.log('showLiveChatModal called with roomId:', roomId);
    
    // FIRST: Remove any existing modal to prevent duplicates
    var existingModal = document.getElementById('livechat-modal');
    if (existingModal) {
        console.log('Removing existing modal');
        existingModal.remove();
    }
    
    // Set current chat room for message sending
    currentChatRoom = roomId;
    window.currentChatRoom = roomId;
    
    // Store userId if provided (from the chat request data)
    var chatUserId = userId || window.currentChatUserId || '';
    window.currentChatUserId = chatUserId;
    
    // Create modal HTML FIRST (before any async calls) so socket messages have a target
    var modalHtml = '<div class="livechat-modal" id="livechat-modal">' +
        '<div class="livechat-modal-content">' +
            '<div class="livechat-modal-header">' +
                '<h3><i class="fas fa-headset"></i> Live Chat Support</h3>' +
                '<div style="display:flex;gap:8px;">' +
                    '<button class="btn btn-success btn-sm" onclick="callUserFromChat()" title="Call this user">' +
                        '<i class="fas fa-phone"></i> Call' +
                    '</button>' +
                    '<button class="btn btn-icon" onclick="closeLiveChatModal()"><i class="fas fa-times"></i></button>' +
                '</div>' +
            '</div>' +
            '<div class="livechat-messages" id="livechat-messages" style="min-height:200px;background:#1a2634;padding:20px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px;">' +
                '<div style="color:#64748b;text-align:center;padding:20px;">Loading messages...</div>' +
            '</div>' +
            '<div class="livechat-input">' +
                '<input type="text" id="livechat-input-dynamic" placeholder="Type your message..." onkeypress="handleChatKeypress(event)">' +
                '<button class="btn btn-primary" onclick="sendChatMessage()">' +
                    '<i class="fas fa-paper-plane"></i>' +
                '</button>' +
            '</div>' +
            '<div class="livechat-actions">' +
                '<button class="btn btn-warning" onclick="endLiveChat(\'' + roomId + '\')">' +
                    '<i class="fas fa-phone-slash"></i> End Chat' +
                '</button>' +
            '</div>' +
        '</div>' +
    '</div>';
    
    // Add modal to page IMMEDIATELY
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    console.log('Modal created, livechat-messages element exists:', !!document.getElementById('livechat-messages'));
    
    // Focus input
    var inputEl = document.getElementById('livechat-input-dynamic');
    if (inputEl) inputEl.focus();
    
    // NOW load existing messages from API (async)
    try {
        var response = await apiCall('/live-chat/rooms/' + roomId + '/messages');
        var messages = response.messages || [];
        
        // Update messages div with loaded messages - BUT only if no socket messages arrived yet
        var messagesDiv = document.getElementById('livechat-messages');
        if (messagesDiv) {
            // Check if socket messages already arrived (more than just the loading placeholder)
            var hasSocketMessages = messagesDiv.querySelectorAll('.chat-message').length > 0;
            
            if (messages.length > 0 && !hasSocketMessages) {
                // Only load from API if no real-time messages have arrived
                messagesDiv.innerHTML = messages.map(function(msg) {
                    var isStaff = msg.sender === 'staff';
                    return '<div class="chat-message ' + (isStaff ? 'staff' : 'user') + '" style="background:' + (isStaff ? '#2d3a4d' : '#3b82f6') + ';padding:12px 16px;border-radius:12px;max-width:80%;color:#fff;">' +
                        '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);">' + (isStaff ? 'You' : 'User') + '</div>' +
                        '<div style="font-size:15px;color:#fff;">' + escapeHtml(msg.text) + '</div>' +
                        '<div style="font-size:10px;color:rgba(255,255,255,0.6);">' + new Date(msg.timestamp).toLocaleTimeString() + '</div>' +
                    '</div>';
                }).join('');
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            } else if (!hasSocketMessages) {
                // Clear the loading message only if no socket messages yet
                messagesDiv.innerHTML = '';
            }
            // If socket messages exist, don't touch the div - let real-time updates continue
            console.log('API load complete. Has socket messages:', hasSocketMessages, 'API messages:', messages.length);
        }
        
    } catch (error) {
        console.error('Error loading chat messages:', error);
        // Don't close modal - just clear the loading message
        var messagesDiv = document.getElementById('livechat-messages');
        if (messagesDiv) {
            var hasSocketMessages = messagesDiv.querySelectorAll('.chat-message').length > 0;
            if (!hasSocketMessages) {
                messagesDiv.innerHTML = '';
            }
        }
    }
    
    // Start polling as fallback (will be skipped if socket connected)
    startChatPolling(roomId);
}

// Handle Enter key in chat input
function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

// Send Chat Message
async function sendChatMessage() {
    var input = document.getElementById('livechat-input-dynamic');
    var text = input.value.trim();
    
    console.log('sendChatMessage called, text:', text, 'room:', currentChatRoom);
    
    if (!text || !currentChatRoom) {
        console.log('No text or no room, aborting');
        return;
    }
    
    try {
        // Emit via Socket.IO for real-time delivery
        var wsocket = window.webRTCPhone && window.webRTCPhone.socket;
        console.log('Socket available:', !!wsocket, 'Connected:', wsocket && wsocket.connected);
        
        if (wsocket && wsocket.connected) {
            var messageData = {
                room_id: currentChatRoom,
                message: text,
                sender_id: currentUser.id,
                sender_name: currentUser.name,
                sender_type: currentUser.role || 'counsellor'
            };
            console.log('Emitting chat_message:', messageData);
            wsocket.emit('chat_message', messageData);
        } else {
            console.error('Socket not connected!');
        }
        
        // Also persist to database via REST API
        await apiCall('/live-chat/rooms/' + currentChatRoom + '/messages', {
            method: 'POST',
            body: JSON.stringify({ text: text, sender: 'staff' })
        });
        
        input.value = '';
        
        // Add message to UI immediately with inline styles to ensure visibility
        var messagesDiv = document.getElementById('livechat-messages');
        console.log('Adding staff message, messagesDiv found:', !!messagesDiv);
        if (messagesDiv) {
            var msgHtml = '<div class="chat-message staff" style="background:#2d3a4d;padding:12px 16px;border-radius:12px;margin:8px 0;align-self:flex-end;max-width:80%;color:#fff;">' +
                '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);">You</div>' +
                '<div style="font-size:15px;color:#fff;">' + escapeHtml(text) + '</div>' +
                '<div style="font-size:10px;color:rgba(255,255,255,0.6);">' + new Date().toLocaleTimeString() + '</div>' +
            '</div>';
            messagesDiv.insertAdjacentHTML('beforeend', msgHtml);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            console.log('Staff message added, children count:', messagesDiv.children.length);
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message', 'error');
    }
}

// Start polling for new messages - only as fallback when socket not available
function startChatPolling(roomId) {
    // Check if socket is connected - if so, rely on real-time socket messages instead
    var wsocket = window.webRTCPhone && window.webRTCPhone.socket;
    if (wsocket && wsocket.connected) {
        console.log('Socket connected - skipping polling, using real-time updates');
        return; // Don't poll when socket is working
    }
    
    console.log('Starting chat polling as fallback (no socket connection)');
    chatPollingInterval = setInterval(async function() {
        try {
            var response = await apiCall('/live-chat/rooms/' + roomId + '/messages');
            updateChatMessages(response.messages || []);
        } catch (error) {
            console.log('Chat polling error:', error);
        }
    }, 3000);
}

// Update chat messages in modal
function updateChatMessages(messages) {
    var messagesDiv = document.getElementById('livechat-messages');
    if (!messagesDiv) return;
    
    messagesDiv.innerHTML = messages.map(function(msg) {
        var isStaff = msg.sender === 'staff';
        return '<div class="chat-message ' + (isStaff ? 'staff' : 'user') + '">' +
            '<span class="msg-sender">' + (isStaff ? 'You' : 'User') + '</span>' +
            '<span class="msg-text">' + escapeHtml(msg.text) + '</span>' +
            '<span class="msg-time">' + new Date(msg.timestamp).toLocaleTimeString() + '</span>' +
        '</div>';
    }).join('');
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Close Live Chat Modal
function closeLiveChatModal() {
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
    
    // Use the WebRTC phone's socket reference (more reliable)
    var wsocket = window.webRTCPhone && window.webRTCPhone.socket;
    
    // Notify server that staff is leaving the chat room (resets status to available)
    if (currentChatRoom && wsocket && wsocket.connected) {
        console.log('Emitting leave_chat_room for:', currentChatRoom);
        wsocket.emit('leave_chat_room', { 
            room_id: currentChatRoom,
            user_id: currentUser.id 
        });
    }
    
    // Force reset status to available using the force_available event
    if (wsocket && wsocket.connected) {
        wsocket.emit('force_available', {});
        console.log('Force reset status to available after closing chat');
    }
    
    // Also call the webrtc-phone's force reset if available
    if (typeof window.forceResetToAvailable === 'function') {
        window.forceResetToAvailable();
    }
    
    currentChatRoom = null;
    window.currentChatRoom = null;
    window.currentChatUserId = null;
    
    var modal = document.getElementById('livechat-modal');
    if (modal) {
        modal.remove();
    }
}

// End Live Chat
async function endLiveChat(roomId) {
    if (!confirm('Are you sure you want to end this chat?')) return;
    
    try {
        // Use the WebRTC phone's socket reference (more reliable)
        var wsocket = window.webRTCPhone && window.webRTCPhone.socket;
        
        // Notify server via Socket.IO first (resets status)
        if (wsocket && wsocket.connected) {
            wsocket.emit('leave_chat_room', { 
                room_id: roomId,
                user_id: currentUser.id 
            });
            // Force reset status to available
            wsocket.emit('force_available', {});
            console.log('Force reset status to available after ending chat');
        }
        
        await apiCall('/live-chat/rooms/' + roomId + '/end', { method: 'POST' });
        closeLiveChatModal();
        loadLiveChats();
        showNotification('Chat ended successfully', 'success');
    } catch (error) {
        console.error('Error ending chat:', error);
        showNotification('Failed to end chat', 'error');
    }
}

// Call user from within a chat
function callUserFromChat() {
    var userId = window.currentChatUserId;
    console.log('=== CALL USER FROM CHAT ===');
    console.log('User ID:', userId);
    console.log('Current chat room:', currentChatRoom);
    
    if (!userId) {
        showNotification('Cannot identify user to call', 'error');
        return;
    }
    
    // First, force reset our own status to available before initiating call
    // This helps prevent "user_busy" errors from stuck states
    var wsocket = window.webRTCPhone && window.webRTCPhone.socket;
    if (wsocket && wsocket.connected) {
        // Clean up any stale call state
        wsocket.emit('force_available', {});
        console.log('Reset own status before initiating call');
    }
    
    // Small delay to let the status reset propagate
    setTimeout(function() {
        // Use WebRTC to call the user
        if (typeof makeOutboundCall === 'function') {
            console.log('Calling user via WebRTC:', userId);
            makeOutboundCall(userId);
        } else if (typeof window.webRTCPhone?.makeOutboundCall === 'function') {
            console.log('Calling user via webRTCPhone object:', userId);
            window.webRTCPhone.makeOutboundCall(userId);
        } else {
            console.error('makeOutboundCall function not available');
            showNotification('Phone system not available', 'error');
        }
    }, 100);
}

// ============ NOTES FUNCTIONALITY ============

var staffUsers = [];
var allCallbacks = [];
var currentNotesTab = 'my';
var editingNoteId = null;

// Load Notes
async function loadNotes() {
    try {
        var notes = await apiCall('/notes?include_shared=true');
        var myNotes = notes.filter(function(n) { return n.author_id === currentUser.id; });
        var sharedNotes = notes.filter(function(n) { 
            return n.author_id !== currentUser.id && 
                   (n.shared_with.includes(currentUser.id) || !n.is_private);
        });
        
        // For admin, show all notes in "shared" tab
        if (currentUser.role === 'admin') {
            sharedNotes = notes.filter(function(n) { return n.author_id !== currentUser.id; });
        }
        
        document.getElementById('notes-count').textContent = myNotes.length || '';
        
        if (currentNotesTab === 'my') {
            renderNotes(myNotes, false);
        } else {
            renderNotes(sharedNotes, true);
        }
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

// Render Notes
function renderNotes(notes, isSharedTab) {
    var container = document.getElementById('notes-list');
    
    if (notes.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-sticky-note"></i><p>' + 
            (isSharedTab ? 'No notes shared with you' : 'No notes yet. Create one!') + '</p></div>';
        return;
    }
    
    container.innerHTML = notes.map(function(note) {
        var isOwner = note.author_id === currentUser.id;
        var cardClass = 'card note-card' + (note.shared_with.length > 0 || !note.is_private ? ' shared' : '');
        
        var badgeHtml = note.is_private 
            ? '<span class="note-badge private"><i class="fas fa-lock"></i> Private</span>'
            : '<span class="note-badge shared"><i class="fas fa-share"></i> Shared</span>';
        
        var callbackInfo = '';
        if (note.callback_id) {
            var cb = allCallbacks.find(function(c) { return c.id === note.callback_id; });
            if (cb) {
                callbackInfo = '<span><i class="fas fa-phone"></i> Linked to: ' + cb.name + '</span>';
            }
        }
        
        var actions = '';
        if (isOwner || currentUser.role === 'admin') {
            actions = '<div class="card-actions">' +
                '<button class="btn btn-small btn-secondary" onclick="editNote(\'' + note.id + '\')"><i class="fas fa-edit"></i> Edit</button>' +
                '<button class="btn btn-small btn-danger" onclick="deleteNote(\'' + note.id + '\')"><i class="fas fa-trash"></i> Delete</button>' +
                '</div>';
        }
        
        return '<div class="' + cardClass + '">' +
            '<div class="card-header">' +
                '<span class="card-name">' + note.title + '</span>' +
                badgeHtml +
            '</div>' +
            '<div class="card-message">' + note.content.replace(/\n/g, '<br>') + '</div>' +
            '<div class="note-meta">' +
                '<span><i class="fas fa-user"></i> ' + note.author_name + '</span>' +
                '<span><i class="fas fa-clock"></i> ' + new Date(note.created_at).toLocaleString() + '</span>' +
                callbackInfo +
            '</div>' +
            actions +
        '</div>';
    }).join('');
}

// Switch Notes Tab
function switchNotesTab(tab) {
    currentNotesTab = tab;
    document.querySelectorAll('.notes-tab').forEach(function(t) {
        t.classList.remove('active');
    });
    document.querySelector('.notes-tab[data-tab="' + tab + '"]').classList.add('active');
    loadNotes();
}

// Load Staff Users for sharing dropdown
async function loadStaffUsers() {
    try {
        staffUsers = await apiCall('/staff-users');
    } catch (error) {
        console.error('Error loading staff users:', error);
    }
}

// Open Note Modal
function openNoteModal(noteId) {
    editingNoteId = noteId || null;
    
    // Populate callbacks dropdown
    var callbackSelect = document.getElementById('note-callback');
    callbackSelect.innerHTML = '<option value="">None</option>' + 
        allCallbacks.map(function(cb) {
            return '<option value="' + cb.id + '">' + cb.name + ' - ' + cb.phone + '</option>';
        }).join('');
    
    // Populate share dropdown (exclude current user)
    var shareSelect = document.getElementById('note-share');
    shareSelect.innerHTML = staffUsers
        .filter(function(u) { return u.id !== currentUser.id; })
        .map(function(u) {
            return '<option value="' + u.id + '">' + u.name + ' (' + u.role + ')</option>';
        }).join('');
    
    if (noteId) {
        // Edit mode - fetch note and populate form
        document.getElementById('note-modal-title').innerHTML = '<i class="fas fa-edit"></i> Edit Note';
        apiCall('/notes/' + noteId).then(function(note) {
            document.getElementById('note-title').value = note.title;
            document.getElementById('note-content').value = note.content;
            document.getElementById('note-callback').value = note.callback_id || '';
            document.getElementById('note-private').checked = note.is_private;
            toggleShareGroup();
            
            // Select shared users
            if (note.shared_with && note.shared_with.length > 0) {
                var options = shareSelect.options;
                for (var i = 0; i < options.length; i++) {
                    if (note.shared_with.includes(options[i].value)) {
                        options[i].selected = true;
                    }
                }
            }
        });
    } else {
        // Create mode - clear form
        document.getElementById('note-modal-title').innerHTML = '<i class="fas fa-sticky-note"></i> New Note';
        document.getElementById('note-title').value = '';
        document.getElementById('note-content').value = '';
        document.getElementById('note-callback').value = '';
        document.getElementById('note-private').checked = true;
        toggleShareGroup();
    }
    
    document.getElementById('note-modal').classList.remove('hidden');
}

// Close Note Modal
function closeNoteModal() {
    document.getElementById('note-modal').classList.add('hidden');
    editingNoteId = null;
}

// Toggle Share Group visibility
function toggleShareGroup() {
    var isPrivate = document.getElementById('note-private').checked;
    document.getElementById('share-group').style.display = isPrivate ? 'none' : 'block';
}

// Save Note
async function saveNote() {
    var title = document.getElementById('note-title').value.trim();
    var content = document.getElementById('note-content').value.trim();
    var callbackId = document.getElementById('note-callback').value || null;
    var isPrivate = document.getElementById('note-private').checked;
    
    // Get selected users to share with
    var sharedWith = [];
    if (!isPrivate) {
        var shareSelect = document.getElementById('note-share');
        for (var i = 0; i < shareSelect.options.length; i++) {
            if (shareSelect.options[i].selected) {
                sharedWith.push(shareSelect.options[i].value);
            }
        }
    }
    
    if (!title || !content) {
        showNotification('Please enter title and content', 'error');
        return;
    }
    
    try {
        if (editingNoteId) {
            // Update existing note
            await apiCall('/notes/' + editingNoteId, {
                method: 'PATCH',
                body: JSON.stringify({
                    title: title,
                    content: content,
                    is_private: isPrivate,
                    shared_with: sharedWith
                })
            });
            showNotification('Note updated');
        } else {
            // Create new note
            await apiCall('/notes', {
                method: 'POST',
                body: JSON.stringify({
                    title: title,
                    content: content,
                    callback_id: callbackId,
                    is_private: isPrivate,
                    shared_with: sharedWith
                })
            });
            showNotification('Note created');
        }
        
        closeNoteModal();
        loadNotes();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Edit Note
function editNote(noteId) {
    openNoteModal(noteId);
}

// Delete Note
async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
        await apiCall('/notes/' + noteId, { method: 'DELETE' });
        showNotification('Note deleted');
        loadNotes();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Setup private checkbox listener
document.addEventListener('DOMContentLoaded', function() {
    var privateCheckbox = document.getElementById('note-private');
    if (privateCheckbox) {
        privateCheckbox.addEventListener('change', toggleShareGroup);
    }
});


// ============ AVAILABILITY/CALENDAR FUNCTIONALITY ============

var currentCalendarMonth = new Date();
var selectedCalendarDate = null;
var calendarShifts = [];
var editingShiftId = null;

// Load shifts for current month
async function loadShifts() {
    try {
        var year = currentCalendarMonth.getFullYear();
        var month = currentCalendarMonth.getMonth();
        var startDate = new Date(year, month, 1).toISOString().split('T')[0];
        var endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
        
        var shifts = await apiCall('/shifts?date_from=' + startDate + '&date_to=' + endDate);
        calendarShifts = Array.isArray(shifts) ? shifts : [];
        renderCalendar();
    } catch (error) {
        console.error('Error loading shifts:', error);
        calendarShifts = [];
        renderCalendar();
    }
}

// Render calendar
function renderCalendar() {
    var year = currentCalendarMonth.getFullYear();
    var month = currentCalendarMonth.getMonth();
    
    // Update month display
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('current-month-display').textContent = monthNames[month] + ' ' + year;
    
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate start padding (Monday = 0)
    var startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    
    var calendarDays = document.getElementById('calendar-days');
    calendarDays.innerHTML = '';
    
    // Add padding days from previous month
    for (var i = startPadding; i > 0; i--) {
        var date = new Date(year, month, 1 - i);
        addDayCell(calendarDays, date, false, today);
    }
    
    // Add days of current month
    for (var day = 1; day <= lastDay.getDate(); day++) {
        var date = new Date(year, month, day);
        addDayCell(calendarDays, date, true, today);
    }
    
    // Add padding to complete 6 rows (42 days)
    var totalCells = calendarDays.children.length;
    var endPadding = 42 - totalCells;
    for (var i = 1; i <= endPadding; i++) {
        var date = new Date(year, month + 1, i);
        addDayCell(calendarDays, date, false, today);
    }
}

// Add a day cell to the calendar
function addDayCell(container, date, isCurrentMonth, today) {
    var dateString = date.toISOString().split('T')[0];
    var isToday = date.getTime() === today.getTime();
    var isSelected = dateString === selectedCalendarDate;
    
    // Find shifts for this day
    var dayShifts = calendarShifts.filter(function(s) { return s.date === dateString; });
    var hasMyShift = dayShifts.some(function(s) { return s.staff_id === currentUser.id; });
    var hasOtherShifts = dayShifts.some(function(s) { return s.staff_id !== currentUser.id; });
    
    var cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (!isCurrentMonth) cell.className += ' outside';
    if (isToday) cell.className += ' today';
    if (isSelected) cell.className += ' selected';
    
    cell.innerHTML = '<span class="day-number">' + date.getDate() + '</span>' +
        ((hasMyShift || hasOtherShifts) ? 
            '<div class="shift-indicators">' +
                (hasMyShift ? '<span class="shift-dot my-shift"></span>' : '') +
                (hasOtherShifts ? '<span class="shift-dot other-shift"></span>' : '') +
            '</div>' : '');
    
    if (isCurrentMonth) {
        cell.onclick = function() {
            selectCalendarDate(dateString);
        };
    }
    
    container.appendChild(cell);
}

// Select a date
function selectCalendarDate(dateString) {
    selectedCalendarDate = dateString;
    renderCalendar();
    showSelectedDayShifts(dateString);
}

// Show shifts for selected day
function showSelectedDayShifts(dateString) {
    var panel = document.getElementById('selected-day-panel');
    var titleEl = document.getElementById('selected-day-title');
    var shiftsContainer = document.getElementById('selected-day-shifts');
    
    panel.style.display = 'block';
    
    var date = new Date(dateString);
    titleEl.textContent = date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
    });
    
    var dayShifts = calendarShifts.filter(function(s) { return s.date === dateString; });
    
    if (dayShifts.length === 0) {
        shiftsContainer.innerHTML = '<div class="empty-shifts"><i class="fas fa-calendar-times"></i> No shifts scheduled for this day</div>' +
            '<button class="btn btn-primary btn-block" onclick="openShiftModalForDate(\'' + dateString + '\')" style="margin-top: 12px;">' +
                '<i class="fas fa-plus"></i> Add Your Availability' +
            '</button>';
        return;
    }
    
    shiftsContainer.innerHTML = dayShifts.map(function(shift) {
        var isMyShift = shift.staff_id === currentUser.id;
        var name = isMyShift ? 'You' : (shift.staff_name || 'Staff');
        
        var actionsHtml = '';
        if (isMyShift) {
            actionsHtml = '<div class="shift-card-actions">' +
                '<button class="btn btn-small btn-danger" onclick="deleteShift(\'' + shift.id + '\')">' +
                    '<i class="fas fa-trash"></i>' +
                '</button>' +
            '</div>';
        }
        
        return '<div class="shift-card-item' + (isMyShift ? '' : ' other') + '">' +
            '<div class="shift-card-info">' +
                '<span class="shift-card-name"><i class="fas fa-user"></i> ' + name + '</span>' +
                '<span class="shift-card-time"><i class="fas fa-clock"></i> ' + shift.start_time + ' - ' + shift.end_time + '</span>' +
            '</div>' +
            actionsHtml +
        '</div>';
    }).join('') +
    '<button class="btn btn-primary btn-block" onclick="openShiftModalForDate(\'' + dateString + '\')" style="margin-top: 12px;">' +
        '<i class="fas fa-plus"></i> Add Your Availability' +
    '</button>';
}

// Navigate to previous month
function prevMonth() {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1);
    selectedCalendarDate = null;
    document.getElementById('selected-day-panel').style.display = 'none';
    loadShifts();
}

// Navigate to next month
function nextMonth() {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1);
    selectedCalendarDate = null;
    document.getElementById('selected-day-panel').style.display = 'none';
    loadShifts();
}

// Open shift modal
function openShiftModal() {
    editingShiftId = null;
    document.getElementById('shift-modal-title').innerHTML = '<i class="fas fa-calendar-plus"></i> Add Shift';
    
    // Default to today or selected date
    var defaultDate = selectedCalendarDate || new Date().toISOString().split('T')[0];
    document.getElementById('shift-date').value = defaultDate;
    document.getElementById('shift-start').value = '09:00';
    document.getElementById('shift-end').value = '17:00';
    
    document.getElementById('shift-modal').classList.remove('hidden');
}

// Open shift modal for specific date
function openShiftModalForDate(dateString) {
    editingShiftId = null;
    document.getElementById('shift-modal-title').innerHTML = '<i class="fas fa-calendar-plus"></i> Add Shift';
    document.getElementById('shift-date').value = dateString;
    document.getElementById('shift-start').value = '09:00';
    document.getElementById('shift-end').value = '17:00';
    document.getElementById('shift-modal').classList.remove('hidden');
}

// Close shift modal
function closeShiftModal() {
    document.getElementById('shift-modal').classList.add('hidden');
    editingShiftId = null;
}

// Save shift
async function saveShift() {
    var date = document.getElementById('shift-date').value;
    var startTime = document.getElementById('shift-start').value;
    var endTime = document.getElementById('shift-end').value;
    
    if (!date || !startTime || !endTime) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        // Build query params with user info
        var params = new URLSearchParams();
        params.append('user_id', currentUser.id);
        params.append('user_name', currentUser.name || '');
        params.append('user_email', currentUser.email || '');
        
        var response = await apiCall('/shifts/?' + params.toString(), {
            method: 'POST',
            body: JSON.stringify({
                date: date,
                start_time: startTime,
                end_time: endTime
            })
        });
        
        showNotification('Shift added successfully');
        closeShiftModal();
        
        // Refresh calendar if the date is in current view
        var shiftDate = new Date(date);
        if (shiftDate.getMonth() === currentCalendarMonth.getMonth() && 
            shiftDate.getFullYear() === currentCalendarMonth.getFullYear()) {
            loadShifts();
            if (selectedCalendarDate === date) {
                // Re-show the selected day with updated shifts
                setTimeout(function() {
                    showSelectedDayShifts(date);
                }, 300);
            }
        }
    } catch (error) {
        showNotification('Failed to add shift: ' + error.message, 'error');
    }
}

// Delete shift
async function deleteShift(shiftId) {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    
    try {
        await apiCall('/shifts/' + shiftId, { method: 'DELETE' });
        showNotification('Shift deleted');
        loadShifts();
        if (selectedCalendarDate) {
            setTimeout(function() {
                showSelectedDayShifts(selectedCalendarDate);
            }, 300);
        }
    } catch (error) {
        showNotification('Failed to delete shift: ' + error.message, 'error');
    }
}

// Initialize calendar when portal loads (hook into initPortal)
var originalInitPortal = initPortal;
initPortal = async function() {
    await originalInitPortal();
    // Load shifts after other data
    loadShifts();
    // Initialize supervisor tab visibility
    initSupervisorTab();
};

// Load swap/cover requests (placeholder for future implementation)
async function loadSwapRequests() {
    var container = document.getElementById('available-swaps');
    if (!container) return;
    
    try {
        // For now, display a message that this feature is coming soon
        // TODO: Implement swap requests API
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No cover requests at this time</p>';
        document.getElementById('swap-count').textContent = '0';
    } catch (error) {
        console.error('Error loading swap requests:', error);
    }
}

// ===========================================
// Team On Duty Functions
// ===========================================

let teamCache = {
    shifts: [],
    staff: [],
    currentTab: 'today'
};

async function loadTeamOnDuty() {
    const container = document.getElementById('team-on-duty');
    container.innerHTML = '<p class="loading-text">Loading team...</p>';
    
    try {
        // Load shifts and staff using the standard apiCall function
        const [shifts, counsellors, peers] = await Promise.all([
            apiCall('/shifts'),
            apiCall('/counsellors'),
            apiCall('/peer-supporters')
        ]);
        
        // Combine staff
        teamCache.staff = [
            ...counsellors.map(c => ({ ...c, role: 'counsellor' })),
            ...peers.map(p => ({ ...p, role: 'peer' }))
        ];
        teamCache.shifts = shifts || [];
        
        renderTeamOnDuty(teamCache.currentTab);
        
    } catch (error) {
        console.error('Error loading team:', error);
        container.innerHTML = '<p class="no-team-text">Failed to load team data</p>';
    }
}

function switchTeamTab(tab) {
    teamCache.currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.team-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    renderTeamOnDuty(tab);
}

function renderTeamOnDuty(tab) {
    const container = document.getElementById('team-on-duty');
    const currentUserId = getCurrentUserId();
    
    // Get date based on tab
    const targetDate = new Date();
    if (tab === 'tomorrow') {
        targetDate.setDate(targetDate.getDate() + 1);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    
    // Filter shifts for the target date
    const dayShifts = teamCache.shifts.filter(s => s.date === dateStr);
    
    if (dayShifts.length === 0) {
        container.innerHTML = `<p class="no-team-text"><i class="fas fa-calendar-times"></i> No shifts scheduled for ${tab === 'today' ? 'today' : 'tomorrow'}</p>`;
        return;
    }
    
    // Render team members
    container.innerHTML = dayShifts.map(shift => {
        const staff = teamCache.staff.find(s => s.id === shift.user_id);
        const name = staff?.name || shift.user_name || 'Unknown';
        const role = staff?.role || 'staff';
        const isMe = shift.user_id === currentUserId;
        const initials = getInitials(name);
        
        return `
            <div class="team-member ${role} ${isMe ? 'is-me' : ''}">
                <div class="team-avatar ${role}">${initials}</div>
                <div class="team-info">
                    <div class="team-name">${escapeHtml(name)}${isMe ? ' (You)' : ''}</div>
                    <div class="team-role">${role === 'counsellor' ? 'Counsellor' : 'Peer Supporter'}</div>
                </div>
                <div class="team-time">
                    <i class="fas fa-clock"></i>
                    ${shift.start_time} - ${shift.end_time}
                </div>
            </div>
        `;
    }).join('');
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function getCurrentUserId() {
    // Get from stored user data
    const userData = JSON.parse(localStorage.getItem('staff_user') || '{}');
    return userData.id || null;
}

// Load team data on portal load
document.addEventListener('DOMContentLoaded', function() {
    // Wait for authentication before loading
    setTimeout(() => {
        if (document.getElementById('portal-screen').classList.contains('active') || 
            !document.getElementById('login-screen').classList.contains('active')) {
            loadTeamOnDuty();
        }
    }, 1500);
});



// ===========================================
// CASE MANAGEMENT FUNCTIONS
// ===========================================

var allCases = [];

// Load all cases for the current counsellor
async function loadCases() {
    var container = document.getElementById('cases-list');
    if (!container) return;
    
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading cases...</p>';
    
    try {
        var statusFilter = document.getElementById('case-status-filter');
        var riskFilter = document.getElementById('case-risk-filter');
        
        var params = new URLSearchParams();
        if (statusFilter && statusFilter.value) params.append('status', statusFilter.value);
        if (riskFilter && riskFilter.value) params.append('risk_level', riskFilter.value);
        
        var queryString = params.toString() ? '?' + params.toString() : '';
        var cases = await apiCall('/cases' + queryString);
        allCases = cases || [];
        
        // Update badge
        var badge = document.getElementById('cases-badge');
        var activeCases = allCases.filter(function(c) { return c.status === 'active'; });
        if (badge) {
            badge.textContent = activeCases.length;
            badge.classList.toggle('hidden', activeCases.length === 0);
        }
        
        // Update count
        var countEl = document.getElementById('my-cases-count');
        if (countEl) countEl.textContent = allCases.length;
        
        renderCases(allCases, container);
        
        // Also load morning review queue
        loadMorningReviewQueue();
        
    } catch (error) {
        console.error('Error loading cases:', error);
        container.innerHTML = '<p style="color: var(--danger); text-align: center; padding: 40px;"><i class="fas fa-exclamation-circle"></i> Failed to load cases. Please try again.</p>';
    }
}

// Render cases list
function renderCases(cases, container) {
    if (!cases || cases.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;"><i class="fas fa-folder-open"></i> No cases found</p>';
        return;
    }
    
    var html = cases.map(function(c) {
        var riskClass = 'risk-' + (c.current_risk_level || 'moderate').toLowerCase();
        var statusDisplay = (c.status || 'active').replace('_', ' ');
        var sessionCount = c.sessions ? c.sessions.length : 0;
        var lastSession = sessionCount > 0 ? c.sessions[sessionCount - 1] : null;
        
        return '<div class="case-card ' + riskClass + '">' +
            '<div class="case-header">' +
                '<div class="case-title"><i class="fas fa-user-shield"></i> Case: ' + escapeHtml(c.user_name || 'Unknown') + '</div>' +
                '<span class="session-count">' + sessionCount + ' session(s)</span>' +
            '</div>' +
            '<div class="case-meta">' +
                '<span class="case-tag status">' + escapeHtml(statusDisplay) + '</span>' +
                '<span class="case-tag ' + riskClass + '">' + escapeHtml(c.current_risk_level || 'moderate') + ' risk</span>' +
                (c.has_safety_plan ? '<span class="case-tag" style="background: rgba(34,197,94,0.1); color: #16a34a;"><i class="fas fa-shield-alt"></i> Safety Plan</span>' : '') +
            '</div>' +
            (lastSession ? '<p style="color: var(--text-muted); font-size: 14px; margin: 8px 0;">Last: ' + escapeHtml(lastSession.presenting_issue || 'No notes').substring(0, 100) + '...</p>' : '') +
            '<div class="case-actions">' +
                '<button class="btn btn-small btn-primary" onclick="openCaseDetail(\'' + c.id + '\')"><i class="fas fa-eye"></i> View</button>' +
                '<button class="btn btn-small btn-secondary" onclick="addSessionNote(\'' + c.id + '\')"><i class="fas fa-plus"></i> Add Note</button>' +
                (c.status === 'active' ? '<button class="btn btn-small btn-warning" onclick="escalateCase(\'' + c.id + '\')"><i class="fas fa-arrow-up"></i> Escalate</button>' : '') +
            '</div>' +
        '</div>';
    }).join('');
    
    container.innerHTML = html;
}

// Load morning review queue (overnight alerts needing triage)
async function loadMorningReviewQueue() {
    var container = document.getElementById('morning-review-list');
    if (!container) return;
    
    try {
        var response = await apiCall('/cases/morning-queue');
        // Handle both array and object responses
        var queue = Array.isArray(response) ? response : (response.queue || response.items || []);
        var queueBadge = document.getElementById('review-queue-count');
        
        if (queueBadge) {
            queueBadge.textContent = queue.length || 0;
        }
        
        if (!queue || queue.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;"><i class="fas fa-check-circle"></i> No items in review queue</p>';
            return;
        }
        
        var html = queue.map(function(item) {
            return '<div class="alert-card" style="background: var(--card); padding: 16px; border-radius: 12px; margin-bottom: 12px; border-left: 4px solid var(--warning);">' +
                '<div style="display: flex; justify-content: space-between; align-items: start;">' +
                    '<div>' +
                        '<strong>' + escapeHtml(item.user_name || 'Unknown User') + '</strong>' +
                        '<p style="color: var(--text-muted); font-size: 13px; margin: 4px 0;">' + escapeHtml(item.details || item.presenting_issue || 'No details') + '</p>' +
                        '<span style="font-size: 12px; color: var(--text-muted);">' + formatTimeAgo(item.created_at) + '</span>' +
                    '</div>' +
                    '<div>' +
                        '<button class="btn btn-small btn-primary" onclick="createCaseFromAlert(\'' + item.id + '\')"><i class="fas fa-folder-plus"></i> Create Case</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading morning review queue:', error);
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Could not load review queue</p>';
    }
}

// Create a case from a safeguarding alert
async function createCaseFromAlert(alertId) {
    if (!confirm('Create a new case from this alert? This will assign the case to you.')) return;
    
    try {
        var result = await apiCall('/cases', 'POST', {
            safeguarding_alert_id: alertId,
            initial_notes: 'Case created from safeguarding alert'
        });
        
        showNotification('Case created successfully', 'success');
        loadCases();
        loadMorningReviewQueue();
        loadSafeguardingAlerts();
        
        // Open the new case
        if (result && result.id) {
            openCaseDetail(result.id);
        }
        
    } catch (error) {
        console.error('Error creating case:', error);
        showNotification('Failed to create case: ' + error.message, 'error');
    }
}

// Open case detail view
async function openCaseDetail(caseId) {
    // Clear modal stack when opening a case fresh
    modalStack = [];
    
    try {
        var caseData = await apiCall('/cases/' + caseId);
        
        // Create modal content
        var sessionsHtml = '';
        if (caseData.sessions && caseData.sessions.length > 0) {
            sessionsHtml = '<h4 style="margin: 16px 0 8px; color: #374151;">Session History</h4>';
            sessionsHtml += caseData.sessions.map(function(s, idx) {
                return '<div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 8px;">' +
                    '<div style="display: flex; justify-content: space-between;">' +
                        '<strong style="color: #1f2937;">Session ' + (idx + 1) + '</strong>' +
                        '<span style="font-size: 12px; color: #6b7280;">' + formatDate(s.session_date) + '</span>' +
                    '</div>' +
                    '<p style="margin: 8px 0; font-size: 14px; color: #374151;">' + escapeHtml(s.presenting_issue || 'No notes') + '</p>' +
                    '<span class="case-tag risk-' + (s.risk_level || 'moderate').toLowerCase() + '">' + (s.risk_level || 'moderate') + ' risk</span>' +
                '</div>';
            }).join('');
        }
        
        var safetyPlanHtml = '';
        if (caseData.safety_plan) {
            safetyPlanHtml = '<h4 style="margin: 16px 0 8px; color: #374151;"><i class="fas fa-shield-alt"></i> Safety Plan</h4>' +
                '<div style="background: rgba(34,197,94,0.1); padding: 12px; border-radius: 8px;">' +
                    '<p style="margin: 0; font-size: 14px; color: #16a34a;">Safety plan on file - Last updated: ' + formatDate(caseData.safety_plan.updated_at) + '</p>' +
                '</div>';
        }
        
        // Build action buttons based on role
        var actionButtons = '';
        var userRole = currentUser ? currentUser.role : '';
        
        // Common buttons for all staff
        actionButtons += '<button class="btn btn-primary" onclick="addSessionNote(\'' + caseId + '\')" style="background: #2563eb; color: white; padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-plus"></i> Add Session Note</button>';
        
        // Peers get an "Escalate to Counsellor" button prominently
        if (userRole === 'peer') {
            actionButtons += '<button class="btn btn-danger" onclick="escalateToCounsellor(\'' + caseId + '\')" style="background: #dc2626; color: white; padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-arrow-up"></i> Escalate to Counsellor</button>';
        }
        
        // Safety plan and referral buttons (available to all)
        actionButtons += '<button class="btn btn-secondary" onclick="editSafetyPlan(\'' + caseId + '\')" style="background: #6b7280; color: white; padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-shield-alt"></i> ' + (caseData.safety_plan ? 'Edit' : 'Create') + ' Safety Plan</button>';
        
        // Counsellors and above can create referrals and share cases
        if (userRole !== 'peer') {
            actionButtons += '<button class="btn btn-warning" onclick="createReferral(\'' + caseId + '\')" style="background: #f59e0b; color: white; padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-hospital"></i> Create Referral</button>';
        }
        
        actionButtons += '<button class="btn btn-outline" onclick="closeModal()" style="background: #f3f4f6; color: #374151; padding: 10px 16px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;"><i class="fas fa-times"></i> Close</button>';
        
        var content = '<div style="padding: 20px; background: #ffffff;">' +
            '<h3 style="color: #1f2937; margin-bottom: 16px;"><i class="fas fa-user-shield"></i> Case: ' + escapeHtml(caseData.user_name || 'Unknown') + '</h3>' +
            '<div class="case-meta" style="margin: 16px 0; display: flex; gap: 8px; flex-wrap: wrap;">' +
                '<span style="padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; background: #dbeafe; color: #1d4ed8;">' + escapeHtml(caseData.status || 'active') + '</span>' +
                '<span class="case-tag risk-' + (caseData.current_risk_level || 'moderate').toLowerCase() + '">' + escapeHtml(caseData.current_risk_level || 'moderate') + ' risk</span>' +
                '<span style="padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; background: #f3f4f6; color: #374151;">Sessions: ' + (caseData.session_count || 0) + '/6</span>' +
            '</div>' +
            safetyPlanHtml +
            sessionsHtml +
            '<div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">' +
                actionButtons +
            '</div>' +
        '</div>';
        
        openGenericModal('Case Details', content);
        
    } catch (error) {
        console.error('Error loading case:', error);
        showNotification('Failed to load case details: ' + error.message, 'error');
    }
}

// Add a session note to a case
async function addSessionNote(caseId) {
    var content = '<div style="padding: 20px; background: #ffffff;">' +
        '<form id="session-note-form" onsubmit="return submitSessionNote(event, \'' + caseId + '\')">' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Presenting Issue / Notes</label>' +
                '<textarea id="session-presenting-issue" rows="4" required placeholder="Describe the main issues discussed..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;"></textarea>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Risk Level</label>' +
                '<select id="session-risk-level" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">' +
                    '<option value="low">Low</option>' +
                    '<option value="moderate" selected>Moderate</option>' +
                    '<option value="high">High</option>' +
                    '<option value="critical">Critical</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Outcome</label>' +
                '<select id="session-outcome" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">' +
                    '<option value="continue_monitoring">Continue Monitoring</option>' +
                    '<option value="escalate_to_nhs">Escalate to NHS</option>' +
                    '<option value="refer_to_service">Refer to External Service</option>' +
                    '<option value="close_case">Close Case</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Next Steps (optional)</label>' +
                '<textarea id="session-next-steps" rows="2" placeholder="What should happen next..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;"></textarea>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 20px;">' +
                '<button type="submit" class="btn btn-primary" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-save"></i> Save Session</button>' +
                '<button type="button" class="btn btn-outline" onclick="goBackToCase(\'' + caseId + '\')" style="background: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;"><i class="fas fa-arrow-left"></i> Back to Case</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    openGenericModal('Add Session Note', content, { isSubModal: true });
}

// Submit session note
async function submitSessionNote(event, caseId) {
    event.preventDefault();
    
    var data = {
        presenting_issue: document.getElementById('session-presenting-issue').value,
        risk_level: document.getElementById('session-risk-level').value,
        outcome: document.getElementById('session-outcome').value,
        next_steps: document.getElementById('session-next-steps').value || null
    };
    
    try {
        await apiCall('/cases/' + caseId + '/sessions', 'POST', data);
        showNotification('Session note added successfully', 'success');
        // Go back to case details to see the updated session
        goBackToCase(caseId);
        loadCases();
    } catch (error) {
        console.error('Error adding session:', error);
        showNotification('Failed to add session: ' + error.message, 'error');
    }
    
    return false;
}

// Escalate a case
async function escalateCase(caseId) {
    if (!confirm('Escalate this case? This will flag it as critical and notify senior staff.')) return;
    
    try {
        await apiCall('/cases/' + caseId + '/sessions', 'POST', {
            presenting_issue: 'Case escalated by counsellor',
            risk_level: 'critical',
            outcome: 'escalate_to_nhs',
            next_steps: 'Requires immediate senior review'
        });
        
        showNotification('Case escalated successfully', 'success');
        loadCases();
    } catch (error) {
        console.error('Error escalating case:', error);
        showNotification('Failed to escalate case: ' + error.message, 'error');
    }
}

// Escalate case to a counsellor (for peer supporters)
async function escalateToCounsellor(caseId) {
    try {
        // Get list of counsellors
        var staff = await apiCall('/users/staff');
        var counsellors = staff.filter(function(s) {
            return s.role === 'counsellor' || s.role === 'supervisor';
        });
        
        if (counsellors.length === 0) {
            showNotification('No counsellors available. Please contact an admin.', 'error');
            return;
        }
        
        // Build counsellor selection
        var counsellorOptions = counsellors.map(function(c) {
            return '<option value="' + c.id + '">' + escapeHtml(c.name) + ' (' + c.role + ')</option>';
        }).join('');
        
        var content = '<div style="padding: 20px; background: #ffffff;">' +
            '<form id="escalate-form" onsubmit="return submitEscalateToCounsellor(event, \'' + caseId + '\')">' +
                '<p style="color: #6b7280; margin-bottom: 16px;">Select a counsellor to escalate this case to. They will receive access to the case and a notification.</p>' +
                '<div class="form-group" style="margin-bottom: 16px;">' +
                    '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Select Counsellor</label>' +
                    '<select id="escalate-counsellor" required style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">' +
                        '<option value="">-- Select a counsellor --</option>' +
                        counsellorOptions +
                    '</select>' +
                '</div>' +
                '<div class="form-group" style="margin-bottom: 16px;">' +
                    '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Reason for Escalation</label>' +
                    '<select id="escalate-reason" required style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">' +
                        '<option value="">-- Select reason --</option>' +
                        '<option value="high_risk">High Risk - Requires clinical assessment</option>' +
                        '<option value="complex_needs">Complex needs beyond peer support</option>' +
                        '<option value="safeguarding">Safeguarding concern</option>' +
                        '<option value="session_limit">Approaching session limit</option>' +
                        '<option value="other">Other (please specify)</option>' +
                    '</select>' +
                '</div>' +
                '<div class="form-group" style="margin-bottom: 16px;">' +
                    '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Additional Notes</label>' +
                    '<textarea id="escalate-notes" rows="3" placeholder="Any additional information for the counsellor..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;"></textarea>' +
                '</div>' +
                '<div style="display: flex; gap: 12px; margin-top: 20px;">' +
                    '<button type="submit" class="btn btn-danger" style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-arrow-up"></i> Escalate Case</button>' +
                    '<button type="button" class="btn btn-outline" onclick="goBackToCase(\'' + caseId + '\')" style="background: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;"><i class="fas fa-arrow-left"></i> Cancel</button>' +
                '</div>' +
            '</form>' +
        '</div>';
        
        openGenericModal('Escalate to Counsellor', content, { isSubModal: true });
        
    } catch (error) {
        console.error('Error loading counsellors:', error);
        showNotification('Failed to load counsellors: ' + error.message, 'error');
    }
}

// Submit escalation to counsellor
async function submitEscalateToCounsellor(event, caseId) {
    event.preventDefault();
    
    var counsellorId = document.getElementById('escalate-counsellor').value;
    var reason = document.getElementById('escalate-reason').value;
    var notes = document.getElementById('escalate-notes').value;
    
    try {
        // Share the case with the counsellor
        await apiCall('/cases/' + caseId + '/share', 'POST', {
            counsellor_id: counsellorId
        });
        
        // Add a session note about the escalation
        await apiCall('/cases/' + caseId + '/sessions', 'POST', {
            presenting_issue: 'Case escalated to counsellor. Reason: ' + reason + (notes ? '. Notes: ' + notes : ''),
            risk_level: reason === 'high_risk' ? 'high' : 'moderate',
            outcome: 'escalate_to_nhs',
            next_steps: 'Counsellor review required'
        });
        
        showNotification('Case escalated successfully. The counsellor has been notified.', 'success');
        closeModal();
        loadCases();
        
    } catch (error) {
        console.error('Error escalating case:', error);
        showNotification('Failed to escalate case: ' + error.message, 'error');
    }
    
    return false;
}

// Edit/create safety plan
async function editSafetyPlan(caseId) {
    var content = '<div style="padding: 20px; background: #ffffff;">' +
        '<form id="safety-plan-form" onsubmit="return submitSafetyPlan(event, \'' + caseId + '\')">' +
            '<p style="color: #6b7280; margin-bottom: 16px;">Create or update the safety plan for this case.</p>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Warning Signs (one per line)</label>' +
                '<textarea id="sp-warning-signs" rows="3" placeholder="What signs indicate crisis?..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;"></textarea>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Coping Strategies (one per line)</label>' +
                '<textarea id="sp-coping" rows="3" placeholder="Internal coping strategies..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;"></textarea>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Reasons for Living (one per line)</label>' +
                '<textarea id="sp-reasons" rows="3" placeholder="What keeps them going..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;"></textarea>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 20px;">' +
                '<button type="submit" class="btn btn-primary" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-save"></i> Save Safety Plan</button>' +
                '<button type="button" class="btn btn-outline" onclick="goBackToCase(\'' + caseId + '\')" style="background: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;"><i class="fas fa-arrow-left"></i> Back to Case</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    openGenericModal('Safety Plan', content, { isSubModal: true });
}

// Submit safety plan
async function submitSafetyPlan(event, caseId) {
    event.preventDefault();
    
    var data = {
        warning_signs: document.getElementById('sp-warning-signs').value.split('\n').filter(function(s) { return s.trim(); }),
        internal_coping: document.getElementById('sp-coping').value.split('\n').filter(function(s) { return s.trim(); }),
        reasons_for_living: document.getElementById('sp-reasons').value.split('\n').filter(function(s) { return s.trim(); })
    };
    
    try {
        await apiCall('/cases/' + caseId + '/safety-plan', 'PUT', data);
        showNotification('Safety plan saved successfully', 'success');
        // Go back to case details to see the updated safety plan
        goBackToCase(caseId);
        loadCases();
    } catch (error) {
        console.error('Error saving safety plan:', error);
        showNotification('Failed to save safety plan: ' + error.message, 'error');
    }
    
    return false;
}

// Create referral
async function createReferral(caseId) {
    var content = '<div style="padding: 20px; background: #ffffff;">' +
        '<form id="referral-form" onsubmit="return submitReferral(event, \'' + caseId + '\')">' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Service Type</label>' +
                '<select id="referral-service-type" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">' +
                    '<option value="nhs_mental_health">NHS Mental Health</option>' +
                    '<option value="crisis_team">Crisis Team</option>' +
                    '<option value="gp">GP</option>' +
                    '<option value="veterans_charity">Veterans Charity</option>' +
                    '<option value="other">Other</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Service Name</label>' +
                '<input type="text" id="referral-service-name" required placeholder="e.g., Local NHS IAPT..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Urgency</label>' +
                '<select id="referral-urgency" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;">' +
                    '<option value="routine">Routine</option>' +
                    '<option value="urgent">Urgent</option>' +
                    '<option value="emergency">Emergency</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom: 16px;">' +
                '<label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Notes</label>' +
                '<textarea id="referral-notes" rows="3" placeholder="Additional information..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;"></textarea>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 20px;">' +
                '<button type="submit" class="btn btn-primary" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;"><i class="fas fa-paper-plane"></i> Create Referral</button>' +
                '<button type="button" class="btn btn-outline" onclick="goBackToCase(\'' + caseId + '\')" style="background: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;"><i class="fas fa-arrow-left"></i> Back to Case</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    openGenericModal('Create Referral', content, { isSubModal: true });
}

// Submit referral
async function submitReferral(event, caseId) {
    event.preventDefault();
    
    var data = {
        service_type: document.getElementById('referral-service-type').value,
        service_name: document.getElementById('referral-service-name').value,
        service_id: document.getElementById('referral-service-type').value,
        urgency: document.getElementById('referral-urgency').value,
        notes: document.getElementById('referral-notes').value || null
    };
    
    try {
        await apiCall('/cases/' + caseId + '/referrals', 'POST', data);
        showNotification('Referral created successfully', 'success');
        // Go back to case details
        goBackToCase(caseId);
        loadCases();
    } catch (error) {
        console.error('Error creating referral:', error);
        showNotification('Failed to create referral: ' + error.message, 'error');
    }
    
    return false;
}

// Generic modal helper - with stacking support
var modalStack = [];

function openGenericModal(title, content, options) {
    options = options || {};
    
    // Check if modal already exists
    var modal = document.getElementById('generic-modal');
    if (!modal) {
        // Create modal
        modal = document.createElement('div');
        modal.id = 'generic-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000;';
        document.body.appendChild(modal);
    }
    
    // Save current state to stack if we're opening a sub-modal
    if (options.isSubModal && modal.innerHTML) {
        modalStack.push({
            title: modal.querySelector('h3') ? modal.querySelector('h3').textContent : '',
            content: modal.innerHTML
        });
    }
    
    modal.innerHTML = '<div class="modal-content" style="background: #ffffff; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">' +
        '<div class="modal-header" style="padding: 20px 20px 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 0;">' +
            '<h3 style="margin: 0; color: #1f2937;">' + title + '</h3>' +
            '<button class="btn btn-icon btn-secondary" onclick="closeModal()" style="border: none; background: #f3f4f6; width: 32px; height: 32px; border-radius: 8px; font-size: 20px; cursor: pointer; color: #6b7280;">&times;</button>' +
        '</div>' +
        content +
    '</div>';
    
    modal.style.display = 'flex';
}

function closeModal() {
    // If there's something in the stack, go back to it
    if (modalStack.length > 0) {
        var previous = modalStack.pop();
        var modal = document.getElementById('generic-modal');
        if (modal) {
            modal.innerHTML = previous.content;
        }
        return;
    }
    
    // Otherwise close completely
    var modal = document.getElementById('generic-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
    // Also try to close any existing modals
    var overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(function(o) { o.style.display = 'none'; });
}

function goBackToCase(caseId) {
    // Clear the stack and re-open case details
    modalStack = [];
    openCaseDetail(caseId);
}

// Helper function
function formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown';
    var date = new Date(dateString);
    var now = new Date();
    var diffMs = now - date;
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return diffMins + ' min ago';
    if (diffHours < 24) return diffHours + ' hours ago';
    return diffDays + ' days ago';
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    var date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}


// ==================== AI RESPONSE FEEDBACK ====================

// Show feedback modal for an AI response
function showFeedbackModal(conversationId, messageId, characterId, userMessage, aiResponse) {
    var modalHtml = `
        <div class="modal-overlay" id="feedback-modal">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Provide Feedback on AI Response</h3>
                    <button class="close-btn" onclick="closeFeedbackModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 15px; padding: 10px; background: #f3f4f6; border-radius: 5px;">
                        <strong>User said:</strong>
                        <p style="margin: 5px 0;">${escapeHtml(userMessage)}</p>
                    </div>
                    <div style="margin-bottom: 15px; padding: 10px; background: #e0f2fe; border-radius: 5px;">
                        <strong>AI responded:</strong>
                        <p style="margin: 5px 0;">${escapeHtml(aiResponse)}</p>
                    </div>
                    <div class="form-group">
                        <label>Feedback Type *</label>
                        <select id="feedback-type">
                            <option value="good">Good Response - Use as example</option>
                            <option value="needs_improvement">Needs Improvement</option>
                            <option value="inappropriate">Inappropriate Response</option>
                            <option value="missed_risk">Missed Safeguarding Risk</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Your Notes</label>
                        <textarea id="feedback-notes" rows="3" placeholder="Explain why this response was good/bad..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Suggested Better Response (optional)</label>
                        <textarea id="suggested-response" rows="3" placeholder="How should the AI have responded?"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeFeedbackModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="submitFeedback('${conversationId}', '${messageId}', '${characterId}', '${escapeHtml(userMessage).replace(/'/g, "\\'")}', '${escapeHtml(aiResponse).replace(/'/g, "\\'")}')">Submit Feedback</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeFeedbackModal() {
    var modal = document.getElementById('feedback-modal');
    if (modal) modal.remove();
}

async function submitFeedback(conversationId, messageId, characterId, userMessage, aiResponse) {
    var feedbackType = document.getElementById('feedback-type').value;
    var staffNotes = document.getElementById('feedback-notes').value.trim();
    var suggestedResponse = document.getElementById('suggested-response').value.trim();
    
    try {
        await apiCall('/learning/feedback?staff_id=' + currentUser.id, {
            method: 'POST',
            body: JSON.stringify({
                conversation_id: conversationId,
                message_id: messageId,
                character_id: characterId,
                user_message: userMessage,
                ai_response: aiResponse,
                feedback_type: feedbackType,
                staff_notes: staffNotes || null,
                suggested_response: suggestedResponse || null
            })
        });
        
        showNotification('Feedback submitted for admin review', 'success');
        closeFeedbackModal();
    } catch (error) {
        console.error('Error submitting feedback:', error);
        showNotification('Failed to submit feedback', 'error');
    }
}

// Submit a conversation snippet as a learning candidate
function submitForLearning(conversationId, characterId, contextSummary, responsePattern, outcome) {
    var modalHtml = `
        <div class="modal-overlay" id="learning-modal">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Submit Conversation for AI Learning</h3>
                    <button class="close-btn" onclick="closeLearningModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="color: #6b7280; margin-bottom: 15px;">
                        This will submit an anonymized version of this conversation for AI learning. 
                        An admin will review and approve before it's used.
                    </p>
                    <div class="form-group">
                        <label>Category *</label>
                        <select id="learning-category">
                            <option value="grief">Grief & Loss</option>
                            <option value="anxiety">Anxiety & Stress</option>
                            <option value="loneliness">Loneliness & Isolation</option>
                            <option value="crisis_deescalation">Crisis De-escalation</option>
                            <option value="ptsd">PTSD & Trauma</option>
                            <option value="relationship">Relationship Issues</option>
                            <option value="transition">Military Transition</option>
                            <option value="substance">Substance Support</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Context Summary * (anonymized)</label>
                        <textarea id="learning-context" rows="3" placeholder="Describe the situation without identifying details...">${contextSummary || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Effective Response Pattern *</label>
                        <textarea id="learning-response" rows="3" placeholder="What approach worked well?">${responsePattern || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Outcome *</label>
                        <select id="learning-outcome">
                            <option value="positive">Positive - User calmed/helped</option>
                            <option value="neutral">Neutral - No significant change</option>
                            <option value="escalated">Escalated - Needed human intervention</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Additional Notes</label>
                        <textarea id="learning-notes" rows="2" placeholder="Any other observations..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeLearningModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="submitLearningCandidate('${conversationId}', '${characterId}')">Submit for Review</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeLearningModal() {
    var modal = document.getElementById('learning-modal');
    if (modal) modal.remove();
}

async function submitLearningCandidate(conversationId, characterId) {
    var category = document.getElementById('learning-category').value;
    var contextSummary = document.getElementById('learning-context').value.trim();
    var responsePattern = document.getElementById('learning-response').value.trim();
    var outcome = document.getElementById('learning-outcome').value;
    var notes = document.getElementById('learning-notes').value.trim();
    
    if (!contextSummary || !responsePattern) {
        showNotification('Please fill in the context and response pattern', 'error');
        return;
    }
    
    try {
        await apiCall('/learning/submit', {
            method: 'POST',
            body: JSON.stringify({
                conversation_id: conversationId,
                character_id: characterId,
                category: category,
                context_summary: contextSummary,
                ai_response_pattern: responsePattern,
                outcome: outcome,
                submitted_by: currentUser.id,
                notes: notes || null
            })
        });
        
        showNotification('Learning submitted for admin approval', 'success');
        closeLearningModal();
    } catch (error) {
        console.error('Error submitting learning:', error);
        showNotification('Failed to submit learning', 'error');
    }
}


// ============ SUPERVISOR FUNCTIONALITY ============

var teamMembers = [];
var escalations = [];
var supervisionNotes = [];
var currentEscalationFilter = 'pending';

// Show/hide supervisor tab based on role
function initSupervisorTab() {
    var role = currentUser ? currentUser.role : null;
    var supervisorTab = document.getElementById('supervisor-tab');
    if (supervisorTab) {
        supervisorTab.style.display = (role === 'supervisor' || role === 'admin') ? 'inline-flex' : 'none';
    }
}

// Load Team Members for supervisor view
async function loadTeamMembers() {
    try {
        teamMembers = await apiCall('/supervision/team');
        renderTeamMembers();
    } catch (error) {
        console.error('Error loading team members:', error);
        var container = document.getElementById('team-members-list');
        if (container) {
            container.innerHTML = '<p style="color: var(--danger); text-align: center; padding: 20px;">Failed to load team: ' + error.message + '</p>';
        }
    }
}

function renderTeamMembers() {
    var container = document.getElementById('team-members-list');
    if (!container) return;
    
    if (!teamMembers || teamMembers.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No team members found</p></div>';
        return;
    }
    
    container.innerHTML = teamMembers.map(function(member) {
        var statusClass = member.status === 'available' ? 'success' : 
                         member.status === 'limited' ? 'warning' : 'secondary';
        var roleIcon = member.role === 'counsellor' ? 'fa-user-md' : 'fa-users';
        var specialization = member.specialization || member.area || '';
        
        return '<div class="card">' +
            '<div class="card-header">' +
                '<span class="card-name"><i class="fas ' + roleIcon + '"></i> ' + member.name + '</span>' +
                '<span class="badge ' + statusClass + '">' + (member.status || 'unknown') + '</span>' +
            '</div>' +
            '<div class="card-meta">' +
                '<span class="badge info">' + member.role + '</span>' +
                (specialization ? '<span style="color: var(--text-muted); margin-left: 8px;">' + specialization + '</span>' : '') +
            '</div>' +
            '<div class="card-actions" style="margin-top: 12px;">' +
                '<button class="btn btn-small btn-primary" onclick="openSupervisionNoteModal(\'' + member.id + '\', \'' + escapeHtml(member.name) + '\')">' +
                    '<i class="fas fa-clipboard"></i> Add Note' +
                '</button>' +
                '<button class="btn btn-small btn-secondary" onclick="viewMemberNotes(\'' + member.id + '\')">' +
                    '<i class="fas fa-history"></i> View History' +
                '</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

// Load Escalations
async function loadEscalations() {
    try {
        var query = currentEscalationFilter ? '?status=' + currentEscalationFilter : '';
        escalations = await apiCall('/escalations' + query);
        renderEscalations();
        
        // Update badge count
        var pendingCount = escalations.filter(function(e) { return e.status === 'pending'; }).length;
        var badge = document.getElementById('escalations-count');
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline' : 'none';
        }
        
        // Also update supervision tab badge
        var supervisionBadge = document.getElementById('supervision-badge');
        if (supervisionBadge) {
            supervisionBadge.textContent = pendingCount;
            supervisionBadge.classList.toggle('hidden', pendingCount === 0);
        }
    } catch (error) {
        console.error('Error loading escalations:', error);
    }
}

function filterEscalations(status) {
    currentEscalationFilter = status;
    
    // Update filter buttons
    document.querySelectorAll('.escalation-tabs .btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    var activeBtn = document.querySelector('.escalation-tabs .btn[data-filter="' + status + '"]');
    if (activeBtn) activeBtn.classList.add('active');
    
    loadEscalations();
}

function renderEscalations() {
    var container = document.getElementById('escalations-list');
    if (!container) return;
    
    if (!escalations || escalations.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No escalations found</p></div>';
        return;
    }
    
    container.innerHTML = escalations.map(function(esc) {
        var priorityClass = esc.priority === 'urgent' ? 'danger' : 
                           esc.priority === 'high' ? 'warning' : 'info';
        var statusClass = esc.status === 'pending' ? 'warning' : 
                         esc.status === 'resolved' ? 'success' : 'info';
        
        var actions = '';
        if (esc.status === 'pending') {
            actions = '<button class="btn btn-small btn-warning" onclick="acknowledgeEscalation(\'' + esc.id + '\')"><i class="fas fa-hand-paper"></i> Acknowledge</button>';
        }
        if (esc.status !== 'resolved') {
            actions += '<button class="btn btn-small btn-success" onclick="resolveEscalation(\'' + esc.id + '\')"><i class="fas fa-check"></i> Resolve</button>';
        }
        
        return '<div class="card">' +
            '<div class="card-header">' +
                '<span class="card-name">' + escapeHtml(esc.subject) + '</span>' +
                '<span class="badge ' + priorityClass + '">' + esc.priority.toUpperCase() + '</span>' +
            '</div>' +
            '<div class="card-meta">' +
                '<span><i class="fas fa-user"></i> From: ' + escapeHtml(esc.staff_name) + ' (' + esc.staff_role + ')</span>' +
                '<span class="badge ' + statusClass + '">' + esc.status + '</span>' +
            '</div>' +
            '<div class="card-message">' + escapeHtml(esc.description) + '</div>' +
            '<div class="card-time"><i class="fas fa-clock"></i> ' + new Date(esc.created_at).toLocaleString() + '</div>' +
            (esc.supervisor_name ? '<div style="color: var(--text-muted); font-size: 13px;"><i class="fas fa-user-check"></i> Handled by: ' + escapeHtml(esc.supervisor_name) + '</div>' : '') +
            (esc.resolution_notes ? '<div style="color: var(--success); font-size: 13px; margin-top: 8px;"><i class="fas fa-sticky-note"></i> Notes: ' + escapeHtml(esc.resolution_notes) + '</div>' : '') +
            '<div class="card-actions" style="margin-top: 12px;">' + actions + '</div>' +
        '</div>';
    }).join('');
}

async function acknowledgeEscalation(id) {
    try {
        await apiCall('/escalations/' + id + '/acknowledge', { method: 'PATCH' });
        showNotification('Escalation acknowledged', 'success');
        loadEscalations();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

async function resolveEscalation(id) {
    var notes = prompt('Resolution notes (optional):');
    try {
        var url = '/escalations/' + id + '/resolve';
        if (notes) url += '?resolution_notes=' + encodeURIComponent(notes);
        await apiCall(url, { method: 'PATCH' });
        showNotification('Escalation resolved', 'success');
        loadEscalations();
    } catch (error) {
        showNotification('Failed: ' + error.message, 'error');
    }
}

// Load Supervision Notes
async function loadSupervisionNotes(staffId) {
    try {
        var query = staffId ? '?staff_id=' + staffId : '';
        supervisionNotes = await apiCall('/supervision/notes' + query);
        renderSupervisionNotes();
    } catch (error) {
        console.error('Error loading supervision notes:', error);
    }
}

function renderSupervisionNotes() {
    var container = document.getElementById('supervision-notes-list');
    if (!container) return;
    
    if (!supervisionNotes || supervisionNotes.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard"></i><p>No supervision notes yet</p></div>';
        return;
    }
    
    container.innerHTML = supervisionNotes.map(function(note) {
        var actionItems = note.action_items && note.action_items.length > 0 ?
            '<div style="margin-top: 8px;"><strong>Actions:</strong> <ul style="margin: 4px 0 0 16px;">' +
            note.action_items.map(function(a) { return '<li>' + escapeHtml(a) + '</li>'; }).join('') +
            '</ul></div>' : '';
        
        return '<div class="card' + (note.is_confidential ? ' confidential' : '') + '">' +
            '<div class="card-header">' +
                '<span class="card-name"><i class="fas fa-user"></i> ' + escapeHtml(note.staff_name) + '</span>' +
                '<span class="badge info">' + note.staff_role + '</span>' +
                (note.is_confidential ? '<span class="badge danger" style="margin-left: 8px;"><i class="fas fa-lock"></i> HR</span>' : '') +
            '</div>' +
            '<div class="card-time"><i class="fas fa-calendar"></i> Session: ' + new Date(note.session_date).toLocaleDateString() + '</div>' +
            (note.wellbeing_notes ? '<div style="margin-top: 8px;"><strong>Wellbeing:</strong> ' + escapeHtml(note.wellbeing_notes) + '</div>' : '') +
            (note.case_notes ? '<div style="margin-top: 8px;"><strong>Cases:</strong> ' + escapeHtml(note.case_notes) + '</div>' : '') +
            actionItems +
            (note.next_session_date ? '<div style="margin-top: 8px; color: var(--primary);"><i class="fas fa-calendar-plus"></i> Next session: ' + note.next_session_date + '</div>' : '') +
            '<div class="card-actions" style="margin-top: 12px;">' +
                '<button class="btn btn-small btn-secondary" onclick="editSupervisionNote(\'' + note.id + '\')"><i class="fas fa-edit"></i> Edit</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

function viewMemberNotes(staffId) {
    loadSupervisionNotes(staffId);
}

// Supervision Note Modal
function openSupervisionNoteModal(staffId, staffName) {
    // Populate staff dropdown
    var staffSelect = document.getElementById('supervision-staff-id');
    if (staffSelect && teamMembers.length > 0) {
        staffSelect.innerHTML = '<option value="">Select staff member...</option>' +
            teamMembers.map(function(m) {
                var selected = m.id === staffId ? 'selected' : '';
                return '<option value="' + m.id + '" ' + selected + '>' + m.name + ' (' + m.role + ')</option>';
            }).join('');
    }
    
    // Clear form
    document.getElementById('supervision-wellbeing').value = '';
    document.getElementById('supervision-cases').value = '';
    document.getElementById('supervision-actions').value = '';
    document.getElementById('supervision-next-date').value = '';
    document.getElementById('supervision-confidential').checked = false;
    
    document.getElementById('supervision-modal').classList.remove('hidden');
}

function closeSupervisionModal() {
    document.getElementById('supervision-modal').classList.add('hidden');
}

async function saveSupervisionNote() {

// ============ ESCALATION FUNCTIONS (For Counsellors/Peers) ============

function openEscalationModal() {
    document.getElementById('escalation-subject').value = '';
    document.getElementById('escalation-description').value = '';
    document.getElementById('escalation-priority').value = 'normal';
    document.getElementById('escalation-case-id').value = '';
    document.getElementById('escalation-modal').classList.remove('hidden');
}

function closeEscalationModal() {
    document.getElementById('escalation-modal').classList.add('hidden');
}

async function submitEscalation() {
    var subject = document.getElementById('escalation-subject').value.trim();
    var description = document.getElementById('escalation-description').value.trim();
    var priority = document.getElementById('escalation-priority').value;
    var caseId = document.getElementById('escalation-case-id').value.trim() || null;
    
    if (!subject || !description) {
        showNotification('Please fill in the subject and description', 'error');
        return;
    }
    
    try {
        await apiCall('/escalations', {
            method: 'POST',
            body: JSON.stringify({
                subject: subject,
                description: description,
                priority: priority,
                related_case_id: caseId
            })
        });
        showNotification('Escalation submitted to supervisors', 'success');
        closeEscalationModal();
    } catch (error) {
        showNotification('Failed to submit escalation: ' + error.message, 'error');
    }
}

    var staffId = document.getElementById('supervision-staff-id').value;
    if (!staffId) {
        showNotification('Please select a staff member', 'error');
        return;
    }
    
    var actionsText = document.getElementById('supervision-actions').value;
    var actionItems = actionsText ? actionsText.split('\n').filter(function(a) { return a.trim(); }) : [];
    
    var noteData = {
        staff_id: staffId,
        wellbeing_notes: document.getElementById('supervision-wellbeing').value || null,
        case_notes: document.getElementById('supervision-cases').value || null,
        action_items: actionItems,
        next_session_date: document.getElementById('supervision-next-date').value || null,
        is_confidential: document.getElementById('supervision-confidential').checked
    };
    
    try {
        await apiCall('/supervision/notes', {
            method: 'POST',
            body: JSON.stringify(noteData)
        });
        showNotification('Supervision note saved', 'success');
        closeSupervisionModal();
        loadSupervisionNotes();
    } catch (error) {
        showNotification('Failed to save note: ' + error.message, 'error');
    }
}

function editSupervisionNote(noteId) {
    // Find the note
    var note = supervisionNotes.find(function(n) { return n.id === noteId; });
    if (!note) return;
    
    // Populate form
    document.getElementById('supervision-staff-id').value = note.staff_id;
    document.getElementById('supervision-wellbeing').value = note.wellbeing_notes || '';
    document.getElementById('supervision-cases').value = note.case_notes || '';
    document.getElementById('supervision-actions').value = (note.action_items || []).join('\n');
    document.getElementById('supervision-next-date').value = note.next_session_date || '';
    document.getElementById('supervision-confidential').checked = note.is_confidential || false;
    
    // Update modal title
    document.getElementById('supervision-modal-title').innerHTML = '<i class="fas fa-edit"></i> Edit Supervision Note';
    
    document.getElementById('supervision-modal').classList.remove('hidden');
}
