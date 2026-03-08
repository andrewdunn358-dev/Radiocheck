/**
 * Radio Check LMS Learner Portal
 * Handles course enrollment, module learning, quizzes, and certificates
 */

// Configuration - Update this URL when deploying to production
// For 20i hosting, set this to your Render backend URL
const API_URL = window.location.hostname === 'localhost' || window.location.hostname.includes('preview.emergentagent.com')
    ? window.location.origin  // Use same origin in dev/preview
    : 'https://your-backend.onrender.com';  // Replace with your Render URL for production

// State
let currentLearner = null;
let courseData = null;
let learnerProgress = null;
let currentModule = null;
let currentQuiz = null;
let quizAnswers = {};
let currentQuestionIndex = 0;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check for stored learner session
    const storedEmail = localStorage.getItem('lms_learner_email');
    if (storedEmail) {
        await loginLearner(storedEmail);
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
    const email = document.getElementById('loginEmail').value.trim();
    
    if (!email) return;
    
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    
    try {
        await loginLearner(email);
        closeModal('loginModal');
    } catch (error) {
        alert(error.message || 'Login failed. Please check your email or register first.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Training';
    }
}

async function loginLearner(email) {
    const res = await fetch(`${API_URL}/api/lms/progress/${encodeURIComponent(email)}`);
    
    if (!res.ok) {
        throw new Error('Learner not found. Please register first or check your email.');
    }
    
    const data = await res.json();
    currentLearner = data.learner;
    learnerProgress = data;
    
    // Store session
    localStorage.setItem('lms_learner_email', email);
    
    // Update header
    updateHeaderForLoggedIn();
    
    // Show dashboard
    showDashboard();
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
    currentLearner = null;
    learnerProgress = null;
    
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
        
        // Render content (simple markdown to HTML)
        document.getElementById('moduleContent').innerHTML = renderMarkdown(currentModule.content);
        
        // Update sidebar
        renderModuleSidebar();
        
        // Update quiz button
        const quizBtn = document.getElementById('startQuizBtn');
        if (data.is_completed) {
            quizBtn.textContent = `Retake Quiz (Current Score: ${data.quiz_score}%)`;
        } else {
            quizBtn.innerHTML = '<i class="fas fa-clipboard-check"></i> Take Quiz to Complete Module';
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
        .replace(/^(?!<h|<li|<tr|<table|<ul|<ol|<p)(.+)$/gm, '<p>$1</p>')
        // Wrap list items
        .replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');
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
    
    // Breakdown
    const breakdown = document.getElementById('resultsBreakdown');
    breakdown.innerHTML = results.results.map(r => `
        <div class="result-item ${r.is_correct ? 'correct' : 'incorrect'}">
            <div class="result-question">${r.question}</div>
            <div class="result-answer">
                Your answer: ${r.your_answer || '(not answered)'}<br>
                ${!r.is_correct ? `Correct answer: ${r.correct_answer}` : ''}
            </div>
            <div class="result-explanation">${r.explanation}</div>
        </div>
    `).join('');
    
    // Buttons
    document.getElementById('continueBtn').style.display = passed ? 'flex' : 'none';
    document.getElementById('retryBtn').style.display = passed ? 'none' : 'flex';
    
    // Refresh progress
    loadDashboard();
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
