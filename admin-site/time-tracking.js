/**
 * Time Tracking Module for Admin Portal
 * Tracks work hours for invoicing purposes
 */

// Get API URL from config - ensure /api prefix is included
const API_BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) 
    ? CONFIG.API_URL + '/api' 
    : 'https://veterans-support-api.onrender.com/api';

// Chart instances
let categoryChart = null;
let dailyChart = null;

// Categories
const TIME_CATEGORIES = [
    'Development', 'Admin Portal', 'Staff Portal', 'LMS Admin',
    'LMS Learning', 'App Testing', 'Support', 'Training',
    'Documentation', 'Meetings', 'Other'
];

// Initialize time tracking when tab is shown
document.addEventListener('DOMContentLoaded', function() {
    // Set default month filter to current month
    const monthInput = document.getElementById('time-filter-month');
    if (monthInput) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    // Populate category filter
    const categorySelect = document.getElementById('time-filter-category');
    if (categorySelect) {
        TIME_CATEGORIES.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            categorySelect.appendChild(opt);
        });
    }
    
    // Load data when time tracking tab is clicked
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.dataset.tab === 'timetracking') {
                loadTimeEntries();
                loadTimeSummary();
            }
        });
    });
});

// Load time entries from API
async function loadTimeEntries() {
    try {
        const monthFilter = document.getElementById('time-filter-month')?.value || '';
        const categoryFilter = document.getElementById('time-filter-category')?.value || '';
        
        let url = `${API_BASE_URL}/timetracking/entries?limit=200`;
        
        if (monthFilter) {
            const [year, month] = monthFilter.split('-');
            const startDate = `${year}-${month}-01`;
            const endDate = month === '12' 
                ? `${parseInt(year) + 1}-01-01` 
                : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;
            url += `&start_date=${startDate}&end_date=${endDate}`;
        }
        
        if (categoryFilter) {
            url += `&category=${encodeURIComponent(categoryFilter)}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load entries');
        
        const data = await response.json();
        renderTimeEntries(data.entries);
        document.getElementById('total-entries').textContent = data.total;
        
    } catch (error) {
        console.error('Error loading time entries:', error);
        showToast('Failed to load time entries', 'error');
    }
}

// Render entries in table
function renderTimeEntries(entries) {
    const tbody = document.getElementById('time-entries-body');
    if (!tbody) return;
    
    if (entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fas fa-clock" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                    No time entries found. Click "Add Entry" to log your work hours.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = entries.map(entry => {
        const totalHours = entry.hours + (entry.minutes / 60);
        const cost = entry.cost || (totalHours * (entry.hourly_rate || 35));
        const typeIcon = entry.auto_tracked 
            ? '<i class="fas fa-robot" title="Auto-tracked"></i>' 
            : '<i class="fas fa-hand-paper" title="Manual"></i>';
        
        return `
            <tr>
                <td>${formatDate(entry.date)}</td>
                <td>${entry.hours}h ${entry.minutes}m</td>
                <td><span class="badge" style="background: ${getCategoryColor(entry.category)};">${entry.category}</span></td>
                <td>£${cost.toFixed(2)}</td>
                <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${entry.description}">${entry.description}</td>
                <td>${typeIcon} ${entry.auto_tracked ? 'Auto' : 'Manual'}</td>
                <td>
                    <button class="btn btn-small btn-secondary" onclick="editTimeEntry('${entry.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-small btn-danger" onclick="deleteTimeEntry('${entry.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Load summary statistics
async function loadTimeSummary() {
    try {
        const monthFilter = document.getElementById('time-filter-month')?.value || '';
        
        let url = `${API_BASE_URL}/timetracking/summary`;
        if (monthFilter) {
            url += `?month=${monthFilter}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load summary');
        
        const data = await response.json();
        
        // Update summary cards
        document.getElementById('total-hours-month').textContent = 
            `${data.total.hours}h ${data.total.minutes}m`;
        
        // Update total cost
        const totalCostEl = document.getElementById('total-cost-month');
        if (totalCostEl) {
            totalCostEl.textContent = `£${(data.total.total_cost || 0).toFixed(2)}`;
        }
        
        // Calculate week total (last 7 days from daily breakdown)
        const weekTotal = calculateWeekTotal(data.daily_breakdown);
        document.getElementById('total-hours-week').textContent = 
            `${Math.floor(weekTotal / 60)}h ${weekTotal % 60}m`;
        
        // Development hours
        const devHours = data.by_category['Development'] || { hours: 0, minutes: 0 };
        document.getElementById('dev-hours').textContent = 
            `${devHours.hours}h ${devHours.minutes}m`;
        
        // Update charts
        updateCategoryChart(data.by_category);
        updateDailyChart(data.daily_breakdown);
        
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// Calculate week total from daily breakdown
function calculateWeekTotal(dailyBreakdown) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekStr = oneWeekAgo.toISOString().split('T')[0];
    
    return dailyBreakdown
        .filter(d => d.date >= weekStr)
        .reduce((sum, d) => sum + d.total_minutes, 0);
}

// Update category pie chart
function updateCategoryChart(byCategory) {
    const ctx = document.getElementById('category-chart');
    if (!ctx) return;
    
    const labels = Object.keys(byCategory);
    const data = labels.map(cat => byCategory[cat].total_minutes / 60);
    const colors = labels.map(cat => getCategoryColor(cat));
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#1a2634'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#a0aec0', font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const hours = context.raw.toFixed(1);
                            return `${context.label}: ${hours} hours`;
                        }
                    }
                }
            }
        }
    });
}

// Update daily bar chart
function updateDailyChart(dailyBreakdown) {
    const ctx = document.getElementById('daily-chart');
    if (!ctx) return;
    
    // Get last 14 days
    const last14 = dailyBreakdown.slice(-14);
    
    const labels = last14.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });
    const data = last14.map(d => d.total_minutes / 60);
    
    if (dailyChart) {
        dailyChart.destroy();
    }
    
    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hours',
                data: data,
                backgroundColor: '#4f6bed',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#a0aec0' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0aec0', maxRotation: 45 }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Get category color
function getCategoryColor(category) {
    const colors = {
        'Development': '#4f6bed',
        'Admin Portal': '#9f7aea',
        'Staff Portal': '#38b2ac',
        'LMS Admin': '#ed8936',
        'LMS Learning': '#48bb78',
        'App Testing': '#f56565',
        'Support': '#667eea',
        'Training': '#ed64a6',
        'Documentation': '#4fd1c5',
        'Meetings': '#fc8181',
        'Other': '#a0aec0'
    };
    return colors[category] || '#a0aec0';
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
}

// Open add time entry modal
function openAddTimeEntryModal() {
    document.getElementById('time-entry-modal-title').innerHTML = '<i class="fas fa-clock"></i> Add Time Entry';
    document.getElementById('time-entry-id').value = '';
    document.getElementById('time-entry-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('time-entry-hours').value = '1';
    document.getElementById('time-entry-minutes').value = '0';
    document.getElementById('time-entry-category').value = 'Development';
    document.getElementById('time-entry-description').value = '';
    
    document.getElementById('time-entry-modal').classList.remove('hidden');
}

// Close modal
function closeTimeEntryModal() {
    document.getElementById('time-entry-modal').classList.add('hidden');
}

// Save time entry
async function saveTimeEntry(event) {
    event.preventDefault();
    
    const entryId = document.getElementById('time-entry-id').value;
    const data = {
        date: document.getElementById('time-entry-date').value,
        hours: parseInt(document.getElementById('time-entry-hours').value),
        minutes: parseInt(document.getElementById('time-entry-minutes').value),
        category: document.getElementById('time-entry-category').value,
        description: document.getElementById('time-entry-description').value
    };
    
    try {
        const url = entryId 
            ? `${API_BASE_URL}/timetracking/entries/${entryId}`
            : `${API_BASE_URL}/timetracking/entries`;
        
        const response = await fetch(url, {
            method: entryId ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Failed to save entry');
        
        showToast(entryId ? 'Entry updated!' : 'Entry added!', 'success');
        closeTimeEntryModal();
        loadTimeEntries();
        loadTimeSummary();
        
    } catch (error) {
        console.error('Error saving entry:', error);
        showToast('Failed to save entry', 'error');
    }
}

// Edit time entry
async function editTimeEntry(entryId) {
    try {
        const response = await fetch(`${API_BASE_URL}/timetracking/entries/${entryId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load entry');
        
        const data = await response.json();
        const entry = data.entry;
        
        document.getElementById('time-entry-modal-title').innerHTML = '<i class="fas fa-edit"></i> Edit Time Entry';
        document.getElementById('time-entry-id').value = entry.id;
        document.getElementById('time-entry-date').value = entry.date;
        document.getElementById('time-entry-hours').value = entry.hours;
        document.getElementById('time-entry-minutes').value = entry.minutes;
        document.getElementById('time-entry-category').value = entry.category;
        document.getElementById('time-entry-description').value = entry.description;
        
        document.getElementById('time-entry-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading entry:', error);
        showToast('Failed to load entry', 'error');
    }
}

// Delete time entry
async function deleteTimeEntry(entryId) {
    if (!confirm('Are you sure you want to delete this time entry?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/timetracking/entries/${entryId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        
        if (!response.ok) throw new Error('Failed to delete entry');
        
        showToast('Entry deleted', 'success');
        loadTimeEntries();
        loadTimeSummary();
        
    } catch (error) {
        console.error('Error deleting entry:', error);
        showToast('Failed to delete entry', 'error');
    }
}

// Export to Excel
async function exportTimeTracking() {
    const monthFilter = document.getElementById('time-filter-month')?.value;
    
    if (!monthFilter) {
        showToast('Please select a month to export', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/timetracking/export?month=${monthFilter}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        
        if (!response.ok) throw new Error('Failed to export');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `time_tracking_${monthFilter}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Excel exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting:', error);
        showToast('Failed to export Excel', 'error');
    }
}

// Seed historical data
async function seedHistoricalData() {
    if (!confirm('This will load estimated historical time entries based on development sessions. Continue?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/timetracking/seed-historical`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        
        const data = await response.json();
        
        if (data.seeded) {
            showToast(`Loaded ${data.total_hours} hours of historical data!`, 'success');
            loadTimeEntries();
            loadTimeSummary();
        } else {
            showToast(data.message, 'warning');
        }
        
    } catch (error) {
        console.error('Error seeding data:', error);
        showToast('Failed to load historical data', 'error');
    }
}

// Clear all entries
async function clearAllEntries() {
    if (!confirm('WARNING: This will DELETE ALL time tracking entries. This cannot be undone. Are you sure?')) {
        return;
    }
    
    if (!confirm('Really delete everything? Type OK in the next prompt to confirm.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/timetracking/clear-all?confirm=true`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });
        
        const data = await response.json();
        showToast(data.message, 'success');
        loadTimeEntries();
        loadTimeSummary();
        
    } catch (error) {
        console.error('Error clearing data:', error);
        showToast('Failed to clear entries', 'error');
    }
}

// Simple toast notification (uses existing showToast if available)
if (typeof showToast !== 'function') {
    function showToast(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    }
}
