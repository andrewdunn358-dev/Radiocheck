// Staff Portal - Radio Check Veterans Support
// For Counsellors and Peer Supporters

// State
let token = localStorage.getItem('staff_token');
let currentUser = JSON.parse(localStorage.getItem('staff_user') || 'null');
let myProfile = null;

// Session timeout - 2 hours of inactivity
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
let inactivityTimer = null;
let lastActivityTime = Date.now();

// Check if session has expired on page load
function checkSessionExpiry() {
    const lastActivity = localStorage.getItem('staff_last_activity');
    const tokenTime = localStorage.getItem('staff_token_time');
    
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
    localStorage.setItem('staff_last_activity', lastActivityTime.toString());
    
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
        
        // Check role - only allow counsellor, peer, or admin
        var role = data.user.role;
        if (!['counsellor', 'peer', 'admin'].includes(role)) {
            throw new Error('Access denied. This portal is for staff only.');
        }
        
        // Save auth - support both 'token' and 'access_token' response formats
        token = data.token || data.access_token;
        currentUser = data.user;
        localStorage.setItem('staff_token', token);
        localStorage.setItem('staff_user', JSON.stringify(currentUser));
        localStorage.setItem('staff_token_time', Date.now().toString());
        localStorage.setItem('staff_last_activity', Date.now().toString());
        
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
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    localStorage.removeItem('staff_last_activity');
    localStorage.removeItem('staff_token_time');
    
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
        role === 'peer' ? 'Peer Support Portal' : 'Staff Portal';
    
    // Set role badge
    var badge = document.getElementById('user-role-badge');
    badge.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    badge.className = 'role-badge role-' + role;
    
    // Show/hide sections based on role
    // Panic ALERTS section - counsellors and admins see alerts FROM peers
    document.getElementById('panic-section').style.display = 
        (role === 'counsellor' || role === 'admin') ? 'block' : 'none';
    // Safeguarding section - ALL staff should see safeguarding alerts
    document.getElementById('safeguarding-section').style.display = 
        (role === 'counsellor' || role === 'admin' || role === 'peer') ? 'block' : 'none';
    // Panic BUTTON - only peers can trigger panic to counsellors
    document.getElementById('panic-button-section').style.display = 
        role === 'peer' ? 'block' : 'none';
    
    // Load profile to get current status
    await loadMyProfile();
    
    // Load staff users for sharing
    await loadStaffUsers();
    
    // Initialize SIP phone if credentials available
    await initializeWebRTCPhone();
    
    // Load data
    loadCallbacks();
    loadNotes();
    
    // All staff (counsellors, peers, and admins) can see live chats and safeguarding
    if (role === 'counsellor' || role === 'admin' || role === 'peer') {
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
    
    // Auto-refresh every 30 seconds for callbacks/notes
    setInterval(function() {
        loadCallbacks();
        loadNotes();
        if (role === 'counsellor' || role === 'admin' || role === 'peer') {
            loadPanicAlerts();
            // Note: Safeguarding and live chats are polled separately with sound support
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
        
        // Initialize WebRTC phone
        var success = WebRTCPhone.init(
            backendUrl,
            currentUser.id,
            currentUser.role === 'counsellor' ? 'counsellor' : 'peer',
            currentUser.name
        );
        
        if (success) {
            console.log('WebRTC Phone initialized for:', currentUser.name);
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
        if (!myProfile) {
            showNotification('Profile not found', 'error');
            return;
        }
        
        var role = currentUser.role;
        var endpoint = role === 'counsellor' 
            ? '/counsellors/' + myProfile.id + '/status'
            : '/peer-supporters/' + myProfile.id + '/status';
        
        await apiCall(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        
        myProfile.status = newStatus;
        updateStatusUI(newStatus);
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
        var actions = isActive 
            ? '<button class="btn btn-success" onclick="completeCallback(\'' + cb.id + '\')"><i class="fas fa-check"></i> Complete</button>' +
              '<button class="btn btn-secondary" onclick="releaseCallback(\'' + cb.id + '\')"><i class="fas fa-undo"></i> Release</button>'
            : '<button class="btn btn-primary" onclick="takeCallback(\'' + cb.id + '\')"><i class="fas fa-hand-paper"></i> Take Callback</button>';
        
        return '<div class="card">' +
            '<div class="card-header">' +
                '<span class="card-name">' + cb.name + '</span>' +
                '<span class="card-status ' + cb.status + '">' + cb.status.replace('_', ' ') + '</span>' +
            '</div>' +
            '<div class="card-phone"><i class="fas fa-phone"></i>' + cb.phone + '</div>' +
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
        if (alert.status === 'active') {
            actions = '<button class="btn btn-warning" onclick="acknowledgeAlert(\'' + alert.id + '\')"><i class="fas fa-hand-paper"></i> Acknowledge</button>';
        }
        actions += '<button class="btn btn-success" onclick="resolveAlert(\'' + alert.id + '\')"><i class="fas fa-check"></i> Resolve</button>';
        
        return '<div class="card alert-card">' +
            '<div class="card-header">' +
                '<span class="card-name">' + (alert.user_name || 'Peer Supporter') + '</span>' +
                '<span class="card-status ' + alert.status + '">' + alert.status + '</span>' +
            '</div>' +
            (alert.user_phone ? '<div class="card-phone"><i class="fas fa-phone"></i>' + alert.user_phone + '</div>' : '') +
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
        var characterName = alert.character === 'tommy' ? 'Tommy' : 'Doris';
        
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
            '<div class="card-actions">' + actions + '</div>' +
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
async function showLiveChatModal(roomId) {
    // Get room messages
    try {
        var response = await apiCall('/live-chat/rooms/' + roomId + '/messages');
        var messages = response.messages || [];
        
        // Create modal HTML
        var modalHtml = '<div class="livechat-modal" id="livechat-modal">' +
            '<div class="livechat-modal-content">' +
                '<div class="livechat-modal-header">' +
                    '<h3><i class="fas fa-headset"></i> Live Chat Support</h3>' +
                    '<button class="btn btn-icon" onclick="closeLiveChatModal()"><i class="fas fa-times"></i></button>' +
                '</div>' +
                '<div class="livechat-messages" id="livechat-messages">' +
                    messages.map(function(msg) {
                        var isStaff = msg.sender === 'staff';
                        return '<div class="chat-message ' + (isStaff ? 'staff' : 'user') + '">' +
                            '<span class="msg-sender">' + (isStaff ? 'You' : 'User') + '</span>' +
                            '<span class="msg-text">' + escapeHtml(msg.text) + '</span>' +
                            '<span class="msg-time">' + new Date(msg.timestamp).toLocaleTimeString() + '</span>' +
                        '</div>';
                    }).join('') +
                '</div>' +
                '<div class="livechat-input">' +
                    '<input type="text" id="livechat-input" placeholder="Type your message..." onkeypress="handleChatKeypress(event)">' +
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
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Start polling for new messages
        startChatPolling(roomId);
        
        // Focus input
        document.getElementById('livechat-input').focus();
        
        // Scroll to bottom
        var messagesDiv = document.getElementById('livechat-messages');
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
    } catch (error) {
        console.error('Error opening chat:', error);
        showNotification('Failed to open chat', 'error');
    }
}

// Handle Enter key in chat input
function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

// Send Chat Message
async function sendChatMessage() {
    var input = document.getElementById('livechat-input');
    var text = input.value.trim();
    
    if (!text || !currentChatRoom) return;
    
    try {
        await apiCall('/live-chat/rooms/' + currentChatRoom + '/messages', {
            method: 'POST',
            body: JSON.stringify({ text: text, sender: 'staff' })
        });
        
        input.value = '';
        
        // Add message to UI immediately
        var messagesDiv = document.getElementById('livechat-messages');
        messagesDiv.innerHTML += '<div class="chat-message staff">' +
            '<span class="msg-sender">You</span>' +
            '<span class="msg-text">' + escapeHtml(text) + '</span>' +
            '<span class="msg-time">' + new Date().toLocaleTimeString() + '</span>' +
        '</div>';
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message', 'error');
    }
}

// Start polling for new messages
function startChatPolling(roomId) {
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
    currentChatRoom = null;
    
    var modal = document.getElementById('livechat-modal');
    if (modal) {
        modal.remove();
    }
}

// End Live Chat
async function endLiveChat(roomId) {
    if (!confirm('Are you sure you want to end this chat?')) return;
    
    try {
        await apiCall('/live-chat/rooms/' + roomId + '/end', { method: 'POST' });
        closeLiveChatModal();
        loadLiveChats();
        showNotification('Chat ended successfully', 'success');
    } catch (error) {
        console.error('Error ending chat:', error);
        showNotification('Failed to end chat', 'error');
    }
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
        var queue = await apiCall('/cases/morning-review-queue');
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
    try {
        var caseData = await apiCall('/cases/' + caseId);
        
        // Create modal content
        var sessionsHtml = '';
        if (caseData.sessions && caseData.sessions.length > 0) {
            sessionsHtml = '<h4 style="margin: 16px 0 8px;">Session History</h4>';
            sessionsHtml += caseData.sessions.map(function(s, idx) {
                return '<div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 8px;">' +
                    '<div style="display: flex; justify-content: space-between;">' +
                        '<strong>Session ' + (idx + 1) + '</strong>' +
                        '<span style="font-size: 12px; color: var(--text-muted);">' + formatDate(s.session_date) + '</span>' +
                    '</div>' +
                    '<p style="margin: 8px 0; font-size: 14px;">' + escapeHtml(s.presenting_issue || 'No notes') + '</p>' +
                    '<span class="case-tag risk-' + (s.risk_level || 'moderate').toLowerCase() + '">' + (s.risk_level || 'moderate') + ' risk</span>' +
                '</div>';
            }).join('');
        }
        
        var safetyPlanHtml = '';
        if (caseData.safety_plan) {
            safetyPlanHtml = '<h4 style="margin: 16px 0 8px;"><i class="fas fa-shield-alt"></i> Safety Plan</h4>' +
                '<div style="background: rgba(34,197,94,0.1); padding: 12px; border-radius: 8px;">' +
                    '<p style="margin: 0; font-size: 14px;">Safety plan on file - Last updated: ' + formatDate(caseData.safety_plan.updated_at) + '</p>' +
                '</div>';
        }
        
        var content = '<div style="padding: 20px;">' +
            '<h3><i class="fas fa-user-shield"></i> Case: ' + escapeHtml(caseData.user_name || 'Unknown') + '</h3>' +
            '<div class="case-meta" style="margin: 16px 0;">' +
                '<span class="case-tag status">' + escapeHtml(caseData.status || 'active') + '</span>' +
                '<span class="case-tag risk-' + (caseData.current_risk_level || 'moderate').toLowerCase() + '">' + escapeHtml(caseData.current_risk_level || 'moderate') + ' risk</span>' +
                '<span class="case-tag" style="background: var(--bg);">Sessions: ' + (caseData.session_count || 0) + '/6</span>' +
            '</div>' +
            safetyPlanHtml +
            sessionsHtml +
            '<div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">' +
                '<button class="btn btn-primary" onclick="addSessionNote(\'' + caseId + '\')"><i class="fas fa-plus"></i> Add Session Note</button>' +
                '<button class="btn btn-secondary" onclick="editSafetyPlan(\'' + caseId + '\')"><i class="fas fa-shield-alt"></i> ' + (caseData.safety_plan ? 'Edit' : 'Create') + ' Safety Plan</button>' +
                '<button class="btn btn-warning" onclick="createReferral(\'' + caseId + '\')"><i class="fas fa-hospital"></i> Create Referral</button>' +
                '<button class="btn btn-outline" onclick="closeModal()"><i class="fas fa-times"></i> Close</button>' +
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
    var content = '<div style="padding: 20px;">' +
        '<form id="session-note-form" onsubmit="return submitSessionNote(event, \'' + caseId + '\')">' +
            '<div class="form-group">' +
                '<label>Presenting Issue / Notes</label>' +
                '<textarea id="session-presenting-issue" rows="4" required placeholder="Describe the main issues discussed..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);"></textarea>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Risk Level</label>' +
                '<select id="session-risk-level" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);">' +
                    '<option value="low">Low</option>' +
                    '<option value="moderate" selected>Moderate</option>' +
                    '<option value="high">High</option>' +
                    '<option value="critical">Critical</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Outcome</label>' +
                '<select id="session-outcome" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);">' +
                    '<option value="continue_monitoring">Continue Monitoring</option>' +
                    '<option value="escalate_to_nhs">Escalate to NHS</option>' +
                    '<option value="refer_to_service">Refer to External Service</option>' +
                    '<option value="close_case">Close Case</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Next Steps (optional)</label>' +
                '<textarea id="session-next-steps" rows="2" placeholder="What should happen next..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);"></textarea>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 16px;">' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Session</button>' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    openGenericModal('Add Session Note', content);
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
        closeModal();
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

// Edit/create safety plan
async function editSafetyPlan(caseId) {
    var content = '<div style="padding: 20px;">' +
        '<form id="safety-plan-form" onsubmit="return submitSafetyPlan(event, \'' + caseId + '\')">' +
            '<p style="color: var(--text-muted); margin-bottom: 16px;">Create or update the safety plan for this case.</p>' +
            '<div class="form-group">' +
                '<label>Warning Signs (one per line)</label>' +
                '<textarea id="sp-warning-signs" rows="3" placeholder="What signs indicate crisis?..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);"></textarea>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Coping Strategies (one per line)</label>' +
                '<textarea id="sp-coping" rows="3" placeholder="Internal coping strategies..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);"></textarea>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Reasons for Living (one per line)</label>' +
                '<textarea id="sp-reasons" rows="3" placeholder="What keeps them going..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);"></textarea>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 16px;">' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Safety Plan</button>' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    openGenericModal('Safety Plan', content);
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
        closeModal();
        loadCases();
    } catch (error) {
        console.error('Error saving safety plan:', error);
        showNotification('Failed to save safety plan: ' + error.message, 'error');
    }
    
    return false;
}

// Create referral
async function createReferral(caseId) {
    var content = '<div style="padding: 20px;">' +
        '<form id="referral-form" onsubmit="return submitReferral(event, \'' + caseId + '\')">' +
            '<div class="form-group">' +
                '<label>Service Type</label>' +
                '<select id="referral-service-type" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);">' +
                    '<option value="nhs_mental_health">NHS Mental Health</option>' +
                    '<option value="crisis_team">Crisis Team</option>' +
                    '<option value="gp">GP</option>' +
                    '<option value="veterans_charity">Veterans Charity</option>' +
                    '<option value="other">Other</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Service Name</label>' +
                '<input type="text" id="referral-service-name" required placeholder="e.g., Local NHS IAPT..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);">' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Urgency</label>' +
                '<select id="referral-urgency" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);">' +
                    '<option value="routine">Routine</option>' +
                    '<option value="urgent">Urgent</option>' +
                    '<option value="emergency">Emergency</option>' +
                '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Notes</label>' +
                '<textarea id="referral-notes" rows="3" placeholder="Additional information..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border);"></textarea>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 16px;">' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Create Referral</button>' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
            '</div>' +
        '</form>' +
    '</div>';
    
    openGenericModal('Create Referral', content);
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
        closeModal();
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
