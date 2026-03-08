/**
 * Radio Check LMS Learner Portal
 * Handles course enrollment, module learning, quizzes, and certificates
 */

// Configuration - Auto-detects environment
const API_URL = window.location.hostname === 'localhost' || window.location.hostname.includes('preview.emergentagent.com')
    ? window.location.origin  // Use same origin in dev/preview
    : 'https://veterans-support-api.onrender.com';  // Production Render URL

// State
let currentLearner = null;
let courseData = null;
let learnerProgress = null;
let currentModule = null;
let currentQuiz = null;
let quizAnswers = {};
let currentQuestionIndex = 0;
let authToken = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check for stored learner session
    const storedToken = localStorage.getItem('lms_token');
    const storedEmail = localStorage.getItem('lms_learner_email');
    if (storedToken && storedEmail) {
        authToken = storedToken;
        await loadLearnerProgress(storedEmail);
    }
    
    // Load course info for landing page
    await loadCourseInfo();
});

// ============ Course Info ============

async function loadCourseInfo() {
    try {
        const res = await fetch(`${API_URL}/api/lms/course`);
        courseData = await res.json();
        
        // Update hero stats
        document.getElementById('heroModules').textContent = courseData.module_count;
        
        // Update course topics
        const topicsList = document.getElementById('courseTopics');
        if (courseData.modules && topicsList) {
            topicsList.innerHTML = courseData.modules.slice(0, 6).map(m => `
                <li><i class="fas fa-check"></i> ${m.title}</li>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading course info:', error);
    }
}

// ============ Authentication ============

function showLogin() {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginEmail').focus();
}

function showRegister() {
    document.getElementById('registerModal').classList.add('active');
    document.getElementById('regName').focus();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }
    
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    
    try {
        const res = await fetch(`${API_URL}/api/lms/learner/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            // Check if password needs to be set
            if (res.status === 400 && data.detail && data.detail.includes('Password not set')) {
                closeModal('loginModal');
                showSetPasswordModal(email);
                return;
            }
            throw new Error(data.detail || 'Login failed');
        }
        
        // Store session
        authToken = data.token;
        localStorage.setItem('lms_token', data.token);
        localStorage.setItem('lms_learner_email', email);
        
        // Load full progress
        await loadLearnerProgress(email);
        closeModal('loginModal');
        
    } catch (error) {
        showError(error.message || 'Login failed. Please check your credentials.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
}

function showSetPasswordModal(email) {
    // Create set password modal if it doesn't exist
    if (!document.getElementById('setPasswordModal')) {
        createSetPasswordModal();
    }
    
    document.getElementById('setPasswordEmail').value = email;
    document.getElementById('setPasswordModal').classList.add('active');
    document.getElementById('newPassword').focus();
}

function createSetPasswordModal() {
    const modal = document.createElement('div');
    modal.id = 'setPasswordModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal modal-lg">
            <div class="modal-header">
                <h2><i class="fas fa-key"></i> Set Your Password</h2>
                <button class="modal-close" onclick="closeModal('setPasswordModal')">&times;</button>
            </div>
            <div class="modal-body">
                <p class="modal-description">
                    Welcome! Your registration has been approved. Please set a password to access your training account.
                </p>
                <form onsubmit="handleSetPassword(event)">
                    <input type="hidden" id="setPasswordEmail">
                    
                    <div class="form-group">
                        <label class="form-label">New Password</label>
                        <input type="password" id="newPassword" class="form-input" required minlength="8" placeholder="Minimum 8 characters" autocomplete="new-password">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Confirm Password</label>
                        <input type="password" id="confirmPassword" class="form-input" required minlength="8" placeholder="Confirm your password" autocomplete="new-password">
                    </div>
                    
                    <div class="form-group">
                        <p class="form-help">
                            <i class="fas fa-info-circle"></i> Choose a strong password with at least 8 characters.
                        </p>
                    </div>
                    
                    <button type="submit" id="setPasswordBtn" class="btn btn-secondary btn-block btn-lg">
                        <i class="fas fa-check"></i> Set Password & Continue
                    </button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleSetPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('setPasswordEmail').value;
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    if (password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
    }
    
    const btn = document.getElementById('setPasswordBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Setting Password...';
    
    try {
        const res = await fetch(`${API_URL}/api/lms/learner/set-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, confirm_password: confirmPassword })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.detail || 'Failed to set password');
        }
        
        // Store session
        authToken = data.token;
        localStorage.setItem('lms_token', data.token);
        localStorage.setItem('lms_learner_email', email);
        
        closeModal('setPasswordModal');
        
        // Show success and load dashboard
        document.getElementById('successTitle').textContent = 'Password Set Successfully!';
        document.getElementById('successMessage').innerHTML = `
            You can now access your training course.<br><br>
            Click "Start Learning" to begin.
        `;
        document.getElementById('successModal').classList.add('active');
        
        await loadLearnerProgress(email);
        
    } catch (error) {
        showError(error.message || 'Failed to set password');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Set Password & Continue';
    }
}

function showError(message) {
    // Create a toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-error';
    toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--danger);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 9999;
        animation: slideUp 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function loadLearnerProgress(email) {
    try {
        const res = await fetch(`${API_URL}/api/lms/progress/${encodeURIComponent(email)}`);
        
        if (!res.ok) {
            throw new Error('Failed to load progress');
        }
        
        const data = await res.json();
        currentLearner = data.learner;
        learnerProgress = data;
        
        updateHeaderForLoggedIn();
        showDashboard();
    } catch (error) {
        console.error('Error loading progress:', error);
        logout();
    }
}

function updateHeaderForLoggedIn() {
    document.getElementById('headerActions').innerHTML = `
        <span style="color: var(--text-secondary); margin-right: 1rem;">
            <i class="fas fa-user"></i> ${currentLearner.full_name}
        </span>
        <button class="btn btn-outline" onclick="logout()">
            <i class="fas fa-sign-out-alt"></i> Logout
        </button>
    `;
}

function logout() {
    localStorage.removeItem('lms_learner_email');
    localStorage.removeItem('lms_token');
    currentLearner = null;
    learnerProgress = null;
    authToken = null;
    
    // Reset header
    document.getElementById('headerActions').innerHTML = `
        <button class="btn btn-outline" onclick="showLogin()">
            <i class="fas fa-sign-in-alt"></i> Login
        </button>
    `;
    
    // Show landing
    showSection('landingSection');
}

// ============ Registration ============

function toggleVeteranFields() {
    const isVeteran = document.getElementById('regVeteran').checked;
    document.getElementById('veteranFields').style.display = isVeteran ? 'block' : 'none';
}

async function handleRegister(event) {
    event.preventDefault();
    
    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    const registration = {
        full_name: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        phone: document.getElementById('regPhone').value.trim() || null,
        is_veteran: document.getElementById('regVeteran').checked,
        service_branch: document.getElementById('regBranch').value || null,
        years_served: document.getElementById('regYears').value || null,
        why_volunteer: document.getElementById('regWhy').value.trim(),
        has_dbs: document.getElementById('regDBS').checked,
        agreed_to_terms: document.getElementById('regTerms').checked
    };
    
    try {
        const res = await fetch(`${API_URL}/api/lms/volunteer/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registration)
        });
        
        const data = await res.json();
        
        if (res.ok) {
            closeModal('registerModal');
            
            // Show success modal
            document.getElementById('successTitle').textContent = 'Registration Submitted!';
            document.getElementById('successMessage').innerHTML = `
                Thank you for registering your interest!<br><br>
                <strong>Next steps:</strong>
                <ul style="text-align:left;margin-top:1rem;">
                    ${data.next_steps.map(s => `<li>${s}</li>`).join('')}
                </ul>
            `;
            document.getElementById('successModal').classList.add('active');
            
            // Reset form
            document.getElementById('registerForm').reset();
            document.getElementById('veteranFields').style.display = 'none';
        } else {
            alert(data.detail || 'Registration failed. Please try again.');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('An error occurred. Please try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Registration';
    }
}

// ============ Navigation ============

function showSection(sectionId) {
    const sections = ['landingSection', 'dashboardSection', 'moduleSection', 'quizSection', 'resultsSection', 'certificateSection'];
    sections.forEach(id => {
        document.getElementById(id).style.display = id === sectionId ? 'block' : 'none';
    });
}

function showDashboard() {
    showSection('dashboardSection');
    loadDashboard();
}

// ============ Dashboard ============

async function loadDashboard() {
    if (!currentLearner) return;
    
    // Update learner name
    document.getElementById('learnerName').textContent = currentLearner.full_name.split(' ')[0];
    
    // Fetch fresh progress
    try {
        const res = await fetch(`${API_URL}/api/lms/progress/${encodeURIComponent(currentLearner.email)}`);
        learnerProgress = await res.json();
    } catch (error) {
        console.error('Error loading progress:', error);
    }
    
    // Update progress circle
    const progressPercent = learnerProgress.progress_percent || 0;
    document.getElementById('progressCircle').setAttribute('stroke-dasharray', `${progressPercent}, 100`);
    document.getElementById('progressPercent').textContent = `${progressPercent}%`;
    document.getElementById('completedModules').textContent = learnerProgress.completed_modules;
    document.getElementById('totalModules').textContent = learnerProgress.total_modules;
    
    // Check if course is complete
    if (learnerProgress.can_get_certificate && !currentLearner.certificate_issued) {
        // Show certificate generation option
    }
    
    // Render modules
    renderModules();
}

function renderModules() {
    if (!courseData || !learnerProgress) return;
    
    const grid = document.getElementById('modulesGrid');
    const moduleStatus = learnerProgress.modules_status || [];
    
    const icons = [
        'fa-brain', 'fa-hands-helping', 'fa-balance-scale', 'fa-comments',
        'fa-exclamation-triangle', 'fa-heart', 'fa-shield-alt', 'fa-users',
        'fa-book-medical', 'fa-clipboard-check', 'fa-phone', 'fa-home',
        'fa-certificate', 'fa-graduation-cap'
    ];
    
    grid.innerHTML = courseData.modules.map((module, index) => {
        const status = moduleStatus.find(s => s.id === module.id) || {};
        const isCompleted = status.completed;
        const score = status.score;
        
        // Check if this is the current module (first incomplete)
        const isCurrent = !isCompleted && (index === 0 || moduleStatus[index - 1]?.completed);
        
        // Check if locked (previous module not complete)
        const isLocked = index > 0 && !moduleStatus[index - 1]?.completed && !isCompleted;
        
        let cardClass = 'module-card';
        if (isCompleted) cardClass += ' completed';
        else if (isCurrent) cardClass += ' current';
        else if (isLocked) cardClass += ' locked';
        
        return `
            <div class="${cardClass}" onclick="${isLocked ? '' : `openModule('${module.id}')`}">
                <div class="module-number">
                    ${isCompleted ? '<i class="fas fa-check"></i>' : (index + 1)}
                </div>
                <div class="module-icon">
                    <i class="fas ${icons[index % icons.length]}"></i>
                </div>
                <h3>${module.title}</h3>
                <p>${module.description}</p>
                <div class="module-meta">
                    <span><i class="fas fa-clock"></i> ${module.duration_minutes} min</span>
                    ${isCompleted ? `<span class="module-score">${score}%</span>` : ''}
                    ${module.is_critical ? '<span class="badge badge-danger">Critical</span>' : ''}
                    ${isLocked ? '<span><i class="fas fa-lock"></i> Locked</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Add certificate card if course complete
    if (learnerProgress.can_get_certificate) {
        grid.innerHTML += `
            <div class="module-card completed" onclick="generateCertificate()" style="background: linear-gradient(135deg, rgba(201, 162, 39, 0.2), rgba(30, 58, 95, 0.3));">
                <div class="module-number" style="background: var(--secondary);">
                    <i class="fas fa-trophy"></i>
                </div>
                <div class="module-icon" style="background: rgba(201, 162, 39, 0.3);">
                    <i class="fas fa-certificate"></i>
                </div>
                <h3>Get Your Certificate</h3>
                <p>Congratulations! You've completed all modules. Claim your Radio Check Peer Supporter Certificate.</p>
                <div class="module-meta">
                    <span><i class="fas fa-award"></i> Course Complete!</span>
                </div>
            </div>
        `;
    }
}

// ============ Module View ============

async function openModule(moduleId) {
    try {
        const res = await fetch(`${API_URL}/api/lms/module/${moduleId}?learner_email=${encodeURIComponent(currentLearner.email)}`);
        
        if (!res.ok) {
            const error = await res.json();
            alert(error.detail || 'Cannot access this module.');
            return;
        }
        
        const data = await res.json();
        currentModule = data.module;
        
        // Update UI
        showSection('moduleSection');
        
        const moduleIndex = courseData.modules.findIndex(m => m.id === moduleId);
        document.getElementById('currentModuleNum').textContent = moduleIndex + 1;
        document.getElementById('totalModulesView').textContent = courseData.modules.length;
        document.getElementById('moduleTitle').textContent = currentModule.title;
        document.getElementById('moduleDuration').textContent = currentModule.duration_minutes;
        
        // Critical badge
        document.getElementById('criticalBadge').style.display = currentModule.is_critical ? 'inline-flex' : 'none';
        
        // Get Mr Clark's introduction for this module
        let tutorIntroHtml = '';
        try {
            const tutorRes = await fetch(`${API_URL}/api/lms/tutor/module-intro/${moduleId}`);
            if (tutorRes.ok) {
                const tutorData = await tutorRes.json();
                tutorIntroHtml = `
                    <div class="tutor-intro">
                        <img src="${tutorData.tutor.avatar_url}" alt="${tutorData.tutor.name}" class="tutor-avatar">
                        <div class="tutor-message">
                            <div class="tutor-name">${tutorData.tutor.name} <span class="tutor-title">- ${tutorData.tutor.title}</span></div>
                            <p>${tutorData.introduction}</p>
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            console.log('Tutor intro not available');
        }
        
        // Render content with image (simple markdown to HTML)
        const contentHtml = renderMarkdown(currentModule.content);
        document.getElementById('moduleContent').innerHTML = tutorIntroHtml + renderModuleWithImage(currentModule, contentHtml);
        
        // Also show external links if available
        if (currentModule.external_links && currentModule.external_links.length > 0) {
            const linksHtml = `
                <div class="external-links">
                    <h3><i class="fas fa-external-link-alt"></i> Further Reading</h3>
                    <ul>
                        ${currentModule.external_links.map(link => `
                            <li><a href="${link.url}" target="_blank" rel="noopener">${link.title}</a></li>
                        `).join('')}
                    </ul>
                </div>
            `;
            document.getElementById('moduleContent').innerHTML += linksHtml;
        }
        
        // Check if this module has reflection questions
        try {
            const reflectionRes = await fetch(`${API_URL}/api/lms/tutor/reflection-questions/${moduleId}`);
            if (reflectionRes.ok) {
                const reflectionData = await reflectionRes.json();
                if (reflectionData.has_reflection) {
                    // Store for later use
                    window.currentReflection = reflectionData;
                    
                    // Update quiz button to show reflection first
                    const quizBtn = document.getElementById('startQuizBtn');
                    quizBtn.innerHTML = '<i class="fas fa-pen-fancy"></i> Complete Reflection & Quiz';
                    quizBtn.onclick = () => showReflectionQuestions(moduleId);
                    
                    // Add reflection notice
                    document.getElementById('moduleContent').innerHTML += `
                        <div class="reflection-notice">
                            <i class="fas fa-lightbulb"></i>
                            <div>
                                <strong>Reflection Required</strong>
                                <p>This is a critical module. Before taking the quiz, you'll need to answer some reflection questions reviewed by ${reflectionData.tutor.name}.</p>
                            </div>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.log('No reflection questions for this module');
        }
        
        // Update sidebar
        renderModuleSidebar();
        
        // Update quiz button
        const quizBtn = document.getElementById('startQuizBtn');
        if (data.is_completed && !window.currentReflection) {
            quizBtn.textContent = `Retake Quiz (Current Score: ${data.quiz_score}%)`;
            quizBtn.onclick = () => startQuiz();
        } else if (!window.currentReflection) {
            quizBtn.innerHTML = '<i class="fas fa-clipboard-check"></i> Take Quiz to Complete Module';
            quizBtn.onclick = () => startQuiz();
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
    } catch (error) {
        console.error('Error loading module:', error);
        alert('Failed to load module. Please try again.');
    }
}

function renderModuleSidebar() {
    const sidebar = document.getElementById('moduleSidebar');
    sidebar.innerHTML = courseData.modules.map((m, i) => {
        const status = learnerProgress.modules_status?.find(s => s.id === m.id) || {};
        const isActive = currentModule && m.id === currentModule.id;
        const isCompleted = status.completed;
        
        return `
            <div class="sidebar-item ${isActive ? 'active' : ''}" onclick="openModule('${m.id}')">
                <i class="fas ${isCompleted ? 'fa-check-circle' : 'fa-circle'}"></i>
                ${i + 1}. ${m.title.substring(0, 25)}${m.title.length > 25 ? '...' : ''}
            </div>
        `;
    }).join('');
}

function renderMarkdown(content) {
    if (!content) return '';
    
    // Simple markdown rendering
    return content
        // Headers
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Blockquotes
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr>')
        // Lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        // Tables (simple)
        .replace(/\|(.+)\|/g, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>`;
        })
        // Wrap in paragraphs
        .replace(/^(?!<h|<li|<tr|<table|<ul|<ol|<p|<blockquote|<hr)(.+)$/gm, '<p>$1</p>')
        // Wrap list items
        .replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');
}

function renderModuleWithImage(module, contentHtml) {
    // Add module image at the top if available
    let imageHtml = '';
    if (module.image_url) {
        imageHtml = `
            <div class="module-hero-image">
                <img src="${module.image_url}" alt="${module.title}" loading="lazy">
            </div>
        `;
    }
    return imageHtml + contentHtml;
}

// ============ Quiz ============

function startQuiz() {
    if (!currentModule || !currentModule.quiz) {
        alert('No quiz available for this module.');
        return;
    }
    
    currentQuiz = currentModule.quiz;
    quizAnswers = {};
    currentQuestionIndex = 0;
    
    showSection('quizSection');
    document.getElementById('quizTitle').textContent = currentQuiz.title;
    document.getElementById('totalQuestions').textContent = currentQuiz.questions.length;
    
    renderQuestion();
}

function renderQuestion() {
    const question = currentQuiz.questions[currentQuestionIndex];
    const total = currentQuiz.questions.length;
    
    document.getElementById('currentQuestion').textContent = currentQuestionIndex + 1;
    
    const content = document.getElementById('quizContent');
    content.innerHTML = `
        <div class="quiz-question">
            <h3>${currentQuestionIndex + 1}. ${question.question}</h3>
            <div class="quiz-options">
                ${question.options.map((option, i) => {
                    const isSelected = quizAnswers[question.id] === option;
                    return `
                        <div class="quiz-option ${isSelected ? 'selected' : ''}" onclick="selectAnswer('${question.id}', '${option.replace(/'/g, "\\'")}')">
                            <span class="option-marker">${String.fromCharCode(65 + i)}</span>
                            <span>${option}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    // Update navigation buttons
    document.getElementById('prevQuestionBtn').disabled = currentQuestionIndex === 0;
    
    const isLast = currentQuestionIndex === total - 1;
    document.getElementById('nextQuestionBtn').style.display = isLast ? 'none' : 'flex';
    document.getElementById('submitQuizBtn').style.display = isLast ? 'flex' : 'none';
}

function selectAnswer(questionId, answer) {
    quizAnswers[questionId] = answer;
    renderQuestion();
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function nextQuestion() {
    const question = currentQuiz.questions[currentQuestionIndex];
    
    if (!quizAnswers[question.id]) {
        alert('Please select an answer before continuing.');
        return;
    }
    
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
}

async function submitQuiz() {
    // Check all questions answered
    const unanswered = currentQuiz.questions.filter(q => !quizAnswers[q.id]);
    if (unanswered.length > 0) {
        alert(`Please answer all questions. ${unanswered.length} remaining.`);
        return;
    }
    
    const submitBtn = document.getElementById('submitQuizBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    try {
        const res = await fetch(`${API_URL}/api/lms/quiz/submit?learner_email=${encodeURIComponent(currentLearner.email)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                module_id: currentModule.id,
                answers: quizAnswers
            })
        });
        
        const results = await res.json();
        showQuizResults(results);
    } catch (error) {
        console.error('Error submitting quiz:', error);
        alert('Failed to submit quiz. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit Quiz';
    }
}

function showQuizResults(results) {
    showSection('resultsSection');
    
    const passed = results.passed;
    const icon = document.getElementById('resultsIcon');
    icon.innerHTML = passed ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>';
    icon.className = `results-icon ${passed ? 'success' : 'fail'}`;
    
    document.getElementById('resultsTitle').textContent = passed ? 'Quiz Passed!' : 'Quiz Not Passed';
    document.getElementById('scoreValue').textContent = results.score;
    
    let message = '';
    if (passed) {
        message = results.is_critical_module 
            ? 'Excellent! You scored 100% on this critical module.'
            : `Great work! You scored ${results.score}% (needed ${results.required_score}%).`;
    } else {
        message = `You scored ${results.score}%, but need ${results.required_score}% to pass. Review the material and try again.`;
    }
    document.getElementById('resultsMessage').textContent = message;
    
    // Breakdown - Don't reveal correct answers, give guidance instead
    const breakdown = document.getElementById('resultsBreakdown');
    breakdown.innerHTML = results.results.map(r => `
        <div class="result-item ${r.is_correct ? 'correct' : 'incorrect'}">
            <div class="result-question">${r.question}</div>
            <div class="result-answer">
                Your answer: ${r.your_answer || '(not answered)'}
                ${r.is_correct ? 
                    '<span class="answer-correct"><i class="fas fa-check-circle"></i> Correct!</span>' : 
                    '<span class="answer-incorrect"><i class="fas fa-times-circle"></i> Not quite right</span>'
                }
            </div>
            ${!r.is_correct ? `
                <div class="result-guidance">
                    <i class="fas fa-lightbulb"></i>
                    <strong>Guidance:</strong> Review the module content and think about ${getGuidanceHint(r.question)}. 
                    The explanation below will help point you in the right direction.
                </div>
            ` : ''}
            <div class="result-explanation">
                <strong>Understanding:</strong> ${r.explanation}
            </div>
        </div>
    `).join('');
    
    // Buttons
    document.getElementById('continueBtn').style.display = passed ? 'flex' : 'none';
    document.getElementById('retryBtn').style.display = passed ? 'none' : 'flex';
    
    // Refresh progress
    loadDashboard();
}

// Generate a guidance hint based on the question type
function getGuidanceHint(question) {
    const lowerQ = question.toLowerCase();
    if (lowerQ.includes('first') || lowerQ.includes('initial')) {
        return 'what should be prioritised first in this situation';
    } else if (lowerQ.includes('not') || lowerQ.includes("shouldn't") || lowerQ.includes('avoid')) {
        return 'what actions would be inappropriate or outside your role';
    } else if (lowerQ.includes('crisis') || lowerQ.includes('emergency') || lowerQ.includes('suicide')) {
        return 'the key principles of crisis support and safety';
    } else if (lowerQ.includes('boundary') || lowerQ.includes('boundaries') || lowerQ.includes('ethical')) {
        return 'the importance of maintaining professional boundaries';
    } else if (lowerQ.includes('safeguard')) {
        return 'when and how safeguarding procedures should be followed';
    } else if (lowerQ.includes('listen') || lowerQ.includes('communication')) {
        return 'effective communication and active listening techniques';
    } else {
        return 'the key principles covered in this module';
    }
}

function continueAfterQuiz() {
    // Find next module
    const currentIndex = courseData.modules.findIndex(m => m.id === currentModule.id);
    
    if (currentIndex < courseData.modules.length - 1) {
        openModule(courseData.modules[currentIndex + 1].id);
    } else {
        // Course complete!
        showDashboard();
    }
}

function retryQuiz() {
    quizAnswers = {};
    currentQuestionIndex = 0;
    showSection('quizSection');
    renderQuestion();
}

// ============ Certificate ============

async function generateCertificate() {
    if (currentLearner.certificate_issued && currentLearner.certificate_id) {
        // Show existing certificate
        showCertificate(currentLearner.certificate_id, currentLearner.full_name, new Date());
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/lms/certificate/generate?learner_email=${encodeURIComponent(currentLearner.email)}`, {
            method: 'POST'
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
            showCertificate(data.certificate_id, data.learner_name, new Date(data.issued_date));
            
            // Update learner data
            currentLearner.certificate_issued = true;
            currentLearner.certificate_id = data.certificate_id;
        } else {
            alert(data.detail || 'Unable to generate certificate. Please complete all modules first.');
        }
    } catch (error) {
        console.error('Error generating certificate:', error);
        alert('Failed to generate certificate. Please try again.');
    }
}

function showCertificate(certId, name, date) {
    showSection('certificateSection');
    
    document.getElementById('certName').textContent = name;
    document.getElementById('certDate').textContent = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    document.getElementById('certId').textContent = certId.substring(0, 16);
    document.getElementById('certVerifyId').textContent = certId.substring(0, 16);
}

function downloadCertificate() {
    // In a real implementation, this would generate a PDF
    alert('Certificate download feature coming soon!\n\nFor now, you can take a screenshot or print this page.');
}

// ============ Utility ============

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});

// Handle keyboard events
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
});

// ============ Reflection Questions (Mr Clark AI Tutor) ============

function showReflectionQuestions(moduleId) {
    if (!window.currentReflection) {
        startQuiz();
        return;
    }
    
    const reflection = window.currentReflection;
    
    // Create reflection modal if it doesn't exist
    if (!document.getElementById('reflectionModal')) {
        createReflectionModal();
    }
    
    // Set up the reflection form
    document.getElementById('reflectionModuleTitle').textContent = reflection.module_name;
    document.getElementById('reflectionTutorMessage').textContent = reflection.intro_message;
    document.getElementById('reflectionTutorAvatar').src = reflection.tutor.avatar_url;
    document.getElementById('reflectionTutorName').textContent = reflection.tutor.name;
    
    // Render questions
    const questionsHtml = reflection.questions.map((q, idx) => `
        <div class="reflection-question" data-question-id="${q.id}">
            <div class="question-header">
                <span class="question-type ${q.type}">${q.type === 'scenario' ? 'Scenario' : 'Reflection'}</span>
                <span class="question-num">Question ${idx + 1} of ${reflection.questions.length}</span>
            </div>
            <p class="question-text">${q.question}</p>
            <textarea 
                class="reflection-textarea" 
                id="reflection-${q.id}" 
                placeholder="Write your thoughtful response here (minimum 50 characters)..."
                rows="6"
            ></textarea>
            <div class="char-count" id="count-${q.id}">0 characters</div>
        </div>
    `).join('');
    
    document.getElementById('reflectionQuestions').innerHTML = questionsHtml;
    
    // Add character counters
    reflection.questions.forEach(q => {
        const textarea = document.getElementById(`reflection-${q.id}`);
        const counter = document.getElementById(`count-${q.id}`);
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            counter.textContent = `${len} characters`;
            counter.className = len >= 50 ? 'char-count valid' : 'char-count';
        });
    });
    
    document.getElementById('reflectionModal').classList.add('active');
}

function createReflectionModal() {
    const modal = document.createElement('div');
    modal.id = 'reflectionModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal modal-xl">
            <div class="modal-header reflection-header">
                <div class="tutor-badge">
                    <img id="reflectionTutorAvatar" src="" alt="Tutor">
                    <span id="reflectionTutorName">Mr Clark</span>
                </div>
                <h2 id="reflectionModuleTitle">Module Reflection</h2>
                <button class="modal-close" onclick="closeModal('reflectionModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="tutor-intro-message">
                    <p id="reflectionTutorMessage"></p>
                </div>
                
                <div id="reflectionQuestions"></div>
                
                <div class="reflection-submit">
                    <button type="button" class="btn btn-secondary btn-lg" id="submitReflectionBtn" onclick="submitReflections()">
                        <i class="fas fa-paper-plane"></i> Submit to ${window.currentReflection?.tutor?.name || 'Mr Clark'} for Review
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitReflections() {
    const reflection = window.currentReflection;
    if (!reflection) return;
    
    const btn = document.getElementById('submitReflectionBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mr Clark is reviewing...';
    
    const results = [];
    let allPassed = true;
    
    for (const q of reflection.questions) {
        const response = document.getElementById(`reflection-${q.id}`).value.trim();
        
        if (response.length < 50) {
            showError(`Please provide a more detailed response for question: "${q.question.substring(0, 50)}..."`);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit to Mr Clark for Review';
            return;
        }
        
        try {
            const res = await fetch(`${API_URL}/api/lms/tutor/submit-reflection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    learner_email: currentLearner.email,
                    module_id: currentModule.id,
                    question_id: q.id,
                    response: response
                })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                results.push({
                    question: q.question,
                    passed: data.evaluation.passed,
                    feedback: data.evaluation.tutor_message,
                    competencies: data.evaluation.competencies_demonstrated
                });
                
                if (!data.evaluation.passed) {
                    allPassed = false;
                }
            } else {
                throw new Error(data.detail || 'Submission failed');
            }
        } catch (error) {
            showError(`Error submitting response: ${error.message}`);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit to Mr Clark for Review';
            return;
        }
    }
    
    // Show results
    showReflectionResults(results, allPassed);
}

function showReflectionResults(results, allPassed) {
    const tutor = window.currentReflection?.tutor || { name: 'Mr Clark', avatar_url: '' };
    
    let resultsHtml = `
        <div class="reflection-results">
            <div class="tutor-feedback-header">
                <img src="${tutor.avatar_url}" alt="${tutor.name}" class="tutor-avatar-large">
                <div>
                    <h3>${tutor.name}'s Feedback</h3>
                    <p class="feedback-summary ${allPassed ? 'passed' : 'needs-work'}">
                        ${allPassed ? 'Well done! You\'ve demonstrated good understanding.' : 'Good effort! Some areas need more development.'}
                    </p>
                </div>
            </div>
            
            <div class="feedback-list">
                ${results.map((r, i) => `
                    <div class="feedback-item ${r.passed ? 'passed' : 'needs-work'}">
                        <div class="feedback-status">
                            <i class="fas ${r.passed ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                            ${r.passed ? 'Passed' : 'Needs Development'}
                        </div>
                        <p class="feedback-question">${r.question.substring(0, 80)}...</p>
                        <p class="feedback-text">${r.feedback}</p>
                        ${r.competencies?.length > 0 ? `
                            <div class="competencies-shown">
                                <strong>Competencies demonstrated:</strong>
                                ${r.competencies.map(c => `<span class="competency-tag">${c}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            
            <div class="reflection-actions">
                ${allPassed ? `
                    <p class="success-message"><i class="fas fa-award"></i> You can now proceed to the module quiz!</p>
                    <button class="btn btn-secondary btn-lg" onclick="closeModal('reflectionModal'); startQuiz();">
                        <i class="fas fa-clipboard-check"></i> Take Module Quiz
                    </button>
                ` : `
                    <p class="retry-message"><i class="fas fa-redo"></i> Please review the feedback and try again.</p>
                    <button class="btn btn-outline btn-lg" onclick="location.reload()">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                `}
            </div>
        </div>
    `;
    
    document.getElementById('reflectionQuestions').innerHTML = resultsHtml;
    document.getElementById('submitReflectionBtn').style.display = 'none';
}


// ============ Mr Clark Chat Widget ============

let chatOpen = false;

function toggleTutorChat() {
    const chatWindow = document.getElementById('chatWindow');
    const widget = document.getElementById('tutorChatWidget');
    chatOpen = !chatOpen;
    
    if (chatOpen) {
        chatWindow.classList.add('open');
        widget.classList.add('chat-open');
        document.getElementById('chatInput').focus();
    } else {
        chatWindow.classList.remove('open');
        widget.classList.remove('chat-open');
    }
}

async function sendTutorMessage() {
    if (!currentLearner) {
        showError('Please log in to chat with Mr Clark');
        return;
    }
    
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    const sendBtn = document.getElementById('chatSendBtn');
    sendBtn.disabled = true;
    
    // Add user message to chat
    addChatMessage(message, 'user');
    input.value = '';
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        const res = await fetch(`${API_URL}/api/lms/tutor/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                learner_email: currentLearner.email,
                message: message,
                current_module: currentModule?.title || null
            })
        });
        
        const data = await res.json();
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        if (res.ok) {
            addChatMessage(data.response, 'tutor');
        } else {
            addChatMessage("I'm sorry, I'm having trouble responding right now. Please try again in a moment.", 'tutor');
        }
    } catch (error) {
        removeTypingIndicator(typingId);
        addChatMessage("I'm sorry, I couldn't connect. Please check your internet and try again.", 'tutor');
        console.error('Chat error:', error);
    } finally {
        sendBtn.disabled = false;
    }
}

function addChatMessage(content, type) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    const tutorAvatar = 'https://static.prod-images.emergentagent.com/jobs/535ca64e-70e1-4fc8-813d-3b487fc07905/images/a9bacd4dc492874cedeb536e97e322012136c6e4d632ddf2b353b4dad5037acb.png';
    
    if (type === 'tutor') {
        messageDiv.innerHTML = `
            <img src="${tutorAvatar}" alt="Mr Clark" class="message-avatar">
            <div class="message-content">
                <p>${formatTutorResponse(content)}</p>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${escapeHtml(content)}</p>
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatTutorResponse(text) {
    // Convert markdown-style formatting to HTML
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^- (.+)$/gm, '• $1');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message tutor typing-indicator';
    typingDiv.id = 'typing-' + Date.now();
    
    const tutorAvatar = 'https://static.prod-images.emergentagent.com/jobs/535ca64e-70e1-4fc8-813d-3b487fc07905/images/a9bacd4dc492874cedeb536e97e322012136c6e4d632ddf2b353b4dad5037acb.png';
    
    typingDiv.innerHTML = `
        <img src="${tutorAvatar}" alt="Mr Clark" class="message-avatar">
        <div class="message-content typing">
            <span></span><span></span><span></span>
        </div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return typingDiv.id;
}

function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// Send message on Enter (Shift+Enter for new line)
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendTutorMessage();
            }
        });
    }
});

