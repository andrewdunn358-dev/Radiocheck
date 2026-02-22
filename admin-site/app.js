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
            throw new Error(data.detail || 'API Error');
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
        token = data.access_token;
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
    
    // Sort users: admins first, then counsellors, then peers
    const sortedUsers = [...users].sort((a, b) => {
        const roleOrder = { admin: 0, counsellor: 1, peer: 2 };
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
        const [callsRes, chatsRes, safeguardingRes, callbacksRes, panicRes] = await Promise.all([
            apiCall(`/call-logs?days=${period}`).catch(() => ({ total_calls: 0, recent_logs: [] })),
            apiCall('/live-chat/rooms').catch(() => []),
            apiCall('/safeguarding-alerts').catch(() => []),
            apiCall('/callbacks').catch(() => []),
            apiCall('/panic-alerts').catch(() => [])
        ]);
        
        // Store data
        logsData.calls = callsRes.recent_logs || [];
        logsData.chats = chatsRes || [];
        logsData.safeguarding = safeguardingRes || [];
        logsData.callbacks = callbacksRes || [];
        logsData.panic = panicRes || [];
        
        // Update stats
        document.getElementById('stat-calls').textContent = callsRes.total_calls || 0;
        document.getElementById('stat-chats').textContent = logsData.chats.length;
        document.getElementById('stat-escalations').textContent = logsData.safeguarding.length;
        document.getElementById('stat-panic').textContent = logsData.panic.length;
        
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
        case 'callbacks':
            container.innerHTML = renderCallbackLogs(data);
            break;
        case 'panic':
            container.innerHTML = renderPanicLogs(data);
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
                    <th>Type</th>
                    <th>User</th>
                    <th>Staff</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${alerts.map(alert => `
                    <tr>
                        <td>${formatDateTime(alert.created_at)}</td>
                        <td><span class="badge badge-${alert.risk_level === 'high' ? 'danger' : alert.risk_level === 'medium' ? 'warning' : 'info'}">${alert.risk_level || 'Unknown'}</span></td>
                        <td>${alert.alert_type || '-'}</td>
                        <td>${alert.user_name || 'Anonymous'}</td>
                        <td>${alert.assigned_to_name || '-'}</td>
                        <td><span class="badge badge-${alert.status === 'resolved' ? 'success' : alert.status === 'pending' ? 'warning' : 'secondary'}">${alert.status}</span></td>
                    </tr>
                `).join('')}
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
    document.getElementById('modal-overlay').classList.add('hidden');
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
            <div class="form-group">
                <label>New Password *</label>
                <input type="password" name="newPassword" required minlength="8" placeholder="Minimum 8 characters">
            </div>
            <div class="form-group">
                <label>Confirm Password *</label>
                <input type="password" name="confirmPassword" required minlength="8" placeholder="Re-enter password">
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
    } catch (error) {
        console.error('Error loading settings:', error);
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
                            <strong style="color: var(--text-primary);">${call.caller_name} → ${call.callee_name}</strong>
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

// Open Status Modal for changing staff status
function openStatusModal(userId, role, currentStatus) {
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2><i class="fas fa-toggle-on"></i> Change Status</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <form id="status-form">
                <div class="form-group">
                    <label><i class="fas fa-user-clock"></i> Status</label>
                    <select name="status" required>
                        <option value="available" ${currentStatus === 'available' ? 'selected' : ''}>Available</option>
                        <option value="limited" ${currentStatus === 'limited' ? 'selected' : ''}>Limited</option>
                        <option value="unavailable" ${currentStatus === 'unavailable' ? 'selected' : ''}>Unavailable</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Update Status
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.getElementById('modal').classList.add('open');
    
    document.getElementById('status-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newStatus = formData.get('status');
        
        try {
            // Find the profile ID
            let profileId;
            let endpoint;
            
            if (role === 'counsellor') {
                const counsellor = allCounsellors.find(c => c.user_id === userId);
                if (counsellor) {
                    profileId = counsellor.id;
                    endpoint = `/admin/counsellors/${profileId}/status`;
                }
            } else if (role === 'peer') {
                const peer = allPeers.find(p => p.user_id === userId);
                if (peer) {
                    profileId = peer.id;
                    endpoint = `/admin/peer-supporters/${profileId}/status`;
                }
            }
            
            if (!endpoint) {
                throw new Error('Profile not found');
            }
            
            await apiCall(endpoint, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            
            showNotification('Status updated successfully', 'success');
            closeModal();
            loadAllData();
        } catch (error) {
            showNotification('Failed to update status: ' + error.message, 'error');
        }
    });
}

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
    document.getElementById('modal-overlay').classList.remove('hidden');
}

// Toggle role-specific fields
function toggleRoleFields() {
    const role = document.getElementById('staff-role-select').value;
    const counsellorFields = document.getElementById('counsellor-fields');
    const peerFields = document.getElementById('peer-fields');
    const profileFields = document.getElementById('profile-fields');
    
    counsellorFields.style.display = role === 'counsellor' ? 'block' : 'none';
    peerFields.style.display = role === 'peer' ? 'block' : 'none';
    profileFields.style.display = (role === 'counsellor' || role === 'peer') ? 'block' : 'none';
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
        phone: formData.get('phone') || null,
        sms: formData.get('sms') || null,
        whatsapp: formData.get('whatsapp') || null,
        specialization: formData.get('specialization') || null,
        area: formData.get('area') || null,
        background: formData.get('background') || null,
        yearsServed: formData.get('yearsServed') || null
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
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" name="new_password" required minlength="8" placeholder="Minimum 8 characters">
                </div>
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
        try {
            await apiCall('/auth/admin-reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: formData.get('user_id'),
                    new_password: formData.get('new_password')
                })
            });
            showNotification('Password reset successfully', 'success');
            closeModal();
        } catch (error) {
            showNotification('Failed to reset password: ' + error.message, 'error');
        }
    });
    
    document.getElementById('modal-overlay').classList.remove('hidden');
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
    
    if (type === 'section') {
        panel.innerHTML = `
            <div class="edit-field">
                <label>Section Title</label>
                <input type="text" id="edit-title" value="${data.title || ''}" onchange="updateField('title', this.value)">
            </div>
            <div class="edit-field">
                <label>Subtitle</label>
                <textarea id="edit-subtitle" onchange="updateField('subtitle', this.value)">${data.subtitle || ''}</textarea>
            </div>
            <div class="edit-field">
                <label>Section Type</label>
                <select id="edit-section-type" onchange="updateField('section_type', this.value)">
                    <option value="cards" ${data.section_type === 'cards' ? 'selected' : ''}>Cards Grid</option>
                    <option value="hero" ${data.section_type === 'hero' ? 'selected' : ''}>Hero Banner</option>
                    <option value="text" ${data.section_type === 'text' ? 'selected' : ''}>Text Content</option>
                    <option value="resources" ${data.section_type === 'resources' ? 'selected' : ''}>Resources List</option>
                </select>
            </div>
            <div class="edit-field">
                <label>Visibility</label>
                <select id="edit-visible" onchange="updateField('is_visible', this.value === 'true')">
                    <option value="true" ${data.is_visible !== false ? 'selected' : ''}>Visible</option>
                    <option value="false" ${data.is_visible === false ? 'selected' : ''}>Hidden</option>
                </select>
            </div>
            <div class="edit-actions">
                <button class="btn btn-primary" onclick="applyChanges()">
                    <i class="fas fa-check"></i> Apply
                </button>
            </div>
        `;
    } else if (type === 'card') {
        panel.innerHTML = `
            <div class="edit-field">
                <label>Card Title</label>
                <input type="text" id="edit-title" value="${data.title || ''}" onchange="updateField('title', this.value)">
            </div>
            <div class="edit-field">
                <label>Description</label>
                <textarea id="edit-description" onchange="updateField('description', this.value)">${data.description || ''}</textarea>
            </div>
            <div class="edit-field">
                <label>Icon Color</label>
                <div class="color-picker-wrapper">
                    <input type="color" id="edit-color" value="${data.color || '#3b82f6'}" onchange="updateField('color', this.value)">
                    <input type="text" value="${data.color || '#3b82f6'}" onchange="document.getElementById('edit-color').value = this.value; updateField('color', this.value)">
                </div>
            </div>
            <div class="edit-field">
                <label>Background Color</label>
                <div class="color-picker-wrapper">
                    <input type="color" id="edit-bg-color" value="${data.bg_color || '#1e3a5f'}" onchange="updateField('bg_color', this.value)">
                    <input type="text" value="${data.bg_color || '#1e3a5f'}" onchange="document.getElementById('edit-bg-color').value = this.value; updateField('bg_color', this.value)">
                </div>
            </div>
            <div class="edit-field">
                <label>Route (Internal Link)</label>
                <input type="text" id="edit-route" value="${data.route || ''}" placeholder="/page-name" onchange="updateField('route', this.value)">
            </div>
            <div class="edit-field">
                <label>External URL (Optional)</label>
                <input type="text" id="edit-external-url" value="${data.external_url || ''}" placeholder="https://..." onchange="updateField('external_url', this.value)">
            </div>
            <div class="edit-field">
                <label>Phone Number (Optional)</label>
                <input type="text" id="edit-phone" value="${data.phone || ''}" placeholder="0800 123 456" onchange="updateField('phone', this.value)">
            </div>
            <div class="edit-actions">
                <button class="btn btn-primary" onclick="applyChanges()">
                    <i class="fas fa-check"></i> Apply
                </button>
            </div>
        `;
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

// Download compliance document
function downloadDocument(filename) {
    showNotification(`Document ${filename} would be downloaded. In production, these are stored in /app/docs/compliance/`, 'info');
}

// Escape HTML for security
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize compliance tab when clicked
document.addEventListener('DOMContentLoaded', function() {
    const complianceTab = document.querySelector('[data-tab="compliance"]');
    if (complianceTab) {
        complianceTab.addEventListener('click', function() {
            setTimeout(loadComplianceDashboard, 100);
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
