// Admin Portal API Client
// Extracted from /app/portal/src/app/admin/page.tsx

import type { 
  User, 
  StaffMember, 
  CallLog, 
  ChatRoom, 
  SafeguardingAlert, 
  AICharacter, 
  AIUsageSummary 
} from '@/types/admin';

// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

// Helper to resolve avatar URLs - prepend API URL if path is relative
export function resolveAvatarUrl(avatarPath: string | undefined): string {
  if (!avatarPath) return '';
  // If already absolute URL, return as-is
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }
  // Prepend API URL for relative paths
  return `${API_URL}${avatarPath}`;
}

// API Client with proper error handling
export const api = {
  async fetch<T>(endpoint: string, options: { token?: string; method?: string; body?: string } = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      // Handle Pydantic validation errors which come as array
      if (Array.isArray(error.detail)) {
        const messages = error.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ');
        throw new Error(messages);
      }
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return response.json();
  },

  // Auth
  login: (email: string, password: string) => 
    api.fetch<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Staff Management - using NEW unified endpoints
  getStaff: (token: string, role?: string) => 
    api.fetch<StaffMember[]>(`/staff${role ? `?role=${role}` : ''}`, { token }),
  
  // Legacy unified staff view - combines users, counsellors, peers
  getUnifiedStaff: (token: string) =>
    api.fetch<any[]>('/admin/unified-staff', { token }),
  
  // Legacy separate collections
  getCounsellors: (token: string) =>
    api.fetch<any[]>('/counsellors', { token }),
  
  getPeerSupporters: (token: string) =>
    api.fetch<any[]>('/peer-supporters', { token }),
  
  getLegacyUsers: (token: string) =>
    api.fetch<any[]>('/auth/users', { token }),
  
  getStaffById: (token: string, id: string) =>
    api.fetch<StaffMember>(`/staff/${id}`, { token }),
  
  createStaff: (token: string, data: Partial<StaffMember> & { password: string }) =>
    api.fetch<{ message: string; staff: StaffMember }>('/staff', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateStaff: (token: string, id: string, data: Partial<StaffMember>) =>
    api.fetch<StaffMember>(`/staff/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  deleteStaff: (token: string, id: string) =>
    api.fetch<{ message: string }>(`/staff/${id}`, {
      token,
      method: 'DELETE',
    }),
  
  updateStaffStatus: (token: string, id: string, status: string) =>
    api.fetch<{ message: string }>(`/staff/${id}/status`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  
  // Legacy status updates
  updateCounsellorStatus: (token: string, id: string, status: string) =>
    api.fetch<any>(`/counsellors/${id}/status`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  
  updatePeerStatus: (token: string, id: string, status: string) =>
    api.fetch<any>(`/peer-supporters/${id}/status`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Migration
  getMigrationStatus: (token: string) =>
    api.fetch<{ legacy_counts: any; unified_staff_count: number; migrated_count: number }>('/admin/migration-status', { token }),
  
  runMigration: (token: string) =>
    api.fetch<{ message: string; stats: any }>('/admin/migrate-to-unified-staff', {
      token,
      method: 'POST',
    }),
  
  fixStaffPasswords: (token: string) =>
    api.fetch<{ message: string; stats: any }>('/admin/fix-staff-passwords', {
      token,
      method: 'POST',
    }),

  // Logs - Chat Rooms (old endpoint, kept for backward compatibility)
  getChatRooms: (token: string) =>
    api.fetch<ChatRoom[]>('/live-chat/rooms', { token }),
  
  // Logs - Safeguarding Alerts (old endpoint, kept for backward compatibility)
  getSafeguardingAlerts: (token: string) =>
    api.fetch<SafeguardingAlert[]>('/safeguarding-alerts', { token }),

  // AI Characters - Correct endpoint is /ai-characters/admin/all
  getAICharacters: (token: string) =>
    api.fetch<{ characters: AICharacter[]; source: string }>('/ai-characters/admin/all', { token }),
  
  getAICharacter: (token: string, id: string) =>
    api.fetch<AICharacter>(`/ai-characters/admin/${id}`, { token }),

  updateAICharacter: (token: string, id: string, data: Partial<AICharacter>) =>
    api.fetch<AICharacter>(`/ai-characters/${id}`, {
      token,
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleAICharacterStatus: (token: string, id: string, enabled: boolean) =>
    api.fetch<any>(`/ai-characters/admin/${id}/status`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ is_enabled: enabled }),
    }),

  seedAICharacters: (token: string) =>
    api.fetch<any>('/ai-characters/seed-from-hardcoded', {
      token,
      method: 'POST',
    }),

  // AI Usage - Correct endpoint format
  getAIUsageSummary: (token: string, days: number = 30) =>
    api.fetch<AIUsageSummary>(`/admin/ai-usage/summary?days=${days}`, { token }),
  
  getAIUsageByCharacter: (token: string, days: number = 30) =>
    api.fetch<any[]>(`/admin/ai-usage/by-character?days=${days}`, { token }),

  // Monitoring - Correct endpoint is /admin/system-stats
  getMonitoringStats: (token: string) =>
    api.fetch<any>('/admin/system-stats', { token }),

  // Rota/Shifts
  getShifts: (token: string) =>
    api.fetch<any[]>('/shifts/', { token }),
  
  getSwapRequests: (token: string) =>
    api.fetch<any[]>('/shift-swaps/', { token }),
  
  getPendingSwaps: (token: string) =>
    api.fetch<any[]>('/shift-swaps/needs-approval', { token }),

  approveSwap: (token: string, id: string, approved: boolean) =>
    api.fetch<any>(`/shift-swaps/${id}/approve`, {
      token,
      method: 'POST',
      body: JSON.stringify({ approved }),
    }),

  // Create Shift
  createShift: (token: string, shift: { date: string; start_time: string; end_time: string }, userId: string, userName: string, userEmail: string) =>
    api.fetch<any>(`/shifts/?user_id=${encodeURIComponent(userId)}&user_name=${encodeURIComponent(userName)}&user_email=${encodeURIComponent(userEmail)}`, {
      token,
      method: 'POST',
      body: JSON.stringify(shift),
    }),

  deleteShift: (token: string, shiftId: string) =>
    api.fetch<any>(`/shifts/${shiftId}`, {
      token,
      method: 'DELETE',
    }),

  // Events - use /events/admin/all for full list with past events option
  getEvents: (token: string, includePast: boolean = true) =>
    api.fetch<any[]>(`/events/admin/all?include_past=${includePast}`, { token }),
  
  createEvent: (token: string, data: any) =>
    api.fetch<any>('/events/admin/create', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  deleteEvent: (token: string, id: string) =>
    api.fetch<any>(`/events/admin/${id}`, {
      token,
      method: 'DELETE',
    }),
  
  updateEvent: (token: string, id: string, data: any) =>
    api.fetch<any>(`/events/admin/${id}`, {
      token,
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  getEventAttendance: (token: string, eventId: string) =>
    api.fetch<any>(`/events/admin/${eventId}/attendance`, { token }),

  getAttendanceHistory: (token: string) =>
    api.fetch<any>(`/events/admin/attendance-history`, { token }),

  // Admin reset password
  adminResetPassword: (token: string, userId: string, newPassword: string) =>
    api.fetch<any>('/auth/admin-reset-password', {
      token,
      method: 'POST',
      body: JSON.stringify({ user_id: userId, new_password: newPassword }),
    }),

  // AI Usage Daily
  getAIUsageDaily: (token: string, days: number = 30) =>
    api.fetch<any[]>(`/admin/ai-usage/daily?days=${days}`, { token }),

  // CMS
  getCMSPages: (token: string) =>
    api.fetch<any[]>('/cms/pages', { token }),
  
  getCMSPage: (token: string, slug: string) =>
    api.fetch<any>(`/cms/pages/${slug}`, { token }),
  
  updateCMSPage: (token: string, slug: string, data: any) =>
    api.fetch<any>(`/cms/pages/${slug}`, {
      token,
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  seedCMSDefaults: (token: string) =>
    api.fetch<any>('/cms/seed-public', {
      token,
      method: 'POST',
    }),

  // CMS Content - Books
  getCMSBooks: (token: string) =>
    api.fetch<any>('/cms/admin/books', { token }),
  createCMSBook: (token: string, data: any) =>
    api.fetch<any>('/cms/admin/books', { token, method: 'POST', body: JSON.stringify(data) }),
  updateCMSBook: (token: string, id: string, data: any) =>
    api.fetch<any>(`/cms/admin/books/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  deleteCMSBook: (token: string, id: string) =>
    api.fetch<any>(`/cms/admin/books/${id}`, { token, method: 'DELETE' }),
  seedCMSBooks: (token: string) =>
    api.fetch<any>('/cms/admin/books/seed', { token, method: 'POST' }),
  reorderCMSBooks: (token: string, order: string[]) =>
    api.fetch<any>('/cms/admin/books/reorder', { token, method: 'POST', body: JSON.stringify(order) }),

  // CMS Content - Podcasts
  getCMSPodcasts: (token: string) =>
    api.fetch<any>('/cms/admin/podcasts', { token }),
  createCMSPodcast: (token: string, data: any) =>
    api.fetch<any>('/cms/admin/podcasts', { token, method: 'POST', body: JSON.stringify(data) }),
  updateCMSPodcast: (token: string, id: string, data: any) =>
    api.fetch<any>(`/cms/admin/podcasts/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  deleteCMSPodcast: (token: string, id: string) =>
    api.fetch<any>(`/cms/admin/podcasts/${id}`, { token, method: 'DELETE' }),
  reorderCMSPodcasts: (token: string, order: string[]) =>
    api.fetch<any>('/cms/admin/podcasts/reorder', { token, method: 'POST', body: JSON.stringify(order) }),
  seedCMSPodcasts: (token: string) =>
    api.fetch<any>('/cms/admin/podcasts/seed', { token, method: 'POST' }),

  // CMS Content - Persona Bios
  getCMSPersonaBios: (token: string) =>
    api.fetch<any>('/cms/admin/persona-bios', { token }),
  updateCMSPersonaBio: (token: string, id: string, data: any) =>
    api.fetch<any>(`/cms/admin/persona-bios/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  seedCMSPersonaBios: (token: string) =>
    api.fetch<any>('/cms/admin/persona-bios/seed', { token, method: 'POST' }),
  reorderCMSPersonaBios: (token: string, order: string[]) =>
    api.fetch<any>('/cms/admin/persona-bios/reorder', { token, method: 'POST', body: JSON.stringify(order) }),

  // Compliance
  getComplianceDashboard: (token: string) =>
    api.fetch<any>('/compliance/dashboard', { token }),
  
  getComplianceIncidents: (token: string) =>
    api.fetch<any>('/compliance/incidents?status=detected&status=investigating&status=contained', { token }),
  
  getComplianceComplaints: (token: string) =>
    api.fetch<any>('/compliance/complaints?status=received&status=under_review&status=investigating', { token }),
  
  getAuditLogs: (token: string, limit: number = 50) =>
    api.fetch<any>(`/admin/audit-logs?limit=${limit}`, { token }),

  // Logs - All sub-tabs
  getCallLogs: (token: string) =>
    api.fetch<any>('/call-logs', { token }),
  
  getChatLogs: (token: string) =>
    api.fetch<any>('/live-chat/rooms', { token }),
  
  getSafeguardingLogs: (token: string) =>
    api.fetch<any>('/safeguarding-alerts', { token }),
  
  getScreeningLogs: (token: string) =>
    api.fetch<any>('/screening-submissions', { token }),
  
  getCallbackLogs: (token: string) =>
    api.fetch<any>('/callbacks', { token }),
  
  getPanicLogs: (token: string) =>
    api.fetch<any>('/panic-alerts', { token }),

  // Screening actions
  updateScreeningStatus: (token: string, id: string, status: string) =>
    api.fetch<any>(`/safeguarding/screening-submissions/${id}/status?status=${status}`, { token, method: 'PATCH' }),

  // Chat history
  getChatMessages: (token: string, chatId: string) =>
    api.fetch<any>(`/live-chat/rooms/${chatId}/messages`, { token }),

  // Safeguarding actions
  acknowledgeSafeguardingAlert: (token: string, alertId: string) =>
    api.fetch<any>(`/safeguarding-alerts/${alertId}/acknowledge`, { token, method: 'PATCH' }),
  
  resolveSafeguardingAlert: (token: string, alertId: string) =>
    api.fetch<any>(`/safeguarding-alerts/${alertId}/resolve`, { token, method: 'PATCH' }),
  
  getSafeguardingAlertDetail: (token: string, alertId: string) =>
    api.fetch<any>(`/safeguarding-alerts/${alertId}`, { token }),

  // App Usage Analytics
  getAppUsageStats: (token: string) =>
    api.fetch<any>('/analytics/usage', { token }),
  
  getLocationData: (token: string) =>
    api.fetch<any>('/analytics/locations', { token }),
  
  getAIChatStats: (token: string, days: number = 7) =>
    api.fetch<any>(`/ai-chat/stats?days=${days}`, { token }),

  // Settings
  getSettings: (token: string) =>
    api.fetch<any>('/settings', { token }),
  
  updateSettings: (token: string, settings: any) =>
    api.fetch<any>('/settings', { 
      token, 
      method: 'PUT',
      body: JSON.stringify(settings) 
    }),
  
  clearLogs: (token: string, logType: string) =>
    api.fetch<any>('/admin/clear-logs', { 
      token, 
      method: 'POST',
      body: JSON.stringify({ log_type: logType, confirm: true }) 
    }),

  // Governance
  getHazards: (token: string) =>
    api.fetch<any>('/governance/hazards', { token }),
  
  reviewHazard: (token: string, hazardId: string, reviewerId: string) =>
    api.fetch<any>(`/governance/hazards/${hazardId}/review?reviewer_id=${encodeURIComponent(reviewerId)}`, { 
      token, 
      method: 'POST' 
    }),

  getGovernanceKPIs: (token: string, days: number = 30) =>
    api.fetch<any>(`/governance/kpis?days=${days}`, { token }),
  
  getGovernanceIncidents: (token: string) =>
    api.fetch<any>('/governance/incidents', { token }),
  
  getPeerReports: (token: string, status: string = 'pending') =>
    api.fetch<any>(`/governance/peer-reports?status=${status}`, { token }),
  
  takeModerationAction: (token: string, reportId: string, action: string, moderatorId: string) =>
    api.fetch<any>(`/governance/peer-reports/${reportId}/action?action=${action}&moderator_id=${encodeURIComponent(moderatorId)}`, {
      token,
      method: 'PUT'
    }),

  getCSOApprovals: (token: string) =>
    api.fetch<any>('/governance/cso/approvals', { token }),
  
  processCSOApproval: (token: string, approvalId: string, approved: boolean, reviewerId: string, notes: string = '') =>
    api.fetch<any>(`/governance/cso/approvals/${approvalId}?approved=${approved}&reviewer_id=${encodeURIComponent(reviewerId)}&notes=${encodeURIComponent(notes)}`, {
      token,
      method: 'PUT'
    }),

  getGovernanceSummary: (token: string, period: string = '30d') =>
    api.fetch<any>(`/governance/summary-report?period=${period}`, { token }),
  
  getScheduledReports: (token: string) =>
    api.fetch<any>('/governance/scheduled-reports', { token }),
  
  addScheduledReport: (token: string, email: string, frequency: string) =>
    api.fetch<any>(`/governance/scheduled-reports?email=${encodeURIComponent(email)}&frequency=${frequency}&enabled=true`, {
      token,
      method: 'POST'
    }),
  
  deleteScheduledReport: (token: string, email: string) =>
    api.fetch<any>(`/governance/scheduled-reports/${encodeURIComponent(email)}`, {
      token,
      method: 'DELETE'
    }),
  
  emailReport: (token: string, email: string, period: string) =>
    api.fetch<any>(`/governance/summary-report/email?email=${encodeURIComponent(email)}&period=${period}`, {
      token,
      method: 'POST'
    }),
  
  exportGovernanceData: (token: string) =>
    api.fetch<any>('/governance/export?days=90', { token }),

  // Learning/AI Training
  getLearningStats: (token: string) =>
    api.fetch<any>('/learning/stats', { token }),
  
  getSafetyPatterns: (token: string, category: string = '', severity: string = '') => {
    let url = '/learning/patterns?is_active=true';
    if (category) url += `&category=${category}`;
    if (severity) url += `&severity=${severity}`;
    return api.fetch<any>(url, { token });
  },
  
  getLearningQueue: (token: string) =>
    api.fetch<any>('/learning/queue?status=pending', { token }),
  
  getApprovedLearnings: (token: string) =>
    api.fetch<any>('/learning/approved', { token }),
  
  getResponseFeedback: (token: string) =>
    api.fetch<any>('/learning/feedback?status=pending', { token }),
  
  deletePattern: (token: string, patternId: string) =>
    api.fetch<any>(`/learning/patterns/${patternId}`, { token, method: 'DELETE' }),
  
  reviewFeedback: (token: string, feedbackId: string, action: 'approve' | 'reject') =>
    api.fetch<any>(`/learning/feedback/${feedbackId}/review?action=${action}`, { token, method: 'POST' }),

  // Beta Testing
  getBetaStatus: (token: string) =>
    api.fetch<{ beta_enabled: boolean }>('/surveys/beta-enabled', { token }),
  
  setBetaStatus: (token: string, enabled: boolean) =>
    api.fetch<any>('/surveys/beta-enabled', {
      token,
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  
  getBetaStats: (token: string) =>
    api.fetch<any>('/surveys/stats', { token }),
  
  getBetaResponses: (token: string) =>
    api.fetch<any>('/surveys/responses?limit=50', { token }),
  
  // Time Tracking
  getTimeTrackingSummary: (token: string, month?: string) =>
    api.fetch<any>(`/timetracking/summary${month ? `?month=${month}` : ''}`, { token }),
  
  getTimeTrackingEntries: (token: string, limit: number = 20) =>
    api.fetch<any>(`/timetracking/entries?limit=${limit}`, { token }),
  
  getTimeTrackingCategories: (token: string) =>
    api.fetch<any>('/timetracking/categories', { token }),
  
  createTimeEntry: (token: string, data: { date: string; hours: number; minutes: number; category: string; description: string }) =>
    api.fetch<any>('/timetracking/entries', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  deleteTimeEntry: (token: string, id: string) =>
    api.fetch<any>(`/timetracking/entries/${id}`, {
      token,
      method: 'DELETE',
    }),
};
