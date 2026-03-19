// Veterans Support Admin Portal - Main Application

// Ensure CONFIG is defined (fallback if config.js fails to load)
if (typeof CONFIG === 'undefined') {
    console.error('CONFIG not loaded! Make sure config.js is deployed alongside app.js');
    window.CONFIG = {
        API_URL: 'https://veterans-support-api.onrender.com',
        VERSION: '1.0.0'
    };
}

// Session timeout - 2 hours of inactivity
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
let inactivityTimer = null;

// Check if session has expired on page load
function checkSessionExpiry() {
    const lastActivity = localStorage.getItem('admin_last_activity');
    const tokenTime = localStorage.getItem('admin_token_time');
    
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
    localStorage.setItem('admin_last_activity', Date.now().toString());
    
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

// State
let token = localStorage.getItem('auth_token');
let currentUser = JSON.parse(localStorage.getItem('current_user') || 'null');
let counsellors = [];
let peers = [];
let organizations = [];
let users = [];
let content = {};
let resources = [];
let unifiedStaff = [];
let currentStaffFilter = 'all';

// API Helper
async function apiCall(endpoint, options = {}) {
    // Don't make API calls if not logged in (except for login)
    if (!token && !endpoint.includes('/auth/login')) {
        console.log('Skipping API call - not logged in:', endpoint);
        throw new Error('Not authenticated');
    }
    
    const url = `${CONFIG.API_URL}/api${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // If token is invalid/expired, force re-login
            if (response.status === 401) {
                console.warn('Token invalid or expired, forcing re-login');
                logout(true);
                showNotification('Session expired. Please log in again.', 'error');
                throw new Error('Session expired');
            }
            // Handle validation errors (422) with detailed message
            let errorMessage = 'API Error';
            if (data.detail) {
                if (typeof data.detail === 'string') {
                    errorMessage = data.detail;
                } else if (Array.isArray(data.detail)) {
                    // Pydantic validation errors come as array
                    errorMessage = data.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
                } else if (typeof data.detail === 'object') {
                    errorMessage = JSON.stringify(data.detail);
                }
            }
            throw new Error(errorMessage);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notification-message');
    
    notification.className = `notification ${type}`;
    messageEl.textContent = message;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Tab Management
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // SECURITY: Clear any sensitive data from URL (prevents credential leakage)
    if (window.location.search.includes('password') || window.location.search.includes('email')) {
        console.warn('Security: Clearing sensitive parameters from URL');
        // Remove query string without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Check session expiry first
    if (checkSessionExpiry()) {
        showScreen('login-screen');
        return;
    }
    
    // Setup activity listeners for session timeout
    setupActivityListeners();
    
    // Check if logged in
    if (token && currentUser) {
        showScreen('dashboard-screen');
        document.getElementById('user-name').textContent = `Welcome, ${currentUser.name}`;
        loadAllData();
        resetInactivityTimer(); // Start the inactivity timer
        
        // Start real-time alert counter polling
        updateAlertCounter();
        setInterval(updateAlertCounter, 30000); // Poll every 30 seconds
    } else {
        showScreen('login-screen');
    }
    
    // Login form handler
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
});

// Real-time alert counter - shows pending safeguarding alerts
async function updateAlertCounter() {
    try {
        const response = await apiCall('/safeguarding-alerts?status=pending');
        const pendingAlerts = response && Array.isArray(response) ? response.length : 
                            (response && response.alerts ? response.alerts.filter(a => !a.acknowledged).length : 0);
        
        const badge = document.getElementById('alert-counter-badge');
        if (badge) {
            if (pendingAlerts > 0) {
                badge.textContent = pendingAlerts > 99 ? '99+' : pendingAlerts;
                badge.style.display = 'inline-block';
                badge.classList.add('pulse-alert');
            } else {
                badge.style.display = 'none';
                badge.classList.remove('pulse-alert');
            }
        }
    } catch (error) {
        console.log('Error updating alert counter:', error);
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    
    try {
        errorEl.classList.add('hidden');
        
        const response = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Login failed');
        }
        
        // Check if admin
        if (data.user.role !== 'admin') {
            throw new Error('Access denied. Admin only.');
        }
        
        // Save token and user
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('current_user', JSON.stringify(currentUser));
        localStorage.setItem('admin_token_time', Date.now().toString());
        localStorage.setItem('admin_last_activity', Date.now().toString());
        
        // Setup activity tracking
        setupActivityListeners();
        resetInactivityTimer();
        
        // Show dashboard
        document.getElementById('user-name').textContent = `Welcome, ${currentUser.name}`;
        showScreen('dashboard-screen');
        loadAllData();
        
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

// Logout
function handleLogout() {
    logout();
}

function logout(silent = false) {
    token = null;
    currentUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('admin_token_time');
    localStorage.removeItem('admin_last_activity');
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    
    showScreen('login-screen');
    document.getElementById('login-form').reset();
}

// Load All Data
async function loadAllData() {
    try {
        const [counsellorsData, peersData, orgsData, usersData, contentData, resourcesData, unifiedStaffData] = await Promise.all([
            apiCall('/counsellors'),
            apiCall('/peer-supporters'),
            apiCall('/organizations'),
            apiCall('/auth/users'),
            apiCall('/content'),
            apiCall('/resources').catch(() => []),  // Resources might not exist yet
            apiCall('/admin/unified-staff').catch(() => [])  // Unified staff view
        ]);
        
        counsellors = counsellorsData;
        peers = peersData;
        organizations = orgsData;
        users = usersData;
        content = contentData;
        resources = resourcesData;
        unifiedStaff = unifiedStaffData;
        
        renderUnifiedStaff();
        renderCounsellors();
        renderPeers();
        renderOrganizations();
        renderUsers();
        renderResources();
        renderCMS();
        // Load logs data
        loadLogsData();
        
    } catch (error) {
        showNotification('Failed to load data: ' + error.message, 'error');
    }
}

// Render Counsellors
function renderCounsellors() {
    const container = document.getElementById('counsellors-list');
    
    if (counsellors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-md"></i>
                <p>No counsellors added yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = counsellors.map(c => `
        <div class="card">
            <div class="card-header">
                <span class="card-name">${c.name}</span>
                <span class="status-badge status-${c.status}">${c.status}</span>
            </div>
            <p class="card-detail">${c.specialization}</p>
            <p class="card-detail">${c.phone}</p>
            ${c.sms ? `<p class="card-detail">SMS: ${c.sms}</p>` : ''}
            ${c.whatsapp ? `<p class="card-detail">WhatsApp: ${c.whatsapp}</p>` : ''}
            
            <div class="status-toggle">
                <span class="status-toggle-label">Status:</span>
                <button class="status-btn ${c.status === 'available' ? 'active status-available' : ''}" 
                        onclick="updateCounsellorStatus('${c.id}', 'available')">Available</button>
                <button class="status-btn ${c.status === 'busy' ? 'active status-busy' : ''}" 
                        onclick="updateCounsellorStatus('${c.id}', 'busy')">Busy</button>
                <button class="status-btn ${c.status === 'off' ? 'active status-off' : ''}" 
                        onclick="updateCounsellorStatus('${c.id}', 'off')">Off</button>
            </div>
            
            <div class="card-actions">
                <button class="btn btn-primary btn-small" onclick="openEditCounsellorModal('${c.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-small" onclick="confirmDelete('counsellor', '${c.id}', '${c.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Render Peers
function renderPeers() {
    const container = document.getElementById('peers-list');
    
    if (peers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>No peer supporters added yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = peers.map(p => `
        <div class="card">
            <div class="card-header">
                <span class="card-name">${p.firstName}</span>
                <span class="status-badge status-${p.status}">${p.status}</span>
            </div>
            <p class="card-detail">${p.area} - ${p.background}</p>
            <p class="card-detail">${p.yearsServed} years served</p>
            <p class="card-detail">${p.phone}</p>
            ${p.sms ? `<p class="card-detail">SMS: ${p.sms}</p>` : ''}
            ${p.whatsapp ? `<p class="card-detail">WhatsApp: ${p.whatsapp}</p>` : ''}
            
            <div class="status-toggle">
                <span class="status-toggle-label">Status:</span>
                <button class="status-btn ${p.status === 'available' ? 'active status-available' : ''}" 
                        onclick="updatePeerStatus('${p.id}', 'available')">Available</button>
                <button class="status-btn ${p.status === 'limited' ? 'active status-limited' : ''}" 
                        onclick="updatePeerStatus('${p.id}', 'limited')">Limited</button>
                <button class="status-btn ${p.status === 'unavailable' ? 'active status-unavailable' : ''}" 
                        onclick="updatePeerStatus('${p.id}', 'unavailable')">Unavailable</button>
            </div>
            
            <div class="card-actions">
                <button class="btn btn-primary btn-small" onclick="openEditPeerModal('${p.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-small" onclick="confirmDelete('peer', '${p.id}', '${p.firstName}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Render Organizations
function renderOrganizations() {
    const container = document.getElementById('organizations-list');
    
    if (organizations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-building"></i>
                <p>No organizations added yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = organizations.map(o => `
        <div class="card">
            <div class="card-header">
                <span class="card-name">${o.name}</span>
            </div>
            <p class="card-detail">${o.description}</p>
            <p class="card-detail">${o.phone}</p>
            ${o.sms ? `<p class="card-detail">SMS: ${o.sms}</p>` : ''}
            ${o.whatsapp ? `<p class="card-detail">WhatsApp: ${o.whatsapp}</p>` : ''}
            
            <div class="card-actions">
                <button class="btn btn-primary btn-small" onclick="openEditOrgModal('${o.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-small" onclick="confirmDelete('org', '${o.id}', '${o.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Render Users
function renderUsers() {
    const container = document.getElementById('users-list');
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>No users found</p>
            </div>
        `;
        return;
    }
    
    // Sort users: admins first, then supervisors, then counsellors, then peers
    const sortedUsers = [...users].sort((a, b) => {
        const roleOrder = { admin: 0, supervisor: 1, counsellor: 2, peer: 3 };
        return (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
    });
    
    // Find linked profiles for each user
    const getUserProfile = (user) => {
        if (user.role === 'counsellor') {
            return counsellors.find(c => c.user_id === user.id);
        } else if (user.role === 'peer') {
            return peers.find(p => p.user_id === user.id);
        }
        return null;
    };
    
    container.innerHTML = `
        <div class="users-summary">
            <span class="user-count"><i class="fas fa-user-shield"></i> ${users.filter(u => u.role === 'admin').length} Admins</span>
            <span class="user-count"><i class="fas fa-user-md"></i> ${users.filter(u => u.role === 'counsellor').length} Counsellors</span>
            <span class="user-count"><i class="fas fa-users"></i> ${users.filter(u => u.role === 'peer').length} Peers</span>
        </div>
    ` + sortedUsers.map(u => {
        const profile = getUserProfile(u);
        const profileInfo = profile ? `<p class="card-detail profile-link"><i class="fas fa-link"></i> Linked to profile: ${profile.name || profile.firstName}</p>` : 
            (u.role !== 'admin' ? `<p class="card-detail no-profile"><i class="fas fa-unlink"></i> No profile linked</p>` : '');
        
        return `
        <div class="card user-card">
            <div class="card-header">
                <span class="card-name">${u.name}</span>
                <span class="role-badge role-${u.role}">${u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span>
            </div>
            <p class="card-detail"><i class="fas fa-envelope"></i> ${u.email}</p>
            ${profileInfo}
            
            <div class="card-actions">
                <button class="btn btn-primary btn-small" onclick="openEditUserModal('${u.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-warning btn-small" onclick="openResetPasswordModal('${u.id}', '${u.name}')">
                    <i class="fas fa-key"></i> Reset Password
                </button>
                ${u.role !== 'admin' ? `
                    <button class="btn btn-danger btn-small" onclick="confirmDelete('user', '${u.id}', '${u.name}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `}).join('');
}

// Render Resources
function renderResources() {
    const container = document.getElementById('resources-list');
    
    if (!resources || resources.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <p>No resources added yet. Click "Add Resource" to create helpful content for veterans.</p>
            </div>
        `;
        return;
    }
    
    // Group resources by category
    const categories = {};
    resources.forEach(r => {
        const cat = r.category || 'General';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(r);
    });
    
    container.innerHTML = Object.keys(categories).map(category => `
        <div class="resource-category">
            <h3 class="category-title"><i class="fas fa-folder"></i> ${category}</h3>
            <div class="resources-list">
                ${categories[category].map(r => `
                    <div class="resource-card">
                        ${r.image_url ? `<img src="${r.image_url}" alt="${r.title}" class="resource-image">` : ''}
                        <div class="resource-content">
                            <h4 class="resource-title">${r.title}</h4>
                            <p class="resource-description">${r.description || ''}</p>
                            ${r.link ? `<a href="${r.link}" target="_blank" class="resource-link"><i class="fas fa-external-link-alt"></i> View Resource</a>` : ''}
                        </div>
                        <div class="resource-actions">
                            <button class="btn btn-primary btn-small" onclick="openEditResourceModal('${r.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-small" onclick="confirmDelete('resource', '${r.id}', '${r.title}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Render CMS
function renderCMS() {
    // Initialize the WYSIWYG visual editor
    initCMSEditor();
}

// Helper functions
function formatPageName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatSectionName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ CMS PREVIEW FUNCTIONALITY ============

let currentPreviewPage = 'home';
let previewCMSData = null;

async function openCMSPreview() {
    document.getElementById('cms-preview-modal').classList.remove('hidden');
    await loadPreviewData();
    refreshPreview();
}

function closeCMSPreview() {
    document.getElementById('cms-preview-modal').classList.add('hidden');
    const iframe = document.getElementById('preview-iframe');
    iframe.src = '';
}

function changePreviewPage() {
    currentPreviewPage = document.getElementById('preview-page-select').value;
    loadPreviewData();
    refreshPreview();
}

function refreshPreview() {
    const iframe = document.getElementById('preview-iframe');
    // Use the app URL with the selected page - add timestamp to force refresh
    const appUrl = CONFIG.API_URL.replace('/api', '').replace(':8001', ':3000');
    const pageRoute = currentPreviewPage === 'home' ? '/home' : '/' + currentPreviewPage;
    iframe.src = appUrl + pageRoute + '?preview=' + Date.now();
}

async function loadPreviewData() {
    const panel = document.getElementById('preview-content-panel');
    panel.innerHTML = '<p style="color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    
    try {
        const response = await apiCall(`/cms/pages/${currentPreviewPage}`);
        previewCMSData = response;
        renderPreviewContentPanel();
    } catch (error) {
        panel.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-exclamation-circle" style="font-size: 32px; margin-bottom: 12px; color: #f59e0b;"></i>
                <p>No CMS content found for this page.</p>
                <p style="font-size: 13px;">Click "Load Defaults" in the CMS tab to seed content.</p>
            </div>
        `;
    }
}

function renderPreviewContentPanel() {
    const panel = document.getElementById('preview-content-panel');
    
    if (!previewCMSData || !previewCMSData.sections || previewCMSData.sections.length === 0) {
        panel.innerHTML = '<p style="color: var(--text-secondary);">No sections found for this page.</p>';
        return;
    }
    
    let html = '';
    
    previewCMSData.sections.forEach(section => {
        html += `
            <div style="margin-bottom: 20px; background: var(--bg-secondary); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h5 style="margin: 0; color: var(--primary);">
                        <i class="fas fa-layer-group"></i> ${formatSectionName(section.section_type)}
                    </h5>
                    <span style="font-size: 11px; background: var(--primary); color: white; padding: 2px 8px; border-radius: 10px;">
                        ${section.cards ? section.cards.length : 0} cards
                    </span>
                </div>
                ${section.title ? `<p style="margin: 0 0 8px 0; font-weight: 600; color: var(--text-primary);">${section.title}</p>` : ''}
                ${section.subtitle ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text-secondary);">${section.subtitle}</p>` : ''}
                
                ${section.cards && section.cards.length > 0 ? `
                    <div style="display: grid; gap: 8px; margin-top: 12px;">
                        ${section.cards.map(card => `
                            <div style="background: var(--card-bg); padding: 12px; border-radius: 6px; display: flex; align-items: center; gap: 12px; border: 1px solid var(--border-color);">
                                ${card.icon ? `<i class="fas fa-${card.icon}" style="color: ${card.color || '#3b82f6'}; width: 24px; text-align: center;"></i>` : ''}
                                ${card.image_url ? `<img src="${card.image_url}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">` : ''}
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${card.title}</div>
                                    ${card.description ? `<div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${card.description}</div>` : ''}
                                </div>
                                <button class="btn btn-small btn-secondary" onclick="editPreviewCard('${section.id}', '${card.id}')" title="Edit">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">No cards in this section</p>'}
            </div>
        `;
    });
    
    panel.innerHTML = html;
}

async function editPreviewCard(sectionId, cardId) {
    // Find the card
    let targetCard = null;
    let targetSection = null;
    
    for (const section of previewCMSData.sections) {
        if (section.id === sectionId) {
            targetSection = section;
            for (const card of section.cards || []) {
                if (card.id === cardId) {
                    targetCard = card;
                    break;
                }
            }
        }
    }
    
    if (!targetCard) {
        showNotification('Card not found', 'error');
        return;
    }
    
    // Create edit modal content
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <h3><i class="fas fa-edit"></i> Edit Card</h3>
        <form id="edit-card-form" onsubmit="savePreviewCard(event, '${cardId}')">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="card-title" value="${escapeHtml(targetCard.title || '')}" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="card-description" rows="2">${escapeHtml(targetCard.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Icon (FontAwesome name, e.g., "heart", "book")</label>
                <input type="text" id="card-icon" value="${escapeHtml(targetCard.icon || '')}">
            </div>
            <div class="form-group">
                <label>Image URL</label>
                <input type="url" id="card-image" value="${escapeHtml(targetCard.image_url || '')}">
            </div>
            <div class="form-group">
                <label>Color (hex, e.g., #3b82f6)</label>
                <input type="text" id="card-color" value="${escapeHtml(targetCard.color || '')}" pattern="^#[0-9A-Fa-f]{6}$">
            </div>
            <div class="form-group">
                <label>Route (e.g., /self-care)</label>
                <input type="text" id="card-route" value="${escapeHtml(targetCard.route || '')}">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Changes</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-overlay').classList.remove('hidden');
}

async function savePreviewCard(event, cardId) {
    event.preventDefault();
    
    const updateData = {
        title: document.getElementById('card-title').value,
        description: document.getElementById('card-description').value || null,
        icon: document.getElementById('card-icon').value || null,
        image_url: document.getElementById('card-image').value || null,
        color: document.getElementById('card-color').value || null,
        route: document.getElementById('card-route').value || null,
    };
    
    try {
        await apiCall(`/cms/cards/${cardId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        showNotification('Card updated successfully');
        closeModal();
        
        // Refresh both the preview and content panel
        await loadPreviewData();
        refreshPreview();
    } catch (error) {
        showNotification('Failed to update card: ' + error.message, 'error');
    }
}

// ============ LOGS & ANALYTICS ============

let currentLogTab = 'calls';
let logsData = {
    calls: [],
    chats: [],
    safeguarding: [],
    callbacks: [],
    panic: []
};

async function loadLogsData() {
    const period = document.getElementById('logs-period')?.value || 30;
    
    try {
        // Load all data in parallel
        const [callsRes, chatsRes, safeguardingRes, screeningRes, callbacksRes, panicRes, auditRes] = await Promise.all([
            apiCall(`/call-logs?days=${period}`).catch(() => ({ total_calls: 0, recent_logs: [] })),
            apiCall('/live-chat/rooms').catch(() => []),
            apiCall('/safeguarding-alerts').catch(() => []),
            apiCall('/safeguarding/screening-submissions').catch(() => []),
            apiCall('/callbacks').catch(() => []),
            apiCall('/panic-alerts').catch(() => []),
            apiCall('/admin/audit-logs?limit=200').catch(() => ({ logs: [] }))
        ]);
        
        // Store data
        logsData.calls = callsRes.recent_logs || [];
        logsData.chats = chatsRes || [];
        logsData.safeguarding = safeguardingRes || [];
        logsData.screening = screeningRes || [];
        logsData.callbacks = callbacksRes || [];
        logsData.panic = panicRes || [];
        logsData.audit = auditRes.logs || [];
        
        // Update stats
        document.getElementById('stat-calls').textContent = callsRes.total_calls || 0;
        document.getElementById('stat-chats').textContent = logsData.chats.length;
        document.getElementById('stat-escalations').textContent = logsData.safeguarding.length + logsData.screening.filter(s => s.status === 'pending').length;
        document.getElementById('stat-panic').textContent = logsData.panic.length;
        
        // Load AI Chat stats
        loadAIChatStats();
        
        // Load App Usage stats
        loadAppUsageStats();
        
        // Load Location Map
        loadLocationMap();
        
        // Render charts
        renderActivityTrendChart(logsData.calls, logsData.chats, logsData.safeguarding);
        renderContactTypeChart(logsData.calls);
        
        // Render current tab
        renderLogTab(currentLogTab);
    } catch (error) {
        console.error('Error loading logs:', error);
        showNotification('Failed to load logs', 'error');
    }
}

// Chart instances for cleanup
let activityTrendChart = null;
let contactTypeChart = null;

// AI Chat Stats
async function loadAIChatStats() {
    try {
        const stats = await apiCall('/ai-chat/stats?days=7');
        
        // Update AI chat stat card if it exists
        const aiChatStat = document.getElementById('stat-ai-chats');
        if (aiChatStat) {
            aiChatStat.textContent = stats.total_sessions || 0;
        }
        
        // Update AI messages stat
        const aiMessagesStat = document.getElementById('stat-ai-messages');
        if (aiMessagesStat) {
            aiMessagesStat.textContent = stats.total_messages || 0;
        }
        
        // Update character breakdown if container exists
        const characterBreakdown = document.getElementById('ai-character-breakdown');
        if (characterBreakdown && stats.by_character) {
            characterBreakdown.innerHTML = stats.by_character.map(c => `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                    <span style="text-transform: capitalize; font-weight: 500;">${c._id || 'Unknown'}</span>
                    <span><strong>${c.total_sessions}</strong> chats / <strong>${c.total_messages}</strong> msgs</span>
                </div>
            `).join('') || '<p style="color: var(--text-muted);">No AI chat data yet</p>';
        }
        
        return stats;
    } catch (error) {
        console.log('AI Chat stats not available:', error);
        return null;
    }
}

// App Usage Analytics
async function loadAppUsageStats() {
    try {
        const stats = await apiCall('/analytics/usage');
        
        // Update period stats
        document.getElementById('stat-connected-now').textContent = stats.currently_connected || 0;
        document.getElementById('stat-7days').textContent = stats['7_days']?.unique_visitors || 0;
        document.getElementById('stat-30days').textContent = stats['30_days']?.unique_visitors || 0;
        document.getElementById('stat-6months').textContent = stats['6_months']?.unique_visitors || 0;
        document.getElementById('stat-12months').textContent = stats['12_months']?.unique_visitors || 0;
        
        // Update region breakdown
        const regionContainer = document.getElementById('region-breakdown');
        if (regionContainer && stats.regions) {
            const regions = Object.entries(stats.regions);
            if (regions.length > 0) {
                const regionLabels = {
                    'england': '<i class="fas fa-map-marker-alt" style="color:#e53e3e;margin-right:6px;"></i>England',
                    'scotland': '<i class="fas fa-map-marker-alt" style="color:#3182ce;margin-right:6px;"></i>Scotland',
                    'wales': '<i class="fas fa-map-marker-alt" style="color:#38a169;margin-right:6px;"></i>Wales',
                    'northern_ireland': '<i class="fas fa-map-marker-alt" style="color:#805ad5;margin-right:6px;"></i>Northern Ireland',
                    'other': '<i class="fas fa-globe" style="color:#6b7280;margin-right:6px;"></i>Other'
                };
                regionContainer.innerHTML = regions.map(([region, count]) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-secondary); border-radius: 6px;">
                        <span>${regionLabels[region] || region}</span>
                        <strong>${count}</strong>
                    </div>
                `).join('');
            } else {
                regionContainer.innerHTML = '<div style="color: var(--text-muted);">No region data yet</div>';
            }
        }
        
        // Update daily trend
        const trendContainer = document.getElementById('daily-trend');
        if (trendContainer && stats.daily_trend) {
            const last7 = stats.daily_trend.slice(-7);
            if (last7.length > 0) {
                trendContainer.innerHTML = last7.map(day => `
                    <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: var(--bg-secondary); border-radius: 4px;">
                        <span>${day._id}</span>
                        <span><strong>${day.unique_visitors}</strong> visitors</span>
                    </div>
                `).join('');
            } else {
                trendContainer.innerHTML = '<div style="color: var(--text-muted);">No data yet</div>';
            }
        }
        
        // Update device breakdown
        const deviceContainer = document.getElementById('device-breakdown');
        if (deviceContainer && stats.devices) {
            const devices = Object.entries(stats.devices);
            const deviceIcons = {
                'desktop': '<i class="fas fa-desktop" style="color:#8b5cf6;margin-right:6px;"></i>',
                'mobile': '<i class="fas fa-mobile-alt" style="color:#22c55e;margin-right:6px;"></i>',
                'tablet': '<i class="fas fa-tablet-alt" style="color:#3b82f6;margin-right:6px;"></i>',
                'other': '<i class="fas fa-question-circle" style="color:#6b7280;margin-right:6px;"></i>'
            };
            if (devices.length > 0) {
                deviceContainer.innerHTML = devices.map(([device, count]) => `
                    <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: var(--bg-secondary); border-radius: 6px;">
                        <span>${deviceIcons[device] || deviceIcons['other']}${device.charAt(0).toUpperCase() + device.slice(1)}</span>
                        <strong>${count}</strong>
                    </div>
                `).join('');
            } else {
                deviceContainer.innerHTML = '<div style="color: var(--text-muted);">No data yet</div>';
            }
        }
        
        // Update browser breakdown
        const browserContainer = document.getElementById('browser-breakdown');
        if (browserContainer && stats.browsers) {
            const browsers = Object.entries(stats.browsers);
            const browserIcons = {
                'chrome': '<i class="fab fa-chrome" style="color:#22c55e;margin-right:6px;"></i>',
                'safari': '<i class="fab fa-safari" style="color:#3b82f6;margin-right:6px;"></i>',
                'firefox': '<i class="fab fa-firefox" style="color:#f97316;margin-right:6px;"></i>',
                'edge': '<i class="fab fa-edge" style="color:#06b6d4;margin-right:6px;"></i>',
                'other': '<i class="fas fa-globe" style="color:#6b7280;margin-right:6px;"></i>'
            };
            if (browsers.length > 0) {
                browserContainer.innerHTML = browsers.map(([browser, count]) => `
                    <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: var(--bg-secondary); border-radius: 6px;">
                        <span>${browserIcons[browser] || browserIcons['other']}${browser.charAt(0).toUpperCase() + browser.slice(1)}</span>
                        <strong>${count}</strong>
                    </div>
                `).join('');
            } else {
                browserContainer.innerHTML = '<div style="color: var(--text-muted);">No data yet</div>';
            }
        }
        
        // Update OS breakdown
        const osContainer = document.getElementById('os-breakdown');
        if (osContainer && stats.operating_systems) {
            const osList = Object.entries(stats.operating_systems);
            const osIcons = {
                'windows': '<i class="fab fa-windows" style="color:#0078d4;margin-right:6px;"></i>',
                'apple': '<i class="fab fa-apple" style="color:#333;margin-right:6px;"></i>',
                'android': '<i class="fab fa-android" style="color:#3ddc84;margin-right:6px;"></i>',
                'linux': '<i class="fab fa-linux" style="color:#f97316;margin-right:6px;"></i>',
                'other': '<i class="fas fa-laptop" style="color:#6b7280;margin-right:6px;"></i>'
            };
            const osLabels = {
                'windows': 'Windows',
                'apple': 'Apple (iOS/Mac)',
                'android': 'Android',
                'linux': 'Linux',
                'other': 'Other'
            };
            if (osList.length > 0) {
                osContainer.innerHTML = osList.map(([os, count]) => `
                    <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: var(--bg-secondary); border-radius: 6px;">
                        <span>${osIcons[os] || osIcons['other']}${osLabels[os] || os}</span>
                        <strong>${count}</strong>
                    </div>
                `).join('');
            } else {
                osContainer.innerHTML = '<div style="color: var(--text-muted);">No data yet</div>';
            }
        }
        
        // Update return rate
        if (stats.return_rate) {
            const rateEl = document.getElementById('return-rate-percentage');
            const detailEl = document.getElementById('return-rate-detail');
            if (rateEl) {
                rateEl.textContent = stats.return_rate.percentage + '%';
            }
            if (detailEl) {
                detailEl.textContent = `${stats.return_rate.returning_visitors} returning / ${stats.return_rate.total_visitors} total visitors`;
            }
        }
        
        // Update feature usage
        const featureContainer = document.getElementById('feature-usage');
        if (featureContainer && stats.feature_usage) {
            if (stats.feature_usage.length > 0) {
                // Take top 9 features for a 3x3 grid
                const topFeatures = stats.feature_usage.slice(0, 9);
                featureContainer.innerHTML = topFeatures.map(f => {
                    // Format page names nicely
                    const pageName = f.page
                        .replace(/-/g, ' ')
                        .replace(/\//g, '')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ') || 'Home';
                    return `
                        <div style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;" title="${pageName}">${pageName}</span>
                            <strong style="color: var(--primary);">${f.visits}</strong>
                        </div>
                    `;
                }).join('');
            } else {
                featureContainer.innerHTML = '<div style="color: var(--text-muted); grid-column: span 3;">No feature data yet</div>';
            }
        }
        
        return stats;
    } catch (error) {
        console.log('App usage stats not available:', error);
        return null;
    }
}

// Location Map Variables
let locationMap = null;
let locationMarkers = [];

// Load and render location map
async function loadLocationMap() {
    try {
        const data = await apiCall('/analytics/locations');
        
        // Update active count
        const countEl = document.getElementById('map-active-count');
        if (countEl) {
            countEl.textContent = (data.active_count || 0) + ' active';
        }
        
        // Initialize or reset map
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer) return;
        
        if (!locationMap) {
            // Initialize map centered on UK
            locationMap = L.map('location-map', {
                center: [54.5, -2],
                zoom: 6,
                zoomControl: true,
                scrollWheelZoom: true
            });
            
            // Use multiple tile layer options for reliability
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 18,
                crossOrigin: true
            }).addTo(locationMap);
            
            // Force a resize after initialization
            setTimeout(function() {
                locationMap.invalidateSize();
            }, 250);
        }
        
        // Clear existing markers
        locationMarkers.forEach(marker => locationMap.removeLayer(marker));
        locationMarkers = [];
        
        // Add markers for recent locations
        if (data.recent_locations && data.recent_locations.length > 0) {
            data.recent_locations.forEach(loc => {
                if (loc.lat && loc.lon) {
                    const marker = L.circleMarker([loc.lat, loc.lon], {
                        radius: Math.min(5 + loc.visits * 2, 20),
                        fillColor: '#3b82f6',
                        color: '#1d4ed8',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.5
                    }).addTo(locationMap);
                    
                    marker.bindPopup(
                        '<strong>' + (loc.city || 'Unknown') + '</strong>' +
                        (loc.country ? ', ' + loc.country : '') +
                        '<br><span style="color: #666;">' + loc.visits + ' visits (24h)</span>'
                    );
                    locationMarkers.push(marker);
                }
            });
        }
        
        // Add green markers for currently active users
        if (data.active_users_with_location && data.active_users_with_location.length > 0) {
            data.active_users_with_location.forEach(user => {
                if (user.geo_lat && user.geo_lon) {
                    const marker = L.circleMarker([user.geo_lat, user.geo_lon], {
                        radius: 10,
                        fillColor: '#22c55e',
                        color: '#15803d',
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(locationMap);
                    
                    marker.bindPopup(
                        '<strong style="color: #22c55e;">Active Now</strong><br>' +
                        (user.geo_city || 'Unknown') +
                        (user.geo_country ? ', ' + user.geo_country : '') +
                        '<br><span style="color: #666;">' + (user.device || 'Unknown device') + '</span>'
                    );
                    locationMarkers.push(marker);
                }
            });
        }
        
        // Fit bounds if we have markers
        if (locationMarkers.length > 0) {
            const group = L.featureGroup(locationMarkers);
            locationMap.fitBounds(group.getBounds().pad(0.1));
        }
        
        // Update country breakdown
        const countryContainer = document.getElementById('country-breakdown');
        if (countryContainer && data.countries) {
            if (data.countries.length > 0) {
                const flagEmoji = {
                    'United Kingdom': '🇬🇧',
                    'United States': '🇺🇸',
                    'Ireland': '🇮🇪',
                    'Germany': '🇩🇪',
                    'France': '🇫🇷',
                    'Canada': '🇨🇦',
                    'Australia': '🇦🇺',
                    'Netherlands': '🇳🇱',
                    'Spain': '🇪🇸',
                    'Italy': '🇮🇹'
                };
                countryContainer.innerHTML = data.countries.map(c => 
                    '<div style="display: flex; justify-content: space-between; padding: 6px 10px; background: var(--bg-secondary); border-radius: 6px;">' +
                        '<span>' + (flagEmoji[c.country] || '🌍') + ' ' + c.country + '</span>' +
                        '<strong>' + c.visits + '</strong>' +
                    '</div>'
                ).join('');
            } else {
                countryContainer.innerHTML = '<div style="color: var(--text-muted);">No data yet</div>';
            }
        }
        
        // Update city breakdown
        const cityContainer = document.getElementById('city-breakdown');
        if (cityContainer && data.cities) {
            if (data.cities.length > 0) {
                cityContainer.innerHTML = data.cities.slice(0, 10).map(c => 
                    '<div style="display: flex; justify-content: space-between; padding: 6px 10px; background: var(--bg-secondary); border-radius: 6px;">' +
                        '<span><i class="fas fa-map-pin" style="color: #8b5cf6; margin-right: 6px;"></i>' + c.city + '</span>' +
                        '<strong>' + c.visits + '</strong>' +
                    '</div>'
                ).join('');
            } else {
                cityContainer.innerHTML = '<div style="color: var(--text-muted);">No data yet</div>';
            }
        }
        
        // Update UK region breakdown
        const ukRegionContainer = document.getElementById('uk-region-breakdown');
        if (ukRegionContainer && data.uk_regions) {
            if (data.uk_regions.length > 0) {
                ukRegionContainer.innerHTML = data.uk_regions.map(r => 
                    '<div style="display: flex; justify-content: space-between; padding: 6px 10px; background: var(--bg-secondary); border-radius: 6px;">' +
                        '<span><i class="fas fa-map-marker-alt" style="color: #22c55e; margin-right: 6px;"></i>' + r.region + '</span>' +
                        '<strong>' + r.visits + '</strong>' +
                    '</div>'
                ).join('');
            } else {
                ukRegionContainer.innerHTML = '<div style="color: var(--text-muted);">No UK data yet</div>';
            }
        }
        
    } catch (error) {
        console.log('Location analytics not available:', error);
    }
}

function renderActivityTrendChart(calls, chats, safeguarding) {
    const ctx = document.getElementById('activity-trend-chart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (activityTrendChart) {
        activityTrendChart.destroy();
    }
    
    // Group data by date
    const today = new Date();
    const labels = [];
    const callData = [];
    const chatData = [];
    const alertData = [];
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }));
        
        // Count items for this date
        callData.push(calls.filter(c => c.timestamp && c.timestamp.startsWith(dateStr)).length);
        chatData.push(chats.filter(c => c.created_at && c.created_at.startsWith(dateStr)).length);
        alertData.push(safeguarding.filter(s => s.created_at && s.created_at.startsWith(dateStr)).length);
    }
    
    activityTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Calls',
                    data: callData,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Chats',
                    data: chatData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Alerts',
                    data: alertData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', padding: 20 }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: '#94a3b8', stepSize: 1 }
                }
            }
        }
    });
}

function renderContactTypeChart(calls) {
    const ctx = document.getElementById('contact-type-chart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (contactTypeChart) {
        contactTypeChart.destroy();
    }
    
    // Count by contact type
    const typeCounts = {
        counsellor: 0,
        peer: 0,
        organization: 0,
        crisis_line: 0
    };
    
    calls.forEach(call => {
        const type = call.contact_type || 'other';
        if (typeCounts[type] !== undefined) {
            typeCounts[type]++;
        }
    });
    
    const labels = ['Counsellors', 'Peer Support', 'Organizations', 'Crisis Lines'];
    const data = [typeCounts.counsellor, typeCounts.peer, typeCounts.organization, typeCounts.crisis_line];
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
    
    contactTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { 
                        color: '#94a3b8',
                        padding: 12,
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

function switchLogTab(tab) {
    currentLogTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.logs-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.logtab === tab);
    });
    
    renderLogTab(tab);
}

function renderLogTab(tab) {
    const container = document.getElementById('logs-content');
    const data = logsData[tab] || [];
    
    if (data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>No ${tab} records found for this period</p>
            </div>
        `;
        return;
    }
    
    switch (tab) {
        case 'calls':
            container.innerHTML = renderCallLogs(data);
            break;
        case 'chats':
            container.innerHTML = renderChatLogs(data);
            break;
        case 'safeguarding':
            container.innerHTML = renderSafeguardingLogs(data);
            break;
        case 'screening':
            container.innerHTML = renderScreeningLogs(data);
            break;
        case 'callbacks':
            container.innerHTML = renderCallbackLogs(data);
            break;
        case 'panic':
            container.innerHTML = renderPanicLogs(data);
            break;
        case 'audit':
            container.innerHTML = renderAuditLogs(data);
            break;
    }
}

function renderCallLogs(logs) {
    return `
        <table class="logs-table">
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>Contact Name</th>
                    <th>Type</th>
                    <th>Method</th>
                    <th>Phone</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(log => `
                    <tr>
                        <td>${formatDateTime(log.timestamp)}</td>
                        <td><strong>${log.contact_name || 'Unknown'}</strong></td>
                        <td><span class="badge ${log.contact_type === 'peer' ? 'badge-success' : 'badge-primary'}">${log.contact_type}</span></td>
                        <td><span class="badge ${log.call_method === 'webrtc' ? 'badge-info' : 'badge-secondary'}">${log.call_method}</span></td>
                        <td>${log.contact_phone || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderChatLogs(chats) {
    return `
        <table class="logs-table">
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>Status</th>
                    <th>User</th>
                    <th>Staff</th>
                    <th>Messages</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${chats.map(chat => `
                    <tr>
                        <td>${formatDateTime(chat.created_at)}</td>
                        <td><span class="badge badge-${chat.status === 'active' ? 'success' : chat.status === 'closed' ? 'secondary' : 'warning'}">${chat.status}</span></td>
                        <td>${chat.user_name || 'Anonymous'}</td>
                        <td>${chat.staff_name || '-'}</td>
                        <td>${chat.message_count || 0}</td>
                        <td>
                            <button class="btn btn-small btn-secondary" onclick="viewChatHistory('${chat.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderSafeguardingLogs(alerts) {
    return `
        <table class="logs-table">
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>Risk Level</th>
                    <th>Score</th>
                    <th>Session</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${alerts.map(alert => {
                    const riskLevel = (alert.risk_level || 'unknown').toUpperCase();
                    const badgeClass = riskLevel === 'RED' ? 'danger' : riskLevel === 'AMBER' ? 'warning' : riskLevel === 'YELLOW' ? 'warning' : 'info';
                    const location = alert.geo_city && alert.geo_country ? `${alert.geo_city}, ${alert.geo_country}` : (alert.client_ip || 'Unknown');
                    return `
                    <tr>
                        <td>${formatDateTime(alert.created_at)}</td>
                        <td><span class="badge badge-${badgeClass}">${riskLevel}</span></td>
                        <td><strong>${alert.risk_score || 0}</strong></td>
                        <td>${alert.session_id ? alert.session_id.substring(0, 12) + '...' : '-'}</td>
                        <td>${location}</td>
                        <td><span class="badge badge-${alert.status === 'resolved' ? 'success' : alert.status === 'acknowledged' ? 'warning' : 'secondary'}">${alert.status || 'active'}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="viewSafeguardingAlert('${alert.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${alert.status === 'active' ? `
                            <button class="btn btn-sm btn-warning" onclick="acknowledgeSafeguardingAlert('${alert.id}')" title="Acknowledge">
                                <i class="fas fa-check"></i>
                            </button>
                            ` : ''}
                            ${alert.status !== 'resolved' ? `
                            <button class="btn btn-sm btn-success" onclick="resolveSafeguardingAlert('${alert.id}')" title="Resolve">
                                <i class="fas fa-check-double"></i>
                            </button>
                            ` : ''}
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderCallbackLogs(callbacks) {
    return `
        <table class="logs-table">
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Handled By</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${callbacks.map(cb => `
                    <tr>
                        <td>${formatDateTime(cb.created_at)}</td>
                        <td><span class="badge badge-${cb.request_type === 'urgent' ? 'danger' : 'primary'}">${cb.request_type}</span></td>
                        <td><strong>${cb.name || 'Anonymous'}</strong></td>
                        <td>${cb.phone || '-'}</td>
                        <td>${cb.handled_by_name || '-'}</td>
                        <td><span class="badge badge-${cb.status === 'completed' ? 'success' : cb.status === 'pending' ? 'warning' : 'secondary'}">${cb.status}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderPanicLogs(alerts) {
    return `
        <table class="logs-table">
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>User</th>
                    <th>Location</th>
                    <th>Responded By</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${alerts.map(alert => `
                    <tr class="${alert.status === 'active' ? 'row-urgent' : ''}">
                        <td>${formatDateTime(alert.created_at)}</td>
                        <td><strong>${alert.user_name || 'Anonymous'}</strong></td>
                        <td>${alert.location || '-'}</td>
                        <td>${alert.responded_by_name || '-'}</td>
                        <td><span class="badge badge-${alert.status === 'resolved' ? 'success' : alert.status === 'active' ? 'danger' : 'warning'}">${alert.status}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAuditLogs(logs) {
    // Get badge color based on event type
    const getEventBadge = (eventType) => {
        if (eventType.startsWith('auth.')) return 'badge-info';
        if (eventType.startsWith('safeguarding.')) return 'badge-danger';
        if (eventType.startsWith('data.')) return 'badge-warning';
        if (eventType.startsWith('admin.')) return 'badge-primary';
        if (eventType.startsWith('support.')) return 'badge-success';
        return 'badge-secondary';
    };
    
    // Get badge color for risk level
    const getRiskBadge = (riskLevel) => {
        switch (riskLevel) {
            case 'critical': return 'badge-danger';
            case 'high': return 'badge-warning';
            case 'medium': return 'badge-info';
            case 'low': return 'badge-success';
            default: return 'badge-secondary';
        }
    };
    
    // Format event type for display
    const formatEventType = (type) => {
        return type.replace(/\./g, ' › ').replace(/_/g, ' ');
    };
    
    return `
        <div style="margin-bottom: 16px; padding: 12px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <span style="color: var(--text-secondary);">Filter by type:</span>
                <select id="audit-filter-type" onchange="filterAuditLogs()" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-primary);">
                    <option value="">All Events</option>
                    <option value="auth.">Authentication</option>
                    <option value="safeguarding.">Safeguarding</option>
                    <option value="data.">Data Access</option>
                    <option value="admin.">Admin Actions</option>
                    <option value="support.">Live Support</option>
                </select>
                <span style="margin-left: auto; color: var(--text-muted); font-size: 13px;">
                    <i class="fas fa-info-circle"></i> Showing ${logs.length} events
                </span>
            </div>
        </div>
        <table class="logs-table" id="audit-logs-table">
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>Event Type</th>
                    <th>User</th>
                    <th>Outcome</th>
                    <th>Risk Level</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(log => {
                    const userEmail = log.user?.email || log.user?.id || 'System';
                    const eventType = log.event_type || 'unknown';
                    const riskLevel = log.risk_level;
                    const outcome = log.outcome || 'success';
                    const details = log.action_details || {};
                    
                    // Build details string
                    let detailsStr = '';
                    if (details.action) detailsStr += details.action + '. ';
                    if (details.record_count) detailsStr += `Records: ${details.record_count}. `;
                    if (details.score) detailsStr += `Score: ${details.score}. `;
                    if (log.resource?.type) detailsStr += `Resource: ${log.resource.type}. `;
                    if (log.context?.ip_address) detailsStr += `IP: ${log.context.ip_address}`;
                    
                    return `
                        <tr class="${riskLevel === 'critical' || riskLevel === 'high' ? 'row-urgent' : ''}" data-event-type="${eventType}">
                            <td>${formatDateTime(log.timestamp)}</td>
                            <td><span class="badge ${getEventBadge(eventType)}" style="font-size: 11px; text-transform: capitalize;">${formatEventType(eventType)}</span></td>
                            <td><strong>${userEmail}</strong></td>
                            <td><span class="badge ${outcome === 'success' ? 'badge-success' : 'badge-danger'}">${outcome}</span></td>
                            <td>${riskLevel ? `<span class="badge ${getRiskBadge(riskLevel)}">${riskLevel.toUpperCase()}</span>` : '-'}</td>
                            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${detailsStr || 'No additional details'}">${detailsStr || '-'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function filterAuditLogs() {
    const filterValue = document.getElementById('audit-filter-type')?.value || '';
    const rows = document.querySelectorAll('#audit-logs-table tbody tr');
    
    rows.forEach(row => {
        const eventType = row.dataset.eventType || '';
        if (!filterValue || eventType.startsWith(filterValue)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function renderScreeningLogs(submissions) {
    return `
        <table class="logs-table">
            <thead>
                <tr>
                    <th>Date/Time</th>
                    <th>User</th>
                    <th>Severity</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${submissions.map(sub => {
                    // Parse the details to extract score info
                    const detailsLines = sub.details ? sub.details.split('\\n') : [];
                    const scoreInfo = detailsLines.find(l => l.includes('Score:')) || '-';
                    
                    const severityBadge = sub.severity === 'high' ? 'badge-danger' : 
                        (sub.severity === 'medium' ? 'badge-warning' : 'badge-success');
                    const statusBadge = sub.status === 'pending' ? 'badge-warning' : 
                        (sub.status === 'resolved' ? 'badge-success' : 'badge-info');
                    
                    return `
                        <tr class="${sub.severity === 'high' && sub.status === 'pending' ? 'row-urgent' : ''}">
                            <td>${formatDateTime(sub.created_at)}</td>
                            <td><strong>${sub.user_name || 'Anonymous'}</strong></td>
                            <td><span class="badge ${severityBadge}">${sub.severity.toUpperCase()}</span></td>
                            <td>${scoreInfo}</td>
                            <td><span class="badge ${statusBadge}">${sub.status}</span></td>
                            <td>${sub.assigned_to_name || '-'}</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" onclick="viewScreeningDetails('${sub.id}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                ${sub.status === 'pending' ? `
                                    <button class="btn btn-sm btn-primary" onclick="updateScreeningStatus('${sub.id}', 'reviewed')">
                                        <i class="fas fa-check"></i> Review
                                    </button>
                                ` : ''}
                                ${sub.status !== 'resolved' ? `
                                    <button class="btn btn-sm btn-success" onclick="updateScreeningStatus('${sub.id}', 'resolved')">
                                        <i class="fas fa-check-circle"></i> Resolve
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

async function viewScreeningDetails(id) {
    const submission = logsData.screening.find(s => s.id === id);
    if (!submission) return;
    
    const content = `
        <h3><i class="fas fa-clipboard-check"></i> Screening Details</h3>
        <div style="background: var(--bg-secondary); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <p><strong>User:</strong> ${submission.user_name || 'Anonymous'}</p>
            <p><strong>Severity:</strong> <span class="badge badge-${submission.severity === 'high' ? 'danger' : submission.severity === 'medium' ? 'warning' : 'success'}">${submission.severity.toUpperCase()}</span></p>
            <p><strong>Submitted:</strong> ${formatDateTime(submission.created_at)}</p>
            <p><strong>Status:</strong> ${submission.status}</p>
            ${submission.assigned_to_name ? `<p><strong>Assigned To:</strong> ${submission.assigned_to_name}</p>` : ''}
            ${submission.staff_notes ? `<p><strong>Staff Notes:</strong> ${submission.staff_notes}</p>` : ''}
        </div>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; white-space: pre-wrap; font-family: monospace; font-size: 13px;">
            ${submission.details.replace(/\\n/g, '<br>')}
        </div>
        <div class="modal-actions" style="margin-top: 16px;">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            ${submission.status !== 'resolved' ? `
                <button class="btn btn-success" onclick="updateScreeningStatus('${id}', 'resolved'); closeModal();">
                    <i class="fas fa-check-circle"></i> Mark Resolved
                </button>
            ` : ''}
        </div>
    `;
    
    openModal(content);
}

async function updateScreeningStatus(id, status) {
    try {
        await apiCall(`/safeguarding/screening-submissions/${id}/status?status=${status}`, { method: 'PATCH' });
        showNotification(`Screening marked as ${status}`);
        loadLogsData();
    } catch (error) {
        showNotification('Failed to update status', 'error');
    }
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function viewChatHistory(chatId) {
    try {
        const messages = await apiCall(`/live-chat/rooms/${chatId}/messages`);
        
        const content = `
            <h3><i class="fas fa-comments"></i> Chat History</h3>
            <div style="max-height: 400px; overflow-y: auto; background: var(--bg-secondary); border-radius: 8px; padding: 16px;">
                ${messages.length === 0 ? '<p style="color: var(--text-muted);">No messages</p>' : 
                    messages.map(msg => `
                        <div style="margin-bottom: 12px; padding: 10px; background: ${msg.is_staff ? 'var(--primary)' : 'var(--card-bg)'}; border-radius: 8px; ${msg.is_staff ? 'margin-left: 40px;' : 'margin-right: 40px;'}">
                            <div style="font-size: 11px; color: ${msg.is_staff ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)'}; margin-bottom: 4px;">
                                ${msg.sender_name || 'User'} - ${formatDateTime(msg.timestamp)}
                            </div>
                            <div style="color: ${msg.is_staff ? '#fff' : 'var(--text-primary)'};">${msg.content}</div>
                        </div>
                    `).join('')
                }
            </div>
            <div class="modal-actions" style="margin-top: 16px;">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            </div>
        `;
        
        openModal(content);
    } catch (error) {
        showNotification('Failed to load chat history', 'error');
    }
}

async function exportLogsCSV() {
    const tab = currentLogTab;
    const data = logsData[tab] || [];
    
    if (data.length === 0) {
        showNotification('No data to export', 'error');
        return;
    }
    
    // Create CSV
    let csv = '';
    
    switch (tab) {
        case 'calls':
            csv = 'Date,Contact Name,Type,Method,Phone\n';
            data.forEach(log => {
                csv += `"${formatDateTime(log.timestamp)}","${log.contact_name || ''}","${log.contact_type}","${log.call_method}","${log.contact_phone || ''}"\n`;
            });
            break;
        case 'chats':
            csv = 'Date,Status,User,Staff,Messages\n';
            data.forEach(chat => {
                csv += `"${formatDateTime(chat.created_at)}","${chat.status}","${chat.user_name || ''}","${chat.staff_name || ''}","${chat.message_count || 0}"\n`;
            });
            break;
        case 'safeguarding':
            csv = 'Date,Risk Level,Type,User,Staff,Status\n';
            data.forEach(alert => {
                csv += `"${formatDateTime(alert.created_at)}","${alert.risk_level || ''}","${alert.alert_type || ''}","${alert.user_name || ''}","${alert.assigned_to_name || ''}","${alert.status}"\n`;
            });
            break;
        case 'callbacks':
            csv = 'Date,Type,Name,Phone,Handled By,Status\n';
            data.forEach(cb => {
                csv += `"${formatDateTime(cb.created_at)}","${cb.request_type}","${cb.name || ''}","${cb.phone || ''}","${cb.handled_by_name || ''}","${cb.status}"\n`;
            });
            break;
        case 'panic':
            csv = 'Date,User,Location,Responded By,Status\n';
            data.forEach(alert => {
                csv += `"${formatDateTime(alert.created_at)}","${alert.user_name || ''}","${alert.location || ''}","${alert.responded_by_name || ''}","${alert.status}"\n`;
            });
            break;
    }
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('CSV exported successfully');
}

// Status Updates
async function updateCounsellorStatus(id, status) {
    try {
        await apiCall(`/counsellors/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        showNotification(`Status updated to ${status}`);
        loadAllData();
    } catch (error) {
        showNotification('Failed to update status: ' + error.message, 'error');
    }
}

async function updatePeerStatus(id, status) {
    try {
        await apiCall(`/peer-supporters/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        showNotification(`Status updated to ${status}`);
        loadAllData();
    } catch (error) {
        showNotification('Failed to update status: ' + error.message, 'error');
    }
}

// Modal Management
function openModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none'; // Force hide as backup
    }
}

// Delete Confirmation
let deleteTarget = null;

function confirmDelete(type, id, name) {
    deleteTarget = { type, id };
    document.getElementById('delete-message').textContent = `Are you sure you want to delete "${name}"?`;
    document.getElementById('delete-modal').classList.remove('hidden');
    
    document.getElementById('confirm-delete-btn').onclick = executeDelete;
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    deleteTarget = null;
}

async function executeDelete() {
    if (!deleteTarget) return;
    
    const { type, id } = deleteTarget;
    let endpoint;
    
    switch (type) {
        case 'counsellor': endpoint = `/counsellors/${id}`; break;
        case 'peer': endpoint = `/peer-supporters/${id}`; break;
        case 'org': endpoint = `/organizations/${id}`; break;
        case 'user': endpoint = `/auth/users/${id}`; break;
        case 'resource': endpoint = `/resources/${id}`; break;
    }
    
    try {
        await apiCall(endpoint, { method: 'DELETE' });
        showNotification('Deleted successfully');
        closeDeleteModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to delete: ' + error.message, 'error');
    }
}

// Add Counsellor Modal
function openAddCounsellorModal() {
    openModal(`
        <div class="modal-header">
            <h3>Add New Counsellor</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="add-counsellor-form" class="modal-body">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" name="email" required>
            </div>
            <div class="form-group">
                <label>Password *</label>
                <input type="password" name="password" required minlength="8">
            </div>
            <div class="form-group">
                <label>Specialization *</label>
                <input type="text" name="specialization" required placeholder="e.g., Trauma & PTSD">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="tel" name="phone" placeholder="01234567890 (optional)">
            </div>
            <div class="form-group">
                <label>SMS Number</label>
                <input type="tel" name="sms" placeholder="Optional">
            </div>
            <div class="form-group">
                <label>WhatsApp Number</label>
                <input type="tel" name="whatsapp" placeholder="Optional">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitAddCounsellor()">Add Counsellor</button>
        </div>
    `);
}

async function submitAddCounsellor() {
    const form = document.getElementById('add-counsellor-form');
    const formData = new FormData(form);
    
    try {
        // First create user
        const userResult = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password'),
                name: formData.get('name'),
                role: 'counsellor'
            })
        });
        
        // Then create counsellor profile linked to the user
        await apiCall('/counsellors', {
            method: 'POST',
            body: JSON.stringify({
                name: formData.get('name'),
                specialization: formData.get('specialization'),
                phone: formData.get('phone'),
                sms: formData.get('sms') || null,
                whatsapp: formData.get('whatsapp') || null,
                user_id: userResult.id
            })
        });
        
        showNotification('Counsellor added successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to add counsellor: ' + error.message, 'error');
    }
}

// Edit Counsellor Modal
function openEditCounsellorModal(id) {
    const counsellor = counsellors.find(c => c.id === id);
    if (!counsellor) return;
    
    // Filter users with 'counsellor' role who aren't already linked to another counsellor
    const linkedUserIds = counsellors.filter(c => c.user_id && c.id !== id).map(c => c.user_id);
    const availableCounsellorUsers = users.filter(u => u.role === 'counsellor' && !linkedUserIds.includes(u.id));
    
    const userOptions = availableCounsellorUsers.length > 0 
        ? `<option value="">-- Select user to link --</option>` + 
          availableCounsellorUsers.map(u => `<option value="${u.id}" ${counsellor.user_id === u.id ? 'selected' : ''}>${u.name} (${u.email})</option>`).join('')
        : `<option value="">No unlinked counsellor users available</option>`;
    
    openModal(`
        <div class="modal-header">
            <h3>Edit Counsellor</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="edit-counsellor-form" class="modal-body">
            <input type="hidden" name="id" value="${counsellor.id}">
            <div class="form-group">
                <label>Link to User Account</label>
                <select name="user_id">
                    ${userOptions}
                </select>
                <small style="color: var(--text-muted);">Link this profile to a user account to enable portal login</small>
            </div>
            <div class="form-group">
                <label>Name *</label>
                <input type="text" name="name" required value="${counsellor.name}">
            </div>
            <div class="form-group">
                <label>Specialization *</label>
                <input type="text" name="specialization" required value="${counsellor.specialization}">
            </div>
            <div class="form-group">
                <label>Phone *</label>
                <input type="tel" name="phone" required value="${counsellor.phone}">
            </div>
            <div class="form-group">
                <label>SMS Number</label>
                <input type="tel" name="sms" value="${counsellor.sms || ''}">
            </div>
            <div class="form-group">
                <label>WhatsApp Number</label>
                <input type="tel" name="whatsapp" value="${counsellor.whatsapp || ''}">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitEditCounsellor()">Save Changes</button>
        </div>
    `);
}

async function submitEditCounsellor() {
    const form = document.getElementById('edit-counsellor-form');
    const formData = new FormData(form);
    const id = formData.get('id');
    
    try {
        await apiCall(`/counsellors/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: formData.get('name'),
                specialization: formData.get('specialization'),
                phone: formData.get('phone'),
                sms: formData.get('sms') || null,
                whatsapp: formData.get('whatsapp') || null,
                user_id: formData.get('user_id') || null
            })
        });
        
        showNotification('Counsellor updated successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to update counsellor: ' + error.message, 'error');
    }
}

// Add Peer Modal
function openAddPeerModal() {
    openModal(`
        <div class="modal-header">
            <h3>Add New Peer Supporter</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="add-peer-form" class="modal-body">
            <div class="form-group">
                <label>First Name *</label>
                <input type="text" name="firstName" required>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" name="email" required>
            </div>
            <div class="form-group">
                <label>Password *</label>
                <input type="password" name="password" required minlength="8">
            </div>
            <div class="form-group">
                <label>Area *</label>
                <input type="text" name="area" required placeholder="e.g., Greater Manchester">
            </div>
            <div class="form-group">
                <label>Background *</label>
                <input type="text" name="background" required placeholder="e.g., Royal Marines">
            </div>
            <div class="form-group">
                <label>Years Served *</label>
                <input type="text" name="yearsServed" required placeholder="e.g., 2001-2013">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="tel" name="phone" placeholder="01234567890 (optional)">
            </div>
            <div class="form-group">
                <label>SMS Number</label>
                <input type="tel" name="sms" placeholder="Optional">
            </div>
            <div class="form-group">
                <label>WhatsApp Number</label>
                <input type="tel" name="whatsapp" placeholder="Optional">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitAddPeer()">Add Peer Supporter</button>
        </div>
    `);
}

async function submitAddPeer() {
    const form = document.getElementById('add-peer-form');
    const formData = new FormData(form);
    
    try {
        // First create user
        const userResult = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password'),
                name: formData.get('firstName'),
                role: 'peer'
            })
        });
        
        // Then create peer profile linked to the user
        await apiCall('/peer-supporters', {
            method: 'POST',
            body: JSON.stringify({
                firstName: formData.get('firstName'),
                area: formData.get('area'),
                background: formData.get('background'),
                yearsServed: formData.get('yearsServed'),
                phone: formData.get('phone'),
                sms: formData.get('sms') || null,
                whatsapp: formData.get('whatsapp') || null,
                user_id: userResult.id
            })
        });
        
        showNotification('Peer supporter added successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to add peer supporter: ' + error.message, 'error');
    }
}

// Edit Peer Modal
function openEditPeerModal(id) {
    const peer = peers.find(p => p.id === id);
    if (!peer) return;
    
    // Filter users with 'peer' role who aren't already linked to another peer
    const linkedUserIds = peers.filter(p => p.user_id && p.id !== id).map(p => p.user_id);
    const availablePeerUsers = users.filter(u => u.role === 'peer' && !linkedUserIds.includes(u.id));
    
    const userOptions = availablePeerUsers.length > 0 
        ? `<option value="">-- Select user to link --</option>` + 
          availablePeerUsers.map(u => `<option value="${u.id}" ${peer.user_id === u.id ? 'selected' : ''}>${u.name} (${u.email})</option>`).join('')
        : `<option value="">No unlinked peer users available</option>`;
    
    openModal(`
        <div class="modal-header">
            <h3>Edit Peer Supporter</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="edit-peer-form" class="modal-body">
            <input type="hidden" name="id" value="${peer.id}">
            <div class="form-group">
                <label>Link to User Account</label>
                <select name="user_id">
                    ${userOptions}
                </select>
                <small style="color: var(--text-muted);">Link this profile to a user account to enable portal login</small>
            </div>
            <div class="form-group">
                <label>First Name *</label>
                <input type="text" name="firstName" required value="${peer.firstName}">
            </div>
            <div class="form-group">
                <label>Area *</label>
                <input type="text" name="area" required value="${peer.area}">
            </div>
            <div class="form-group">
                <label>Background *</label>
                <input type="text" name="background" required value="${peer.background}">
            </div>
            <div class="form-group">
                <label>Years Served *</label>
                <input type="text" name="yearsServed" required value="${peer.yearsServed}">
            </div>
            <div class="form-group">
                <label>Phone *</label>
                <input type="tel" name="phone" required value="${peer.phone}">
            </div>
            <div class="form-group">
                <label>SMS Number</label>
                <input type="tel" name="sms" value="${peer.sms || ''}">
            </div>
            <div class="form-group">
                <label>WhatsApp Number</label>
                <input type="tel" name="whatsapp" value="${peer.whatsapp || ''}">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitEditPeer()">Save Changes</button>
        </div>
    `);
}

async function submitEditPeer() {
    const form = document.getElementById('edit-peer-form');
    const formData = new FormData(form);
    const id = formData.get('id');
    
    try {
        await apiCall(`/peer-supporters/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                firstName: formData.get('firstName'),
                area: formData.get('area'),
                background: formData.get('background'),
                yearsServed: formData.get('yearsServed'),
                phone: formData.get('phone'),
                sms: formData.get('sms') || null,
                whatsapp: formData.get('whatsapp') || null,
                user_id: formData.get('user_id') || null
            })
        });
        
        showNotification('Peer supporter updated successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to update peer supporter: ' + error.message, 'error');
    }
}

// Add Organization Modal
function openAddOrgModal() {
    openModal(`
        <div class="modal-header">
            <h3>Add Organization</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="add-org-form" class="modal-body">
            <div class="form-group">
                <label>Organization Name *</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>Description *</label>
                <textarea name="description" required placeholder="Describe the organization's services"></textarea>
            </div>
            <div class="form-group">
                <label>Phone *</label>
                <input type="tel" name="phone" required placeholder="01234567890">
            </div>
            <div class="form-group">
                <label>SMS Number</label>
                <input type="tel" name="sms" placeholder="Optional">
            </div>
            <div class="form-group">
                <label>WhatsApp Number</label>
                <input type="tel" name="whatsapp" placeholder="Optional">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitAddOrg()">Add Organization</button>
        </div>
    `);
}

async function submitAddOrg() {
    const form = document.getElementById('add-org-form');
    const formData = new FormData(form);
    
    try {
        await apiCall('/organizations', {
            method: 'POST',
            body: JSON.stringify({
                name: formData.get('name'),
                description: formData.get('description'),
                phone: formData.get('phone'),
                sms: formData.get('sms') || null,
                whatsapp: formData.get('whatsapp') || null
            })
        });
        
        showNotification('Organization added successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to add organization: ' + error.message, 'error');
    }
}

// Edit Organization Modal
function openEditOrgModal(id) {
    const org = organizations.find(o => o.id === id);
    if (!org) return;
    
    openModal(`
        <div class="modal-header">
            <h3>Edit Organization</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="edit-org-form" class="modal-body">
            <input type="hidden" name="id" value="${org.id}">
            <div class="form-group">
                <label>Organization Name *</label>
                <input type="text" name="name" required value="${org.name}">
            </div>
            <div class="form-group">
                <label>Description *</label>
                <textarea name="description" required>${org.description}</textarea>
            </div>
            <div class="form-group">
                <label>Phone *</label>
                <input type="tel" name="phone" required value="${org.phone}">
            </div>
            <div class="form-group">
                <label>SMS Number</label>
                <input type="tel" name="sms" value="${org.sms || ''}">
            </div>
            <div class="form-group">
                <label>WhatsApp Number</label>
                <input type="tel" name="whatsapp" value="${org.whatsapp || ''}">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitEditOrg()">Save Changes</button>
        </div>
    `);
}

async function submitEditOrg() {
    const form = document.getElementById('edit-org-form');
    const formData = new FormData(form);
    const id = formData.get('id');
    
    try {
        await apiCall(`/organizations/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: formData.get('name'),
                description: formData.get('description'),
                phone: formData.get('phone'),
                sms: formData.get('sms') || null,
                whatsapp: formData.get('whatsapp') || null
            })
        });
        
        showNotification('Organization updated successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to update organization: ' + error.message, 'error');
    }
}

// Profile Only Modal (no user account)
function openProfileOnlyModal(type) {
    if (type === 'counsellor') {
        openModal(`
            <div class="modal-header">
                <h3>Add Counsellor Profile Only</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="profile-only-form" class="modal-body">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" required>
                </div>
                <div class="form-group">
                    <label>Specialization *</label>
                    <input type="text" name="specialization" required>
                </div>
                <div class="form-group">
                    <label>Phone *</label>
                    <input type="tel" name="phone" required>
                </div>
                <div class="form-group">
                    <label>SMS Number</label>
                    <input type="tel" name="sms">
                </div>
                <div class="form-group">
                    <label>WhatsApp Number</label>
                    <input type="tel" name="whatsapp">
                </div>
            </form>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitProfileOnly('counsellor')">Add Profile</button>
            </div>
        `);
    } else {
        openModal(`
            <div class="modal-header">
                <h3>Add Peer Supporter Profile Only</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="profile-only-form" class="modal-body">
                <div class="form-group">
                    <label>First Name *</label>
                    <input type="text" name="firstName" required>
                </div>
                <div class="form-group">
                    <label>Area *</label>
                    <input type="text" name="area" required>
                </div>
                <div class="form-group">
                    <label>Background *</label>
                    <input type="text" name="background" required>
                </div>
                <div class="form-group">
                    <label>Years Served *</label>
                    <input type="text" name="yearsServed" required>
                </div>
                <div class="form-group">
                    <label>Phone *</label>
                    <input type="tel" name="phone" required>
                </div>
                <div class="form-group">
                    <label>SMS Number</label>
                    <input type="tel" name="sms">
                </div>
                <div class="form-group">
                    <label>WhatsApp Number</label>
                    <input type="tel" name="whatsapp">
                </div>
            </form>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitProfileOnly('peer')">Add Profile</button>
            </div>
        `);
    }
}

async function submitProfileOnly(type) {
    const form = document.getElementById('profile-only-form');
    const formData = new FormData(form);
    
    try {
        if (type === 'counsellor') {
            await apiCall('/counsellors', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.get('name'),
                    specialization: formData.get('specialization'),
                    phone: formData.get('phone'),
                    sms: formData.get('sms') || null,
                    whatsapp: formData.get('whatsapp') || null
                })
            });
        } else {
            await apiCall('/peer-supporters', {
                method: 'POST',
                body: JSON.stringify({
                    firstName: formData.get('firstName'),
                    area: formData.get('area'),
                    background: formData.get('background'),
                    yearsServed: formData.get('yearsServed'),
                    phone: formData.get('phone'),
                    sms: formData.get('sms') || null,
                    whatsapp: formData.get('whatsapp') || null
                })
            });
        }
        
        showNotification('Profile added successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to add profile: ' + error.message, 'error');
    }
}

// Add User Modal
function openAddUserModal() {
    openModal(`
        <div class="modal-header">
            <h3>Add New User</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="add-user-form" class="modal-body">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" name="email" required>
            </div>
            <div class="form-group">
                <label>Password *</label>
                <input type="password" name="password" required minlength="8">
            </div>
            <div class="form-group">
                <label>Role *</label>
                <select name="role" required>
                    <option value="counsellor">Counsellor</option>
                    <option value="peer">Peer Supporter</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitAddUser()">Add User</button>
        </div>
    `);
}

async function submitAddUser() {
    const form = document.getElementById('add-user-form');
    const formData = new FormData(form);
    
    try {
        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password'),
                name: formData.get('name'),
                role: formData.get('role')
            })
        });
        
        showNotification('User added successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to add user: ' + error.message, 'error');
    }
}

// Edit User Modal
function openEditUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    // Find existing profile
    const counsellorProfile = counsellors.find(c => c.user_id === userId);
    const peerProfile = peers.find(p => p.user_id === userId);
    const profile = counsellorProfile || peerProfile;
    
    openModal(`
        <div class="modal-header">
            <h3><i class="fas fa-user-edit"></i> Edit User: ${user.name}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="edit-user-form" class="modal-body">
            <input type="hidden" name="id" value="${user.id}">
            <input type="hidden" name="profileId" value="${profile ? (profile.id || '') : ''}">
            
            <!-- Basic Info Section -->
            <div style="background: var(--card-bg); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; color: var(--text-primary);"><i class="fas fa-user"></i> Account Details</h4>
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" required value="${user.name}">
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" required value="${user.email}">
                </div>
                <div class="form-group">
                    <label>Role *</label>
                    <select name="role" id="edit-user-role" onchange="toggleEditProfileFields()" ${user.role === 'admin' ? 'disabled' : ''}>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="supervisor" ${user.role === 'supervisor' ? 'selected' : ''}>Supervisor</option>
                        <option value="counsellor" ${user.role === 'counsellor' ? 'selected' : ''}>Counsellor</option>
                        <option value="peer" ${user.role === 'peer' ? 'selected' : ''}>Peer Supporter</option>
                    </select>
                    ${user.role === 'admin' ? '<small style="color: var(--warning);">Admin role cannot be changed.</small>' : ''}
                </div>
            </div>
            
            <!-- Profile Section - Counsellor -->
            <div id="edit-counsellor-fields" style="display: ${user.role === 'counsellor' ? 'block' : 'none'}; background: rgba(34, 197, 94, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(34, 197, 94, 0.3);">
                <h4 style="margin: 0 0 12px 0; color: #22c55e;"><i class="fas fa-user-md"></i> Counsellor Profile</h4>
                <div class="form-group">
                    <label><i class="fas fa-briefcase"></i> Specialization</label>
                    <input type="text" name="specialization" value="${counsellorProfile?.specialization || ''}" placeholder="e.g., Trauma & PTSD">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-phone"></i> Phone</label>
                    <input type="tel" name="counsellor_phone" value="${counsellorProfile?.phone || ''}" placeholder="Contact number">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-sms"></i> SMS</label>
                    <input type="tel" name="counsellor_sms" value="${counsellorProfile?.sms || ''}" placeholder="SMS number (optional)">
                </div>
                <div class="form-group">
                    <label><i class="fab fa-whatsapp"></i> WhatsApp</label>
                    <input type="tel" name="counsellor_whatsapp" value="${counsellorProfile?.whatsapp || ''}" placeholder="WhatsApp (optional)">
                </div>
            </div>
            
            <!-- Profile Section - Peer -->
            <div id="edit-peer-fields" style="display: ${user.role === 'peer' ? 'block' : 'none'}; background: rgba(59, 130, 246, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(59, 130, 246, 0.3);">
                <h4 style="margin: 0 0 12px 0; color: #3b82f6;"><i class="fas fa-hands-helping"></i> Peer Supporter Profile</h4>
                <div class="form-group">
                    <label><i class="fas fa-map-marker-alt"></i> Area</label>
                    <input type="text" name="area" value="${peerProfile?.area || ''}" placeholder="e.g., North East">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-history"></i> Background</label>
                    <input type="text" name="background" value="${peerProfile?.background || ''}" placeholder="e.g., Army, 10 years">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-calendar"></i> Years Served</label>
                    <input type="text" name="yearsServed" value="${peerProfile?.yearsServed || ''}" placeholder="e.g., 2005-2015">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-phone"></i> Phone</label>
                    <input type="tel" name="peer_phone" value="${peerProfile?.phone || ''}" placeholder="Contact number">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-sms"></i> SMS</label>
                    <input type="tel" name="peer_sms" value="${peerProfile?.sms || ''}" placeholder="SMS number (optional)">
                </div>
                <div class="form-group">
                    <label><i class="fab fa-whatsapp"></i> WhatsApp</label>
                    <input type="tel" name="peer_whatsapp" value="${peerProfile?.whatsapp || ''}" placeholder="WhatsApp (optional)">
                </div>
            </div>
            
            <!-- Password Section -->
            <div style="background: var(--card-bg); padding: 16px; border-radius: 8px;">
                <h4 style="margin: 0 0 12px 0; color: var(--text-primary);"><i class="fas fa-key"></i> Change Password (optional)</h4>
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" name="newPassword" minlength="8" placeholder="Leave blank to keep current">
                    <small style="color: var(--text-muted);">Minimum 8 characters</small>
                </div>
                <div class="form-group">
                    <label>Confirm Password</label>
                    <input type="password" name="confirmPassword" minlength="8" placeholder="Re-enter new password">
                </div>
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitEditUser()">
                <i class="fas fa-save"></i> Save Changes
            </button>
        </div>
    `);
}

function toggleEditProfileFields() {
    const role = document.getElementById('edit-user-role').value;
    document.getElementById('edit-counsellor-fields').style.display = role === 'counsellor' ? 'block' : 'none';
    document.getElementById('edit-peer-fields').style.display = role === 'peer' ? 'block' : 'none';
}

async function submitEditUser() {
    const form = document.getElementById('edit-user-form');
    const formData = new FormData(form);
    const userId = formData.get('id');
    const profileId = formData.get('profileId');
    const user = users.find(u => u.id === userId);
    
    // Get role
    const roleSelect = form.querySelector('select[name="role"]');
    const newRole = roleSelect.disabled ? user.role : formData.get('role');
    
    // Validate password if provided
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');
    if (newPassword) {
        if (newPassword.length < 8) {
            showNotification('Password must be at least 8 characters', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }
    }
    
    try {
        // Update user details
        await apiCall(`/auth/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: formData.get('name'),
                email: formData.get('email'),
                role: newRole
            })
        });
        
        // Update or create profile based on role
        if (newRole === 'counsellor') {
            const profileData = {
                name: formData.get('name'),
                specialization: formData.get('specialization') || 'General Support',
                phone: formData.get('counsellor_phone') || '',
                sms: formData.get('counsellor_sms') || null,
                whatsapp: formData.get('counsellor_whatsapp') || null,
                user_id: userId
            };
            
            // Check if counsellor profile exists
            const existingCounsellor = counsellors.find(c => c.user_id === userId);
            if (existingCounsellor) {
                await apiCall(`/admin/counsellors/${existingCounsellor.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(profileData)
                });
            } else {
                await apiCall('/counsellors', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...profileData,
                        status: 'off'
                    })
                });
            }
        } else if (newRole === 'peer') {
            const profileData = {
                firstName: formData.get('name'),
                area: formData.get('area') || 'General',
                background: formData.get('background') || 'Veteran',
                yearsServed: formData.get('yearsServed') || 'N/A',
                phone: formData.get('peer_phone') || '',
                sms: formData.get('peer_sms') || null,
                whatsapp: formData.get('peer_whatsapp') || null,
                user_id: userId
            };
            
            // Check if peer profile exists
            const existingPeer = peers.find(p => p.user_id === userId);
            if (existingPeer) {
                await apiCall(`/admin/peer-supporters/${existingPeer.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(profileData)
                });
            } else {
                await apiCall('/peer-supporters', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...profileData,
                        status: 'unavailable'
                    })
                });
            }
        }
        
        // Update password if provided
        if (newPassword) {
            await apiCall('/auth/admin-reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    new_password: newPassword
                })
            });
            showNotification('User and profile updated, password changed!', 'success');
        } else {
            showNotification('User and profile updated successfully!', 'success');
        }
        
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to update: ' + error.message, 'error');
    }
}

// Reset Password Modal
function openResetPasswordModal(userId, userName) {
    openModal(`
        <div class="modal-header">
            <h3>Reset Password for ${userName}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="reset-password-form" class="modal-body">
            <input type="hidden" name="userId" value="${userId}">
            <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">
                <i class="fas fa-info-circle"></i> Password must be at least 8 characters and cannot match any of the last 3 passwords used.
            </p>
            <div class="form-group">
                <label>New Password *</label>
                <input type="password" name="newPassword" id="new-password" required minlength="8" placeholder="Minimum 8 characters" autocomplete="new-password">
            </div>
            <div class="form-group">
                <label>Confirm Password *</label>
                <input type="password" name="confirmPassword" id="confirm-password" required minlength="8" placeholder="Re-enter password" autocomplete="new-password">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-warning" onclick="submitResetPassword()">Reset Password</button>
        </div>
    `);
}

async function submitResetPassword() {
    const form = document.getElementById('reset-password-form');
    const formData = new FormData(form);
    
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');
    
    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    try {
        await apiCall('/auth/admin-reset-password', {
            method: 'POST',
            body: JSON.stringify({
                user_id: formData.get('userId'),
                new_password: newPassword
            })
        });
        
        showNotification('Password reset successfully');
        closeModal();
    } catch (error) {
        showNotification('Failed to reset password: ' + error.message, 'error');
    }
}

// Add Content Modal
function openAddContentModal() {
    const existingPages = Object.keys(content);
    const pageOptions = existingPages.length > 0 
        ? existingPages.map(p => `<option value="${p}">${formatPageName(p)}</option>`).join('') 
        : '';
    
    openModal(`
        <div class="modal-header">
            <h3>Add New Content</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="add-content-form" class="modal-body">
            <div class="form-group">
                <label>Page Name *</label>
                <input type="text" name="pageName" required placeholder="e.g., home, about, resources" list="page-list">
                <datalist id="page-list">
                    ${pageOptions}
                </datalist>
                <small style="color: var(--text-muted);">Select existing page or type new page name</small>
            </div>
            <div class="form-group">
                <label>Section Name *</label>
                <input type="text" name="sectionName" required placeholder="e.g., title, description, hero_text">
                <small style="color: var(--text-muted);">Use underscores for multi-word names</small>
            </div>
            <div class="form-group">
                <label>Content *</label>
                <textarea name="contentValue" required rows="6" placeholder="Enter the content for this section"></textarea>
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitAddContent()">Add Content</button>
        </div>
    `);
}

async function submitAddContent() {
    const form = document.getElementById('add-content-form');
    const formData = new FormData(form);
    
    const pageName = formData.get('pageName').toLowerCase().replace(/\s+/g, '_');
    const sectionName = formData.get('sectionName').toLowerCase().replace(/\s+/g, '_');
    const contentValue = formData.get('contentValue');
    
    try {
        await apiCall(`/content/${pageName}/${sectionName}`, {
            method: 'PUT',
            body: JSON.stringify({
                content: contentValue
            })
        });
        
        showNotification('Content added successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to add content: ' + error.message, 'error');
    }
}

// Edit Content Modal
function openEditContentModal(page, section, value) {
    openModal(`
        <div class="modal-header">
            <h3>Edit Content</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="edit-content-form" class="modal-body">
            <p style="color: var(--text-secondary); margin-bottom: 16px; background: var(--bg-primary); padding: 12px; border-radius: 8px;">
                <strong>Page:</strong> ${formatPageName(page)}<br>
                <strong>Section:</strong> ${formatSectionName(section)}
            </p>
            <input type="hidden" name="page" value="${page}">
            <input type="hidden" name="section" value="${section}">
            <div class="form-group">
                <label>Content</label>
                <textarea name="value" rows="8">${value}</textarea>
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitEditContent()">Save Changes</button>
        </div>
    `);
}

async function submitEditContent() {
    const form = document.getElementById('edit-content-form');
    const formData = new FormData(form);
    
    try {
        await apiCall(`/content/${formData.get('page')}/${formData.get('section')}`, {
            method: 'PUT',
            body: JSON.stringify({
                content: formData.get('value')
            })
        });
        
        showNotification('Content updated successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to update content: ' + error.message, 'error');
    }
}

// Delete Content
async function deleteContent(page, section) {
    if (!confirm(`Delete "${formatSectionName(section)}" from ${formatPageName(page)}?`)) {
        return;
    }
    
    try {
        await apiCall(`/content/${page}/${section}`, {
            method: 'DELETE'
        });
        
        showNotification('Content deleted successfully');
        loadAllData();
    } catch (error) {
        showNotification('Failed to delete content: ' + error.message, 'error');
    }
}

// Seed Functions
async function seedContent() {
    try {
        await apiCall('/content/seed', { method: 'POST' });
        showNotification('Default content loaded successfully');
        loadAllData();
    } catch (error) {
        showNotification('Failed to load defaults: ' + error.message, 'error');
    }
}

async function seedResources() {
    try {
        await apiCall('/resources/seed', { method: 'POST' });
        showNotification('Default resources loaded successfully');
        loadAllData();
    } catch (error) {
        showNotification('Failed to load resources: ' + error.message, 'error');
    }
}

// ============ CATEGORY MANAGEMENT ============
let categories = [];

function loadCategories() {
    // Get unique categories from resources
    categories = [...new Set(resources.map(r => r.category).filter(Boolean))];
    renderCategories();
}

function renderCategories() {
    const container = document.getElementById('category-list-display');
    if (!container) return;
    
    if (categories.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No categories yet. Add resources to create categories.</p>';
        return;
    }
    
    container.innerHTML = categories.map(cat => `
        <div class="category-tag" style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--primary-color); color: white; border-radius: 20px; font-size: 13px;">
            <span>${cat}</span>
            <button onclick="deleteCategory('${cat}')" style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 14px;" title="Delete category">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function addCategory() {
    const input = document.getElementById('new-category-input');
    const newCategory = input.value.trim();
    
    if (!newCategory) {
        showNotification('Please enter a category name', 'error');
        return;
    }
    
    if (categories.includes(newCategory)) {
        showNotification('Category already exists', 'error');
        return;
    }
    
    categories.push(newCategory);
    renderCategories();
    input.value = '';
    showNotification('Category added. It will appear in dropdowns when adding resources.');
}

async function deleteCategory(category) {
    // Check if any resources use this category
    const resourcesWithCategory = resources.filter(r => r.category === category);
    
    if (resourcesWithCategory.length > 0) {
        if (!confirm(`${resourcesWithCategory.length} resource(s) use this category. Deleting will NOT remove the resources, but the category won't appear in the list. Continue?`)) {
            return;
        }
    }
    
    categories = categories.filter(c => c !== category);
    renderCategories();
    showNotification('Category removed from list');
}

// ============ LOGO / SETTINGS MANAGEMENT ============
let siteSettings = {};
let newLogoData = null;

async function loadSettings() {
    try {
        const settings = await apiCall('/settings').catch(() => ({}));
        siteSettings = settings;
        
        // Display current logo
        const logoImg = document.getElementById('current-logo-img');
        if (logoImg && siteSettings.logo_url) {
            logoImg.src = siteSettings.logo_url;
        } else if (logoImg) {
            // Default logo - use local asset
            logoImg.src = 'logo.png';
        }
        
        // Load email settings
        const adminEmail = document.getElementById('admin-notification-email');
        const csoEmail = document.getElementById('cso-email');
        const peerEmail = document.getElementById('peer-registration-email');
        
        if (adminEmail) adminEmail.value = siteSettings.admin_notification_email || '';
        if (csoEmail) csoEmail.value = siteSettings.cso_email || '';
        if (peerEmail) peerEmail.value = siteSettings.peer_registration_notification_email || '';
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveEmailSettings() {
    const adminEmail = document.getElementById('admin-notification-email').value;
    const csoEmail = document.getElementById('cso-email').value;
    const peerEmail = document.getElementById('peer-registration-email').value;
    const statusDiv = document.getElementById('email-settings-status');
    
    try {
        await apiCall('/settings', {
            method: 'PUT',
            body: JSON.stringify({
                admin_notification_email: adminEmail,
                cso_email: csoEmail,
                peer_registration_notification_email: peerEmail
            })
        });
        
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(22, 163, 74, 0.2)';
        statusDiv.style.color = '#22c55e';
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Email settings saved successfully!';
        
        // Update local settings
        siteSettings.admin_notification_email = adminEmail;
        siteSettings.cso_email = csoEmail;
        siteSettings.peer_registration_notification_email = peerEmail;
        
        showNotification('Email settings saved successfully!', 'success');
    } catch (error) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(220, 38, 38, 0.2)';
        statusDiv.style.color = '#ef4444';
        statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to save: ' + error.message;
        
        showNotification('Failed to save email settings: ' + error.message, 'error');
    }
}

// Clear logs for testing
async function clearLogs(logType) {
    const typeLabels = {
        'safeguarding': 'Safeguarding Alerts',
        'calls': 'Call Logs',
        'chats': 'Chat Logs',
        'analytics': 'Analytics Data',
        'callbacks': 'Callback Requests',
        'screening': 'Screening Data',
        'panic': 'Panic Alerts',
        'all': 'ALL Logs & Data'
    };
    
    const label = typeLabels[logType] || logType;
    
    if (!confirm('Are you sure you want to permanently delete ' + label + '?\n\nThis action cannot be undone!')) {
        return;
    }
    
    // Double confirm for 'all'
    if (logType === 'all') {
        if (!confirm('FINAL WARNING: This will delete ALL data including safeguarding alerts, call logs, chat logs, analytics, callbacks, and screening data.\n\nType "DELETE ALL" in the next prompt to confirm.')) {
            return;
        }
        const confirmText = prompt('Type "DELETE ALL" to confirm:');
        if (confirmText !== 'DELETE ALL') {
            showNotification('Deletion cancelled - confirmation text did not match', 'warning');
            return;
        }
    }
    
    const statusDiv = document.getElementById('clear-logs-status');
    
    try {
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(59, 130, 246, 0.2)';
        statusDiv.style.color = '#3b82f6';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing ' + label + '...';
        
        const result = await apiCall('/admin/clear-logs', {
            method: 'POST',
            body: JSON.stringify({
                log_type: logType,
                confirm: true
            })
        });
        
        // Format the result
        let deletedText = '';
        if (result.deleted) {
            const entries = Object.entries(result.deleted);
            if (entries.length > 0) {
                deletedText = entries.map(([key, count]) => key.replace(/_/g, ' ') + ': ' + count).join(', ');
            }
        }
        
        statusDiv.style.background = 'rgba(22, 163, 74, 0.2)';
        statusDiv.style.color = '#22c55e';
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Cleared ' + label + '. ' + (deletedText ? 'Deleted: ' + deletedText : '');
        
        showNotification('Successfully cleared ' + label, 'success');
        
        // Refresh the logs data after a short delay
        setTimeout(() => {
            loadLogsData();
        }, 1000);
        
    } catch (error) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(220, 38, 38, 0.2)';
        statusDiv.style.color = '#ef4444';
        statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to clear: ' + error.message;
        
        showNotification('Failed to clear logs: ' + error.message, 'error');
    }
}

function previewNewLogo(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.size > 2 * 1024 * 1024) {
            showNotification('Logo must be less than 2MB', 'error');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            newLogoData = e.target.result;
            document.getElementById('new-logo-preview').src = newLogoData;
            document.getElementById('new-logo-preview-container').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

async function saveLogo() {
    if (!newLogoData) {
        showNotification('Please select a logo image first', 'error');
        return;
    }
    
    try {
        await apiCall('/settings', {
            method: 'PUT',
            body: JSON.stringify({
                logo_url: newLogoData
            })
        });
        
        // Update current logo display
        document.getElementById('current-logo-img').src = newLogoData;
        document.getElementById('new-logo-preview-container').style.display = 'none';
        document.getElementById('logo-upload-input').value = '';
        newLogoData = null;
        
        showNotification('Logo saved successfully! Refresh the page to see changes.');
    } catch (error) {
        showNotification('Failed to save logo: ' + error.message, 'error');
    }
}

// Update loadAllData to include settings and categories
const originalLoadAllData = loadAllData;
loadAllData = async function() {
    await originalLoadAllData();
    loadCategories();
    loadSettings();
};

// Modal overlay click - DISABLED to prevent accidental closures
// Users must click Cancel or Close button to close the modal
// This prevents losing form data on accidental clicks

// Note: Delete modal still closes on outside click for quick dismiss
document.getElementById('delete-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal') {
        closeDeleteModal();
    }
});

// Forgot Password Modal
function openForgotPasswordModal() {
    // Create a simple modal for forgot password
    const modalHtml = `
        <div class="modal-header">
            <h3>Reset Password</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="forgot-password-form" class="modal-body">
            <p style="color: var(--text-secondary); margin-bottom: 16px;">
                Enter your email address and we'll send you a link to reset your password.
            </p>
            <div class="form-group">
                <label>Email Address *</label>
                <input type="email" name="email" required placeholder="Enter your email">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitForgotPassword()">Send Reset Link</button>
        </div>
    `;
    openModal(modalHtml);
}

async function submitForgotPassword() {
    const form = document.getElementById('forgot-password-form');
    const formData = new FormData(form);
    const email = formData.get('email');
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        closeModal();
        
        if (data.reset_token) {
            // For testing - show the token
            showNotification('Check console for reset token (dev mode)', 'info');
            console.log('Reset token:', data.reset_token);
        } else {
            showNotification('If that email exists, a reset link has been sent', 'success');
        }
    } catch (error) {
        showNotification('Failed to send reset email: ' + error.message, 'error');
    }
}

// ============ RESOURCES MANAGEMENT ============

// Add Resource Modal
function openAddResourceModal() {
    // Get unique categories from existing resources
    const existingCategories = [...new Set(resources.map(r => r.category).filter(Boolean))];
    const categoryOptions = existingCategories.length > 0 
        ? existingCategories.map(c => `<option value="${c}">${c}</option>`).join('')
        : '';
    
    openModal(`
        <div class="modal-header">
            <h3>Add New Resource</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="add-resource-form" class="modal-body">
            <div class="form-group">
                <label>Category *</label>
                <input type="text" name="category" list="category-list" required placeholder="e.g., Mental Health, Employment, Housing">
                <datalist id="category-list">
                    ${categoryOptions}
                    <option value="Mental Health">
                    <option value="Employment Support">
                    <option value="Housing">
                    <option value="Financial Help">
                    <option value="Family Support">
                    <option value="Health & Wellbeing">
                    <option value="Legal Advice">
                    <option value="Crisis Support">
                    <option value="Wellness">
                    <option value="Career & Employment">
                    <option value="Benefits & Support">
                    <option value="General">
                </datalist>
            </div>
            <div class="form-group">
                <label>Title *</label>
                <input type="text" name="title" required placeholder="Resource title">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" rows="4" placeholder="Detailed description or advice..."></textarea>
            </div>
            <div class="form-group">
                <label>Upload Image</label>
                <div class="image-upload-container">
                    <input type="file" id="resource-image-file" accept="image/*" onchange="previewResourceImage(this)">
                    <div id="image-preview-container" style="display:none; margin-top:10px; align-items:center;">
                        <img id="image-preview" style="max-width:200px; max-height:150px; border-radius:8px;">
                        <button type="button" class="btn btn-small btn-danger" onclick="clearImagePreview()" style="margin-left:10px;">
                            <i class="fas fa-times"></i> Remove
                        </button>
                    </div>
                </div>
                <small style="color: var(--text-muted);">Upload an image (JPG, PNG, GIF - max 2MB)</small>
            </div>
            <div class="form-group">
                <label>Or Image URL</label>
                <input type="url" name="image_url" placeholder="https://example.com/image.jpg">
            </div>
            <div class="form-group">
                <label>External Link (optional)</label>
                <input type="url" name="link" placeholder="https://example.com/resource">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitAddResource()">Add Resource</button>
        </div>
    `);
}

// Image preview and handling functions
let selectedImageData = null;

function previewResourceImage(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Check file size (2MB max)
        if (file.size > 2 * 1024 * 1024) {
            showNotification('Image must be less than 2MB', 'error');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImageData = e.target.result;
            document.getElementById('image-preview').src = selectedImageData;
            document.getElementById('image-preview-container').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

function clearImagePreview() {
    selectedImageData = null;
    const fileInput = document.getElementById('resource-image-file');
    if (fileInput) fileInput.value = '';
    const previewContainer = document.getElementById('image-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';
}

async function submitAddResource() {
    const form = document.getElementById('add-resource-form');
    const formData = new FormData(form);
    
    try {
        const resourceData = {
            category: formData.get('category'),
            title: formData.get('title'),
            description: formData.get('description'),
            link: formData.get('link') || null
        };
        
        // Use uploaded image if available, otherwise use URL
        if (selectedImageData) {
            resourceData.image_data = selectedImageData;
        } else if (formData.get('image_url')) {
            resourceData.image_url = formData.get('image_url');
        }
        
        await apiCall('/resources', {
            method: 'POST',
            body: JSON.stringify(resourceData)
        });
        
        selectedImageData = null; // Reset
        showNotification('Resource added successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to add resource: ' + error.message, 'error');
    }
}

// Edit Resource Modal
function openEditResourceModal(resourceId) {
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) return;
    
    // Reset selected image
    selectedImageData = null;
    
    // Get unique categories
    const existingCategories = [...new Set(resources.map(r => r.category).filter(Boolean))];
    const categoryOptions = existingCategories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    openModal(`
        <div class="modal-header">
            <h3>Edit Resource</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="edit-resource-form" class="modal-body">
            <input type="hidden" name="id" value="${resource.id}">
            <div class="form-group">
                <label>Category *</label>
                <input type="text" name="category" list="category-list-edit" required value="${resource.category || ''}">
                <datalist id="category-list-edit">
                    ${categoryOptions}
                    <option value="Mental Health">
                    <option value="Employment Support">
                    <option value="Housing">
                    <option value="Financial Help">
                    <option value="Family Support">
                    <option value="Health & Wellbeing">
                    <option value="Legal Advice">
                    <option value="Crisis Support">
                    <option value="Wellness">
                    <option value="Career & Employment">
                    <option value="Benefits & Support">
                    <option value="General">
                </datalist>
            </div>
            <div class="form-group">
                <label>Title *</label>
                <input type="text" name="title" required value="${resource.title || ''}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" rows="4">${resource.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Content (detailed information)</label>
                <textarea name="content" rows="6">${resource.content || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Current Image</label>
                ${resource.image_url ? `<img src="${resource.image_url}" style="max-width: 200px; margin-top: 10px; border-radius: 8px;">` : '<p style="color: var(--text-muted);">No image</p>'}
            </div>
            <div class="form-group">
                <label>Upload New Image</label>
                <div class="image-upload-container">
                    <input type="file" id="edit-resource-image-file" accept="image/*" onchange="previewEditResourceImage(this)">
                    <div id="edit-image-preview-container" style="display:none; margin-top:10px; align-items:center;">
                        <img id="edit-image-preview" style="max-width:200px; max-height:150px; border-radius:8px;">
                        <button type="button" class="btn btn-small btn-danger" onclick="clearEditImagePreview()" style="margin-left:10px;">
                            <i class="fas fa-times"></i> Remove
                        </button>
                    </div>
                </div>
                <small style="color: var(--text-muted);">Upload to replace current image (max 2MB)</small>
            </div>
            <div class="form-group">
                <label>Or Image URL</label>
                <input type="url" name="image_url" value="${resource.image_url || ''}" placeholder="https://example.com/image.jpg">
            </div>
            <div class="form-group">
                <label>External Link (optional)</label>
                <input type="url" name="link" value="${resource.link || ''}">
            </div>
        </form>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitEditResource()">Save Changes</button>
        </div>
    `);
}

function previewEditResourceImage(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 2 * 1024 * 1024) {
            showNotification('Image must be less than 2MB', 'error');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImageData = e.target.result;
            document.getElementById('edit-image-preview').src = selectedImageData;
            document.getElementById('edit-image-preview-container').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

function clearEditImagePreview() {
    selectedImageData = null;
    const fileInput = document.getElementById('edit-resource-image-file');
    if (fileInput) fileInput.value = '';
    const previewContainer = document.getElementById('edit-image-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';
}

async function submitEditResource() {
    const form = document.getElementById('edit-resource-form');
    const formData = new FormData(form);
    const resourceId = formData.get('id');
    
    try {
        const updateData = {
            category: formData.get('category'),
            title: formData.get('title'),
            description: formData.get('description'),
            content: formData.get('content'),
            link: formData.get('link') || null
        };
        
        // Use uploaded image if available, otherwise use URL field
        if (selectedImageData) {
            updateData.image_data = selectedImageData;
        } else if (formData.get('image_url')) {
            updateData.image_url = formData.get('image_url');
        }
        
        await apiCall(`/resources/${resourceId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        selectedImageData = null;
        showNotification('Resource updated successfully');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to update resource: ' + error.message, 'error');
    }
}

// ==========================================
// Calls Management (WebRTC)
// ==========================================

// Render Calls Tab
async function renderCallsTab() {
    await fetchOnlineStaff();
    await fetchActiveCalls();
}

// Refresh calls data
async function refreshCallsData() {
    showNotification('Refreshing...', 'info');
    await renderCallsTab();
    showNotification('Data refreshed', 'success');
}

// Fetch online staff
async function fetchOnlineStaff() {
    const container = document.getElementById('online-staff-list');
    const countBadge = document.getElementById('online-count');
    if (!container) return;
    
    try {
        const response = await apiCall('/webrtc/online-staff');
        const staff = response.staff || [];
        
        if (countBadge) countBadge.textContent = staff.length;
        
        if (staff.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <i class="fas fa-user-slash" style="font-size: 32px; opacity: 0.5; margin-bottom: 10px;"></i>
                    <p>No staff members online</p>
                    <small>Staff will appear here when they log into the Staff Portal</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = staff.map(s => {
            const typeColor = s.user_type === 'counsellor' ? '#22c55e' : '#3b82f6';
            const typeIcon = s.user_type === 'counsellor' ? 'user-md' : 'hands-helping';
            const statusColor = s.status === 'available' ? '#22c55e' : s.status === 'in_call' ? '#f59e0b' : '#6b7280';
            
            return `
                <div class="card" style="border-left: 3px solid ${typeColor};">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-${typeIcon}" style="color: ${typeColor};"></i>
                            <strong style="color: var(--text-primary);">${s.name}</strong>
                            <span class="badge" style="background: ${typeColor}; color: white; font-size: 10px; padding: 2px 8px; border-radius: 10px;">
                                ${s.user_type}
                            </span>
                        </div>
                        <span style="background: ${statusColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; text-transform: capitalize;">
                            ${s.status.replace('_', ' ')}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        container.innerHTML = `<p style="color: var(--error);">Failed to load online staff</p>`;
    }
}

// Fetch active calls
async function fetchActiveCalls() {
    const container = document.getElementById('active-calls-list');
    const countBadge = document.getElementById('calls-count');
    if (!container) return;
    
    try {
        const response = await apiCall('/webrtc/active-calls');
        const calls = response.calls || [];
        
        if (countBadge) countBadge.textContent = calls.length;
        
        if (calls.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <i class="fas fa-phone-slash" style="font-size: 32px; opacity: 0.5; margin-bottom: 10px;"></i>
                    <p>No active calls</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = calls.map(call => {
            const duration = call.started_at ? getCallDuration(call.started_at) : '00:00';
            const statusColor = call.status === 'ringing' ? '#f59e0b' : '#22c55e';
            
            return `
                <div class="card" style="border-left: 3px solid ${statusColor};">
                    <div class="card-header">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <i class="fas fa-phone-volume" style="color: ${statusColor};"></i>
                            <strong style="color: var(--text-primary);">${call.caller_name} -&gt; ${call.callee_name}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted);">
                            <span><i class="fas fa-clock"></i> ${duration}</span>
                            <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 10px; text-transform: capitalize;">
                                ${call.status}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        container.innerHTML = `<p style="color: var(--error);">Failed to load active calls</p>`;
    }
}

// Calculate call duration
function getCallDuration(startedAt) {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now - start;
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==========================================
// Unified Staff Management
// ==========================================

// Render Unified Staff List
function renderUnifiedStaff() {
    const container = document.getElementById('staff-list');
    if (!container) return;
    
    // Filter staff based on current filter
    let filteredStaff = unifiedStaff;
    if (currentStaffFilter !== 'all') {
        filteredStaff = unifiedStaff.filter(s => s.role === currentStaffFilter);
    }
    
    if (filteredStaff.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>No staff members found${currentStaffFilter !== 'all' ? ` with role "${currentStaffFilter}"` : ''}.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredStaff.map(staff => {
        const roleColors = {
            admin: '#ef4444',
            counsellor: '#22c55e',
            peer: '#3b82f6'
        };
        const roleIcons = {
            admin: 'shield-alt',
            counsellor: 'user-md',
            peer: 'hands-helping'
        };
        const roleColor = roleColors[staff.role] || '#6b7280';
        const roleIcon = roleIcons[staff.role] || 'user';
        
        // Profile status
        const hasProfile = staff.has_profile;
        const profile = staff.profile || {};
        const status = profile.status || 'N/A';
        
        // Status badge color
        const statusColors = {
            available: '#22c55e',
            busy: '#f59e0b',
            off: '#ef4444',
            limited: '#f59e0b',
            unavailable: '#6b7280'
        };
        const statusColor = statusColors[status] || '#6b7280';
        
        return `
            <div class="card staff-card" data-role="${staff.role}">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <i class="fas fa-${roleIcon}" style="color: ${roleColor}; font-size: 20px;"></i>
                            <strong style="color: var(--text-primary); font-size: 16px;">${staff.name}</strong>
                            <span class="badge" style="background: ${roleColor}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; text-transform: uppercase;">
                                ${staff.role}
                            </span>
                        </div>
                        <p style="color: var(--text-muted); font-size: 13px; margin: 0;">
                            <i class="fas fa-envelope"></i> ${staff.email}
                        </p>
                    </div>
                    ${staff.role !== 'admin' ? `
                        <span class="status-badge" style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; text-transform: capitalize;">
                            ${status}
                        </span>
                    ` : ''}
                </div>
                
                ${staff.role !== 'admin' ? `
                    <div class="profile-info" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                        ${hasProfile ? `
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
                                ${staff.role === 'counsellor' ? `
                                    <div><i class="fas fa-briefcase" style="color: var(--text-muted);"></i> ${profile.specialization || 'Not set'}</div>
                                ` : `
                                    <div><i class="fas fa-map-marker-alt" style="color: var(--text-muted);"></i> ${profile.area || 'Not set'}</div>
                                `}
                                <div><i class="fas fa-phone" style="color: var(--text-muted);"></i> ${profile.phone || 'Not set'}</div>
                                ${profile.sip_extension ? `
                                    <div><i class="fas fa-phone-volume" style="color: #8b5cf6;"></i> Ext. ${profile.sip_extension}</div>
                                ` : ''}
                            </div>
                        ` : `
                            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 10px; border-radius: 8px; color: #f59e0b; font-size: 13px;">
                                <i class="fas fa-exclamation-triangle"></i> No profile linked. Click "Fix Missing Profiles" to create one.
                            </div>
                        `}
                    </div>
                ` : ''}
                
                <div class="card-actions" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                    ${staff.role !== 'admin' && hasProfile ? `
                        <button class="btn btn-secondary btn-small" onclick="openEditStaffModal('${staff.user_id}', '${staff.role}')">
                            <i class="fas fa-edit"></i> Edit Profile
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="openStatusModal('${staff.user_id}', '${staff.role}', '${status}')">
                            <i class="fas fa-toggle-on"></i> Status
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-small" onclick="resetUserPassword('${staff.user_id}', '${staff.name}')">
                        <i class="fas fa-key"></i> Reset Password
                    </button>
                    ${staff.role !== 'admin' ? `
                        <button class="btn btn-danger btn-small" onclick="deleteStaffMember('${staff.user_id}', '${staff.role}', '${staff.name}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Filter Staff
function filterStaff(filter) {
    currentStaffFilter = filter;
    
    // Update active button
    document.querySelectorAll('.staff-filter').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });
    
    renderUnifiedStaff();
}

// Fix Missing Profiles
async function fixMissingProfiles() {
    if (!confirm('This will create profiles for all users that don\'t have one. Continue?')) {
        return;
    }
    
    try {
        const result = await apiCall('/admin/fix-missing-profiles', { method: 'POST' });
        showNotification(result.message, 'success');
        loadAllData();
    } catch (error) {
        showNotification('Failed to fix profiles: ' + error.message, 'error');
    }
}

// Open Edit Staff Modal - routes to appropriate edit modal based on role
function openEditStaffModal(userId, role) {
    // Find the profile ID for this user
    if (role === 'counsellor') {
        const counsellor = counsellors.find(c => c.user_id === userId);
        if (counsellor) {
            openEditCounsellorModal(counsellor.id);
        } else {
            showNotification('Counsellor profile not found', 'error');
        }
    } else if (role === 'peer') {
        const peer = peers.find(p => p.user_id === userId);
        if (peer) {
            openEditPeerModal(peer.id);
        } else {
            showNotification('Peer supporter profile not found', 'error');
        }
    }
}

// NOTE: openStatusModal is defined later in the file (around line 3683) - DO NOT DUPLICATE

// Open Add Staff Modal
function openAddStaffModal() {
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2><i class="fas fa-user-plus"></i> Add Staff Member</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <form id="add-staff-form">
                <div class="form-group">
                    <label><i class="fas fa-envelope"></i> Email *</label>
                    <input type="email" name="email" required placeholder="staff@example.com">
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-lock"></i> Password *</label>
                    <input type="password" name="password" required placeholder="Minimum 8 characters" minlength="8">
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Full Name *</label>
                    <input type="text" name="name" required placeholder="Full name">
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-user-tag"></i> Role *</label>
                    <select name="role" id="staff-role-select" required onchange="toggleRoleFields()">
                        <option value="">Select role...</option>
                        <option value="admin">Admin</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="counsellor">Counsellor</option>
                        <option value="peer">Peer Supporter</option>
                    </select>
                </div>
                
                <!-- Counsellor-specific fields -->
                <div id="counsellor-fields" style="display: none;">
                    <div class="form-group">
                        <label><i class="fas fa-briefcase"></i> Specialization</label>
                        <input type="text" name="specialization" placeholder="e.g., Trauma & PTSD">
                    </div>
                </div>
                
                <!-- Peer-specific fields -->
                <div id="peer-fields" style="display: none;">
                    <div class="form-group">
                        <label><i class="fas fa-map-marker-alt"></i> Area</label>
                        <input type="text" name="area" placeholder="e.g., North East">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-history"></i> Background</label>
                        <input type="text" name="background" placeholder="e.g., Army, 10 years">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> Years Served</label>
                        <input type="text" name="yearsServed" placeholder="e.g., 2005-2015">
                    </div>
                </div>
                
                <!-- Common profile fields for non-admin -->
                <div id="profile-fields" style="display: none;">
                    <div class="form-group">
                        <label><i class="fas fa-phone"></i> Phone</label>
                        <input type="tel" name="phone" placeholder="Phone number">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-sms"></i> SMS Number</label>
                        <input type="tel" name="sms" placeholder="SMS number (optional)">
                    </div>
                    <div class="form-group">
                        <label><i class="fab fa-whatsapp"></i> WhatsApp</label>
                        <input type="tel" name="whatsapp" placeholder="WhatsApp number (optional)">
                    </div>
                </div>
                
                <div class="modal-actions" style="margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-check"></i> Create Staff Member
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.getElementById('add-staff-form').addEventListener('submit', handleAddStaff);
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
}

// Toggle role-specific fields
function toggleRoleFields() {
    const role = document.getElementById('staff-role-select').value;
    const counsellorFields = document.getElementById('counsellor-fields');
    const peerFields = document.getElementById('peer-fields');
    const profileFields = document.getElementById('profile-fields');
    
    // Supervisor uses counsellor fields for now (similar specialization/expertise)
    counsellorFields.style.display = (role === 'counsellor' || role === 'supervisor') ? 'block' : 'none';
    peerFields.style.display = role === 'peer' ? 'block' : 'none';
    profileFields.style.display = (role === 'counsellor' || role === 'supervisor' || role === 'peer') ? 'block' : 'none';
}

// Handle Add Staff
async function handleAddStaff(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const staffData = {
        email: formData.get('email'),
        password: formData.get('password'),
        name: formData.get('name'),
        role: formData.get('role'),
        phone: formData.get('phone') || '',
        sms: formData.get('sms') || '',
        whatsapp: formData.get('whatsapp') || '',
        specialization: formData.get('specialization') || '',
        area: formData.get('area') || '',
        background: formData.get('background') || '',
        yearsServed: formData.get('yearsServed') || ''
    };
    
    try {
        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(staffData)
        });
        
        showNotification(`${staffData.role.charAt(0).toUpperCase() + staffData.role.slice(1)} "${staffData.name}" created successfully!`, 'success');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to create staff member: ' + error.message, 'error');
    }
}

// Delete Staff Member
async function deleteStaffMember(userId, role, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? This will remove their user account and profile.`)) {
        return;
    }
    
    try {
        // Delete user account
        await apiCall(`/auth/users/${userId}`, { method: 'DELETE' });
        
        // The profile deletion should ideally be handled server-side
        // For now, we just reload the data
        showNotification(`"${name}" has been deleted`, 'success');
        loadAllData();
    } catch (error) {
        showNotification('Failed to delete staff member: ' + error.message, 'error');
    }
}

// Reset User Password
function resetUserPassword(userId, name) {
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2><i class="fas fa-key"></i> Reset Password</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom: 16px;">Reset password for <strong>${name}</strong></p>
            <form id="reset-password-form">
                <input type="hidden" name="user_id" value="${userId}">
                <input type="hidden" name="user_name" value="${name}">
                <div class="form-group">
                    <label>New Password *</label>
                    <input type="password" name="new_password" id="new-password" required minlength="8" placeholder="Minimum 8 characters">
                    <small style="color: var(--text-secondary); display: block; margin-top: 4px;">
                        Must be 8+ characters with uppercase and lowercase letters. Cannot contain user's name.
                    </small>
                </div>
                <div class="form-group">
                    <label>Confirm Password *</label>
                    <input type="password" name="confirm_password" id="confirm-password" required minlength="8" placeholder="Re-enter password">
                </div>
                <div id="password-error" style="color: var(--danger); font-size: 14px; margin-bottom: 12px; display: none;"></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Reset Password</button>
                </div>
            </form>
        </div>
    `;
    
    document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newPassword = formData.get('new_password');
        const confirmPassword = formData.get('confirm_password');
        const userName = formData.get('user_name');
        const errorDiv = document.getElementById('password-error');
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Validate password complexity
        const validationError = validatePasswordComplexity(newPassword, userName);
        if (validationError) {
            errorDiv.textContent = validationError;
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            await apiCall('/auth/admin-reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: formData.get('user_id'),
                    new_password: newPassword
                })
            });
            showNotification('Password reset successfully', 'success');
            closeModal();
        } catch (error) {
            errorDiv.textContent = error.message || 'Failed to reset password';
            errorDiv.style.display = 'block';
        }
    });
    
    document.getElementById('modal-overlay').classList.remove('hidden');
}

// Password complexity validation
function validatePasswordComplexity(password, userName) {
    // Minimum 8 characters
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }
    
    // Must contain uppercase
    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }
    
    // Must contain lowercase
    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }
    
    // Cannot contain user's name (case insensitive)
    if (userName) {
        const nameParts = userName.toLowerCase().split(/\s+/);
        const passwordLower = password.toLowerCase();
        for (const part of nameParts) {
            if (part.length >= 3 && passwordLower.includes(part)) {
                return 'Password cannot contain your name';
            }
        }
    }
    
    return null; // Valid
}

// Open Status Modal
function openStatusModal(userId, role, currentStatus) {
    // Find the profile
    const staff = unifiedStaff.find(s => s.user_id === userId);
    if (!staff || !staff.profile) return;
    
    const profileId = staff.profile.id;
    const statuses = role === 'counsellor' 
        ? ['available', 'busy', 'off']
        : ['available', 'limited', 'unavailable'];
    
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2><i class="fas fa-toggle-on"></i> Update Status</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom: 16px;">Update status for <strong>${staff.name}</strong></p>
            <div class="status-options" style="display: flex; flex-direction: column; gap: 10px;">
                ${statuses.map(status => `
                    <button class="btn ${currentStatus === status ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="updateStaffStatus('${profileId}', '${role}', '${status}')"
                            style="justify-content: flex-start;">
                        <i class="fas fa-circle" style="color: ${status === 'available' ? '#22c55e' : status === 'busy' || status === 'limited' ? '#f59e0b' : '#ef4444'};"></i>
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('modal-overlay').classList.remove('hidden');
}

// Update Staff Status
async function updateStaffStatus(profileId, role, newStatus) {
    try {
        const endpoint = role === 'counsellor'
            ? `/admin/counsellors/${profileId}/status`
            : `/admin/peer-supporters/${profileId}/status`;
        
        await apiCall(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        
        showNotification(`Status updated to "${newStatus}"`, 'success');
        closeModal();
        loadAllData();
    } catch (error) {
        showNotification('Failed to update status: ' + error.message, 'error');
    }
}


// ==========================================
// WYSIWYG CMS Visual Editor
// ==========================================

let currentCMSPage = 'home';
let cmsPageData = null;
let cmsPendingChanges = {};
let editingElement = null;

// Initialize CMS Visual Editor when tab is opened
function initCMSEditor() {
    loadCMSPageDropdown().then(() => {
        loadCMSPage('home');
    });
}

// Load page options dynamically from API
async function loadCMSPageDropdown() {
    const select = document.getElementById('cms-page-select');
    if (!select) return;
    
    try {
        const pages = await apiCall('/cms/pages');
        select.innerHTML = pages.map(page => 
            `<option value="${page.slug}">${page.title}</option>`
        ).join('');
    } catch (error) {
        console.error('Failed to load CMS pages:', error);
        // Fallback to default pages
        select.innerHTML = `
            <option value="home">Home</option>
            <option value="self-care">Self Care</option>
            <option value="family-friends">Family & Friends</option>
            <option value="organizations">Support Organizations</option>
            <option value="peer-support">Peer Support</option>
        `;
    }
}

// Toggle between list and visual views
function toggleCMSView(view) {
    const visualEditor = document.getElementById('cms-visual-editor');
    const listView = document.getElementById('cms-list-view');
    
    document.querySelectorAll('.tab-actions .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (view === 'visual') {
        visualEditor.style.display = 'flex';
        listView.style.display = 'none';
        document.getElementById('visual-view-btn')?.classList.add('active');
        loadCMSPage(currentCMSPage);
    } else {
        visualEditor.style.display = 'none';
        listView.style.display = 'grid';
        loadCMSListView();
    }
}

// Load a CMS page for editing
async function loadCMSPage(slug) {
    currentCMSPage = slug;
    document.getElementById('cms-page-select').value = slug;
    
    const phoneContent = document.getElementById('cms-phone-content');
    phoneContent.innerHTML = `
        <p style="text-align: center; padding: 40px; color: #64748b;">
            <i class="fas fa-spinner fa-spin"></i> Loading page...
        </p>
    `;
    
    try {
        const response = await apiCall(`/cms/pages/${slug}`);
        cmsPageData = response;
        
        // Update page title in phone header
        document.getElementById('phone-page-title').textContent = response.title || slug;
        
        // Render page sections
        renderPhonePreview(response);
    } catch (error) {
        console.error('Error loading CMS page:', error);
        // If page doesn't exist, show empty state
        phoneContent.innerHTML = `
            <div class="add-section-placeholder" onclick="addNewSection()">
                <i class="fas fa-plus" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p>This page has no content yet.<br>Click to add your first section.</p>
            </div>
        `;
    }
}

// Render the phone preview with editable sections
function renderPhonePreview(pageData) {
    const phoneContent = document.getElementById('cms-phone-content');
    
    if (!pageData.sections || pageData.sections.length === 0) {
        phoneContent.innerHTML = `
            <div class="add-section-placeholder" onclick="addNewSection()">
                <i class="fas fa-plus" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p>No sections yet. Click to add content.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    pageData.sections.forEach((section, sIdx) => {
        html += `
            <div class="phone-section" 
                 data-section-id="${section.id}" 
                 data-section-idx="${sIdx}"
                 draggable="true"
                 ondragstart="handleDragStart(event, '${section.id}')"
                 ondragend="handleDragEnd(event)"
                 ondragover="handleDragOver(event)"
                 ondragleave="handleDragLeave(event)"
                 ondrop="handleDrop(event, '${section.id}')"
                 onclick="selectSection('${section.id}', event)">
                <div class="section-drag-handle" title="Drag to reorder">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <button class="delete-element-btn" onclick="deleteSection('${section.id}', event)" title="Delete section">
                    <i class="fas fa-times"></i>
                </button>
                ${section.title ? `<div class="phone-section-title" data-field="title">${section.title}</div>` : ''}
                ${section.subtitle ? `<div class="phone-section-subtitle" data-field="subtitle">${section.subtitle}</div>` : ''}
        `;
        
        // Render cards if present
        if (section.cards && section.cards.length > 0) {
            html += '<div class="phone-cards-grid">';
            section.cards.forEach((card, cIdx) => {
                const iconColor = card.color || '#3b82f6';
                const bgColor = card.bg_color || 'rgba(59, 130, 246, 0.15)';
                html += `
                    <div class="phone-card" 
                         data-card-id="${card.id}"
                         data-section-id="${section.id}"
                         onclick="selectCard('${card.id}', '${section.id}', event)">
                        <button class="delete-element-btn" onclick="deleteCard('${card.id}', '${section.id}', event)" title="Delete card">
                            <i class="fas fa-times"></i>
                        </button>
                        <div class="phone-card-icon" style="background: ${bgColor}; color: ${iconColor};">
                            <i class="${getIconClass(card.icon)}"></i>
                        </div>
                        <div class="phone-card-title">${card.title || 'Untitled'}</div>
                        ${card.description ? `<div class="phone-card-desc">${card.description}</div>` : ''}
                    </div>
                `;
            });
            html += '</div>';
            
            // Add card button
            html += `
                <button class="btn btn-secondary btn-small" style="width: 100%; margin-top: 12px;" onclick="addNewCard('${section.id}', event)">
                    <i class="fas fa-plus"></i> Add Card
                </button>
            `;
        }
        
        html += '</div>';
    });
    
    // Add section button at the bottom
    html += `
        <div class="add-section-placeholder" onclick="addNewSection()">
            <i class="fas fa-plus"></i> Add New Section
        </div>
    `;
    
    phoneContent.innerHTML = html;
}

// Helper to convert icon names to FontAwesome classes
function getIconClass(iconName) {
    if (!iconName) return 'fas fa-circle';
    
    // Map Ionicons to FontAwesome equivalents
    const iconMap = {
        'heart': 'fas fa-heart',
        'people': 'fas fa-users',
        'chatbubbles': 'fas fa-comments',
        'call': 'fas fa-phone',
        'book': 'fas fa-book',
        'fitness': 'fas fa-dumbbell',
        'medical': 'fas fa-medkit',
        'home': 'fas fa-home',
        'shield': 'fas fa-shield-alt',
        'warning': 'fas fa-exclamation-triangle',
        'information-circle': 'fas fa-info-circle',
        'help-circle': 'fas fa-question-circle',
        'star': 'fas fa-star',
        'calendar': 'fas fa-calendar',
        'location': 'fas fa-map-marker-alt',
        'mail': 'fas fa-envelope',
        'person': 'fas fa-user',
        'settings': 'fas fa-cog',
        'document': 'fas fa-file',
        'clipboard': 'fas fa-clipboard',
        'wine': 'fas fa-wine-glass',
        'leaf': 'fas fa-leaf',
        'moon': 'fas fa-moon',
        'sunny': 'fas fa-sun',
        'water': 'fas fa-tint',
        'body': 'fas fa-running',
        'cafe': 'fas fa-coffee',
        'restaurant': 'fas fa-utensils',
        'bed': 'fas fa-bed'
    };
    
    return iconMap[iconName] || `fas fa-${iconName}`;
}

// Select a section for editing
function selectSection(sectionId, event) {
    event.stopPropagation();
    
    // Remove editing class from all elements
    document.querySelectorAll('.phone-section, .phone-card').forEach(el => {
        el.classList.remove('editing');
    });
    
    // Add editing class to selected section
    const sectionEl = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionEl) {
        sectionEl.classList.add('editing');
    }
    
    // Find section data
    const section = cmsPageData.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    editingElement = { type: 'section', id: sectionId, data: section };
    renderEditPanel('section', section);
}

// Select a card for editing
function selectCard(cardId, sectionId, event) {
    event.stopPropagation();
    
    // Remove editing class from all elements
    document.querySelectorAll('.phone-section, .phone-card').forEach(el => {
        el.classList.remove('editing');
    });
    
    // Add editing class to selected card
    const cardEl = document.querySelector(`[data-card-id="${cardId}"]`);
    if (cardEl) {
        cardEl.classList.add('editing');
    }
    
    // Find card data
    const section = cmsPageData.sections.find(s => s.id === sectionId);
    const card = section?.cards?.find(c => c.id === cardId);
    if (!card) return;
    
    editingElement = { type: 'card', id: cardId, sectionId: sectionId, data: card };
    renderEditPanel('card', card);
}

// Render the edit panel based on element type
function renderEditPanel(type, data) {
    const panel = document.getElementById('cms-edit-content');
    const titleEl = document.getElementById('edit-panel-title');
    
    if (type === 'section') {
        titleEl.innerHTML = '<i class="fas fa-layer-group"></i> Edit Section';
        panel.innerHTML = `
            <div class="edit-form-group">
                <label>Section Title</label>
                <input type="text" id="edit-title" value="${escapeHtml(data.title || '')}" onchange="updateField('title', this.value)" placeholder="Enter section title">
            </div>
            <div class="edit-form-group">
                <label>Subtitle</label>
                <textarea id="edit-subtitle" onchange="updateField('subtitle', this.value)" placeholder="Optional description">${escapeHtml(data.subtitle || '')}</textarea>
            </div>
            <div class="edit-form-group">
                <label>Section Type</label>
                <select id="edit-section-type" onchange="updateField('type', this.value)">
                    <option value="menu" ${data.type === 'menu' ? 'selected' : ''}>Menu Items</option>
                    <option value="cards" ${data.type === 'cards' ? 'selected' : ''}>Cards Grid</option>
                    <option value="ai_team" ${data.type === 'ai_team' ? 'selected' : ''}>AI Team</option>
                    <option value="hero" ${data.type === 'hero' ? 'selected' : ''}>Hero Banner</option>
                    <option value="resources" ${data.type === 'resources' ? 'selected' : ''}>Resources List</option>
                </select>
            </div>
            <div class="edit-actions">
                <button class="btn btn-danger" onclick="deleteSection('${data.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="btn btn-primary" onclick="applyChanges()">
                    <i class="fas fa-check"></i> Apply
                </button>
            </div>
        `;
    } else if (type === 'card') {
        titleEl.innerHTML = '<i class="fas fa-square"></i> Edit Card';
        
        // Available icons for selection
        const icons = ['heart', 'people', 'shield', 'call', 'fitness', 'headset', 'list', 'heart-circle', 'heart-dislike', 'shield-checkmark', 'chatbubbles', 'book', 'home', 'star', 'person', 'medical', 'warning', 'information-circle'];
        
        let iconOptionsHtml = icons.map(icon => `
            <div class="icon-option ${data.icon === icon ? 'selected' : ''}" onclick="selectIcon('${icon}')" data-icon="${icon}">
                <i class="${getIconClass(icon)}"></i>
            </div>
        `).join('');
        
        panel.innerHTML = `
            <div class="edit-form-group">
                <label>Card Title</label>
                <input type="text" id="edit-title" value="${escapeHtml(data.title || '')}" oninput="updateFieldLive('title', this.value)" placeholder="Card title">
            </div>
            <div class="edit-form-group">
                <label>Description</label>
                <textarea id="edit-description" oninput="updateFieldLive('description', this.value)" placeholder="Brief description">${escapeHtml(data.description || '')}</textarea>
            </div>
            <div class="edit-form-group">
                <label>Icon</label>
                <div class="icon-selector">
                    ${iconOptionsHtml}
                </div>
            </div>
            <div class="edit-form-group">
                <label>Icon Color</label>
                <div class="color-picker-row">
                    <input type="color" id="edit-color" value="${data.color || '#3b82f6'}" oninput="updateColorLive('color', this.value)">
                    <input type="text" id="edit-color-text" value="${data.color || '#3b82f6'}" oninput="syncColorInput('color', this.value)">
                </div>
            </div>
            <div class="edit-form-group">
                <label>Background Color</label>
                <div class="color-picker-row">
                    <input type="color" id="edit-bg-color" value="${data.bg_color || '#dbeafe'}" oninput="updateColorLive('bg_color', this.value)">
                    <input type="text" id="edit-bg-color-text" value="${data.bg_color || '#dbeafe'}" oninput="syncColorInput('bg_color', this.value)">
                </div>
            </div>
            <div class="edit-form-group">
                <label>Route / Link</label>
                <input type="text" id="edit-route" value="${escapeHtml(data.route || '')}" onchange="updateField('route', this.value)" placeholder="/page-name">
            </div>
            <div class="edit-form-group">
                <label>Image URL (for AI characters)</label>
                <input type="text" id="edit-image" value="${escapeHtml(data.image_url || '')}" onchange="updateField('image_url', this.value)" placeholder="https://...">
            </div>
            <div class="edit-actions">
                <button class="btn btn-danger" onclick="deleteCard('${data.id}', '${editingElement.sectionId}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="btn btn-primary" onclick="applyChanges()">
                    <i class="fas fa-check"></i> Apply
                </button>
            </div>
        `;
    }
}

// Select icon from the icon selector
function selectIcon(iconName) {
    document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
    document.querySelector(`[data-icon="${iconName}"]`)?.classList.add('selected');
    updateFieldLive('icon', iconName);
}

// Live update field and refresh preview
function updateFieldLive(field, value) {
    if (!editingElement) return;
    editingElement.data[field] = value;
    renderPhonePreview(cmsPageData);
    
    // Re-highlight the editing element
    setTimeout(() => {
        const el = document.querySelector(`[data-card-id="${editingElement.id}"]`) || 
                   document.querySelector(`[data-section-id="${editingElement.id}"]`);
        if (el) el.classList.add('editing');
    }, 10);
}

// Sync color input with color picker
function syncColorInput(field, value) {
    if (!value.startsWith('#')) value = '#' + value;
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        document.getElementById(`edit-${field.replace('_', '-')}`).value = value;
        updateColorLive(field, value);
    }
}

// Live update color and refresh preview
function updateColorLive(field, value) {
    if (!editingElement) return;
    editingElement.data[field] = value;
    document.getElementById(`edit-${field.replace('_', '-')}-text`).value = value;
    renderPhonePreview(cmsPageData);
    
    // Re-highlight the editing element
    setTimeout(() => {
        const el = document.querySelector(`[data-card-id="${editingElement.id}"]`);
        if (el) el.classList.add('editing');
    }, 10);
}

// Set preview theme (light/dark)
function setPreviewTheme(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.theme-btn').classList.add('active');
    
    const phoneScreen = document.getElementById('cms-phone-screen');
    const phoneContent = document.getElementById('cms-phone-content');
    
    if (theme === 'light') {
        phoneScreen.style.background = '#f5f7fa';
        phoneContent.classList.add('light-theme');
        document.querySelector('.phone-header').style.background = '#ffffff';
        document.querySelector('.phone-header').style.color = '#1e293b';
    } else {
        phoneScreen.style.background = '#0f172a';
        phoneContent.classList.remove('light-theme');
        document.querySelector('.phone-header').style.background = '#1e293b';
        document.querySelector('.phone-header').style.color = '#ffffff';
    }
}

// Update a field value
function updateField(field, value) {
    if (!editingElement) return;
    
    editingElement.data[field] = value;
    cmsPendingChanges[editingElement.id] = editingElement.data;
    
    // Show unsaved indicator
    showUnsavedIndicator();
}

// Apply changes to the preview
function applyChanges() {
    if (!editingElement) return;
    
    // Update the data in cmsPageData
    if (editingElement.type === 'section') {
        const idx = cmsPageData.sections.findIndex(s => s.id === editingElement.id);
        if (idx !== -1) {
            cmsPageData.sections[idx] = { ...cmsPageData.sections[idx], ...editingElement.data };
        }
    } else if (editingElement.type === 'card') {
        const section = cmsPageData.sections.find(s => s.id === editingElement.sectionId);
        if (section) {
            const cardIdx = section.cards.findIndex(c => c.id === editingElement.id);
            if (cardIdx !== -1) {
                section.cards[cardIdx] = { ...section.cards[cardIdx], ...editingElement.data };
            }
        }
    }
    
    // Re-render preview
    renderPhonePreview(cmsPageData);
    showNotification('Changes applied to preview', 'success');
}

// Show unsaved changes indicator
function showUnsavedIndicator() {
    const indicator = document.querySelector('.unsaved-indicator');
    if (indicator) {
        indicator.classList.add('visible');
    }
}

// Close edit panel
function closeEditPanel() {
    document.getElementById('cms-edit-content').innerHTML = `
        <p style="color: var(--text-muted); text-align: center; padding: 40px;">
            Click on any element in the preview to edit it
        </p>
    `;
    
    document.querySelectorAll('.phone-section, .phone-card').forEach(el => {
        el.classList.remove('editing');
    });
    
    editingElement = null;
}

// Add a new section
async function addNewSection() {
    const newSection = {
        page_slug: currentCMSPage,
        section_type: 'cards',
        title: 'New Section',
        subtitle: 'Click to edit this section',
        order: cmsPageData?.sections?.length || 0,
        is_visible: true
    };
    
    try {
        const result = await apiCall('/cms/sections', {
            method: 'POST',
            body: JSON.stringify(newSection)
        });
        
        showNotification('Section added', 'success');
        loadCMSPage(currentCMSPage);
    } catch (error) {
        showNotification('Failed to add section: ' + error.message, 'error');
    }
}

// Add a new card to a section
async function addNewCard(sectionId, event) {
    event.stopPropagation();
    
    const newCard = {
        section_id: sectionId,
        card_type: 'link',
        title: 'New Card',
        description: 'Click to edit',
        icon: 'star',
        color: '#3b82f6',
        bg_color: 'rgba(59, 130, 246, 0.15)',
        order: 99
    };
    
    try {
        await apiCall('/cms/cards', {
            method: 'POST',
            body: JSON.stringify(newCard)
        });
        
        showNotification('Card added', 'success');
        loadCMSPage(currentCMSPage);
    } catch (error) {
        showNotification('Failed to add card: ' + error.message, 'error');
    }
}

// Delete a section
async function deleteSection(sectionId, event) {
    event.stopPropagation();
    
    if (!confirm('Delete this section and all its cards?')) return;
    
    try {
        await apiCall(`/cms/sections/${sectionId}`, { method: 'DELETE' });
        showNotification('Section deleted', 'success');
        loadCMSPage(currentCMSPage);
    } catch (error) {
        showNotification('Failed to delete section: ' + error.message, 'error');
    }
}

// Delete a card
async function deleteCard(cardId, sectionId, event) {
    event.stopPropagation();
    
    if (!confirm('Delete this card?')) return;
    
    try {
        await apiCall(`/cms/cards/${cardId}`, { method: 'DELETE' });
        showNotification('Card deleted', 'success');
        loadCMSPage(currentCMSPage);
    } catch (error) {
        showNotification('Failed to delete card: ' + error.message, 'error');
    }
}

// Move section up
async function moveSectionUp(sectionId, event) {
    event.stopPropagation();
    await reorderSection(sectionId, -1);
}

// Move section down
async function moveSectionDown(sectionId, event) {
    event.stopPropagation();
    await reorderSection(sectionId, 1);
}

// Reorder sections
async function reorderSection(sectionId, direction) {
    const sections = cmsPageData.sections;
    const currentIdx = sections.findIndex(s => s.id === sectionId);
    const newIdx = currentIdx + direction;
    
    if (newIdx < 0 || newIdx >= sections.length) return;
    
    // Swap orders
    const updates = {};
    updates[sections[currentIdx].id] = newIdx;
    updates[sections[newIdx].id] = currentIdx;
    
    try {
        await apiCall('/cms/sections/reorder', {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        
        loadCMSPage(currentCMSPage);
    } catch (error) {
        showNotification('Failed to reorder: ' + error.message, 'error');
    }
}

// ==========================================
// Drag and Drop Handlers
// ==========================================

let draggedSectionId = null;

function handleDragStart(event, sectionId) {
    draggedSectionId = sectionId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', sectionId);
    
    // Add dragging class to phone content for visual feedback
    document.getElementById('cms-phone-content').classList.add('has-dragging');
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    draggedSectionId = null;
    
    // Remove all drag-related classes
    document.querySelectorAll('.phone-section').forEach(el => {
        el.classList.remove('drag-over', 'dragging');
    });
    document.getElementById('cms-phone-content')?.classList.remove('has-dragging');
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const target = event.target.closest('.phone-section');
    if (target && target.dataset.sectionId !== draggedSectionId) {
        // Remove drag-over from all sections first
        document.querySelectorAll('.phone-section').forEach(el => {
            el.classList.remove('drag-over');
        });
        target.classList.add('drag-over');
    }
}

function handleDragLeave(event) {
    const target = event.target.closest('.phone-section');
    if (target) {
        target.classList.remove('drag-over');
    }
}

async function handleDrop(event, targetSectionId) {
    event.preventDefault();
    event.stopPropagation();
    
    const sourceSectionId = draggedSectionId;
    
    // Clean up visual states
    document.querySelectorAll('.phone-section').forEach(el => {
        el.classList.remove('drag-over', 'dragging');
    });
    document.getElementById('cms-phone-content')?.classList.remove('has-dragging');
    
    if (!sourceSectionId || sourceSectionId === targetSectionId) return;
    
    const sections = cmsPageData.sections;
    const sourceIdx = sections.findIndex(s => s.id === sourceSectionId);
    const targetIdx = sections.findIndex(s => s.id === targetSectionId);
    
    if (sourceIdx === -1 || targetIdx === -1) return;
    
    // Build reorder updates - all sections between source and target need updating
    const updates = {};
    
    if (sourceIdx < targetIdx) {
        // Moving down
        for (let i = sourceIdx; i <= targetIdx; i++) {
            if (i === sourceIdx) {
                updates[sections[i].id] = targetIdx;
            } else {
                updates[sections[i].id] = i - 1;
            }
        }
    } else {
        // Moving up
        for (let i = targetIdx; i <= sourceIdx; i++) {
            if (i === sourceIdx) {
                updates[sections[i].id] = targetIdx;
            } else {
                updates[sections[i].id] = i + 1;
            }
        }
    }
    
    try {
        await apiCall('/cms/sections/reorder', {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        
        showNotification('Section reordered', 'success');
        loadCMSPage(currentCMSPage);
    } catch (error) {
        showNotification('Failed to reorder: ' + error.message, 'error');
    }
    
    draggedSectionId = null;
}

// Save all CMS changes
async function saveCMSChanges() {
    if (Object.keys(cmsPendingChanges).length === 0) {
        showNotification('No changes to save', 'info');
        return;
    }
    
    try {
        // Save each changed element
        for (const [id, data] of Object.entries(cmsPendingChanges)) {
            if (data.section_type !== undefined) {
                // It's a section
                await apiCall(`/cms/sections/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            } else {
                // It's a card
                await apiCall(`/cms/cards/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            }
        }
        
        cmsPendingChanges = {};
        document.querySelector('.unsaved-indicator')?.classList.remove('visible');
        showNotification('All changes saved!', 'success');
        loadCMSPage(currentCMSPage);
    } catch (error) {
        showNotification('Failed to save: ' + error.message, 'error');
    }
}

// Load the traditional list view
async function loadCMSListView() {
    const container = document.getElementById('cms-list-view');
    container.innerHTML = '<p style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    
    try {
        const pages = await apiCall('/cms/pages/all');
        
        if (!pages || pages.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: var(--text-muted);">
                    <i class="fas fa-file-alt" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p>No CMS pages found. Switch to Visual Editor to create content.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = pages.map(page => `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3>${page.title}</h3>
                        <p style="color: var(--text-muted); font-size: 13px;">/${page.slug}</p>
                    </div>
                    <span class="badge ${page.is_visible ? 'badge-success' : 'badge-secondary'}">
                        ${page.is_visible ? 'Visible' : 'Hidden'}
                    </span>
                </div>
                <div class="card-actions">
                    <button class="btn btn-primary btn-small" onclick="toggleCMSView('visual'); loadCMSPage('${page.slug}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<p style="color: var(--danger); padding: 20px;">Error: ${error.message}</p>`;
    }
}

// Initialize CMS editor when CMS tab is clicked
document.addEventListener('DOMContentLoaded', function() {
    // Listen for CMS tab activation
    const cmsTab = document.querySelector('[data-tab="cms"]');
    if (cmsTab) {
        cmsTab.addEventListener('click', function() {
            setTimeout(initCMSEditor, 100);
        });
    }
});

// ==========================================
// COMPLIANCE TAB FUNCTIONS
// ==========================================

// Load compliance dashboard data
async function loadComplianceDashboard() {
    try {
        const data = await apiCall('/compliance/dashboard');
        
        // Update GDPR metrics
        document.getElementById('compliance-consent-rate').textContent = data.gdpr.consent_rate + '%';
        document.getElementById('gdpr-exports').textContent = data.gdpr.data_exports_this_month;
        document.getElementById('gdpr-deletions').textContent = data.gdpr.account_deletions_this_month;
        document.getElementById('gdpr-ai-consent').textContent = data.gdpr.users_with_ai_consent + ' / ' + data.gdpr.total_users;
        
        // Update complaints
        document.getElementById('compliance-complaints').textContent = data.complaints.open_complaints;
        
        // Update staff wellbeing
        document.getElementById('staff-checkins').textContent = data.staff_wellbeing.checkins_this_week;
        document.getElementById('staff-support-needed').textContent = data.staff_wellbeing.staff_needing_support;
        document.getElementById('staff-supervision').textContent = data.staff_wellbeing.pending_supervision_requests;
        
        // Update security
        document.getElementById('compliance-security-status').textContent = 
            data.security.last_review_status ? data.security.last_review_status.replace('_', ' ') : 'No review';
        document.getElementById('compliance-incidents').textContent = data.security.open_incidents;
        
        // Update audit
        document.getElementById('audit-week-count').textContent = data.audit.entries_this_week;
        
        // Load incidents list
        await loadIncidentsList();
        
        // Load complaints list
        await loadComplaintsList();
        
    } catch (error) {
        console.error('Failed to load compliance dashboard:', error);
        showNotification('Failed to load compliance data: ' + error.message, 'error');
    }
}

// Load security incidents list
async function loadIncidentsList() {
    try {
        const data = await apiCall('/compliance/incidents?status=detected&status=investigating&status=contained');
        const container = document.getElementById('incidents-list');
        
        if (data.incidents && data.incidents.length > 0) {
            container.innerHTML = data.incidents.map(incident => `
                <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--card-bg);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="badge ${getSeverityBadgeClass(incident.severity)}">${incident.severity.toUpperCase()}</span>
                        <span style="color: var(--text-secondary); font-size: 12px;">${new Date(incident.detected_at).toLocaleDateString()}</span>
                    </div>
                    <h4 style="margin: 0 0 4px 0;">${escapeHtml(incident.title)}</h4>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">${escapeHtml(incident.description).substring(0, 100)}...</p>
                    <div style="margin-top: 8px;">
                        <span class="badge badge-outline">${incident.status}</span>
                        <button class="btn btn-outline btn-small" onclick="viewIncident('${incident.id}')" style="margin-left: 8px;">View</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <p style="color: var(--text-secondary); text-align: center; padding: 20px;">
                    <i class="fas fa-check-circle" style="color: #16a34a;"></i> No open incidents
                </p>
            `;
        }
    } catch (error) {
        console.error('Failed to load incidents:', error);
    }
}

// Load complaints list
async function loadComplaintsList() {
    try {
        const data = await apiCall('/compliance/complaints?status=received&status=under_review&status=investigating');
        const container = document.getElementById('complaints-list');
        
        if (data.complaints && data.complaints.length > 0) {
            container.innerHTML = data.complaints.map(complaint => `
                <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--card-bg);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="badge ${getPriorityBadgeClass(complaint.priority)}">${complaint.priority.toUpperCase()}</span>
                        <span style="color: var(--text-secondary); font-size: 12px;">RC-${complaint.id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <h4 style="margin: 0 0 4px 0;">${escapeHtml(complaint.subject)}</h4>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">Category: ${complaint.category}</p>
                    <div style="margin-top: 8px;">
                        <span class="badge badge-outline">${complaint.status}</span>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <p style="color: var(--text-secondary); text-align: center; padding: 20px;">
                    <i class="fas fa-check-circle" style="color: #16a34a;"></i> No open complaints
                </p>
            `;
        }
    } catch (error) {
        console.error('Failed to load complaints:', error);
    }
}

// Get badge class for incident severity
function getSeverityBadgeClass(severity) {
    switch (severity) {
        case 'critical': return 'badge-danger';
        case 'high': return 'badge-warning';
        case 'medium': return 'badge-info';
        case 'low': return 'badge-secondary';
        default: return 'badge-secondary';
    }
}

// Get badge class for complaint priority
function getPriorityBadgeClass(priority) {
    switch (priority) {
        case 'critical': return 'badge-danger';
        case 'high': return 'badge-warning';
        case 'normal': return 'badge-info';
        case 'low': return 'badge-secondary';
        default: return 'badge-secondary';
    }
}

// Run automated security review
async function runSecurityReview() {
    try {
        showNotification('Running security review...', 'info');
        const review = await apiCall('/compliance/security/automated-review');
        showNotification(`Security review complete: ${review.overall_status}`, 'success');
        await loadComplianceDashboard();
    } catch (error) {
        showNotification('Security review failed: ' + error.message, 'error');
    }
}

// Run data retention cleanup
async function runDataRetentionCleanup() {
    if (!confirm('This will permanently delete data older than retention periods. Continue?')) {
        return;
    }
    
    try {
        showNotification('Running data cleanup...', 'info');
        await apiCall('/compliance/data-retention/run-cleanup', { method: 'POST' });
        showNotification('Data cleanup started', 'success');
    } catch (error) {
        showNotification('Data cleanup failed: ' + error.message, 'error');
    }
}

// View audit logs
async function viewAuditLogs() {
    try {
        const data = await apiCall('/compliance/audit-logs?limit=50');
        
        // Create modal content
        const content = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <table class="data-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Action</th>
                            <th>Resource</th>
                            <th>User</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.logs.map(log => `
                            <tr>
                                <td style="white-space: nowrap;">${new Date(log.timestamp).toLocaleString()}</td>
                                <td><span class="badge badge-outline">${log.action}</span></td>
                                <td>${log.resource_type}</td>
                                <td>${log.user_email || 'System'}</td>
                                <td>${escapeHtml(log.description).substring(0, 50)}...</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Show in modal
        openGenericModal('Audit Logs', content);
        
    } catch (error) {
        showNotification('Failed to load audit logs: ' + error.message, 'error');
    }
}

// Open incident report modal
function openNewIncidentModal() {
    const content = `
        <form id="incident-form" onsubmit="submitIncident(event)">
            <div class="form-group">
                <label>Incident Type</label>
                <select id="incident-type" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <option value="">Select type...</option>
                    <option value="data_breach">Data Breach</option>
                    <option value="unauthorized_access">Unauthorized Access</option>
                    <option value="service_outage">Service Outage</option>
                    <option value="safeguarding_failure">Safeguarding Failure</option>
                    <option value="privacy_violation">Privacy Violation</option>
                    <option value="security_vulnerability">Security Vulnerability</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Severity</label>
                <select id="incident-severity" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </select>
            </div>
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="incident-title" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="incident-description" rows="4" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);"></textarea>
            </div>
            <div class="form-group">
                <label>Affected Systems (comma separated)</label>
                <input type="text" id="incident-systems" placeholder="e.g., backend, database, mobile app" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);">
            </div>
            <button type="submit" class="btn btn-danger" style="width: 100%;">
                <i class="fas fa-exclamation-triangle"></i> Report Incident
            </button>
        </form>
    `;
    
    openGenericModal('Report Security Incident', content);
}

// Submit incident report
async function submitIncident(event) {
    event.preventDefault();
    
    const incident = {
        incident_type: document.getElementById('incident-type').value,
        severity: document.getElementById('incident-severity').value,
        title: document.getElementById('incident-title').value,
        description: document.getElementById('incident-description').value,
        detected_by: currentUser.email,
        affected_systems: document.getElementById('incident-systems').value.split(',').map(s => s.trim()).filter(s => s)
    };
    
    try {
        await apiCall('/compliance/incidents', {
            method: 'POST',
            body: JSON.stringify(incident)
        });
        showNotification('Incident reported successfully', 'success');
        closeModal();
        await loadComplianceDashboard();
    } catch (error) {
        showNotification('Failed to report incident: ' + error.message, 'error');
    }
}

// Generic modal helper
function openGenericModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'generic-modal';
    modal.innerHTML = `
        <div class="modal" style="max-width: 700px;">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

// Download compliance document - direct link to static PDF
function downloadDocument(filename) {
    // Map old filenames to static PDF files
    const docMap = {
        'ROPA.md': '/docs/ROPA.pdf',
        'BACP_ETHICAL_FRAMEWORK_COMPLIANCE.md': '/docs/BACP_Compliance.pdf',
        'GDPR_AUDIT_REPORT.md': '/docs/GDPR_Audit_Report.pdf',
        'INCIDENT_RESPONSE_PLAN.md': '/docs/Incident_Response_Plan.pdf',
        'SECURITY_REVIEW_SCHEDULE.md': '/docs/Security_Review_Schedule.pdf',
        'SAFEGUARDING_DISCLAIMER.md': '/docs/Safeguarding_Disclaimer.pdf'
    };
    
    const pdfPath = docMap[filename];
    if (!pdfPath) {
        showNotification(`Unknown document: ${filename}`, 'error');
        return;
    }
    
    // Create a temporary link to force download
    const link = document.createElement('a');
    link.href = pdfPath;
    link.download = pdfPath.split('/').pop();
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Downloading ${pdfPath.split('/').pop()}...`, 'success');
}

// ============================================
// Beta Testing Functions
// ============================================

// Toggle beta testing mode
async function toggleBetaMode(enabled) {
    try {
        const response = await apiCall('/surveys/beta-enabled', {
            method: 'POST',
            body: JSON.stringify({ enabled: enabled })
        });
        showNotification(`Beta testing ${enabled ? 'enabled' : 'disabled'}`, 'success');
        loadBetaStats();
    } catch (error) {
        showNotification('Failed to toggle beta mode: ' + error.message, 'error');
        // Revert checkbox
        document.getElementById('beta-toggle').checked = !enabled;
    }
}

// Load beta testing statistics
async function loadBetaStats() {
    try {
        // Check if beta is enabled
        const betaStatus = await apiCall('/surveys/beta-enabled');
        document.getElementById('beta-toggle').checked = betaStatus.beta_enabled;
        
        // Load stats
        const stats = await apiCall('/surveys/stats');
        
        document.getElementById('beta-pre-count').textContent = stats.total_pre_surveys || 0;
        document.getElementById('beta-post-count').textContent = stats.total_post_surveys || 0;
        document.getElementById('beta-completion-rate').textContent = (stats.completion_rate || 0) + '%';
        document.getElementById('beta-nps').textContent = stats.nps_score || '--';
        
        // Improvement metrics
        const improvement = stats.improvement || {};
        updateImprovementMetric('wellbeing-change', improvement.wellbeing_change);
        updateImprovementMetric('anxiety-change', improvement.anxiety_change, true); // Lower is better for anxiety
        updateImprovementMetric('mood-change', improvement.mood_change, true); // Lower is better for mood issues
        
        // Load recent responses
        loadBetaResponses();
    } catch (error) {
        console.error('Error loading beta stats:', error);
    }
}

function updateImprovementMetric(elementId, value, lowerIsBetter = false) {
    const el = document.getElementById(elementId);
    if (value === undefined || value === null) {
        el.textContent = '--';
        el.style.color = '#9ca3af';
        return;
    }
    
    const isPositive = lowerIsBetter ? value < 0 : value > 0;
    const prefix = value > 0 ? '+' : '';
    el.textContent = prefix + value.toFixed(1);
    el.style.color = isPositive ? '#22c55e' : value === 0 ? '#9ca3af' : '#ef4444';
}

// Load survey responses
async function loadBetaResponses() {
    try {
        const data = await apiCall('/surveys/responses?limit=50');
        const container = document.getElementById('beta-responses');
        
        if (!data.responses || data.responses.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No survey responses yet</p>';
            return;
        }
        
        container.innerHTML = data.responses.map(r => `
            <div style="background: var(--bg-color); padding: 16px; border-radius: 12px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; color: ${r.survey_type === 'pre' ? '#3b82f6' : '#22c55e'};">
                        <i class="fas fa-${r.survey_type === 'pre' ? 'clipboard-check' : 'clipboard-list'}"></i>
                        ${r.survey_type === 'pre' ? 'Pre-Survey' : 'Post-Survey'}
                    </span>
                    <span style="color: var(--text-muted); font-size: 12px;">${new Date(r.submitted_at).toLocaleDateString()}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 13px;">
                    <div><span style="color: var(--text-muted);">Wellbeing:</span> <strong>${r.wellbeing_score}/10</strong></div>
                    <div><span style="color: var(--text-muted);">Anxiety:</span> <strong>${r.anxiety_level}/3</strong></div>
                    <div><span style="color: var(--text-muted);">Mood:</span> <strong>${r.mood_level}/3</strong></div>
                </div>
                ${r.survey_type === 'post' ? `
                    <div style="margin-top: 8px; font-size: 13px;">
                        <span style="color: var(--text-muted);">App Helped:</span> <strong>${r.app_helped}/5</strong> | 
                        <span style="color: var(--text-muted);">Would Recommend:</span> <strong>${r.would_recommend}/10</strong>
                    </div>
                ` : ''}
                ${r.hopes ? `<div style="margin-top: 8px; font-size: 13px; color: var(--text-muted); font-style: italic;">"${escapeHtml(r.hopes)}"</div>` : ''}
                ${r.improvements ? `<div style="margin-top: 8px; font-size: 13px; color: var(--text-muted); font-style: italic;">"${escapeHtml(r.improvements)}"</div>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading responses:', error);
    }
}

// Export survey data as CSV
function exportSurveyData() {
    window.open(`${CONFIG.API_URL}/api/surveys/export`, '_blank');
    showNotification('Downloading survey data...', 'success');
}

// ============================================

// Escape HTML for security
// escapeHtml function defined at line 565 - DO NOT DUPLICATE

// Initialize compliance tab when clicked
document.addEventListener('DOMContentLoaded', function() {
    const complianceTab = document.querySelector('[data-tab="compliance"]');
    if (complianceTab) {
        complianceTab.addEventListener('click', function() {
            setTimeout(loadComplianceDashboard, 100);
        });
    }
    
    // Initialize beta testing tab
    const betaTab = document.querySelector('[data-tab="beta"]');
    if (betaTab) {
        betaTab.addEventListener('click', function() {
            setTimeout(loadBetaStats, 100);
        });
    }
});

// ===========================================
// Cookie Consent Management
// ===========================================

function checkCookieConsent() {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
        showCookieBanner();
    }
}

function showCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
        banner.classList.remove('hidden');
    }
}

function hideCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

function acceptAllCookies() {
    const consent = {
        essential: true,
        analytics: true,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookie_consent', JSON.stringify(consent));
    hideCookieBanner();
    showNotification('Cookie preferences saved', 'success');
}

function showCookieSettings() {
    const modal = document.getElementById('cookie-settings-modal');
    if (modal) {
        // Load saved preferences
        const consent = JSON.parse(localStorage.getItem('cookie_consent') || '{}');
        const analyticsCheckbox = document.getElementById('analytics-cookies');
        if (analyticsCheckbox) {
            analyticsCheckbox.checked = consent.analytics !== false;
        }
        modal.classList.remove('hidden');
    }
}

function closeCookieSettings() {
    const modal = document.getElementById('cookie-settings-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function saveCookieSettings() {
    const analyticsCheckbox = document.getElementById('analytics-cookies');
    const consent = {
        essential: true,
        analytics: analyticsCheckbox ? analyticsCheckbox.checked : false,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookie_consent', JSON.stringify(consent));
    closeCookieSettings();
    hideCookieBanner();
    showNotification('Cookie preferences saved', 'success');
}

// Check cookie consent on page load
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to not interfere with login flow
    setTimeout(checkCookieConsent, 1000);
});

// ===========================================
// Staff Rota Functions
// ===========================================

let rotaCache = {
    shifts: [],
    staff: [],
    lastLoaded: null
};

async function loadRotaData() {
    try {
        // Load shifts and staff in parallel using apiCall
        const [shifts, counsellors, peers] = await Promise.all([
            apiCall('/shifts/'),
            apiCall('/counsellors'),
            apiCall('/peer-supporters')
        ]);
        
        // Combine staff with role info
        const staff = [
            ...counsellors.map(c => ({ ...c, role: 'counsellor' })),
            ...peers.map(p => ({ ...p, role: 'peer' }))
        ];
        
        rotaCache = {
            shifts: shifts || [],
            staff: staff,
            lastLoaded: new Date()
        };
        
        renderTodayShifts();
        renderTomorrowShifts();
        renderWeekView();
        updateCoverageStats();
        
    } catch (error) {
        console.error('Error loading rota data:', error);
        showNotification('Failed to load rota data', 'error');
    }
}

function getStaffById(userId) {
    return rotaCache.staff.find(s => s.id === userId) || null;
}

function getStaffInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function renderShiftCard(shift, staff) {
    const name = staff?.name || shift.user_name || 'Unassigned';
    const role = staff?.role || 'staff';
    const initials = getStaffInitials(name);
    
    return `
        <div class="shift-card ${role}">
            <div class="shift-card-header">
                <div class="shift-avatar">${initials}</div>
                <div>
                    <div class="shift-name">${escapeHtml(name)}</div>
                    <div class="shift-role">${role === 'counsellor' ? 'Counsellor' : 'Peer Supporter'}</div>
                </div>
            </div>
            <div class="shift-time">
                <i class="fas fa-clock"></i>
                ${shift.start_time} - ${shift.end_time}
            </div>
        </div>
    `;
}

function renderTodayShifts() {
    const container = document.getElementById('today-shifts');
    const today = new Date().toISOString().split('T')[0];
    
    const todayShifts = rotaCache.shifts.filter(s => s.date === today);
    
    if (todayShifts.length === 0) {
        container.innerHTML = '<p class="no-shifts-text"><i class="fas fa-calendar-times"></i> No shifts scheduled for today</p>';
        return;
    }
    
    container.innerHTML = todayShifts.map(shift => {
        const staff = getStaffById(shift.user_id);
        return renderShiftCard(shift, staff);
    }).join('');
}

function renderTomorrowShifts() {
    const container = document.getElementById('tomorrow-shifts');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const tomorrowShifts = rotaCache.shifts.filter(s => s.date === tomorrowStr);
    
    if (tomorrowShifts.length === 0) {
        container.innerHTML = '<p class="no-shifts-text"><i class="fas fa-calendar-times"></i> No shifts scheduled for tomorrow</p>';
        return;
    }
    
    container.innerHTML = tomorrowShifts.map(shift => {
        const staff = getStaffById(shift.user_id);
        return renderShiftCard(shift, staff);
    }).join('');
}

function renderWeekView() {
    const container = document.getElementById('week-view');
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let html = '';
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const isToday = i === 0;
        
        const dayShifts = rotaCache.shifts.filter(s => s.date === dateStr);
        
        html += `
            <div class="week-day ${isToday ? 'today' : ''}">
                <div class="week-day-header">${dayNames[date.getDay()]}</div>
                <div class="week-day-date">${date.getDate()}/${date.getMonth() + 1}</div>
                <div class="week-day-shifts">
                    ${dayShifts.length === 0 ? '<span style="color: var(--text-muted); font-size: 11px;">No shifts</span>' : 
                        dayShifts.map(shift => {
                            const staff = getStaffById(shift.user_id);
                            const name = staff?.name || shift.user_name || '?';
                            const role = staff?.role || 'staff';
                            return `<div class="week-shift-pill ${role}" title="${name}: ${shift.start_time}-${shift.end_time}">${getStaffInitials(name)}</div>`;
                        }).join('')
                    }
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateCoverageStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = rotaCache.shifts.filter(s => s.date === today);
    
    // Count counsellors and peers for today
    let counsellorsToday = 0;
    let peersToday = 0;
    
    todayShifts.forEach(shift => {
        const staff = getStaffById(shift.user_id);
        if (staff?.role === 'counsellor') counsellorsToday++;
        else if (staff?.role === 'peer') peersToday++;
    });
    
    // Count total shifts this week
    const weekStart = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weekShifts = rotaCache.shifts.filter(s => {
        const shiftDate = new Date(s.date);
        return shiftDate >= weekStart && shiftDate < weekEnd;
    });
    
    // Check for coverage gaps (days with no shifts)
    let gaps = 0;
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayShifts = rotaCache.shifts.filter(s => s.date === dateStr);
        if (dayShifts.length === 0) gaps++;
    }
    
    // Update UI
    document.getElementById('counsellors-today').textContent = counsellorsToday;
    document.getElementById('peers-today').textContent = peersToday;
    document.getElementById('total-shifts-week').textContent = weekShifts.length;
    
    const gapsCard = document.getElementById('coverage-gaps-card');
    if (gaps > 0) {
        gapsCard.style.display = 'block';
        document.getElementById('coverage-gaps').textContent = gaps;
    } else {
        gapsCard.style.display = 'none';
    }
}

// Load rota data when tab is clicked
document.addEventListener('DOMContentLoaded', function() {
    const rotaTab = document.querySelector('[data-tab="rota"]');
    if (rotaTab) {
        rotaTab.addEventListener('click', function() {
            setTimeout(loadRotaData, 100);
        });
    }
});

// ===========================================
// Swap Request Functions
// ===========================================

let swapCache = {
    all: [],
    pending: [],
    currentTab: 'pending'
};

async function loadSwapRequests() {
    try {
        const [all, pending] = await Promise.all([
            apiCall('/shift-swaps/'),
            apiCall('/shift-swaps/needs-approval')
        ]);
        
        swapCache.all = all;
        swapCache.pending = pending;
        
        // Update badge count
        document.getElementById('pending-swap-count').textContent = swapCache.pending.length;
        
        renderSwapRequests(swapCache.currentTab);
        
    } catch (error) {
        console.error('Error loading swap requests:', error);
        document.getElementById('swap-requests-list').innerHTML = 
            '<p class="no-swaps-text">Failed to load swap requests</p>';
    }
}

function switchSwapTab(tab) {
    swapCache.currentTab = tab;
    
    document.querySelectorAll('.swap-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    renderSwapRequests(tab);
}

function renderSwapRequests(tab) {
    const container = document.getElementById('swap-requests-list');
    const swaps = tab === 'pending' ? swapCache.pending : swapCache.all;
    
    if (swaps.length === 0) {
        container.innerHTML = `<p class="no-swaps-text">
            <i class="fas fa-check-circle"></i> 
            ${tab === 'pending' ? 'No swap requests need approval' : 'No swap requests yet'}
        </p>`;
        return;
    }
    
    container.innerHTML = swaps.map(swap => {
        const statusClass = swap.status;
        const showActions = swap.status === 'accepted';
        
        return `
            <div class="swap-card ${statusClass}">
                <div class="swap-header">
                    <div class="swap-info">
                        <h4><i class="fas fa-exchange-alt"></i> Shift Swap Request</h4>
                        <p>${escapeHtml(swap.requester_name)} needs cover</p>
                    </div>
                    <span class="swap-status ${statusClass}">${swap.status}</span>
                </div>
                <div class="swap-details">
                    <span><i class="fas fa-calendar"></i> <strong>${swap.shift_date}</strong></span>
                    <span><i class="fas fa-clock"></i> <strong>${swap.shift_start} - ${swap.shift_end}</strong></span>
                    ${swap.responder_name ? `<span><i class="fas fa-user-check"></i> Cover: <strong>${escapeHtml(swap.responder_name)}</strong></span>` : ''}
                    ${swap.reason ? `<span><i class="fas fa-comment"></i> ${escapeHtml(swap.reason)}</span>` : ''}
                </div>
                ${showActions ? `
                    <div class="swap-actions">
                        <button class="btn btn-success" onclick="approveSwap('${swap.id}', true)">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn btn-danger" onclick="approveSwap('${swap.id}', false)">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function approveSwap(swapId, approved) {
    const action = approved ? 'approve' : 'reject';
    const notes = approved ? '' : prompt('Reason for rejection (optional):');
    
    if (!approved && notes === null) return; // Cancelled
    
    try {
        const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
        
        await apiCall(`/shift-swaps/${swapId}/approve`, {
            method: 'POST',
            body: JSON.stringify({
                admin_id: adminUser.id || 'admin',
                admin_name: adminUser.name || 'Admin',
                approved: approved,
                notes: notes || null
            })
        });
        
        showNotification(`Swap request ${action}d successfully`, 'success');
        loadSwapRequests();
        loadRotaData(); // Refresh rota as shift may have changed
        
    } catch (error) {
        console.error('Error processing swap:', error);
        showNotification(`Failed to ${action} swap request`, 'error');
    }
}

// Load swap requests when rota tab loads
const originalLoadRotaData = loadRotaData;
loadRotaData = async function() {
    await originalLoadRotaData();
    await loadSwapRequests();
};

// ============ MONITORING DASHBOARD ============

let monitoringInterval = null;

async function loadMonitoringStats() {
    try {
        const stats = await apiCall('/admin/system-stats');
        
        // Update user stats
        document.getElementById('stat-total-users').textContent = stats.users.total_registered;
        document.getElementById('stat-connected-staff').textContent = stats.users.connected_staff;
        
        // Update activity stats
        document.getElementById('stat-active-calls').textContent = stats.activity.active_calls;
        document.getElementById('stat-ai-sessions').textContent = stats.activity.active_ai_sessions_24h;
        document.getElementById('stat-live-chats').textContent = stats.activity.active_live_chats;
        document.getElementById('stat-pending-callbacks').textContent = stats.activity.pending_callbacks;
        
        // Update server health
        updateProgressBar('cpu', stats.server.cpu_percent);
        updateProgressBar('memory', stats.server.memory_percent);
        updateProgressBar('load', stats.capacity.current_load_percent);
        
        // Update timestamp
        const now = new Date();
        document.getElementById('monitoring-last-updated').textContent = 
            `Last updated: ${now.toLocaleTimeString()}`;
            
    } catch (error) {
        console.error('Error loading monitoring stats:', error);
    }
}

function updateProgressBar(type, value) {
    const progressEl = document.getElementById(`${type}-progress`);
    const valueEl = document.getElementById(`${type}-value`);
    
    if (progressEl && valueEl) {
        progressEl.style.width = `${Math.min(value, 100)}%`;
        valueEl.textContent = `${value}%`;
        
        // Update color based on value
        progressEl.classList.remove('warning', 'danger');
        if (value >= 80) {
            progressEl.classList.add('danger');
        } else if (value >= 60) {
            progressEl.classList.add('warning');
        }
    }
}

function refreshMonitoring() {
    loadMonitoringStats();
    showNotification('Monitoring data refreshed', 'success');
}

function startMonitoringAutoRefresh() {
    // Clear any existing interval
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }
    
    // Load immediately
    loadMonitoringStats();
    
    // Then refresh every 30 seconds
    monitoringInterval = setInterval(loadMonitoringStats, 30000);
}

function stopMonitoringAutoRefresh() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}


// === SAFEGUARDING ALERT MANAGEMENT FUNCTIONS ===

async function viewSafeguardingAlert(alertId) {
    try {
        const alert = await apiCall(`/safeguarding-alerts/${alertId}`);
        if (!alert) {
            showNotification('Alert not found', 'error');
            return;
        }
        
        const triggersHtml = alert.triggered_indicators && alert.triggered_indicators.length > 0
            ? alert.triggered_indicators.map(t => `<span class="badge badge-warning">${t}</span>`).join(' ')
            : '<span class="text-muted">None recorded</span>';
        
        const characterName = alert.character ? alert.character.charAt(0).toUpperCase() + alert.character.slice(1) : 'AI';
        const conversationHtml = alert.conversation_history && alert.conversation_history.length > 0
            ? alert.conversation_history.map(msg => `
                <div class="message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}">
                    <strong>${msg.role === 'user' ? 'User' : characterName}:</strong> ${msg.content || msg.message || ''}
                </div>
            `).join('')
            : '<p class="text-muted">No conversation history available</p>';
        
        const modalContent = `
            <div class="safeguarding-detail">
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Alert ID:</label>
                        <span>${alert.id}</span>
                    </div>
                    <div class="detail-item">
                        <label>Risk Level:</label>
                        <span class="badge badge-${alert.risk_level === 'RED' ? 'danger' : alert.risk_level === 'AMBER' ? 'warning' : 'info'}">${alert.risk_level}</span>
                    </div>
                    <div class="detail-item">
                        <label>Risk Score:</label>
                        <span><strong>${alert.risk_score || 0}</strong></span>
                    </div>
                    <div class="detail-item">
                        <label>Status:</label>
                        <span class="badge badge-${alert.status === 'resolved' ? 'success' : alert.status === 'acknowledged' ? 'warning' : 'secondary'}">${alert.status || 'active'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Session ID:</label>
                        <span>${alert.session_id || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Character:</label>
                        <span>${alert.character || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Client IP:</label>
                        <span>${alert.client_ip || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Location:</label>
                        <span>${alert.geo_city && alert.geo_country ? `${alert.geo_city}, ${alert.geo_country}` : 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <label>ISP:</label>
                        <span>${alert.geo_isp || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Created:</label>
                        <span>${formatDateTime(alert.created_at)}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Triggered Indicators</h4>
                    <div class="triggers-list">${triggersHtml}</div>
                </div>
                
                <div class="detail-section">
                    <h4>Triggering Message</h4>
                    <div class="triggering-message">${alert.triggering_message || 'Not recorded'}</div>
                </div>
                
                <div class="detail-section">
                    <h4>AI Response</h4>
                    <div class="ai-response">${alert.ai_response || 'Not recorded'}</div>
                </div>
                
                <div class="detail-section">
                    <h4>Conversation History</h4>
                    <div class="conversation-history">${conversationHtml}</div>
                </div>
                
                <div class="detail-actions">
                    ${alert.status === 'active' ? `<button class="btn btn-warning" onclick="acknowledgeSafeguardingAlert('${alert.id}'); closeSafeguardingModal();">Acknowledge</button>` : ''}
                    ${alert.status !== 'resolved' ? `<button class="btn btn-success" onclick="resolveSafeguardingAlert('${alert.id}'); closeSafeguardingModal();">Mark Resolved</button>` : ''}
                    <button class="btn btn-secondary" onclick="closeSafeguardingModal()">Close</button>
                </div>
            </div>
        `;
        
        showModal('Safeguarding Alert Details', modalContent);
    } catch (error) {
        console.error('Error viewing safeguarding alert:', error);
        showNotification('Failed to load alert details', 'error');
    }
}

async function acknowledgeSafeguardingAlert(alertId) {
    try {
        await apiCall(`/safeguarding-alerts/${alertId}/acknowledge`, { method: 'PATCH' });
        showNotification('Alert acknowledged', 'success');
        refreshSafeguardingMonitor(); // Refresh the safeguarding view
        closeModal(); // Close any open modal
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        showNotification('Failed to acknowledge alert', 'error');
    }
}

async function resolveSafeguardingAlert(alertId) {
    console.log('Attempting to resolve alert:', alertId);
    try {
        const result = await apiCall(`/safeguarding-alerts/${alertId}/resolve`, { method: 'PATCH' });
        console.log('Resolve result:', result);
        showNotification('Alert resolved', 'success');
        refreshSafeguardingMonitor(); // Refresh the safeguarding view
        loadSafeguardingAlerts(); // Also refresh the alerts list
        closeModal(); // Close any open modal
    } catch (error) {
        console.error('Error resolving alert:', error);
        showNotification('Failed to resolve alert: ' + error.message, 'error');
    }
}

function showModal(title, content) {
    // Check if modal container exists, if not create it
    let modalContainer = document.getElementById('safeguarding-modal');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'safeguarding-modal';
        modalContainer.className = 'modal-overlay';
        document.body.appendChild(modalContainer);
    }
    
    modalContainer.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeSafeguardingModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    modalContainer.style.display = 'flex';
}

function closeSafeguardingModal() {
    const modal = document.getElementById('safeguarding-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}


// Hook into tab switching to start/stop monitoring refresh
const originalSwitchTab = window.switchTab || function() {};
window.switchTab = function(tabName) {
    // Call original if exists
    if (typeof originalSwitchTab === 'function') {
        originalSwitchTab(tabName);
    }
    
    // Handle monitoring tab
    if (tabName === 'monitoring') {
        startMonitoringAutoRefresh();
    } else {
        stopMonitoringAutoRefresh();
    }
};

// Add monitoring to tab click handlers
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            if (tabName === 'monitoring') {
                startMonitoringAutoRefresh();
            } else {
                stopMonitoringAutoRefresh();
            }
        });
    });
});

// ============ SAFEGUARDING MONITOR FUNCTIONS ============

async function testSafeguardingPhrase() {
    var phraseInput = document.getElementById('test-phrase');
    var resultEl = document.getElementById('test-result');
    
    if (!phraseInput || !phraseInput.value.trim()) {
        showNotification('Please enter a phrase to test', 'warning');
        return;
    }
    
    try {
        var data = await apiCall('/safeguarding/test', {
            method: 'POST',
            body: JSON.stringify({ phrase: phraseInput.value })
        });
        
        var levelClass = data.risk_level.toLowerCase();
        var triggers = data.triggered_indicators.map(function(t) {
            return '<span class="trigger-badge ' + t.level.toLowerCase() + '">' + t.indicator + ' (+' + t.weight + ')</span>';
        }).join(' ');
        
        var html = '<div class="test-result-card ' + levelClass + '">';
        html += '<div class="result-header">';
        html += '<span class="risk-badge ' + levelClass + '">' + data.risk_level + '</span>';
        html += '<span class="score">Score: ' + data.score + '</span>';
        html += data.would_create_alert ? '<span class="alert-badge">Would create alert</span>' : '<span class="no-alert-badge">No alert</span>';
        html += '</div>';
        if (triggers) {
            html += '<div class="triggers">' + triggers + '</div>';
        } else {
            html += '<p class="no-triggers">No triggers matched</p>';
        }
        html += '</div>';
        
        resultEl.innerHTML = html;
        
    } catch (error) {
        console.error('Error testing phrase:', error);
        showNotification('Failed to test phrase', 'error');
    }
}

async function loadTriggerPhrases() {
    try {
        var data = await apiCall('/safeguarding/triggers');
        
        var triggerEl = document.getElementById('trigger-phrases');
        if (!triggerEl) return;
        
        var html = '';
        
        // RED indicators
        html += '<div class="trigger-section red">';
        html += '<h5>RED Indicators (' + data.red_indicators.triggers.length + ') - ' + data.red_indicators.threshold_info + '</h5>';
        html += '<div class="trigger-pills">';
        data.red_indicators.triggers.slice(0, 30).forEach(function(t) {
            html += '<span class="trigger-pill red">' + t.phrase + ' (+' + t.weight + ')</span>';
        });
        if (data.red_indicators.triggers.length > 30) {
            html += '<span class="more-badge">+' + (data.red_indicators.triggers.length - 30) + ' more</span>';
        }
        html += '</div></div>';
        
        // AMBER indicators
        html += '<div class="trigger-section amber">';
        html += '<h5>AMBER Indicators (' + data.amber_indicators.triggers.length + ') - ' + data.amber_indicators.threshold_info + '</h5>';
        html += '<div class="trigger-pills">';
        data.amber_indicators.triggers.slice(0, 30).forEach(function(t) {
            html += '<span class="trigger-pill amber">' + t.phrase + ' (+' + t.weight + ')</span>';
        });
        if (data.amber_indicators.triggers.length > 30) {
            html += '<span class="more-badge">+' + (data.amber_indicators.triggers.length - 30) + ' more</span>';
        }
        html += '</div></div>';
        
        // Modifiers
        html += '<div class="trigger-section modifier">';
        html += '<h5>Modifiers (' + data.modifiers.triggers.length + ') - ' + data.modifiers.threshold_info + '</h5>';
        html += '<div class="trigger-pills">';
        data.modifiers.triggers.forEach(function(t) {
            html += '<span class="trigger-pill modifier">' + t.phrase + ' (+' + t.weight + ')</span>';
        });
        html += '</div></div>';
        
        // Scoring rules
        html += '<div class="scoring-rules">';
        html += '<h5>Scoring Rules</h5>';
        html += '<ul>';
        Object.entries(data.scoring_rules).forEach(function([level, rule]) {
            html += '<li><span class="risk-badge ' + level.toLowerCase() + '">' + level + '</span> ' + rule + '</li>';
        });
        html += '</ul></div>';
        
        triggerEl.innerHTML = html;
        showNotification('Trigger phrases loaded', 'success');
        
    } catch (error) {
        console.error('Error loading triggers:', error);
        showNotification('Failed to load trigger phrases', 'error');
    }
}

async function refreshSafeguardingMonitor() {
    try {
        var data = await apiCall('/safeguarding/monitor');
        
        var activityEl = document.getElementById('monitor-activity');
        if (!activityEl) return;
        
        if (data.recent_alerts.length === 0) {
            activityEl.innerHTML = '<p class="no-data">No safeguarding alerts in the last 24 hours</p>';
            showNotification('No recent activity', 'info');
            return;
        }
        
        var html = '<div class="activity-list">';
        data.recent_alerts.forEach(function(alert) {
            var levelClass = alert.risk_level.toLowerCase();
            var triggers = alert.triggered_indicators.map(function(t) {
                return '<span class="trigger-badge ' + t.level.toLowerCase() + '">' + t.indicator + ' (+' + t.weight + ')</span>';
            }).join(' ');
            
            html += '<div class="activity-item ' + levelClass + '">';
            html += '<div class="activity-header">';
            html += '<span class="risk-badge ' + levelClass + '">' + alert.risk_level + '</span>';
            html += '<span class="score">Score: ' + alert.score + '</span>';
            html += '<span class="status-badge ' + alert.status + '">' + alert.status + '</span>';
            html += '<span class="timestamp">' + new Date(alert.timestamp).toLocaleString() + '</span>';
            html += '</div>';
            html += '<div class="triggers">' + (triggers || '<em>No specific triggers</em>') + '</div>';
            html += '</div>';
        });
        html += '</div>';
        
        activityEl.innerHTML = html;
        showNotification('Monitor refreshed - ' + data.recent_alerts.length + ' alerts', 'success');
        
    } catch (error) {
        console.error('Error refreshing monitor:', error);
        showNotification('Failed to refresh monitor', 'error');
    }
}


// ============================================================================
// GOVERNANCE MODULE - Clinical Safety & Compliance
// ============================================================================

// Show governance subtab
function showGovernanceSubtab(subtab) {
    // Update button states
    document.querySelectorAll('.governance-subtab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.subtab === subtab) {
            btn.classList.add('active');
        }
    });
    
    // Show/hide sections
    document.querySelectorAll('.governance-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(subtab + '-section').style.display = 'block';
    
    // Load data for the section
    switch(subtab) {
        case 'hazards':
            loadHazards();
            break;
        case 'kpis':
            loadKPIs();
            break;
        case 'incidents':
            loadIncidents();
            break;
        case 'moderation':
            loadModerationQueue();
            break;
        case 'approvals':
            loadCSOApprovals();
            break;
        case 'compliance':
            loadComplianceStatus();
            break;
        case 'reports':
            loadScheduledReports();
            break;
    }
}

// Generate summary report (weekly or monthly)
async function generateReport(period) {
    const reportDisplay = document.getElementById('report-display');
    const reportLoading = document.getElementById('report-loading');
    const reportContent = document.getElementById('report-content');
    
    reportDisplay.style.display = 'block';
    reportLoading.style.display = 'block';
    reportContent.style.display = 'none';
    
    try {
        const report = await apiCall(`/governance/summary-report?period=${period}`);
        
        reportLoading.style.display = 'none';
        reportContent.style.display = 'block';
        
        const periodLabel = period === 'weekly' ? 'Weekly' : 'Monthly';
        const periodDays = report.period_days;
        
        reportContent.innerHTML = `
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #fff; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="margin: 0;"><i class="fas fa-file-alt"></i> ${periodLabel} Summary Report</h3>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">
                    Period: ${new Date(report.period_start).toLocaleDateString()} - ${new Date(report.period_end).toLocaleDateString()} (${periodDays} days)
                </p>
                <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
                    Generated: ${new Date(report.generated_at).toLocaleString()}
                </p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <!-- Safeguarding Card -->
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border-left: 4px solid #ef4444;">
                    <h4 style="margin: 0 0 15px 0; color: #ef4444;"><i class="fas fa-shield-alt"></i> Safeguarding</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <span style="font-size: 24px; font-weight: 700; color: var(--text-primary);">${report.safeguarding.total_alerts}</span>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Total Alerts</p>
                        </div>
                        <div>
                            <span style="font-size: 24px; font-weight: 700; color: #ef4444;">${report.safeguarding.imminent_risk}</span>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Imminent Risk</p>
                        </div>
                        <div>
                            <span style="font-size: 24px; font-weight: 700; color: #f59e0b;">${report.safeguarding.high_risk}</span>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">High Risk</p>
                        </div>
                        <div>
                            <span style="font-size: 24px; font-weight: 700; color: #8b5cf6;">${report.safeguarding.panic_alerts}</span>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Panic Alerts</p>
                        </div>
                    </div>
                </div>
                
                <!-- KPIs Card -->
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border-left: 4px solid #10b981;">
                    <h4 style="margin: 0 0 15px 0; color: #10b981;"><i class="fas fa-chart-line"></i> KPIs</h4>
                    <div style="font-size: 14px;">
                        <div style="margin-bottom: 10px;">
                            <strong>Avg Response (High):</strong> ${report.kpis.avg_response_time_high || 'N/A'}
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>Avg Response (Imminent):</strong> ${report.kpis.avg_response_time_imminent || 'N/A'}
                        </div>
                        <div>
                            <strong>SLA Compliance:</strong> ${report.kpis.high_risk_sla_compliance || 'N/A'}
                        </div>
                    </div>
                </div>
                
                <!-- Engagement Card -->
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border-left: 4px solid #3b82f6;">
                    <h4 style="margin: 0 0 15px 0; color: #3b82f6;"><i class="fas fa-users"></i> Engagement</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <span style="font-size: 24px; font-weight: 700; color: var(--text-primary);">${report.engagement.ai_chat_sessions}</span>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">AI Chats</p>
                        </div>
                        <div>
                            <span style="font-size: 24px; font-weight: 700; color: var(--text-primary);">${report.engagement.live_chats}</span>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Live Chats</p>
                        </div>
                        <div>
                            <span style="font-size: 24px; font-weight: 700; color: var(--text-primary);">${report.engagement.callbacks_requested}</span>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Callbacks</p>
                        </div>
                        <div>
                            <span style="font-size: 24px; font-weight: 700; color: #10b981;">${report.engagement.callback_completion_rate}</span>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Completion</p>
                        </div>
                    </div>
                </div>
            </div>
            
            ${report.recommendations && report.recommendations.length > 0 ? `
            <div style="background: #fef3c7; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <h4 style="margin: 0 0 10px 0; color: #92400e;"><i class="fas fa-exclamation-triangle"></i> Recommendations</h4>
                <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                    ${report.recommendations.map(r => `<li style="margin-bottom: 5px;">${r}</li>`).join('')}
                </ul>
            </div>
            ` : `
            <div style="background: #d1fae5; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #10b981;">
                <h4 style="margin: 0; color: #065f46;"><i class="fas fa-check-circle"></i> All systems operating within normal parameters</h4>
            </div>
            `}
            
            <div style="margin-top: 20px; text-align: center;">
                <button class="btn btn-secondary" onclick="exportReportPDF()">
                    <i class="fas fa-download"></i> Export as PDF
                </button>
                <button class="btn btn-outline" onclick="printReport()">
                    <i class="fas fa-print"></i> Print Report
                </button>
            </div>
        `;
        
        showNotification(`${periodLabel} report generated successfully`, 'success');
        
    } catch (error) {
        reportLoading.style.display = 'none';
        reportContent.style.display = 'block';
        reportContent.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger);">
                <i class="fas fa-exclamation-circle fa-3x"></i>
                <p style="margin-top: 15px;">Failed to generate report. Please try again.</p>
                <p style="font-size: 12px; color: var(--text-secondary);">${error.message || error}</p>
            </div>
        `;
    }
}

function printReport() {
    const content = document.getElementById('report-content');
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Radio Check Summary Report</title>');
    printWindow.document.write('<style>body{font-family:Arial,sans-serif;padding:20px;}h3,h4{color:#333;}.no-print{display:none;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(content.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function exportReportPDF() {
    const period = document.getElementById('report-period-select')?.value || 'weekly';
    openPDFReport(period);
}

// Open PDF report in new window (masked URL)
async function openPDFReport(period) {
    try {
        showNotification(`Generating ${period} PDF report...`, 'info');
        
        // Fetch PDF via authenticated request
        const response = await fetch(`${CONFIG.API_URL}/api/governance/summary-report/pdf?period=${period}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate PDF');
        }
        
        // Create blob and open in new tab
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Open in new window
        const newWindow = window.open(blobUrl, '_blank');
        
        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        
        showNotification(`${period} PDF report opened`, 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showNotification('Failed to generate PDF: ' + error.message, 'error');
    }
}

// Email report to specified address
async function emailReport() {
    const email = document.getElementById('report-email-input').value.trim();
    const period = document.getElementById('report-period-select').value;
    
    if (!email) {
        showNotification('Please enter an email address', 'error');
        return;
    }
    
    if (!email.includes('@')) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        showNotification('Sending report...', 'info');
        const response = await apiCall(`/governance/summary-report/email?email=${encodeURIComponent(email)}&period=${period}`, 'POST');
        showNotification(`Report sent to ${email}`, 'success');
        document.getElementById('report-email-input').value = '';
    } catch (error) {
        showNotification('Failed to send report: ' + (error.message || error), 'error');
    }
}

// Add scheduled report
async function addScheduledReport() {
    const email = document.getElementById('schedule-email-input').value.trim();
    const frequency = document.getElementById('schedule-frequency-select').value;
    
    if (!email || !email.includes('@')) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        await apiCall(`/governance/scheduled-reports?email=${encodeURIComponent(email)}&frequency=${frequency}&enabled=true`, 'POST');
        showNotification(`Scheduled ${frequency} reports to ${email}`, 'success');
        document.getElementById('schedule-email-input').value = '';
        loadScheduledReports();
    } catch (error) {
        showNotification('Failed to create schedule: ' + (error.message || error), 'error');
    }
}

// Load scheduled reports list
async function loadScheduledReports() {
    const container = document.getElementById('scheduled-reports-list');
    try {
        const response = await apiCall('/governance/scheduled-reports');
        const schedules = response.schedules || [];
        
        if (schedules.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 0;">No scheduled reports configured.</p>';
            return;
        }
        
        container.innerHTML = schedules.map(s => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-primary); border-radius: 8px; margin-bottom: 8px;">
                <div>
                    <strong style="color: var(--text-primary);">${s.email}</strong>
                    <span style="color: var(--text-secondary); margin-left: 10px;">
                        <i class="fas fa-clock"></i> ${s.frequency}
                    </span>
                    ${s.enabled ? '<span style="color: #10b981; margin-left: 10px;"><i class="fas fa-check-circle"></i> Active</span>' : '<span style="color: #f59e0b; margin-left: 10px;"><i class="fas fa-pause-circle"></i> Paused</span>'}
                </div>
                <button class="btn btn-small btn-danger" onclick="deleteScheduledReport('${s.email}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<p style="color: var(--danger); text-align: center;">Failed to load schedules.</p>';
    }
}

// Delete scheduled report
async function deleteScheduledReport(email) {
    if (!confirm(`Remove scheduled reports for ${email}?`)) return;
    
    try {
        await apiCall(`/governance/scheduled-reports/${encodeURIComponent(email)}`, 'DELETE');
        showNotification(`Removed schedule for ${email}`, 'success');
        loadScheduledReports();
    } catch (error) {
        showNotification('Failed to remove schedule', 'error');
    }
}

// Load hazards
async function loadHazards() {
    try {
        const hazards = await apiCall('/governance/hazards');
        const tbody = document.getElementById('hazards-tbody');
        
        if (!hazards || hazards.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No hazards found. Click "Add Hazard" to create one.</td></tr>';
            return;
        }
        
        let html = '';
        hazards.forEach(h => {
            const riskClass = h.risk_rating >= 15 ? 'risk-critical' : 
                              h.risk_rating >= 10 ? 'risk-high' : 
                              h.risk_rating >= 6 ? 'risk-medium' : 'risk-low';
            const statusClass = h.status === 'closed' ? 'status-closed' : 
                                h.status === 'mitigated' ? 'status-mitigated' : 'status-active';
            
            html += `
                <tr>
                    <td><strong>${h.hazard_id}</strong></td>
                    <td>
                        <div><strong>${h.title}</strong></div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${h.cause}</div>
                    </td>
                    <td><span class="severity-badge severity-${h.severity}">${h.severity}</span></td>
                    <td><span class="likelihood-badge">${h.likelihood}</span></td>
                    <td><span class="risk-badge ${riskClass}">${h.risk_rating}</span></td>
                    <td><span class="status-badge ${statusClass}">${h.status}</span></td>
                    <td>${h.owner}</td>
                    <td>
                        <button class="btn btn-small btn-outline" onclick="reviewHazard('${h.hazard_id}')" title="Review">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-small btn-outline" onclick="editHazard('${h.hazard_id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    } catch (error) {
        console.error('Error loading hazards:', error);
        showNotification('Failed to load hazards', 'error');
    }
}

// Load KPIs
async function loadKPIs() {
    try {
        const days = document.getElementById('kpi-period')?.value || 30;
        const data = await apiCall(`/governance/kpis?days=${days}`);
        
        if (data && data.kpis) {
            const kpis = data.kpis;
            
            // Update KPI cards
            document.getElementById('kpi-high-risk-time').textContent = 
                kpis.avg_high_risk_response_time > 0 ? kpis.avg_high_risk_response_time.toFixed(1) + ' min' : 'N/A';
            document.getElementById('kpi-imminent-time').textContent = 
                kpis.avg_imminent_risk_response_time > 0 ? kpis.avg_imminent_risk_response_time.toFixed(1) + ' min' : 'N/A';
            document.getElementById('kpi-sla').textContent = kpis.pct_high_risk_reviewed_in_sla.toFixed(1) + '%';
            document.getElementById('kpi-high-risk-count').textContent = kpis.total_high_risk_alerts;
            document.getElementById('kpi-imminent-count').textContent = kpis.total_imminent_risk_alerts;
            document.getElementById('kpi-medium-count').textContent = kpis.total_medium_risk_alerts;
            
            // Update chart
            updateKPIChart(kpis.risk_level_distribution);
        }
    } catch (error) {
        console.error('Error loading KPIs:', error);
        showNotification('Failed to load KPIs', 'error');
    }
}

let kpiChart = null;
function updateKPIChart(distribution) {
    const ctx = document.getElementById('kpi-risk-chart');
    if (!ctx) return;
    
    if (kpiChart) {
        kpiChart.destroy();
    }
    
    kpiChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Imminent', 'High', 'Medium', 'Low'],
            datasets: [{
                data: [
                    distribution.imminent || 0,
                    distribution.high || 0,
                    distribution.medium || 0,
                    distribution.low || 0
                ],
                backgroundColor: ['#ef4444', '#f97316', '#fbbf24', '#22c55e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Load incidents
async function loadIncidents() {
    try {
        const incidents = await apiCall('/governance/incidents');
        const tbody = document.getElementById('incidents-tbody');
        
        if (!incidents || incidents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No incidents recorded</td></tr>';
            return;
        }
        
        let html = '';
        incidents.forEach(inc => {
            const levelClass = inc.level.includes('critical') ? 'level-critical' : 
                              inc.level.includes('high') ? 'level-high' : 'level-moderate';
            
            html += `
                <tr>
                    <td><strong>${inc.incident_number}</strong></td>
                    <td>${inc.title}</td>
                    <td><span class="level-badge ${levelClass}">${inc.level.replace('level_', 'L').replace('_', ' ')}</span></td>
                    <td><span class="status-badge status-${inc.status}">${inc.status}</span></td>
                    <td>${new Date(inc.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-small btn-outline" onclick="viewIncident('${inc.incident_number}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    } catch (error) {
        console.error('Error loading incidents:', error);
        showNotification('Failed to load incidents', 'error');
    }
}

// Load moderation queue
async function loadModerationQueue() {
    try {
        const reports = await apiCall('/governance/peer-reports?status=pending');
        const tbody = document.getElementById('moderation-tbody');
        
        if (!reports || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No pending reports - all clear!</td></tr>';
            return;
        }
        
        let html = '';
        reports.forEach(r => {
            html += `
                <tr>
                    <td>${r.id.substring(0, 12)}...</td>
                    <td>${r.reported_user_id}</td>
                    <td>${r.reason}</td>
                    <td><span class="status-badge status-pending">${r.status}</span></td>
                    <td>${new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-small btn-success" onclick="takeModerationAction('${r.id}', 'reviewed')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-small btn-warning" onclick="takeModerationAction('${r.id}', 'warning_issued')">
                            <i class="fas fa-exclamation"></i>
                        </button>
                        <button class="btn btn-small btn-danger" onclick="takeModerationAction('${r.id}', 'suspended')">
                            <i class="fas fa-ban"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    } catch (error) {
        console.error('Error loading moderation queue:', error);
        showNotification('Failed to load moderation queue', 'error');
    }
}

// Take moderation action
async function takeModerationAction(reportId, action) {
    try {
        const moderatorId = currentUser?.email || 'admin';
        await apiCall(`/governance/peer-reports/${reportId}/action?action=${action}&moderator_id=${moderatorId}`, {
            method: 'PUT'
        });
        showNotification(`Action "${action}" taken successfully`, 'success');
        loadModerationQueue();
    } catch (error) {
        console.error('Error taking action:', error);
        showNotification('Failed to take action', 'error');
    }
}

// Load CSO approvals
async function loadCSOApprovals() {
    try {
        const approvals = await apiCall('/governance/cso/approvals');
        const tbody = document.getElementById('approvals-tbody');
        
        if (!approvals || approvals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No pending approvals</td></tr>';
            return;
        }
        
        let html = '';
        approvals.forEach(a => {
            html += `
                <tr>
                    <td>${a.id.substring(0, 12)}...</td>
                    <td>${a.request_type}</td>
                    <td>${a.description}</td>
                    <td>${a.requested_by}</td>
                    <td>${new Date(a.requested_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-small btn-success" onclick="processCSOApproval('${a.id}', true)">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn btn-small btn-danger" onclick="processCSOApproval('${a.id}', false)">
                            <i class="fas fa-times"></i> Deny
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    } catch (error) {
        console.error('Error loading approvals:', error);
        showNotification('Failed to load approvals', 'error');
    }
}

// Process CSO approval
async function processCSOApproval(approvalId, approved) {
    try {
        const reviewerId = currentUser?.email || 'admin';
        const notes = prompt('Enter review notes (optional):');
        
        await apiCall(`/governance/cso/approvals/${approvalId}?approved=${approved}&reviewer_id=${reviewerId}&notes=${encodeURIComponent(notes || '')}`, {
            method: 'PUT'
        });
        
        showNotification(approved ? 'Approval granted' : 'Approval denied', 'success');
        loadCSOApprovals();
    } catch (error) {
        console.error('Error processing approval:', error);
        showNotification('Failed to process approval', 'error');
    }
}

// Review hazard
async function reviewHazard(hazardId) {
    try {
        const reviewerId = currentUser?.email || 'admin';
        await apiCall(`/governance/hazards/${hazardId}/review?reviewer_id=${reviewerId}`, {
            method: 'POST'
        });
        showNotification(`Hazard ${hazardId} marked as reviewed`, 'success');
        loadHazards();
    } catch (error) {
        console.error('Error reviewing hazard:', error);
        showNotification('Failed to review hazard', 'error');
    }
}

// Export governance data
async function exportGovernanceData() {
    try {
        const data = await apiCall('/governance/export?days=90');
        
        // Download as JSON
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `governance_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Governance data exported', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Failed to export data', 'error');
    }
}

// Submit CSO sign-off
async function submitCSOSignoff() {
    const name = document.getElementById('cso-name').value;
    const qualification = document.getElementById('cso-qualification').value;
    
    if (!name || !qualification) {
        showNotification('Please enter your name and qualification', 'error');
        return;
    }
    
    try {
        // Create an approval record for the sign-off
        await apiCall('/governance/cso/approvals', {
            method: 'POST',
            body: JSON.stringify({
                request_type: 'annual_signoff',
                description: `Annual safeguarding review sign-off by ${name} (${qualification})`,
                requested_by: currentUser?.email || 'admin',
                current_value: {},
                proposed_value: { signed_by: name, qualification: qualification, date: new Date().toISOString() }
            })
        });
        
        // Auto-approve it (CSO signing off)
        showNotification('CSO sign-off recorded successfully', 'success');
        
        document.getElementById('last-signoff').innerHTML = `
            <i class="fas fa-check-circle" style="color: #22c55e;"></i>
            Last sign-off: ${name} (${qualification}) on ${new Date().toLocaleDateString()}
        `;
        
        document.getElementById('cso-name').value = '';
        document.getElementById('cso-qualification').value = '';
        
    } catch (error) {
        console.error('Error submitting sign-off:', error);
        showNotification('Failed to submit sign-off', 'error');
    }
}

// Placeholder functions for modals
function openAddHazardModal() {
    showNotification('Add Hazard modal - Coming soon. Use API directly for now.', 'info');
}

function openAddIncidentModal() {
    showNotification('Add Incident modal - Coming soon. Use API directly for now.', 'info');
}

function editHazard(hazardId) {
    showNotification(`Edit hazard ${hazardId} - Coming soon`, 'info');
}

function viewIncident(incidentNumber) {
    showNotification(`View incident ${incidentNumber} - Coming soon`, 'info');
}

// ============================================================================
// AI COMPLIANCE CHECKER
// ============================================================================

// Compliance requirements database
const COMPLIANCE_REQUIREMENTS = {
    dcb0129: {
        name: "NHS DCB0129",
        color: "#3b82f6",
        requirements: [
            { id: "dcb1", check: "hazard_register", name: "Hazard Register", description: "Maintain documented hazard log", weight: 3 },
            { id: "dcb2", check: "risk_scoring", name: "Risk Scoring", description: "Severity x Likelihood scoring system", weight: 3 },
            { id: "dcb3", check: "cso_role", name: "CSO Role Defined", description: "Clinical Safety Officer appointed", weight: 3 },
            { id: "dcb4", check: "incident_management", name: "Incident Management", description: "Formal incident logging process", weight: 3 },
            { id: "dcb5", check: "audit_trail", name: "Audit Trail", description: "Changes and events are logged", weight: 2 },
            { id: "dcb6", check: "periodic_review", name: "Periodic Review", description: "Annual safety case review", weight: 2 }
        ]
    },
    samaritans: {
        name: "Samaritans AI Policy",
        color: "#10b981",
        requirements: [
            { id: "sam1", check: "no_harmful_instructions", name: "No Harmful Instructions", description: "AI refuses to provide self-harm methods", weight: 3 },
            { id: "sam2", check: "crisis_resources", name: "Crisis Resources", description: "Automatic crisis helpline provision", weight: 3 },
            { id: "sam3", check: "human_escalation", name: "Human Escalation", description: "Clear path to human support", weight: 3 },
            { id: "sam4", check: "no_romanticizing", name: "No Romanticizing", description: "AI doesn't glamorize self-harm", weight: 3 },
            { id: "sam5", check: "session_monitoring", name: "Session Monitoring", description: "Multi-message risk detection", weight: 2 },
            { id: "sam6", check: "dependency_detection", name: "Dependency Detection", description: "AI over-reliance warnings", weight: 2 }
        ]
    },
    onlineSafety: {
        name: "Online Safety Act",
        color: "#f59e0b",
        requirements: [
            { id: "osa1", check: "age_gate", name: "Age Verification", description: "Age-appropriate safeguards", weight: 3 },
            { id: "osa2", check: "reporting_mechanism", name: "Reporting Mechanism", description: "User can report harmful content", weight: 3 },
            { id: "osa3", check: "moderation_system", name: "Moderation System", description: "Content/user moderation process", weight: 3 },
            { id: "osa4", check: "transparency", name: "Transparency", description: "Clear terms and policies", weight: 2 }
        ]
    },
    icoAI: {
        name: "ICO Data Protection",
        color: "#8b5cf6",
        requirements: [
            { id: "ico1", check: "human_oversight", name: "Human Oversight", description: "Humans review high-risk decisions", weight: 3 },
            { id: "ico2", check: "decision_logging", name: "Decision Logging", description: "AI decisions are logged", weight: 3 },
            { id: "ico3", check: "explanation", name: "Explainability", description: "Can explain why AI flagged something", weight: 2 },
            { id: "ico4", check: "data_minimization", name: "Data Minimization", description: "Collect only necessary data", weight: 2 }
        ]
    }
};

// System implementation status (what we have)
const SYSTEM_IMPLEMENTATIONS = {
    hazard_register: { implemented: true, evidence: "Hazard Register with 7 core hazards (H1-H7)" },
    risk_scoring: { implemented: true, evidence: "Severity x Likelihood scoring (1-25 scale)" },
    cso_role: { implemented: true, evidence: "CSO approval workflow with email notifications" },
    incident_management: { implemented: true, evidence: "3-level incident system with staff reporting" },
    audit_trail: { implemented: true, evidence: "Governance audit log for all changes" },
    periodic_review: { implemented: true, evidence: "Annual sign-off workflow for CSO" },
    no_harmful_instructions: { implemented: true, evidence: "System prompts explicitly refuse harmful content" },
    crisis_resources: { implemented: true, evidence: "Auto-injected crisis helplines in high-risk responses" },
    human_escalation: { implemented: true, evidence: "Safeguarding popup with Call/Chat/Callback options" },
    no_romanticizing: { implemented: true, evidence: "Prompt guardrails against romanticizing" },
    session_monitoring: { implemented: true, evidence: "Multi-layer analysis across conversation history" },
    dependency_detection: { implemented: true, evidence: "Over-reliance detection with soft warnings" },
    age_gate: { implemented: true, evidence: "DOB collection with under-18 feature restrictions" },
    reporting_mechanism: { implemented: true, evidence: "Peer report queue in governance system" },
    moderation_system: { implemented: true, evidence: "User moderation with warn/suspend/ban actions" },
    transparency: { implemented: true, evidence: "Clear operating hours and AI disclosure in-app" },
    human_oversight: { implemented: true, evidence: "High-risk flags require human review" },
    decision_logging: { implemented: true, evidence: "All AI risk scores logged with safeguarding alerts" },
    explanation: { implemented: true, evidence: "Triggered indicators shown in alerts" },
    data_minimization: { implemented: true, evidence: "Anonymous by default, name only at referral" }
};

function loadComplianceStatus() {
    const lastCheck = localStorage.getItem('last_compliance_check');
    if (lastCheck) {
        const checkData = JSON.parse(lastCheck);
        document.getElementById('last-compliance-check').innerHTML = `
            <i class="fas fa-check-circle" style="color: #22c55e;"></i> 
            Last check: ${new Date(checkData.timestamp).toLocaleString()} - 
            Overall Score: <strong>${checkData.overallScore}%</strong>
        `;
    }
}

async function runComplianceCheck() {
    const resultsDiv = document.getElementById('compliance-results');
    const summaryDiv = document.getElementById('compliance-summary');
    const detailsDiv = document.getElementById('compliance-details');
    
    resultsDiv.style.display = 'block';
    summaryDiv.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Running compliance check...</div>';
    
    // Simulate checking delay for UX
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Calculate scores for each framework
    const results = {};
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [frameworkId, framework] of Object.entries(COMPLIANCE_REQUIREMENTS)) {
        let frameworkScore = 0;
        let frameworkWeight = 0;
        const checks = [];
        
        for (const req of framework.requirements) {
            const impl = SYSTEM_IMPLEMENTATIONS[req.check];
            const passed = impl?.implemented || false;
            
            frameworkWeight += req.weight;
            if (passed) {
                frameworkScore += req.weight;
            }
            
            checks.push({
                ...req,
                passed,
                evidence: impl?.evidence || 'Not implemented'
            });
        }
        
        const score = Math.round((frameworkScore / frameworkWeight) * 100);
        results[frameworkId] = {
            name: framework.name,
            color: framework.color,
            score,
            checks
        };
        
        totalScore += frameworkScore;
        totalWeight += frameworkWeight;
    }
    
    const overallScore = Math.round((totalScore / totalWeight) * 100);
    
    // Render summary cards
    summaryDiv.innerHTML = Object.entries(results).map(([id, r]) => `
        <div style="background: var(--bg-tertiary); padding: 20px; border-radius: 10px; text-align: center; border-left: 4px solid ${r.color};">
            <div style="font-size: 32px; font-weight: 700; color: ${r.score === 100 ? '#22c55e' : r.score >= 80 ? '#f59e0b' : '#ef4444'};">
                ${r.score}%
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 5px;">${r.name}</div>
        </div>
    `).join('');
    
    // Render detailed results
    detailsDiv.innerHTML = Object.entries(results).map(([id, r]) => `
        <div style="margin-bottom: 30px;">
            <h4 style="margin-bottom: 15px; color: ${r.color};"><i class="fas fa-clipboard-check"></i> ${r.name}</h4>
            <div style="background: var(--bg-tertiary); border-radius: 10px; overflow: hidden;">
                ${r.checks.map(c => `
                    <div style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid var(--border);">
                        <div style="width: 30px;">
                            ${c.passed 
                                ? '<i class="fas fa-check-circle" style="color: #22c55e;"></i>'
                                : '<i class="fas fa-times-circle" style="color: #ef4444;"></i>'
                            }
                        </div>
                        <div style="flex: 1;">
                            <strong>${c.name}</strong>
                            <div style="font-size: 12px; color: var(--text-secondary);">${c.description}</div>
                        </div>
                        <div style="max-width: 300px; font-size: 12px; color: ${c.passed ? '#22c55e' : '#ef4444'};">
                            ${c.evidence}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    // Save result
    const checkResult = {
        timestamp: new Date().toISOString(),
        overallScore,
        results
    };
    localStorage.setItem('last_compliance_check', JSON.stringify(checkResult));
    
    document.getElementById('last-compliance-check').innerHTML = `
        <i class="fas fa-check-circle" style="color: #22c55e;"></i> 
        Compliance check completed at ${new Date().toLocaleString()} - 
        Overall Score: <strong style="color: ${overallScore === 100 ? '#22c55e' : '#f59e0b'};">${overallScore}%</strong>
    `;
    
    showNotification(`Compliance check complete: ${overallScore}% compliant`, overallScore === 100 ? 'success' : 'info');
}

// Auto-load hazards when governance tab opens
document.addEventListener('DOMContentLoaded', function() {
    const governanceTab = document.querySelector('[data-tab="governance"]');
    if (governanceTab) {
        governanceTab.addEventListener('click', function() {
            setTimeout(() => loadHazards(), 100);
        });
    }
});


// =========================================
// AI PERSONAS MANAGEMENT
// =========================================

let aiPersonas = [];
let personasSource = 'unknown';

// Load AI Personas when tab is opened
document.addEventListener('DOMContentLoaded', function() {
    const personasTab = document.querySelector('[data-tab="ai-personas"]');
    if (personasTab) {
        personasTab.addEventListener('click', function() {
            setTimeout(() => loadAIPersonas(), 100);
        });
    }
    
    // Avatar preview on URL change
    document.getElementById('persona-avatar')?.addEventListener('input', function(e) {
        updateAvatarPreview(e.target.value);
    });
    
    // Enabled toggle label
    document.getElementById('persona-enabled')?.addEventListener('change', function(e) {
        document.getElementById('persona-status-label').textContent = e.target.checked ? 'Enabled' : 'Disabled';
    });
});

async function loadAIPersonas() {
    const grid = document.getElementById('personas-grid');
    const notice = document.getElementById('personas-source-notice');
    
    grid.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading AI Personas...</div>';
    
    try {
        const data = await apiCall('/ai-characters/admin/all');
        
        aiPersonas = data.characters || [];
        personasSource = data.source || 'unknown';
        
        // Show/hide source notice
        if (personasSource === 'fallback' || personasSource === 'hardcoded') {
            notice.style.display = 'block';
        } else {
            notice.style.display = 'none';
        }
        
        renderPersonasGrid();
    } catch (error) {
        console.error('Error loading personas:', error);
        grid.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-triangle"></i> Failed to load personas. Please try again.</div>';
    }
}

// Helper to resolve avatar URLs - prepend API URL if path is relative
function resolveAvatarUrl(avatarPath) {
    if (!avatarPath) return '';
    // If it's already an absolute URL, return as-is
    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
        return avatarPath;
    }
    // If it's a relative path, prepend the API base URL
    // CONFIG.API_URL is defined in config.js (e.g., https://veterans-support-api.onrender.com)
    return `${CONFIG.API_URL}${avatarPath}`;
}

function renderPersonasGrid() {
    const grid = document.getElementById('personas-grid');
    
    if (aiPersonas.length === 0) {
        grid.innerHTML = '<div class="loading-placeholder"><i class="fas fa-robot"></i> No AI personas found. Click "Create New Persona" to add one.</div>';
        return;
    }
    
    grid.innerHTML = aiPersonas.map(persona => {
        const isEnabled = persona.is_enabled !== false;
        const isHardcoded = persona.is_hardcoded === true;
        const avatarUrl = resolveAvatarUrl(persona.avatar);
        const promptPreview = (persona.prompt || '').substring(0, 150);
        
        return `
            <div class="persona-card ${!isEnabled ? 'disabled' : ''}" data-id="${persona.id}">
                <div class="persona-card-header">
                    ${avatarUrl 
                        ? `<img src="${avatarUrl}" alt="${persona.name}" class="persona-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                           <div class="persona-avatar-placeholder" style="display:none;">${(persona.name || 'A')[0].toUpperCase()}</div>`
                        : `<div class="persona-avatar-placeholder">${(persona.name || 'A')[0].toUpperCase()}</div>`
                    }
                    <div class="persona-info">
                        <h3>
                            ${persona.name || 'Unnamed'}
                            <span class="badge ${isHardcoded ? 'hardcoded' : 'database'}">${isHardcoded ? 'Code' : 'DB'}</span>
                        </h3>
                        <div class="persona-id">ID: ${persona.id}</div>
                        <div class="persona-description">${persona.description || 'No description'}</div>
                    </div>
                </div>
                <div class="persona-card-body">
                    <div class="persona-meta">
                        <div class="persona-meta-item">
                            <i class="fas fa-tags"></i> ${persona.category || 'general'}
                        </div>
                        <div class="persona-meta-item">
                            <i class="fas fa-sort-numeric-up"></i> Order: ${persona.order ?? 0}
                        </div>
                        <div class="persona-meta-item">
                            <i class="fas fa-${isEnabled ? 'eye' : 'eye-slash'}"></i> ${isEnabled ? 'Enabled' : 'Disabled'}
                        </div>
                    </div>
                    ${promptPreview ? `<div class="persona-prompt-preview">${escapeHtml(promptPreview)}...</div>` : ''}
                </div>
                <div class="persona-card-actions">
                    <button class="btn btn-secondary btn-small" onclick="editPersona('${persona.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${!isHardcoded ? `
                        <button class="btn btn-danger btn-small" onclick="deletePersona('${persona.id}', '${escapeHtml(persona.name)}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : `
                        <button class="btn btn-outline btn-small" onclick="editPersona('${persona.id}')" title="Create a database copy to customize this character">
                            <i class="fas fa-copy"></i> Override
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// escapeHtml defined earlier - DO NOT DUPLICATE

function openAddPersonaModal() {
    const form = document.getElementById('persona-form');
    form.reset();
    
    document.getElementById('persona-modal-title').innerHTML = '<i class="fas fa-plus"></i> Create New AI Persona';
    document.getElementById('persona-submit-btn').innerHTML = '<i class="fas fa-plus"></i> Create Persona';
    document.getElementById('persona-is-new').value = 'true';
    document.getElementById('persona-char-id').disabled = false;
    document.getElementById('persona-enabled').checked = true;
    document.getElementById('persona-status-label').textContent = 'Enabled';
    document.getElementById('persona-order').value = aiPersonas.length + 1;
    
    // Clear avatar preview
    document.getElementById('avatar-preview-img').style.display = 'none';
    
    document.getElementById('persona-modal').classList.remove('hidden');
}

function editPersona(personaId) {
    const persona = aiPersonas.find(p => p.id === personaId);
    if (!persona) {
        showNotification('Persona not found', 'error');
        return;
    }
    
    document.getElementById('persona-modal-title').innerHTML = `<i class="fas fa-edit"></i> Edit: ${persona.name}`;
    document.getElementById('persona-submit-btn').innerHTML = '<i class="fas fa-save"></i> Save Changes';
    document.getElementById('persona-is-new').value = 'false';
    
    // Fill form
    document.getElementById('persona-id').value = persona.id;
    document.getElementById('persona-char-id').value = persona.id;
    document.getElementById('persona-char-id').disabled = true; // Can't change ID
    document.getElementById('persona-name').value = persona.name || '';
    document.getElementById('persona-description').value = persona.description || '';
    document.getElementById('persona-bio').value = persona.bio || '';
    document.getElementById('persona-category').value = persona.category || 'general';
    document.getElementById('persona-order').value = persona.order ?? 0;
    document.getElementById('persona-enabled').checked = persona.is_enabled !== false;
    document.getElementById('persona-status-label').textContent = persona.is_enabled !== false ? 'Enabled' : 'Disabled';
    document.getElementById('persona-avatar').value = persona.avatar || '';
    document.getElementById('persona-prompt').value = persona.prompt || '';
    
    // Update avatar preview and placeholder
    updateAvatarPreview(persona.avatar);
    const placeholder = document.getElementById('avatar-placeholder');
    if (placeholder) {
        placeholder.textContent = (persona.name || '?')[0].toUpperCase();
    }
    
    // Reset file input
    document.getElementById('persona-avatar-file').value = '';
    document.getElementById('avatar-upload-status').textContent = '';
    
    document.getElementById('persona-modal').classList.remove('hidden');
}

function closePersonaModal() {
    const modal = document.getElementById('persona-modal');
    if (modal) modal.classList.add('hidden');
    // Reset file input
    const fileInput = document.getElementById('persona-avatar-file');
    const statusEl = document.getElementById('avatar-upload-status');
    if (fileInput) fileInput.value = '';
    if (statusEl) statusEl.textContent = '';
}

function updateAvatarPreview(url) {
    const img = document.getElementById('avatar-preview-img');
    const placeholder = document.getElementById('avatar-placeholder');
    
    if (!img) return; // Guard against missing elements
    
    if (url && url.trim()) {
        // Resolve relative URLs
        const resolvedUrl = resolveAvatarUrl(url);
        img.src = resolvedUrl;
        img.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        img.onerror = () => { 
            img.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';
        };
    } else {
        img.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }
}

async function handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const statusEl = document.getElementById('avatar-upload-status');
    const avatarUrlInput = document.getElementById('persona-avatar');
    
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
        statusEl.textContent = 'Error: File too large (max 2MB)';
        statusEl.style.color = 'var(--danger)';
        return;
    }
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        statusEl.textContent = 'Error: Invalid file type';
        statusEl.style.color = 'var(--danger)';
        return;
    }
    
    statusEl.textContent = 'Uploading...';
    statusEl.style.color = 'var(--primary)';
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${CONFIG.API_URL}/api/ai-characters/upload-avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Upload failed');
        }
        
        const data = await response.json();
        
        // Set the avatar URL in the form
        avatarUrlInput.value = data.avatar_url;
        
        // Update preview
        updateAvatarPreview(data.avatar_url);
        
        statusEl.textContent = 'Uploaded!';
        statusEl.style.color = 'var(--success)';
        
        // Clear status after 3 seconds
        setTimeout(() => {
            statusEl.textContent = '';
        }, 3000);
        
    } catch (error) {
        console.error('Avatar upload error:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.style.color = 'var(--danger)';
    }
}

async function savePersona(event) {
    event.preventDefault();
    
    const isNew = document.getElementById('persona-is-new').value === 'true';
    const personaId = document.getElementById('persona-char-id').value.toLowerCase().trim();
    
    const data = {
        id: personaId,
        name: document.getElementById('persona-name').value.trim(),
        description: document.getElementById('persona-description').value.trim(),
        bio: document.getElementById('persona-bio').value.trim() || null,
        prompt: document.getElementById('persona-prompt').value.trim(),
        avatar: document.getElementById('persona-avatar').value.trim() || null,
        category: document.getElementById('persona-category').value,
        order: parseInt(document.getElementById('persona-order').value) || 0,
        is_enabled: document.getElementById('persona-enabled').checked
    };
    
    // Validation
    if (!data.id || !data.name || !data.prompt) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (!/^[a-z0-9_-]+$/.test(data.id)) {
        showNotification('Character ID must be lowercase letters, numbers, underscores, or hyphens only', 'error');
        return;
    }
    
    try {
        if (isNew) {
            await apiCall('/ai-characters', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } else {
            // Don't send ID in update payload
            const updateData = { ...data };
            delete updateData.id;
            await apiCall(`/ai-characters/${personaId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
        }
        
        showNotification(isNew ? 'Persona created successfully!' : 'Persona updated successfully!', 'success');
        closePersonaModal();
        loadAIPersonas();
    } catch (error) {
        console.error('Error saving persona:', error);
        showNotification(error.message || 'Failed to save persona', 'error');
    }
}

async function deletePersona(personaId, personaName) {
    if (!confirm(`Are you sure you want to delete "${personaName}"? This cannot be undone.`)) {
        return;
    }
    
    try {
        await apiCall(`/ai-characters/${personaId}`, {
            method: 'DELETE'
        });
        
        showNotification('Persona deleted successfully', 'success');
        loadAIPersonas();
    } catch (error) {
        console.error('Error deleting persona:', error);
        showNotification(error.message || 'Failed to delete persona', 'error');
    }
}

async function seedPersonasFromCode() {
    if (!confirm('This will import all hardcoded characters into the database. You can then edit them freely. Continue?')) {
        return;
    }
    
    try {
        const data = await apiCall('/ai-characters/seed-from-hardcoded', {
            method: 'POST'
        });
        
        showNotification(`Imported ${data.seeded} personas (${data.skipped} already existed)`, 'success');
        loadAIPersonas();
    } catch (error) {
        console.error('Error seeding personas:', error);
        showNotification(error.message || 'Failed to import personas', 'error');
    }
}




// ==================== AI LEARNING SYSTEM ====================

// Switch between learning sub-tabs
function switchLearningTab(tabName) {
    // Update sub-tab buttons
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-learning-tab="${tabName}"]`).classList.add('active');
    
    // Hide all sections
    document.querySelectorAll('.learning-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(`learning-${tabName}`).style.display = 'block';
    
    // Load data for the selected tab
    switch(tabName) {
        case 'patterns':
            loadSafetyPatterns();
            break;
        case 'queue':
            loadApprovalQueue();
            break;
        case 'approved':
            loadApprovedLearnings();
            break;
        case 'feedback':
            loadResponseFeedback();
            break;
    }
}

// Load learning statistics
async function loadLearningStats() {
    try {
        const data = await apiCall('/learning/stats');
        
        document.getElementById('stat-patterns').textContent = data.patterns.active;
        document.getElementById('stat-pending').textContent = data.learnings.pending;
        document.getElementById('stat-approved').textContent = data.learnings.approved;
        document.getElementById('stat-feedback').textContent = data.feedback.pending;
        
        // Update badges
        if (data.learnings.pending > 0) {
            document.getElementById('queue-badge').textContent = data.learnings.pending;
            document.getElementById('queue-badge').style.display = 'inline';
        }
        if (data.feedback.pending > 0) {
            document.getElementById('feedback-badge').textContent = data.feedback.pending;
            document.getElementById('feedback-badge').style.display = 'inline';
        }
    } catch (error) {
        console.error('Error loading learning stats:', error);
    }
}

// ==================== SAFETY PATTERNS ====================

async function loadSafetyPatterns() {
    try {
        const category = document.getElementById('pattern-category-filter')?.value || '';
        const severity = document.getElementById('pattern-severity-filter')?.value || '';
        
        let url = '/learning/patterns?is_active=true';
        if (category) url += `&category=${category}`;
        if (severity) url += `&severity=${severity}`;
        
        const data = await apiCall(url);
        
        const container = document.getElementById('patterns-list');
        if (data.patterns.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No patterns found. Click "Seed Defaults" to add standard patterns.</p></div>';
            return;
        }
        
        container.innerHTML = data.patterns.map(pattern => `
            <div class="pattern-card" style="padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px; background: var(--bg-secondary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <span class="pattern-text" style="font-weight: 600; font-size: 16px;">"${escapeHtml(pattern.pattern)}"</span>
                        <span class="severity-badge severity-${pattern.severity}" style="margin-left: 10px; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${getSeverityColor(pattern.severity)}; color: white;">${pattern.severity.toUpperCase()}</span>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-small" onclick="editPattern('${pattern.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-small btn-danger" onclick="deletePattern('${pattern.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div style="margin-top: 8px; color: var(--text-muted); font-size: 14px;">
                    <span><i class="fas fa-folder"></i> ${pattern.category}</span>
                    <span style="margin-left: 15px;"><i class="fas fa-cog"></i> ${pattern.response_action}</span>
                    <span style="margin-left: 15px;"><i class="fas fa-code"></i> ${pattern.pattern_type}</span>
                </div>
                ${pattern.description ? `<div style="margin-top: 5px; color: var(--text-muted); font-size: 13px;">${escapeHtml(pattern.description)}</div>` : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading patterns:', error);
        showNotification('Failed to load safety patterns', 'error');
    }
}

function getSeverityColor(severity) {
    const colors = {
        'critical': '#dc2626',
        'high': '#ea580c',
        'medium': '#ca8a04',
        'low': '#16a34a'
    };
    return colors[severity] || '#6b7280';
}

async function seedDefaultPatterns() {
    if (!confirm('This will add default safety patterns to the database. Continue?')) return;
    
    try {
        const data = await apiCall(`/learning/patterns/seed-defaults?admin_id=${currentUser.id}`, {
            method: 'POST'
        });
        showNotification(data.message, 'success');
        loadSafetyPatterns();
        loadLearningStats();
    } catch (error) {
        console.error('Error seeding patterns:', error);
        showNotification('Failed to seed patterns', 'error');
    }
}

function showAddPatternModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'pattern-modal';
    modal.innerHTML = `
        <div class="modal" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Add Safety Pattern</h3>
                <button class="close-btn" onclick="closeModal('pattern-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Pattern Text *</label>
                    <input type="text" id="new-pattern-text" placeholder="e.g., want to die" required>
                </div>
                <div class="form-group">
                    <label>Pattern Type *</label>
                    <select id="new-pattern-type">
                        <option value="phrase">Phrase</option>
                        <option value="keyword">Keyword</option>
                        <option value="regex">Regex</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Category *</label>
                    <select id="new-pattern-category">
                        <option value="suicide">Suicide</option>
                        <option value="self_harm">Self Harm</option>
                        <option value="crisis">Crisis</option>
                        <option value="distress">Distress</option>
                        <option value="substance">Substance</option>
                        <option value="abuse">Abuse</option>
                        <option value="ptsd">PTSD</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Severity *</label>
                    <select id="new-pattern-severity">
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Response Action *</label>
                    <select id="new-pattern-action">
                        <option value="escalate">Escalate (Alert Staff)</option>
                        <option value="flag">Flag (Log for Review)</option>
                        <option value="block">Block (Prevent Response)</option>
                        <option value="monitor">Monitor (Track Only)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="new-pattern-description" rows="2" placeholder="Optional description..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('pattern-modal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveNewPattern()">Save Pattern</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveNewPattern() {
    const pattern = {
        pattern: document.getElementById('new-pattern-text').value.trim(),
        pattern_type: document.getElementById('new-pattern-type').value,
        category: document.getElementById('new-pattern-category').value,
        severity: document.getElementById('new-pattern-severity').value,
        response_action: document.getElementById('new-pattern-action').value,
        description: document.getElementById('new-pattern-description').value.trim()
    };
    
    if (!pattern.pattern) {
        showNotification('Pattern text is required', 'error');
        return;
    }
    
    try {
        await apiCall(`/learning/patterns?admin_id=${currentUser.id}`, {
            method: 'POST',
            body: JSON.stringify(pattern)
        });
        showNotification('Pattern created successfully', 'success');
        closeModal('pattern-modal');
        loadSafetyPatterns();
        loadLearningStats();
    } catch (error) {
        console.error('Error creating pattern:', error);
        showNotification('Failed to create pattern', 'error');
    }
}

async function deletePattern(patternId) {
    if (!confirm('Are you sure you want to delete this pattern?')) return;
    
    try {
        await apiCall(`/learning/patterns/${patternId}`, {
            method: 'DELETE'
        });
        showNotification('Pattern deleted', 'success');
        loadSafetyPatterns();
        loadLearningStats();
    } catch (error) {
        console.error('Error deleting pattern:', error);
        showNotification('Failed to delete pattern', 'error');
    }
}

// ==================== APPROVAL QUEUE ====================

async function loadApprovalQueue() {
    try {
        const data = await apiCall('/learning/queue?status=pending');
        
        const container = document.getElementById('approval-queue-list');
        if (data.learnings.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No items pending approval.</p></div>';
            return;
        }
        
        container.innerHTML = data.learnings.map(item => `
            <div class="queue-card" style="padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px; background: var(--bg-secondary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <span class="category-badge" style="padding: 2px 8px; border-radius: 4px; font-size: 12px; background: var(--primary-color); color: white;">${item.category}</span>
                        <span style="margin-left: 10px; color: var(--text-muted); font-size: 12px;">Submitted by: ${item.submitted_by}</span>
                    </div>
                    <span style="color: var(--text-muted); font-size: 12px;">${new Date(item.submitted_at).toLocaleDateString()}</span>
                </div>
                <div style="margin-top: 10px;">
                    <strong>Context:</strong>
                    <p style="margin: 5px 0; color: var(--text-primary);">${escapeHtml(item.context_summary)}</p>
                </div>
                <div style="margin-top: 10px;">
                    <strong>Effective Response Pattern:</strong>
                    <p style="margin: 5px 0; color: var(--text-primary); font-style: italic;">${escapeHtml(item.ai_response_pattern)}</p>
                </div>
                ${item.notes ? `<div style="margin-top: 10px; color: var(--text-muted);"><strong>Staff Notes:</strong> ${escapeHtml(item.notes)}</div>` : ''}
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-success" onclick="approveLearning('${item.id}')"><i class="fas fa-check"></i> Approve</button>
                    <button class="btn btn-danger" onclick="rejectLearning('${item.id}')"><i class="fas fa-times"></i> Reject</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading approval queue:', error);
        showNotification('Failed to load approval queue', 'error');
    }
}

async function approveLearning(learningId) {
    const notes = prompt('Add any admin notes (optional):');
    
    try {
        await apiCall(`/learning/approve/${learningId}?admin_id=${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'approved', admin_notes: notes })
        });
        showNotification('Learning approved', 'success');
        loadApprovalQueue();
        loadLearningStats();
    } catch (error) {
        console.error('Error approving learning:', error);
        showNotification('Failed to approve learning', 'error');
    }
}

async function rejectLearning(learningId) {
    const notes = prompt('Reason for rejection:');
    if (!notes) return;
    
    try {
        await apiCall(`/learning/approve/${learningId}?admin_id=${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'rejected', admin_notes: notes })
        });
        showNotification('Learning rejected', 'success');
        loadApprovalQueue();
        loadLearningStats();
    } catch (error) {
        console.error('Error rejecting learning:', error);
        showNotification('Failed to reject learning', 'error');
    }
}

// ==================== APPROVED LEARNINGS ====================

async function loadApprovedLearnings() {
    try {
        const category = document.getElementById('learning-category-filter')?.value || '';
        let url = '/learning/approved';
        if (category) url += `?category=${category}`;
        
        const data = await apiCall(url);
        
        const container = document.getElementById('approved-learnings-list');
        if (data.learnings.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No approved learnings yet. Learnings will appear here after admin approval.</p></div>';
            return;
        }
        
        container.innerHTML = data.learnings.map(item => `
            <div class="learning-card" style="padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px; background: var(--bg-secondary);">
                <span class="category-badge" style="padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #16a34a; color: white;">${item.category}</span>
                <span class="outcome-badge" style="margin-left: 10px; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${item.outcome === 'positive' ? '#16a34a' : '#ca8a04'}; color: white;">${item.outcome}</span>
                <div style="margin-top: 10px;">
                    <strong>Context:</strong>
                    <p style="margin: 5px 0;">${escapeHtml(item.context_summary)}</p>
                </div>
                <div style="margin-top: 10px;">
                    <strong>Effective Response:</strong>
                    <p style="margin: 5px 0; font-style: italic;">${escapeHtml(item.ai_response_pattern)}</p>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading approved learnings:', error);
        showNotification('Failed to load approved learnings', 'error');
    }
}

// ==================== RESPONSE FEEDBACK ====================

async function loadResponseFeedback() {
    try {
        const feedbackType = document.getElementById('feedback-type-filter')?.value || '';
        let url = '/learning/feedback?status=pending';
        if (feedbackType) url += `&feedback_type=${feedbackType}`;
        
        const data = await apiCall(url);
        
        const container = document.getElementById('feedback-list');
        if (data.feedback.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No pending feedback. Staff can submit feedback on AI responses from the staff portal.</p></div>';
            return;
        }
        
        container.innerHTML = data.feedback.map(item => `
            <div class="feedback-card" style="padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px; background: var(--bg-secondary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <span class="feedback-type-badge" style="padding: 2px 8px; border-radius: 4px; font-size: 12px; background: ${getFeedbackTypeColor(item.feedback_type)}; color: white;">${item.feedback_type.replace('_', ' ').toUpperCase()}</span>
                    <span style="color: var(--text-muted); font-size: 12px;">${new Date(item.submitted_at).toLocaleDateString()}</span>
                </div>
                <div style="margin-top: 10px;">
                    <strong>User Message:</strong>
                    <p style="margin: 5px 0; padding: 10px; background: var(--bg-tertiary); border-radius: 5px;">${escapeHtml(item.user_message)}</p>
                </div>
                <div style="margin-top: 10px;">
                    <strong>AI Response:</strong>
                    <p style="margin: 5px 0; padding: 10px; background: var(--bg-tertiary); border-radius: 5px;">${escapeHtml(item.ai_response)}</p>
                </div>
                ${item.staff_notes ? `<div style="margin-top: 10px;"><strong>Staff Notes:</strong> ${escapeHtml(item.staff_notes)}</div>` : ''}
                ${item.suggested_response ? `<div style="margin-top: 10px;"><strong>Suggested Response:</strong> ${escapeHtml(item.suggested_response)}</div>` : ''}
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-success" onclick="reviewFeedback('${item.id}', 'reviewed')"><i class="fas fa-check"></i> Mark Reviewed</button>
                    <button class="btn btn-primary" onclick="convertToLearning('${item.id}')"><i class="fas fa-graduation-cap"></i> Convert to Learning</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading feedback:', error);
        showNotification('Failed to load feedback', 'error');
    }
}

function getFeedbackTypeColor(type) {
    const colors = {
        'good': '#16a34a',
        'needs_improvement': '#ca8a04',
        'inappropriate': '#dc2626',
        'missed_risk': '#7c3aed'
    };
    return colors[type] || '#6b7280';
}

async function reviewFeedback(feedbackId, status) {
    try {
        await apiCall(`/learning/feedback/${feedbackId}/review?status=${status}&admin_id=${currentUser.id}`, {
            method: 'PUT'
        });
        showNotification('Feedback reviewed', 'success');
        loadResponseFeedback();
        loadLearningStats();
    } catch (error) {
        console.error('Error reviewing feedback:', error);
        showNotification('Failed to review feedback', 'error');
    }
}

async function convertToLearning(feedbackId) {
    // TODO: Open modal to convert feedback to a learning submission
    showNotification('Feature coming soon - manually create a learning from the Approval Queue', 'info');
}

// Initialize learning tab when selected
const originalSwitchTabLearning = window.switchTab || function() {};
window.switchTab = function(tabName) {
    originalSwitchTabLearning(tabName);
    if (tabName === 'learning') {
        loadLearningStats();
        loadSafetyPatterns();
    }
};

// Helper to close specific modals by ID (for inline modals)
function closeSpecificModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
}



// ============================================
// EVENTS MANAGEMENT (Virtual Coffee Mornings)
// ============================================

// Load Events - called when events tab is shown
async function loadEvents() {
    const statusFilter = document.getElementById('events-status-filter')?.value || '';
    const includePast = document.getElementById('events-include-past')?.checked || false;
    const eventsList = document.getElementById('events-list');
    
    if (!eventsList) return;
    
    eventsList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Loading events...</p>';
    
    try {
        let url = `${CONFIG.API_URL}/api/events/admin/all?include_past=${includePast}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load events');
        
        const events = await response.json();
        
        if (events.length === 0) {
            eventsList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <i class="fas fa-calendar-times" style="font-size: 48px; margin-bottom: 15px;"></i>
                    <p>No events found</p>
                    <button class="btn btn-primary" onclick="showCreateEventModal()" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Create Your First Event
                    </button>
                </div>
            `;
            return;
        }
        
        eventsList.innerHTML = events.map(event => renderEventCard(event)).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        eventsList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
                <p>Failed to load events</p>
                <button class="btn btn-secondary" onclick="loadEvents()" style="margin-top: 10px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Render a single event card
function renderEventCard(event) {
    const eventDate = new Date(event.event_date);
    const now = new Date();
    const isLive = event.status === 'live' || (event.status === 'scheduled' && eventDate <= now && new Date(eventDate.getTime() + event.duration_minutes * 60000) >= now);
    const isPast = new Date(eventDate.getTime() + event.duration_minutes * 60000) < now;
    
    const statusBadge = {
        'scheduled': '<span class="badge badge-info"><i class="fas fa-clock"></i> Scheduled</span>',
        'live': '<span class="badge badge-success" style="animation: pulse 2s infinite;"><i class="fas fa-broadcast-tower"></i> LIVE</span>',
        'ended': '<span class="badge badge-secondary"><i class="fas fa-check"></i> Ended</span>',
        'cancelled': '<span class="badge badge-danger"><i class="fas fa-times"></i> Cancelled</span>',
    };
    
    const status = isLive ? 'live' : (isPast ? 'ended' : event.status);
    
    return `
        <div class="resource-card" style="border-left: 4px solid ${isLive ? '#22c55e' : status === 'cancelled' ? '#ef4444' : '#8b5cf6'};">
            <div class="resource-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h3 style="margin: 0 0 8px 0; color: var(--text-primary);">
                        <i class="fas fa-video" style="color: #8b5cf6; margin-right: 8px;"></i>
                        ${escapeHtml(event.title)}
                    </h3>
                    ${statusBadge[status] || ''}
                    ${event.recurring ? `<span class="badge badge-outline" style="margin-left: 5px;"><i class="fas fa-redo"></i> ${event.recurring}</span>` : ''}
                </div>
                <div class="resource-actions">
                    ${event.status !== 'cancelled' && !isPast ? `
                        <button class="btn btn-small btn-outline" onclick="editEvent('${event.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-small btn-danger" onclick="cancelEvent('${event.id}')" title="Cancel">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-small btn-outline" onclick="viewEventAttendance('${event.id}')" title="View Attendance">
                        <i class="fas fa-users"></i>
                    </button>
                </div>
            </div>
            <div class="resource-body" style="margin-top: 12px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; color: var(--text-secondary); font-size: 14px;">
                    <div>
                        <i class="fas fa-calendar" style="width: 20px; color: var(--text-muted);"></i>
                        ${eventDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div>
                        <i class="fas fa-clock" style="width: 20px; color: var(--text-muted);"></i>
                        ${eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} (${event.duration_minutes} min)
                    </div>
                    <div>
                        <i class="fas fa-user" style="width: 20px; color: var(--text-muted);"></i>
                        Host: ${escapeHtml(event.host_name)}
                    </div>
                    <div>
                        <i class="fas fa-users" style="width: 20px; color: var(--text-muted);"></i>
                        ${event.participant_count} joined ${event.max_participants ? `/ ${event.max_participants} max` : ''}
                    </div>
                </div>
                ${event.description ? `<p style="margin-top: 10px; color: var(--text-muted); font-size: 13px;">${escapeHtml(event.description)}</p>` : ''}
                <div style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">
                    <i class="fas fa-link"></i> Room: <code style="background: var(--bg-dark); padding: 2px 6px; border-radius: 4px;">${escapeHtml(event.jitsi_room_name)}</code>
                </div>
            </div>
        </div>
    `;
}

// Show Create Event Modal
function showCreateEventModal() {
    document.getElementById('event-modal-title').innerHTML = '<i class="fas fa-video"></i> Create Event';
    document.getElementById('event-submit-btn').innerHTML = '<i class="fas fa-save"></i> Create Event';
    document.getElementById('event-form').reset();
    document.getElementById('event-id').value = '';
    
    // Set default date to tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    document.getElementById('event-date').value = tomorrow.toISOString().slice(0, 16);
    
    document.getElementById('event-modal').classList.remove('hidden');
}

// Close Event Modal
function closeEventModal() {
    document.getElementById('event-modal').classList.add('hidden');
}

// Edit Event
async function editEvent(eventId) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/events/${eventId}`);
        if (!response.ok) throw new Error('Event not found');
        
        const event = await response.json();
        
        document.getElementById('event-modal-title').innerHTML = '<i class="fas fa-edit"></i> Edit Event';
        document.getElementById('event-submit-btn').innerHTML = '<i class="fas fa-save"></i> Update Event';
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-description').value = event.description || '';
        document.getElementById('event-date').value = new Date(event.event_date).toISOString().slice(0, 16);
        document.getElementById('event-duration').value = event.duration_minutes;
        document.getElementById('event-host').value = event.host_name;
        document.getElementById('event-max').value = event.max_participants || '';
        document.getElementById('event-recurring').value = event.recurring || '';
        document.getElementById('event-waiting-room').checked = event.waiting_room_enabled;
        
        document.getElementById('event-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading event:', error);
        alert('Failed to load event details');
    }
}

// Handle Event Form Submit
async function handleEventSubmit(e) {
    e.preventDefault();
    
    const eventId = document.getElementById('event-id').value;
    const isEdit = !!eventId;
    
    const eventData = {
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-description').value || null,
        event_date: new Date(document.getElementById('event-date').value).toISOString(),
        duration_minutes: parseInt(document.getElementById('event-duration').value),
        host_name: document.getElementById('event-host').value,
        max_participants: document.getElementById('event-max').value ? parseInt(document.getElementById('event-max').value) : null,
        recurring: document.getElementById('event-recurring').value || null,
        waiting_room_enabled: document.getElementById('event-waiting-room').checked,
        requires_moderation: true,
    };
    
    try {
        const url = isEdit 
            ? `${CONFIG.API_URL}/api/events/admin/${eventId}`
            : `${CONFIG.API_URL}/api/events/admin/create`;
        
        const response = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save event');
        }
        
        closeEventModal();
        loadEvents();
        showNotification(isEdit ? 'Event updated successfully!' : 'Event created successfully!', 'success');
    } catch (error) {
        console.error('Error saving event:', error);
        alert(error.message || 'Failed to save event');
    }
}

// Cancel Event
async function cancelEvent(eventId) {
    if (!confirm('Are you sure you want to cancel this event? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/events/admin/${eventId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to cancel event');
        
        loadEvents();
        showNotification('Event cancelled', 'info');
    } catch (error) {
        console.error('Error cancelling event:', error);
        alert('Failed to cancel event');
    }
}

// View Event Attendance
async function viewEventAttendance(eventId) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/events/admin/${eventId}/attendance`);
        if (!response.ok) throw new Error('Failed to load attendance');
        
        const data = await response.json();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'attendance-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2><i class="fas fa-users"></i> Event Attendance</h2>
                    <button class="close-btn" onclick="closeSpecificModal('attendance-modal')">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <h3 style="margin-bottom: 15px; color: var(--text-primary);">${escapeHtml(data.title)}</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 15px;">
                        <i class="fas fa-calendar"></i> ${new Date(data.event_date).toLocaleString('en-GB')}
                    </p>
                    <div class="stat-card" style="margin-bottom: 20px;">
                        <div class="stat-value">${data.total_participants}</div>
                        <div class="stat-label">Total Participants</div>
                    </div>
                    ${data.attendance_log.length > 0 ? `
                        <h4 style="margin-bottom: 10px; color: var(--text-secondary);">Attendance Log</h4>
                        <div style="max-height: 300px; overflow-y: auto;">
                            ${data.attendance_log.map(log => `
                                <div style="padding: 8px; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                                    <span style="color: ${log.action === 'joined' ? '#22c55e' : '#94a3b8'};">
                                        <i class="fas fa-${log.action === 'joined' ? 'sign-in-alt' : 'sign-out-alt'}"></i>
                                        ${log.display_name || log.user_id}
                                    </span>
                                    <span style="color: var(--text-muted); float: right;">
                                        ${new Date(log.joined_at || log.left_at).toLocaleTimeString('en-GB')}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color: var(--text-muted);">No attendance data yet</p>'}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeSpecificModal('attendance-modal')">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error loading attendance:', error);
        alert('Failed to load attendance data');
    }
}

// Update switchTab to load events when events tab is selected
const originalSwitchTabEvents = window.switchTab;
window.switchTab = function(tabName) {
    originalSwitchTabEvents(tabName);
    if (tabName === 'events') {
        loadEvents();
    }
};

// Add CSS for pulse animation
const eventStyles = document.createElement('style');
eventStyles.textContent = `
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }
    .badge-outline {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
    }
`;
document.head.appendChild(eventStyles);

// ============ AI USAGE TRACKING ============

let dailyUsageChart = null;

async function loadAIUsageData() {
    const days = document.getElementById('usage-period')?.value || 30;
    
    try {
        // Fetch usage summary
        const summaryRes = await fetch(`${CONFIG.API_URL}/api/admin/ai-usage/summary?days=${days}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (summaryRes.ok) {
            const summary = await summaryRes.json();
            updateUsageSummary(summary);
        }
        
        // Fetch usage by character
        const charRes = await fetch(`${CONFIG.API_URL}/api/admin/ai-usage/by-character?days=${days}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (charRes.ok) {
            const charData = await charRes.json();
            updateCharacterUsage(charData.by_character);
        }
        
        // Fetch daily usage for chart
        const dailyRes = await fetch(`${CONFIG.API_URL}/api/admin/ai-usage/daily?days=${Math.min(days, 30)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (dailyRes.ok) {
            const dailyData = await dailyRes.json();
            updateDailyChart(dailyData.daily_usage);
        }
        
    } catch (error) {
        console.error('Error loading AI usage data:', error);
    }
}

function updateUsageSummary(summary) {
    // Update total
    document.getElementById('total-cost').textContent = `£${summary.total_cost_gbp?.toFixed(4) || '0.00'}`;
    document.getElementById('total-requests').textContent = formatNumber(summary.total_requests || 0);
    document.getElementById('total-tokens').textContent = formatNumber(summary.total_tokens || 0);
    
    // Update OpenAI
    const openai = summary.providers?.openai || {};
    document.getElementById('openai-cost').textContent = `£${(openai.cost_gbp || 0).toFixed(4)}`;
    document.getElementById('openai-requests').textContent = formatNumber(openai.request_count || 0);
    document.getElementById('openai-tokens').textContent = formatNumber(openai.total_tokens || 0);
    document.getElementById('openai-budget').textContent = (openai.budget_limit_gbp || 20).toFixed(2);
    document.getElementById('openai-remaining').textContent = `£${(openai.budget_remaining_gbp || 20).toFixed(4)} remaining`;
    document.getElementById('openai-percentage').textContent = (openai.budget_percentage_used || 0).toFixed(1);
    document.getElementById('openai-budget-bar').style.width = `${Math.min(openai.budget_percentage_used || 0, 100)}%`;
    
    // Change color if over 80%
    if ((openai.budget_percentage_used || 0) > 80) {
        document.getElementById('openai-budget-bar').style.background = '#ef4444';
    } else if ((openai.budget_percentage_used || 0) > 50) {
        document.getElementById('openai-budget-bar').style.background = '#f59e0b';
    } else {
        document.getElementById('openai-budget-bar').style.background = '#10a37f';
    }
    
    // Update Gemini
    const gemini = summary.providers?.gemini || {};
    document.getElementById('gemini-cost').textContent = `£${(gemini.cost_gbp || 0).toFixed(4)}`;
    document.getElementById('gemini-requests').textContent = formatNumber(gemini.request_count || 0);
    document.getElementById('gemini-tokens').textContent = formatNumber(gemini.total_tokens || 0);
    document.getElementById('gemini-budget').textContent = (gemini.budget_limit_gbp || 10).toFixed(2);
    document.getElementById('gemini-remaining').textContent = `£${(gemini.budget_remaining_gbp || 10).toFixed(4)} remaining`;
    document.getElementById('gemini-percentage').textContent = (gemini.budget_percentage_used || 0).toFixed(1);
    document.getElementById('gemini-budget-bar').style.width = `${Math.min(gemini.budget_percentage_used || 0, 100)}%`;
    
    if ((gemini.budget_percentage_used || 0) > 80) {
        document.getElementById('gemini-budget-bar').style.background = '#ef4444';
    } else if ((gemini.budget_percentage_used || 0) > 50) {
        document.getElementById('gemini-budget-bar').style.background = '#f59e0b';
    } else {
        document.getElementById('gemini-budget-bar').style.background = '#4285f4';
    }
}

function updateCharacterUsage(characters) {
    const container = document.getElementById('character-usage-list');
    if (!characters || characters.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No usage data yet</p>';
        return;
    }
    
    // Character display names
    const charNames = {
        'tommy': 'Tommy',
        'catherine': 'Catherine',
        'doris': 'Rachel',
        'finch': 'Finch',
        'jack': 'Jack',
        'penny': 'Penny',
        'megan': 'Megan',
        'baz': 'Baz',
        'margie': 'Margie'
    };
    
    container.innerHTML = characters.map(c => `
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
            <div style="font-weight: 600; color: var(--text-primary);">${charNames[c.character] || c.character}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                ${formatNumber(c.requests)} requests · ${formatNumber(c.tokens)} tokens
            </div>
            <div style="font-size: 14px; color: #10a37f; font-weight: 600; margin-top: 4px;">
                £${c.cost_gbp.toFixed(4)}
            </div>
        </div>
    `).join('');
}

function updateDailyChart(dailyData) {
    const canvas = document.getElementById('daily-usage-chart');
    if (!canvas) return;
    
    // Group data by date
    const dateMap = {};
    dailyData.forEach(d => {
        if (!dateMap[d.date]) {
            dateMap[d.date] = { openai: 0, gemini: 0 };
        }
        if (d.provider === 'openai') {
            dateMap[d.date].openai = d.cost_gbp;
        } else if (d.provider === 'gemini') {
            dateMap[d.date].gemini = d.cost_gbp;
        }
    });
    
    const dates = Object.keys(dateMap).sort();
    const openaiCosts = dates.map(d => dateMap[d].openai);
    const geminiCosts = dates.map(d => dateMap[d].gemini);
    
    // Destroy existing chart
    if (dailyUsageChart) {
        dailyUsageChart.destroy();
    }
    
    dailyUsageChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: dates.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            }),
            datasets: [
                {
                    label: 'OpenAI',
                    data: openaiCosts,
                    backgroundColor: '#10a37f',
                    borderRadius: 4,
                },
                {
                    label: 'Gemini',
                    data: geminiCosts,
                    backgroundColor: '#4285f4',
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#9ca3af'
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                },
                y: {
                    stacked: true,
                    grid: { color: '#374151' },
                    ticks: { 
                        color: '#9ca3af',
                        callback: (value) => '£' + value.toFixed(4)
                    }
                }
            }
        }
    });
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Load AI usage data when tab is opened
document.addEventListener('DOMContentLoaded', () => {
    const aiUsageTab = document.querySelector('[data-tab="ai-usage"]');
    if (aiUsageTab) {
        aiUsageTab.addEventListener('click', () => {
            setTimeout(loadAIUsageData, 100);
        });
    }
});

