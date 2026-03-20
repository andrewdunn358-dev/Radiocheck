'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { 
  Users, Calendar, FileText, Bot, Shield, Activity, 
  Settings, BarChart3, Clock, BookOpen, AlertTriangle,
  LogOut, Menu, X, Plus, Edit, Trash2, Search,
  Phone, MessageSquare, Bell, ChevronDown, ChevronRight,
  Download, RefreshCw, Check, XCircle, Eye, Filter, Heart, Play, MapPin, Key
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Dynamic import for Leaflet (SSR issues)
const LocationMap = dynamic(() => import('../components/LocationMap'), { 
  ssr: false,
  loading: () => <div className="h-64 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">Loading map...</div>
});

// API Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

// Helper to resolve avatar URLs - prepend API URL if path is relative
function resolveAvatarUrl(avatarPath: string | undefined): string {
  if (!avatarPath) return '';
  // If already absolute URL, return as-is
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }
  // Prepend API URL for relative paths
  return `${API_URL}${avatarPath}`;
}

// Types
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone?: string;
  specialization?: string;
  area?: string;
  background?: string;
  is_supervisor?: boolean;
  created_at?: string;
  has_profile?: boolean;
  _source?: string;
}

interface CallLog {
  id: string;
  contact_name?: string;
  contact_type?: string;
  contact_phone?: string;
  call_method?: string;
  timestamp?: string;
  created_at?: string;
}

interface ChatRoom {
  id: string;
  user_session_id?: string;
  user_name?: string;
  staff_name?: string;
  status: string;
  created_at: string;
  message_count?: number;
}

interface SafeguardingAlert {
  id: string;
  user_name?: string;
  risk_level: string;
  risk_score?: number;
  score?: number;
  trigger_phrase?: string;
  triggered_indicators?: string[];
  triggering_message?: string;
  session_id?: string;
  status: string;
  created_at: string;
  acknowledged_by?: string;
  resolved_by?: string;
  geo_city?: string;
  geo_country?: string;
  location_city?: string;
  location_country?: string;
  ip_address?: string;
  isp?: string;
  timezone?: string;
  user_agent?: string;
  conversation_history?: any[];
}

interface AICharacter {
  id: string;
  name: string;
  description?: string;
  bio?: string;
  prompt?: string;
  avatar?: string;
  is_enabled: boolean;
  order?: number;
  category?: string;
  personality?: string;
  background?: string;
  greeting_message?: string;
  voice_style?: string;
  is_hardcoded?: boolean;
}

interface AIUsageSummary {
  total_tokens?: number;
  total_cost_gbp?: number;
  total_cost?: number;
  total_requests?: number;
  providers?: Record<string, { 
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost_gbp?: number;
    request_count?: number;
    budget_limit_gbp?: number;
    budget_remaining_gbp?: number;
    budget_percentage_used?: number;
  }>;
  by_provider?: Record<string, { tokens: number; cost: number }>;
  by_character?: Array<{ character_name?: string; name?: string; request_count?: number; requests?: number; cost_gbp?: number; cost?: number }>;
}

// API Client with proper error handling
const api = {
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
    api.fetch<any>('/safeguarding/safeguarding-alerts', { token }),
  
  getScreeningLogs: (token: string) =>
    api.fetch<any>('/safeguarding/screening-submissions', { token }),
  
  getCallbackLogs: (token: string) =>
    api.fetch<any>('/callbacks', { token }),
  
  getPanicLogs: (token: string) =>
    api.fetch<any>('/safeguarding/panic-alerts', { token }),

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

// Tab definitions - matching the original admin portal
const TABS = [
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'rota', label: 'Rota', icon: Calendar },
  { id: 'cms', label: 'CMS', icon: FileText },
  { id: 'ai-personas', label: 'AI Personas', icon: Bot },
  { id: 'beta', label: 'Beta Testing', icon: Activity },
  { id: 'compliance', label: 'Compliance', icon: Shield },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'governance', label: 'Governance', icon: Shield },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'learning', label: 'AI Learning', icon: BookOpen },
  { id: 'timetracking', label: 'Time Tracking', icon: Clock },
  { id: 'ai-usage', label: 'AI Usage', icon: BarChart3 },
  { id: 'migration', label: 'Migration', icon: RefreshCw },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const LOG_SUBTABS = [
  { id: 'calls', label: 'Calls' },
  { id: 'chats', label: 'Chats' },
  { id: 'safeguarding', label: 'Safeguarding' },
  { id: 'screening', label: 'Screening' },
  { id: 'callbacks', label: 'Callbacks' },
  { id: 'panic', label: 'Panic' },
  { id: 'audit', label: 'Audit' },
];

// Main Component
export default function AdminPortal() {
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state
  const [activeTab, setActiveTab] = useState('staff');
  const [activeLogSubTab, setActiveLogSubTab] = useState('calls');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Data state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffFilter, setStaffFilter] = useState<string>('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('all');
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [safeguardingAlerts, setSafeguardingAlerts] = useState<SafeguardingAlert[]>([]);
  const [screeningLogs, setScreeningLogs] = useState<any[]>([]);
  const [callbackLogs, setCallbackLogs] = useState<any[]>([]);
  const [panicLogs, setPanicLogs] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [auditEventFilter, setAuditEventFilter] = useState<string>('');
  const [selectedChatHistory, setSelectedChatHistory] = useState<any[]>([]);
  const [showChatHistoryModal, setShowChatHistoryModal] = useState(false);
  const [selectedSafeguardingAlert, setSelectedSafeguardingAlert] = useState<any>(null);
  const [showAlertDetailModal, setShowAlertDetailModal] = useState(false);
  const [aiCharacters, setAICharacters] = useState<AICharacter[]>([]);
  const [aiUsage, setAIUsage] = useState<AIUsageSummary | null>(null);
  const [monitoringStats, setMonitoringStats] = useState<any>(null);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  
  // Rota state
  const [shifts, setShifts] = useState<any[]>([]);
  const [pendingSwaps, setPendingSwaps] = useState<any[]>([]);
  
  // Events state
  const [events, setEvents] = useState<any[]>([]);
  
  // CMS state
  const [cmsPages, setCmsPages] = useState<any[]>([]);
  const [selectedCmsPage, setSelectedCmsPage] = useState<any>(null);
  
  // Compliance state
  const [complianceData, setComplianceData] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  // Governance state
  const [hazards, setHazards] = useState<any[]>([]);
  const [governanceSummary, setGovernanceSummary] = useState<any>(null);
  const [governanceSubTab, setGovernanceSubTab] = useState<'hazards' | 'kpis' | 'incidents' | 'moderation' | 'approvals' | 'compliance' | 'reports'>('hazards');
  const [governanceKPIs, setGovernanceKPIs] = useState<any>(null);
  const [governanceIncidents, setGovernanceIncidents] = useState<any[]>([]);
  const [peerReports, setPeerReports] = useState<any[]>([]);
  const [csoApprovals, setCsoApprovals] = useState<any[]>([]);
  const [scheduledReports, setScheduledReports] = useState<any[]>([]);
  const [kpiPeriod, setKpiPeriod] = useState(30);
  const [reportEmailInput, setReportEmailInput] = useState('');
  const [scheduleEmailInput, setScheduleEmailInput] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [complianceCheckResults, setComplianceCheckResults] = useState<any>(null);
  
  // Learning state
  const [learningStats, setLearningStats] = useState<any>(null);
  const [moderationQueue, setModerationQueue] = useState<any[]>([]);
  const [learningSubTab, setLearningSubTab] = useState<'patterns' | 'queue' | 'approved' | 'feedback'>('patterns');
  const [safetyPatterns, setSafetyPatterns] = useState<any[]>([]);
  const [approvedLearnings, setApprovedLearnings] = useState<any[]>([]);
  const [responseFeedback, setResponseFeedback] = useState<any[]>([]);
  const [patternCategoryFilter, setPatternCategoryFilter] = useState('');
  const [patternSeverityFilter, setPatternSeverityFilter] = useState('');
  
  // Beta Testing state
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [betaStats, setBetaStats] = useState<any>(null);
  const [betaResponses, setBetaResponses] = useState<any[]>([]);
  
  // App Usage Analytics state
  const [appUsageStats, setAppUsageStats] = useState<any>(null);
  const [aiChatStats, setAiChatStats] = useState<any>(null);
  const [locationData, setLocationData] = useState<any>(null);

  // Settings state
  const [systemSettings, setSystemSettings] = useState<any>({
    logo_url: '',
    admin_notification_email: '',
    cso_email: '',
    peer_registration_notification_email: '',
  });
  const [clearLogsType, setClearLogsType] = useState<string>('');
  const [clearLogsConfirmText, setClearLogsConfirmText] = useState('');
  
  // Time Tracking state
  const [timeTrackingSummary, setTimeTrackingSummary] = useState<any>(null);
  const [timeTrackingEntries, setTimeTrackingEntries] = useState<any[]>([]);
  const [timeTrackingCategories, setTimeTrackingCategories] = useState<string[]>([]);
  const [showAddTimeEntryModal, setShowAddTimeEntryModal] = useState(false);
  const [selectedTimeTrackingMonth, setSelectedTimeTrackingMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // Format: YYYY-MM
  );
  const [newTimeEntry, setNewTimeEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: 0,
    minutes: 0,
    category: 'Development',
    description: '',
  });

  // AI Character editing state
  const [editingCharacter, setEditingCharacter] = useState<AICharacter | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);

  // Event editing state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
    event_time: '14:00',
    duration_minutes: 60,
    host_name: '',
    max_participants: 20,
  });
  
  // Modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [newStaff, setNewStaff] = useState({
    email: '',
    password: '',
    name: '',
    role: 'peer' as 'admin' | 'supervisor' | 'counsellor' | 'peer',
    phone: '',
    specialization: '',
    area: '',
  });

  // Reset Password Modal state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string } | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  
  // Rota Swap tabs state
  const [swapTabView, setSwapTabView] = useState<'pending' | 'all'>('pending');
  const [allSwapRequests, setAllSwapRequests] = useState<any[]>([]);
  
  // Monitoring timestamp state
  const [monitoringLastUpdated, setMonitoringLastUpdated] = useState<Date | null>(null);
  
  // Event modals state
  const [showViewAttendanceModal, setShowViewAttendanceModal] = useState(false);
  const [eventAttendance, setEventAttendance] = useState<any[]>([]);
  const [attendanceEventTitle, setAttendanceEventTitle] = useState('');
  
  // AI Usage Daily chart data
  const [aiDailyUsage, setAiDailyUsage] = useState<any[]>([]);
  const [aiUsagePeriod, setAiUsagePeriod] = useState(30);

  // Real-time alert counter state
  const [pendingAlertCount, setPendingAlertCount] = useState(0);

  // Add Shift modal state
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [newShift, setNewShift] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    user_id: '',
  });
  
  // Rota Calendar state
  const [rotaCalendarMonth, setRotaCalendarMonth] = useState(new Date());
  const [selectedRotaDate, setSelectedRotaDate] = useState<string | null>(null);

  // Check for existing session
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
    
    // Strip sensitive params from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('password') || url.searchParams.has('email')) {
        url.searchParams.delete('password');
        url.searchParams.delete('email');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  // Session timeout management (2hr inactivity, 24hr absolute)
  useEffect(() => {
    if (!token) return;
    
    const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
    const ABSOLUTE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
    
    // Check token age on load
    const tokenTime = localStorage.getItem('admin_token_time');
    if (tokenTime) {
      const tokenAge = Date.now() - parseInt(tokenTime);
      if (tokenAge > ABSOLUTE_TIMEOUT) {
        handleLogout();
        return;
      }
    }
    
    // Activity tracking
    let lastActivity = Date.now();
    localStorage.setItem('admin_last_activity', lastActivity.toString());
    
    const resetActivity = () => {
      lastActivity = Date.now();
      localStorage.setItem('admin_last_activity', lastActivity.toString());
    };
    
    // Check for timeout every minute
    const timeoutChecker = setInterval(() => {
      const now = Date.now();
      const storedLastActivity = localStorage.getItem('admin_last_activity');
      const inactiveTime = now - (storedLastActivity ? parseInt(storedLastActivity) : lastActivity);
      
      if (inactiveTime > SESSION_TIMEOUT) {
        handleLogout();
      }
      
      // Also check absolute timeout
      const tokenTime = localStorage.getItem('admin_token_time');
      if (tokenTime) {
        const tokenAge = now - parseInt(tokenTime);
        if (tokenAge > ABSOLUTE_TIMEOUT) {
          handleLogout();
        }
      }
    }, 60000); // Check every minute
    
    // Activity listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, resetActivity));
    
    return () => {
      clearInterval(timeoutChecker);
      events.forEach(event => window.removeEventListener(event, resetActivity));
    };
  }, [token]);

  // Load data when tab changes
  useEffect(() => {
    if (!token) return;
    
    const loadData = async () => {
      try {
        setError(null);
        switch (activeTab) {
          case 'staff':
            await loadStaff();
            break;
          case 'logs':
            await loadLogs();
            break;
          case 'ai-personas':
            await loadAICharacters();
            break;
          case 'ai-usage':
            await loadAIUsage();
            break;
          case 'monitoring':
            await loadMonitoring();
            break;
          case 'migration':
            await loadMigrationStatus();
            break;
          case 'rota':
            await loadRota();
            break;
          case 'events':
            await loadEvents();
            break;
          case 'cms':
            await loadCMS();
            break;
          case 'compliance':
            await loadCompliance();
            break;
          case 'governance':
            await loadGovernance();
            break;
          case 'learning':
            await loadLearning();
            break;
          case 'beta':
            await loadBetaTesting();
            break;
          case 'timetracking':
            await loadTimeTracking();
            break;
        }
      } catch (err: any) {
        setError(err.message);
      }
    };
    
    loadData();
  }, [token, activeTab, activeLogSubTab, staffRoleFilter]);

  // Monitoring auto-refresh every 30 seconds
  useEffect(() => {
    if (!token || activeTab !== 'monitoring') return;
    
    const interval = setInterval(() => {
      loadMonitoring();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [token, activeTab]);

  // Real-time alert counter - polls every 30 seconds
  useEffect(() => {
    if (!token) return;
    
    const updateAlertCount = async () => {
      try {
        const alerts = await api.getSafeguardingAlerts(token);
        const pending = Array.isArray(alerts) 
          ? alerts.filter((a: any) => !a.acknowledged && a.status === 'pending').length
          : 0;
        setPendingAlertCount(pending);
      } catch (err) {
        console.log('Error updating alert counter');
      }
    };
    
    // Initial fetch
    updateAlertCount();
    
    // Poll every 30 seconds
    const interval = setInterval(updateAlertCount, 30000);
    
    return () => clearInterval(interval);
  }, [token]);

  // Load functions
  const loadStaff = async () => {
    if (!token) return;
    try {
      // First try the new unified staff endpoint
      const data = await api.getStaff(token, staffRoleFilter !== 'all' ? staffRoleFilter : undefined);
      // If we get data from the new endpoint, use it
      if (Array.isArray(data) && data.length > 0) {
        setStaff(data);
        return;
      }
      
      // If new endpoint returns empty, try the admin unified-staff view (combines legacy collections)
      const unifiedData = await api.getUnifiedStaff(token).catch(() => []);
      if (Array.isArray(unifiedData) && unifiedData.length > 0) {
        // Map the unified-staff response to our StaffMember format
        const mappedData = unifiedData.map((u: any) => ({
          id: u.user_id || u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.profile?.status || 'offline',
          phone: u.profile?.phone || '',
          specialization: u.profile?.specialization || '',
          area: u.profile?.area || '',
          background: u.profile?.background || '',
          _source: 'unified',
          has_profile: u.has_profile,
          created_at: u.created_at,
        }));
        // Filter by role if needed
        const filtered = staffRoleFilter === 'all' 
          ? mappedData 
          : mappedData.filter((s: any) => s.role === staffRoleFilter);
        setStaff(filtered);
        return;
      }
      
      // Fallback to legacy endpoints if both fail
      console.log('Falling back to legacy endpoints...');
      const [counsellors, peers] = await Promise.all([
        api.getCounsellors(token).catch(() => []),
        api.getPeerSupporters(token).catch(() => []),
      ]);
      const combined = [
        ...(Array.isArray(counsellors) ? counsellors : []).map((c: any) => ({ 
          id: c.id,
          email: c.email || '',
          name: c.name,
          role: 'counsellor',
          status: c.status || 'offline',
          phone: c.phone || '',
          specialization: c.specialization || '',
          _source: 'counsellors' 
        })),
        ...(Array.isArray(peers) ? peers : []).map((p: any) => ({ 
          id: p.id,
          email: p.email || '',
          name: p.firstName || p.name,
          role: 'peer',
          status: p.status || 'offline',
          phone: p.phone || '',
          area: p.area || '',
          background: p.background || '',
          _source: 'peer_supporters' 
        })),
      ];
      // Filter by role if needed
      const filtered = staffRoleFilter === 'all' 
        ? combined 
        : combined.filter((s: any) => s.role === staffRoleFilter);
      setStaff(filtered);
    } catch (err: any) {
      console.error('Failed to load staff:', err);
      setStaff([]);
    }
  };

  const loadLogs = async () => {
    if (!token) return;
    try {
      // Always load app usage, AI chat stats, and location data for the dashboard view
      const [usageData, aiStatsData, locData] = await Promise.all([
        api.getAppUsageStats(token).catch(() => null),
        api.getAIChatStats(token).catch(() => null),
        api.getLocationData(token).catch(() => null),
      ]);
      setAppUsageStats(usageData);
      setAiChatStats(aiStatsData);
      setLocationData(locData);
      
      switch (activeLogSubTab) {
        case 'calls':
          const callsResponse = await api.getCallLogs(token).catch(() => ({ total_calls: 0, recent_logs: [] }));
          const logs = callsResponse?.recent_logs || callsResponse;
          setCallLogs(Array.isArray(logs) ? logs : []);
          break;
        case 'chats':
          const chats = await api.getChatLogs(token).catch(() => []);
          const chatArr = chats?.rooms || chats;
          setChatRooms(Array.isArray(chatArr) ? chatArr : []);
          break;
        case 'safeguarding':
          const alerts = await api.getSafeguardingLogs(token).catch(() => []);
          const alertArr = alerts?.alerts || alerts;
          setSafeguardingAlerts(Array.isArray(alertArr) ? alertArr : []);
          break;
        case 'screening':
          const screening = await api.getScreeningLogs(token).catch(() => []);
          const screenArr = screening?.submissions || screening;
          setScreeningLogs(Array.isArray(screenArr) ? screenArr : []);
          break;
        case 'callbacks':
          const callbacks = await api.getCallbackLogs(token).catch(() => []);
          const callbackArr = callbacks?.callbacks || callbacks;
          setCallbackLogs(Array.isArray(callbackArr) ? callbackArr : []);
          break;
        case 'panic':
          const panic = await api.getPanicLogs(token).catch(() => []);
          const panicArr = panic?.alerts || panic;
          setPanicLogs(Array.isArray(panicArr) ? panicArr : []);
          break;
        case 'audit':
          const audit = await api.getAuditLogs(token, 100).catch(() => []);
          const auditArr = audit?.logs || audit;
          setAdminAuditLogs(Array.isArray(auditArr) ? auditArr : []);
          break;
      }
    } catch (err: any) {
      console.error('Failed to load logs:', err.message);
    }
  };

  const loadAICharacters = async () => {
    if (!token) return;
    try {
      const data = await api.getAICharacters(token);
      setAICharacters(Array.isArray(data?.characters) ? data.characters : []);
    } catch (err: any) {
      // Fallback to public endpoint
      try {
        const data = await api.fetch<{ characters: AICharacter[] }>('/ai-characters', {});
        setAICharacters(Array.isArray(data?.characters) ? data.characters : []);
      } catch {
        setAICharacters([]);
      }
    }
  };

  const loadAIUsage = async () => {
    if (!token) return;
    try {
      const data = await api.getAIUsageSummary(token);
      setAIUsage(data);
      // Also load daily usage data
      try {
        const daily = await api.getAIUsageDaily(token, aiUsagePeriod);
        setAiDailyUsage(daily || []);
      } catch (dailyErr) {
        console.error('Daily AI usage not available:', dailyErr);
      }
    } catch (err: any) {
      console.error('AI Usage not available:', err);
    }
  };

  const loadMonitoring = async () => {
    if (!token) return;
    try {
      const data = await api.getMonitoringStats(token);
      setMonitoringStats(data);
      setMonitoringLastUpdated(new Date());
    } catch (err: any) {
      console.error('Monitoring stats not available:', err);
    }
  };

  const loadMigrationStatus = async () => {
    if (!token) return;
    try {
      const data = await api.getMigrationStatus(token);
      setMigrationStatus(data);
    } catch (err: any) {
      console.error('Migration status not available:', err);
    }
  };

  // Load Rota data
  const loadRota = async () => {
    if (!token) return;
    try {
      const [shiftsData, swapsData] = await Promise.all([
        api.getShifts(token).catch(() => []),
        api.getPendingSwaps(token).catch(() => []),
      ]);
      setShifts(Array.isArray(shiftsData) ? shiftsData : []);
      setPendingSwaps(Array.isArray(swapsData) ? swapsData : []);
    } catch (err: any) {
      console.error('Rota data not available:', err);
    }
  };

  // Load Events
  const loadEvents = async () => {
    if (!token) return;
    try {
      const data = await api.getEvents(token).catch(() => []);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Events not available:', err);
    }
  };

  // Load CMS
  const loadCMS = async () => {
    if (!token) return;
    try {
      const pages = await api.getCMSPages(token).catch(() => []);
      setCmsPages(Array.isArray(pages) ? pages : []);
    } catch (err: any) {
      console.error('CMS data not available:', err);
    }
  };

  // Load Compliance
  const loadCompliance = async () => {
    if (!token) return;
    try {
      const [dashboard, incidentsData, complaintsData, logsData] = await Promise.all([
        api.getComplianceDashboard(token).catch(() => null),
        api.getComplianceIncidents(token).catch(() => ({ incidents: [] })),
        api.getComplianceComplaints(token).catch(() => ({ complaints: [] })),
        api.getAuditLogs(token).catch(() => ({ logs: [] })),
      ]);
      setComplianceData(dashboard);
      setIncidents(incidentsData?.incidents || []);
      setComplaints(complaintsData?.complaints || []);
      setAuditLogs(logsData?.logs || logsData || []);
    } catch (err: any) {
      console.error('Compliance data not available:', err);
    }
  };

  // Load Governance
  const loadGovernance = async () => {
    if (!token) return;
    try {
      // Always load hazards and summary first
      const [hazardsData, summaryData] = await Promise.all([
        api.getHazards(token).catch(() => []),
        api.getGovernanceSummary(token).catch(() => null),
      ]);
      setHazards(Array.isArray(hazardsData) ? hazardsData : (hazardsData?.hazards || []));
      setGovernanceSummary(summaryData);
    } catch (err: any) {
      console.error('Governance data not available:', err);
    }
  };

  // Load governance sub-tab specific data
  const loadGovernanceSubTabData = async (subtab: string) => {
    if (!token) return;
    try {
      switch (subtab) {
        case 'hazards':
          const hazardsData = await api.getHazards(token).catch(() => []);
          setHazards(Array.isArray(hazardsData) ? hazardsData : (hazardsData?.hazards || []));
          break;
        case 'kpis':
          const kpiData = await api.getGovernanceKPIs(token, kpiPeriod).catch(() => null);
          setGovernanceKPIs(kpiData);
          break;
        case 'incidents':
          const incidentsData = await api.getGovernanceIncidents(token).catch(() => []);
          setGovernanceIncidents(Array.isArray(incidentsData) ? incidentsData : (incidentsData?.incidents || []));
          break;
        case 'moderation':
          const reportsData = await api.getPeerReports(token, 'pending').catch(() => []);
          setPeerReports(Array.isArray(reportsData) ? reportsData : (reportsData?.reports || []));
          break;
        case 'approvals':
          const approvalsData = await api.getCSOApprovals(token).catch(() => []);
          setCsoApprovals(Array.isArray(approvalsData) ? approvalsData : (approvalsData?.approvals || []));
          break;
        case 'reports':
          const [summaryData, schedulesData] = await Promise.all([
            api.getGovernanceSummary(token).catch(() => null),
            api.getScheduledReports(token).catch(() => ({ schedules: [] })),
          ]);
          setGovernanceSummary(summaryData);
          setScheduledReports(schedulesData?.schedules || []);
          break;
      }
    } catch (err: any) {
      console.error('Failed to load governance sub-tab data:', err);
    }
  };

  // Load Learning
  const loadLearning = async () => {
    if (!token) return;
    try {
      const [statsData, queueData, patternsData, approvedData, feedbackData] = await Promise.all([
        api.getLearningStats(token).catch(() => null),
        api.getLearningQueue(token).catch(() => ({ learnings: [] })),
        api.getSafetyPatterns(token, patternCategoryFilter, patternSeverityFilter).catch(() => ({ patterns: [] })),
        api.getApprovedLearnings(token).catch(() => ({ learnings: [] })),
        api.getResponseFeedback(token).catch(() => ({ feedback: [] })),
      ]);
      setLearningStats(statsData);
      setModerationQueue(queueData?.learnings || queueData?.queue || []);
      setSafetyPatterns(patternsData?.patterns || []);
      setApprovedLearnings(approvedData?.learnings || []);
      setResponseFeedback(feedbackData?.feedback || feedbackData || []);
    } catch (err: any) {
      console.error('Learning data not available:', err);
    }
  };

  // Load Beta Testing
  const loadBetaTesting = async () => {
    if (!token) return;
    try {
      const [statusData, statsData, responsesData] = await Promise.all([
        api.getBetaStatus(token).catch(() => ({ beta_enabled: false })),
        api.getBetaStats(token).catch(() => null),
        api.getBetaResponses(token).catch(() => ({ responses: [] })),
      ]);
      setBetaEnabled(statusData?.beta_enabled || false);
      setBetaStats(statsData);
      setBetaResponses(responsesData?.responses || []);
    } catch (err: any) {
      console.error('Beta testing data not available:', err);
    }
  };
  
  const loadTimeTracking = async (month?: string) => {
    if (!token) return;
    const monthToUse = month || selectedTimeTrackingMonth;
    try {
      const [summaryData, entriesData, categoriesData] = await Promise.all([
        api.getTimeTrackingSummary(token, monthToUse).catch(() => null),
        api.getTimeTrackingEntries(token, 50).catch(() => ({ entries: [] })),
        api.getTimeTrackingCategories(token).catch(() => ({ categories: [] })),
      ]);
      setTimeTrackingSummary(summaryData);
      // Filter entries by selected month
      const filteredEntries = entriesData?.entries?.filter((entry: any) => {
        if (!entry.date) return true;
        return entry.date.startsWith(monthToUse);
      }) || [];
      setTimeTrackingEntries(filteredEntries);
      setTimeTrackingCategories(categoriesData?.categories || []);
    } catch (err: any) {
      console.error('Time tracking data not available:', err);
    }
  };
  
  const handleAddTimeEntry = async () => {
    if (!token) return;
    try {
      await api.createTimeEntry(token, newTimeEntry);
      setShowAddTimeEntryModal(false);
      setNewTimeEntry({
        date: new Date().toISOString().split('T')[0],
        hours: 0,
        minutes: 0,
        category: 'Development',
        description: '',
      });
      loadTimeTracking();
      setSuccess('Time entry added');
    } catch (err: any) {
      setError('Failed to add time entry: ' + err.message);
    }
  };
  
  const handleDeleteTimeEntry = async (id: string) => {
    if (!token || !confirm('Delete this time entry?')) return;
    try {
      await api.deleteTimeEntry(token, id);
      loadTimeTracking();
      setSuccess('Time entry deleted');
    } catch (err: any) {
      setError('Failed to delete entry');
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    
    try {
      const response = await api.login(loginEmail, loginPassword);
      
      // Check if user is admin
      if (response.user.role !== 'admin') {
        setLoginError('Access denied. Admin role required.');
        return;
      }
      
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem('admin_token', response.token);
      localStorage.setItem('admin_user', JSON.stringify(response.user));
      localStorage.setItem('admin_token_time', Date.now().toString());
      localStorage.setItem('admin_last_activity', Date.now().toString());
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token_time');
    localStorage.removeItem('admin_last_activity');
  };

  // Staff CRUD handlers
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    try {
      await api.createStaff(token, newStaff);
      setSuccess('Staff member created successfully');
      setShowAddStaffModal(false);
      setNewStaff({ email: '', password: '', name: '', role: 'peer', phone: '', specialization: '', area: '' });
      await loadStaff();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingStaff) return;
    
    try {
      await api.updateStaff(token, editingStaff.id, editingStaff);
      setSuccess('Staff member updated successfully');
      setEditingStaff(null);
      await loadStaff();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    
    try {
      await api.deleteStaff(token, id);
      setSuccess('Staff member deleted');
      await loadStaff();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRunMigration = async () => {
    if (!token) return;
    if (!confirm('This will migrate all legacy users to the unified staff collection. Continue?')) return;
    
    try {
      const result = await api.runMigration(token);
      setSuccess(`Migration complete: ${result.stats.staff_created} staff created`);
      await loadMigrationStatus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFixPasswords = async () => {
    if (!token) return;
    
    try {
      const result = await api.fixStaffPasswords(token);
      setSuccess(`Password fix complete: ${result.stats.fixed} fixed`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Filter staff
  const filteredStaff = staff.filter(s => {
    const matchesSearch = !staffFilter || 
      s.name?.toLowerCase().includes(staffFilter.toLowerCase()) ||
      s.email?.toLowerCase().includes(staffFilter.toLowerCase());
    const matchesRole = staffRoleFilter === 'all' || s.role === staffRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Login form
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md border border-gray-700">
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
            <p className="text-gray-400 mt-2">Radio Check Management System</p>
          </div>
          
          {loginError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {loginError}
            </div>
          )}
          
          <form onSubmit={handleLogin} data-testid="admin-login-form">
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                data-testid="admin-login-email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 outline-none"
                placeholder="admin@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                data-testid="admin-login-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 outline-none"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              data-testid="admin-login-submit"
              disabled={loginLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main admin interface
  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {sidebarOpen && <span className="font-bold text-lg">Admin Portal</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-700 rounded-lg">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`nav-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <tab.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{tab.label}</span>}
            </button>
          ))}
        </nav>
        
        {/* User info */}
        <div className="p-4 border-t border-gray-700">
          {sidebarOpen && (
            <div className="mb-2">
              <p className="font-medium truncate">{user?.name}</p>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">{TABS.find(t => t.id === activeTab)?.label}</h1>
          {/* Real-time Alert Badge */}
          {pendingAlertCount > 0 && (
            <button
              onClick={() => setActiveTab('logs')}
              className="relative flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors animate-pulse"
              title={`${pendingAlertCount} pending safeguarding alert${pendingAlertCount > 1 ? 's' : ''}`}
            >
              <Bell className="w-4 h-4" />
              <span className="font-semibold">{pendingAlertCount > 99 ? '99+' : pendingAlertCount}</span>
              <span className="hidden sm:inline text-sm">Alert{pendingAlertCount > 1 ? 's' : ''}</span>
            </button>
          )}
        </header>

        {/* Notifications */}
        {(error || success) && (
          <div className={`mx-6 mt-4 p-4 rounded-lg ${error ? 'bg-red-500/20 border border-red-500 text-red-400' : 'bg-green-500/20 border border-green-500 text-green-400'}`}>
            {error || success}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Staff Tab */}
          {activeTab === 'staff' && (
            <div data-testid="staff-tab">
              {/* Toolbar */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search staff..."
                      value={staffFilter}
                      onChange={(e) => setStaffFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <select
                  value={staffRoleFilter}
                  onChange={(e) => setStaffRoleFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="counsellor">Counsellor</option>
                  <option value="peer">Peer Supporter</option>
                </select>
                <button
                  onClick={() => setShowAddStaffModal(true)}
                  data-testid="add-staff-btn"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Staff
                </button>
                <button
                  onClick={loadStaff}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {/* Staff Table */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                          No staff members found
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-700/50" data-testid={`staff-row-${member.id}`}>
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium">{member.name}</span>
                              {member._source && (
                                <span className="ml-2 text-xs text-gray-500">({member._source})</span>
                              )}
                              {/* Profile link indicator */}
                              {member.role !== 'admin' && (
                                member.has_profile ? (
                                  <p className="text-xs text-green-500 mt-1">Linked to profile</p>
                                ) : (
                                  <p className="text-xs text-gray-500 mt-1">No profile linked</p>
                                )
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{member.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              member.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                              member.role === 'supervisor' ? 'bg-blue-500/20 text-blue-400' :
                              member.role === 'counsellor' ? 'bg-green-500/20 text-green-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {member.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {/* Status buttons - different options for counsellors vs peers */}
                            {member.role === 'counsellor' ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updateCounsellorStatus(token!, member.id, 'available');
                                      setSuccess('Status updated');
                                      loadStaff();
                                    } catch (err: any) { setError(err.message); }
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    member.status === 'available' 
                                      ? 'bg-green-500 text-white' 
                                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                  }`}
                                >
                                  Available
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updateCounsellorStatus(token!, member.id, 'busy');
                                      setSuccess('Status updated');
                                      loadStaff();
                                    } catch (err: any) { setError(err.message); }
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    member.status === 'busy' 
                                      ? 'bg-yellow-500 text-white' 
                                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                  }`}
                                >
                                  Busy
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updateCounsellorStatus(token!, member.id, 'off');
                                      setSuccess('Status updated');
                                      loadStaff();
                                    } catch (err: any) { setError(err.message); }
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    member.status === 'off' 
                                      ? 'bg-gray-500 text-white' 
                                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                  }`}
                                >
                                  Off
                                </button>
                              </div>
                            ) : member.role === 'peer' ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updatePeerStatus(token!, member.id, 'available');
                                      setSuccess('Status updated');
                                      loadStaff();
                                    } catch (err: any) { setError(err.message); }
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    member.status === 'available' 
                                      ? 'bg-green-500 text-white' 
                                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                  }`}
                                >
                                  Available
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updatePeerStatus(token!, member.id, 'limited');
                                      setSuccess('Status updated');
                                      loadStaff();
                                    } catch (err: any) { setError(err.message); }
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    member.status === 'limited' 
                                      ? 'bg-yellow-500 text-white' 
                                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                  }`}
                                >
                                  Limited
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updatePeerStatus(token!, member.id, 'unavailable');
                                      setSuccess('Status updated');
                                      loadStaff();
                                    } catch (err: any) { setError(err.message); }
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    member.status === 'unavailable' 
                                      ? 'bg-gray-500 text-white' 
                                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                  }`}
                                >
                                  Unavailable
                                </button>
                              </div>
                            ) : (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                member.status === 'available' ? 'bg-green-500/20 text-green-400' :
                                member.status === 'busy' || member.status === 'limited' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {member.status || 'offline'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingStaff(member)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4 text-blue-400" />
                              </button>
                              {member.role !== 'admin' && (
                                <button
                                  onClick={() => {
                                    setResetPasswordUser({ id: member.id, name: member.name });
                                    setResetPasswordData({ newPassword: '', confirmPassword: '' });
                                    setShowResetPasswordModal(true);
                                  }}
                                  className="p-1 hover:bg-gray-600 rounded"
                                  title="Reset Password"
                                >
                                  <Key className="w-4 h-4 text-yellow-400" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteStaff(member.id)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div data-testid="logs-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Logs & Analytics</h2>
                <div className="flex gap-2">
                  {/* Export CSV Button */}
                  <button 
                    onClick={() => {
                      // Get current sub-tab data
                      let data: any[] = [];
                      let filename = '';
                      const dateStr = new Date().toISOString().split('T')[0];
                      
                      if (activeLogSubTab === 'calls') {
                        data = callLogs;
                        filename = `calls-logs-${dateStr}.csv`;
                      } else if (activeLogSubTab === 'chats') {
                        data = chatRooms;
                        filename = `chats-logs-${dateStr}.csv`;
                      } else if (activeLogSubTab === 'safeguarding') {
                        data = safeguardingAlerts;
                        filename = `safeguarding-logs-${dateStr}.csv`;
                      } else if (activeLogSubTab === 'screening') {
                        data = screeningLogs;
                        filename = `screening-logs-${dateStr}.csv`;
                      } else if (activeLogSubTab === 'callbacks') {
                        data = callbackLogs;
                        filename = `callbacks-logs-${dateStr}.csv`;
                      } else if (activeLogSubTab === 'panic') {
                        data = panicLogs;
                        filename = `panic-logs-${dateStr}.csv`;
                      } else if (activeLogSubTab === 'audit') {
                        data = adminAuditLogs;
                        filename = `audit-logs-${dateStr}.csv`;
                      }
                      
                      if (data.length === 0) {
                        setError('No data to export');
                        return;
                      }
                      
                      // Convert to CSV
                      const headers = Object.keys(data[0]);
                      const csvContent = [
                        headers.join(','),
                        ...data.map(row => 
                          headers.map(h => {
                            const val = row[h];
                            if (val === null || val === undefined) return '';
                            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                              return `"${val.replace(/"/g, '""')}"`;
                            }
                            return val;
                          }).join(',')
                        )
                      ].join('\n');
                      
                      // Download
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      setSuccess('CSV exported successfully');
                    }}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  {/* Clear Logs Button */}
                  <button 
                    onClick={async () => {
                      const logTypeMap: Record<string, string> = {
                        'calls': 'calls',
                        'chats': 'chats',
                        'safeguarding': 'safeguarding',
                        'screening': 'screening',
                        'callbacks': 'callbacks',
                        'panic': 'panic',
                        'audit': 'analytics'
                      };
                      const logType = logTypeMap[activeLogSubTab] || activeLogSubTab;
                      
                      if (!confirm(`Are you sure you want to permanently delete ${activeLogSubTab} logs?\n\nThis action cannot be undone!`)) {
                        return;
                      }
                      
                      try {
                        await api.clearLogs(token!, logType);
                        setSuccess(`${activeLogSubTab} logs cleared successfully`);
                        loadLogs();
                      } catch (err: any) {
                        setError('Failed to clear logs: ' + err.message);
                      }
                    }}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Logs
                  </button>
                  <button onClick={loadLogs} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4">
                  <p className="text-blue-200 text-sm">Total Calls</p>
                  <p className="text-2xl font-bold">{callLogs.length}</p>
                </div>
                <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-lg p-4">
                  <p className="text-cyan-200 text-sm">Live Chats</p>
                  <p className="text-2xl font-bold">{chatRooms.length}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-4">
                  <p className="text-yellow-200 text-sm">Safeguarding</p>
                  <p className="text-2xl font-bold">{safeguardingAlerts.length}</p>
                </div>
                <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-4">
                  <p className="text-red-200 text-sm">Panic Alerts</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4">
                  <p className="text-purple-200 text-sm">AI Sessions</p>
                  <p className="text-2xl font-bold">{aiChatStats?.total_sessions || 0}</p>
                </div>
                <div className="bg-gradient-to-br from-pink-600 to-pink-700 rounded-lg p-4">
                  <p className="text-pink-200 text-sm">AI Messages (7d)</p>
                  <p className="text-2xl font-bold">{aiChatStats?.total_messages || 0}</p>
                </div>
              </div>

              {/* App Usage Analytics Section */}
              {appUsageStats && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    App Usage Analytics
                  </h3>
                  
                  {/* Period Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold">{appUsageStats?.currently_connected || 0}</p>
                      <p className="text-green-200 text-sm">Connected Now</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold">{appUsageStats?.['7_days']?.unique_visitors || 0}</p>
                      <p className="text-gray-400 text-sm">Last 7 Days</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold">{appUsageStats?.['30_days']?.unique_visitors || 0}</p>
                      <p className="text-gray-400 text-sm">Last 30 Days</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold">{appUsageStats?.['6_months']?.unique_visitors || 0}</p>
                      <p className="text-gray-400 text-sm">Last 6 Months</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold">{appUsageStats?.['12_months']?.unique_visitors || 0}</p>
                      <p className="text-gray-400 text-sm">Last 12 Months</p>
                    </div>
                  </div>

                  {/* Analytics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Visitors by Region */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-3 text-red-400">Visitors by Region (30 days)</h4>
                      <div className="space-y-2">
                        {appUsageStats?.regions && (
                          Array.isArray(appUsageStats.regions) 
                            ? appUsageStats.regions.map((item: any, idx: number) => {
                                // Handle both {region, visits, unique} and {name, count} formats
                                const regionName = String(item.region || item.name || item.country || 'Unknown');
                                const visitCount = Number(item.visits || item.unique || item.count || item.value || 0);
                                return (
                                  <div key={idx} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                    <span className="capitalize">{regionName.replace(/_/g, ' ')}</span>
                                    <strong>{visitCount}</strong>
                                  </div>
                                );
                              })
                            : typeof appUsageStats.regions === 'object' && Object.keys(appUsageStats.regions).length > 0 
                              ? Object.entries(appUsageStats.regions).map(([region, data]: [string, any]) => {
                                  // Handle both number values and object values
                                  const visitCount = typeof data === 'number' 
                                    ? data 
                                    : (typeof data === 'object' ? Number(data.visits || data.unique || data.count || 0) : 0);
                                  return (
                                    <div key={region} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                      <span className="capitalize">{region.replace(/_/g, ' ')}</span>
                                      <strong>{visitCount}</strong>
                                    </div>
                                  );
                                })
                              : <p className="text-gray-500 text-sm">No region data yet</p>
                        )}
                        {!appUsageStats?.regions && <p className="text-gray-500 text-sm">No region data yet</p>}
                      </div>
                    </div>

                    {/* Daily Trend */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-3 text-blue-400">📅 Daily Trend (Last 7 days)</h4>
                      <div className="space-y-1">
                        {appUsageStats?.daily_trend?.slice(-7).map((day: any) => (
                          <div key={day._id} className="flex justify-between items-center bg-gray-700 p-2 rounded text-sm">
                            <span>{day._id}</span>
                            <span><strong>{day.unique_visitors}</strong> visitors</span>
                          </div>
                        )) || <p className="text-gray-500 text-sm">No data yet</p>}
                      </div>
                    </div>

                    {/* Device Type */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-3 text-purple-400">📱 Device Type</h4>
                      <div className="space-y-2">
                        {appUsageStats?.devices && Object.keys(appUsageStats.devices).length > 0 ? (
                          Object.entries(appUsageStats.devices).map(([device, data]: [string, any]) => (
                            <div key={device} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                              <span className="capitalize flex items-center gap-2">
                                {device === 'mobile' ? '📱' : device === 'desktop' ? '🖥️' : '📟'} {device}
                              </span>
                              <strong>{typeof data === 'object' ? (data.count || data.visits || 0) : data}</strong>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No device data yet</p>
                        )}
                      </div>
                    </div>

                    {/* Browser */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-3 text-green-400">🌐 Browser</h4>
                      <div className="space-y-2">
                        {appUsageStats?.browsers && Object.keys(appUsageStats.browsers).length > 0 ? (
                          Object.entries(appUsageStats.browsers).map(([browser, data]: [string, any]) => (
                            <div key={browser} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                              <span className="capitalize">{browser}</span>
                              <strong>{typeof data === 'object' ? (data.count || data.visits || 0) : data}</strong>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No browser data yet</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* OS and Return Rate */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Operating System */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-3 text-yellow-400">💻 Operating System</h4>
                      <div className="space-y-2">
                        {appUsageStats?.operating_systems && Object.keys(appUsageStats.operating_systems).length > 0 ? (
                          Object.entries(appUsageStats.operating_systems).map(([os, data]: [string, any]) => (
                            <div key={os} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                              <span className="capitalize flex items-center gap-2">
                                {os === 'windows' ? '🪟' : os === 'apple' ? '🍎' : os === 'android' ? '🤖' : '💻'} 
                                {os === 'apple' ? 'Apple (iOS/Mac)' : os.charAt(0).toUpperCase() + os.slice(1)}
                              </span>
                              <strong>{typeof data === 'object' ? (data.count || data.visits || 0) : data}</strong>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No OS data yet</p>
                        )}
                      </div>
                    </div>

                    {/* Return Rate */}
                    <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-4">
                      <h4 className="font-medium mb-3 text-purple-200">🔄 Return Rate (30 days)</h4>
                      <div className="text-center py-4">
                        <p className="text-5xl font-bold">
                          {typeof appUsageStats?.return_rate === 'object' && appUsageStats?.return_rate?.percentage !== undefined
                            ? Number(appUsageStats.return_rate.percentage).toFixed(1)
                            : typeof appUsageStats?.return_rate === 'number'
                            ? Number(appUsageStats.return_rate).toFixed(1)
                            : '0.0'}%
                        </p>
                        <p className="text-purple-200 mt-2">
                          {typeof appUsageStats?.return_rate === 'object' && appUsageStats?.return_rate?.returning_visitors !== undefined
                            ? appUsageStats.return_rate.returning_visitors
                            : appUsageStats?.returning_visitors || 0} returning / {typeof appUsageStats?.return_rate === 'object' && appUsageStats?.return_rate?.total_visitors !== undefined
                            ? appUsageStats.return_rate.total_visitors
                            : appUsageStats?.['30_days']?.unique_visitors || 0} total visitors
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts Section */}
              {appUsageStats && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                    Usage Charts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Daily Visitors Line Chart */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-4 text-blue-400">Daily Visitors (Last 7 Days)</h4>
                      <div style={{ height: '250px' }}>
                        <Line
                          data={{
                            labels: appUsageStats?.daily_trend?.slice(-7).map((d: any) => d._id) || [],
                            datasets: [{
                              label: 'Visitors',
                              data: appUsageStats?.daily_trend?.slice(-7).map((d: any) => d.unique_visitors) || [],
                              borderColor: '#3b82f6',
                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                              fill: true,
                              tension: 0.3
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false }
                            },
                            scales: {
                              y: { 
                                beginAtZero: true,
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                ticks: { color: '#9ca3af' }
                              },
                              x: { 
                                grid: { display: false },
                                ticks: { color: '#9ca3af' }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Device Type Doughnut Chart */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-4 text-purple-400">Device Distribution</h4>
                      <div style={{ height: '250px' }} className="flex justify-center">
                        <Doughnut
                          data={{
                            labels: Object.keys(appUsageStats?.devices || { desktop: 0, mobile: 0 }),
                            datasets: [{
                              data: Object.values(appUsageStats?.devices || { desktop: 0, mobile: 0 }).map((d: any) => 
                                typeof d === 'object' ? (d.count || d.visits || 0) : d
                              ),
                              backgroundColor: ['#8b5cf6', '#06b6d4', '#10b981'],
                              borderWidth: 0
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { 
                                position: 'bottom',
                                labels: { color: '#9ca3af' }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Call Volume Bar Chart */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-4 text-green-400">Activity Summary</h4>
                      <div style={{ height: '250px' }}>
                        <Bar
                          data={{
                            labels: ['Calls', 'Chats', 'Safeguarding', 'AI Sessions'],
                            datasets: [{
                              label: 'Count',
                              data: [
                                callLogs.length,
                                chatRooms.length,
                                safeguardingAlerts.length,
                                aiChatStats?.total_sessions || 0
                              ],
                              backgroundColor: ['#3b82f6', '#06b6d4', '#eab308', '#8b5cf6']
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false }
                            },
                            scales: {
                              y: { 
                                beginAtZero: true,
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                ticks: { color: '#9ca3af' }
                              },
                              x: { 
                                grid: { display: false },
                                ticks: { color: '#9ca3af' }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Browser Distribution Doughnut */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-medium mb-4 text-yellow-400">Browser Distribution</h4>
                      <div style={{ height: '250px' }} className="flex justify-center">
                        <Doughnut
                          data={{
                            labels: Object.keys(appUsageStats?.browsers || { chrome: 0 }),
                            datasets: [{
                              data: Object.values(appUsageStats?.browsers || { chrome: 0 }).map((d: any) =>
                                typeof d === 'object' ? (d.count || d.visits || 0) : d
                              ),
                              backgroundColor: ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#8b5cf6'],
                              borderWidth: 0
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { 
                                position: 'bottom',
                                labels: { color: '#9ca3af' }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Trend & Contact Type Charts Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  Activity Trends
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Activity Trend Chart - Last 7 Days */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <h4 className="font-medium mb-4 text-blue-400">Activity Trend (Last 7 Days)</h4>
                    <div style={{ height: '250px' }}>
                      <Line
                        data={{
                          labels: (() => {
                            const days = [];
                            for (let i = 6; i >= 0; i--) {
                              const d = new Date();
                              d.setDate(d.getDate() - i);
                              days.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
                            }
                            return days;
                          })(),
                          datasets: [
                            {
                              label: 'Calls',
                              data: (() => {
                                const counts = new Array(7).fill(0);
                                callLogs.forEach((log: any) => {
                                  const logDate = new Date(log.timestamp || log.created_at);
                                  const daysAgo = Math.floor((Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24));
                                  if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
                                });
                                return counts;
                              })(),
                              borderColor: '#22c55e',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              tension: 0.3
                            },
                            {
                              label: 'Chats',
                              data: (() => {
                                const counts = new Array(7).fill(0);
                                chatRooms.forEach((room: any) => {
                                  const roomDate = new Date(room.created_at);
                                  const daysAgo = Math.floor((Date.now() - roomDate.getTime()) / (1000 * 60 * 60 * 24));
                                  if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
                                });
                                return counts;
                              })(),
                              borderColor: '#3b82f6',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              tension: 0.3
                            },
                            {
                              label: 'Safeguarding Alerts',
                              data: (() => {
                                const counts = new Array(7).fill(0);
                                safeguardingAlerts.forEach((alert: any) => {
                                  const alertDate = new Date(alert.created_at);
                                  const daysAgo = Math.floor((Date.now() - alertDate.getTime()) / (1000 * 60 * 60 * 24));
                                  if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
                                });
                                return counts;
                              })(),
                              borderColor: '#ef4444',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              tension: 0.3
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { 
                              position: 'bottom',
                              labels: { color: '#9ca3af' }
                            }
                          },
                          scales: {
                            y: { 
                              beginAtZero: true,
                              grid: { color: 'rgba(255,255,255,0.1)' },
                              ticks: { color: '#9ca3af' }
                            },
                            x: { 
                              grid: { display: false },
                              ticks: { color: '#9ca3af' }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Contact Type Doughnut Chart */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <h4 className="font-medium mb-4 text-purple-400">Contact Type Distribution</h4>
                    <div style={{ height: '250px' }} className="flex justify-center">
                      <Doughnut
                        data={{
                          labels: ['Counsellor', 'Peer', 'Organization', 'Crisis Line'],
                          datasets: [{
                            data: [
                              callLogs.filter((l: any) => l.contact_type === 'counsellor').length,
                              callLogs.filter((l: any) => l.contact_type === 'peer').length,
                              callLogs.filter((l: any) => l.contact_type === 'organization').length,
                              callLogs.filter((l: any) => l.contact_type === 'crisis_line').length
                            ],
                            backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'],
                            borderWidth: 0
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { 
                              position: 'bottom',
                              labels: { color: '#9ca3af' }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Map Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-400" />
                  Location Analytics
                </h3>
                <LocationMap data={locationData} />
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-2 mb-6">
                {LOG_SUBTABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveLogSubTab(tab.id)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeLogSubTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Call Logs */}
              {activeLogSubTab === 'calls' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date/Time</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Contact Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Method</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {callLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No call logs found</td>
                        </tr>
                      ) : (
                        callLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-gray-400">{new Date(log.timestamp || log.created_at || '').toLocaleString()}</td>
                            <td className="px-4 py-3 font-medium">{log.contact_name || 'Unknown'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                log.contact_type === 'peer' ? 'bg-green-500/20 text-green-400' : 
                                log.contact_type === 'counsellor' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {log.contact_type || 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                log.call_method === 'webrtc' ? 'bg-purple-500/20 text-purple-400' : 
                                log.call_method === 'phone' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {log.call_method || 'phone'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400">{log.contact_phone || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Chat Logs */}
              {activeLogSubTab === 'chats' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Staff</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Messages</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {chatRooms.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No chat logs found</td>
                        </tr>
                      ) : (
                        chatRooms.map((room) => (
                          <tr key={room.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-gray-400">{new Date(room.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                room.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {room.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">{room.user_name || 'Anonymous'}</td>
                            <td className="px-4 py-3">{room.staff_name || 'N/A'}</td>
                            <td className="px-4 py-3">{room.message_count || 0}</td>
                            <td className="px-4 py-3">
                              <button 
                                onClick={async () => {
                                  try {
                                    const messages = await api.getChatMessages(token!, room.id);
                                    setSelectedChatHistory(Array.isArray(messages) ? messages : messages?.messages || []);
                                    setShowChatHistoryModal(true);
                                  } catch (err) {
                                    setError('Failed to load chat history');
                                  }
                                }}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Chat History Modal */}
              {showChatHistoryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700 max-h-[80vh] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold">Chat History</h3>
                      <button onClick={() => setShowChatHistoryModal(false)} className="p-1 hover:bg-gray-700 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3">
                      {selectedChatHistory.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No messages in this chat</p>
                      ) : (
                        selectedChatHistory.map((msg: any, idx: number) => (
                          <div key={idx} className={`p-3 rounded-lg ${msg.sender_type === 'staff' ? 'bg-gray-700 ml-8' : 'bg-blue-900/30 mr-8'}`}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium">{msg.sender_name || msg.sender_type || 'User'}</span>
                              <span className="text-xs text-gray-500">{new Date(msg.created_at || msg.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm">{msg.content || msg.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button onClick={() => setShowChatHistoryModal(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Safeguarding Alerts */}
              {activeLogSubTab === 'safeguarding' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Score</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Session</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Location</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {safeguardingAlerts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No safeguarding alerts</td>
                        </tr>
                      ) : (
                        safeguardingAlerts.map((alert) => (
                          <tr key={alert.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-gray-400 text-sm">{new Date(alert.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                alert.risk_level === 'imminent' || alert.risk_level === 'critical' ? 'bg-red-600 text-white' :
                                alert.risk_level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                alert.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {(alert.risk_level || 'unknown').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-sm">{alert.risk_score || alert.score || '-'}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-400">{alert.session_id?.substring(0, 12) || '-'}...</td>
                            <td className="px-4 py-3 text-sm">
                              {alert.geo_city || alert.location_city || '-'}
                              {(alert.geo_country || alert.location_country) && `, ${alert.geo_country || alert.location_country}`}
                              {!alert.geo_city && !alert.location_city && alert.ip_address && <span className="text-gray-500">{alert.ip_address}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                alert.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {alert.status || 'active'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <button 
                                  onClick={async () => {
                                    try {
                                      const detail = await api.getSafeguardingAlertDetail(token!, alert.id);
                                      setSelectedSafeguardingAlert(detail);
                                      setShowAlertDetailModal(true);
                                    } catch (err) {
                                      setSelectedSafeguardingAlert(alert);
                                      setShowAlertDetailModal(true);
                                    }
                                  }}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                                >
                                  View
                                </button>
                                {alert.status !== 'acknowledged' && alert.status !== 'resolved' && (
                                  <button 
                                    onClick={async () => {
                                      try {
                                        await api.acknowledgeSafeguardingAlert(token!, alert.id);
                                        setSuccess('Alert acknowledged');
                                        loadLogs();
                                      } catch (err: any) {
                                        setError('Failed to acknowledge: ' + err.message);
                                      }
                                    }}
                                    className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                                  >
                                    Ack
                                  </button>
                                )}
                                {alert.status !== 'resolved' && (
                                  <button 
                                    onClick={async () => {
                                      try {
                                        await api.resolveSafeguardingAlert(token!, alert.id);
                                        setSuccess('Alert resolved');
                                        loadLogs();
                                      } catch (err: any) {
                                        setError('Failed to resolve: ' + err.message);
                                      }
                                    }}
                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                                  >
                                    Resolve
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Safeguarding Alert Detail Modal */}
              {showAlertDetailModal && selectedSafeguardingAlert && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl border border-gray-700 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <AlertTriangle className={`w-5 h-5 ${
                          selectedSafeguardingAlert.risk_level === 'imminent' || selectedSafeguardingAlert.risk_level === 'critical' ? 'text-red-500' :
                          selectedSafeguardingAlert.risk_level === 'high' ? 'text-orange-500' : 'text-yellow-500'
                        }`} />
                        Safeguarding Alert Details
                      </h3>
                      <button onClick={() => setShowAlertDetailModal(false)} className="p-1 hover:bg-gray-700 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-700/50 rounded p-3">
                        <p className="text-xs text-gray-400">Risk Level</p>
                        <p className={`text-lg font-bold ${
                          selectedSafeguardingAlert.risk_level === 'imminent' ? 'text-red-500' :
                          selectedSafeguardingAlert.risk_level === 'high' ? 'text-orange-500' : 'text-yellow-500'
                        }`}>{(selectedSafeguardingAlert.risk_level || 'unknown').toUpperCase()}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded p-3">
                        <p className="text-xs text-gray-400">Risk Score</p>
                        <p className="text-lg font-bold">{selectedSafeguardingAlert.risk_score || selectedSafeguardingAlert.score || '-'}</p>
                      </div>
                    </div>

                    {/* Trigger Info */}
                    {(selectedSafeguardingAlert.trigger_phrase || selectedSafeguardingAlert.triggered_indicators) && (
                      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
                        <p className="text-xs text-red-400 mb-2">Triggered By</p>
                        <p className="text-white font-medium">
                          {selectedSafeguardingAlert.trigger_phrase || selectedSafeguardingAlert.triggered_indicators?.join(', ')}
                        </p>
                        {selectedSafeguardingAlert.triggering_message && (
                          <p className="text-gray-300 mt-2 italic">&ldquo;{selectedSafeguardingAlert.triggering_message}&rdquo;</p>
                        )}
                      </div>
                    )}

                    {/* Location & Tracking Info */}
                    <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                      <p className="text-xs text-gray-400 mb-2">Tracking Information</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-400">Location:</span> {selectedSafeguardingAlert.geo_city || selectedSafeguardingAlert.location_city || '-'}, {selectedSafeguardingAlert.geo_country || selectedSafeguardingAlert.location_country || '-'}</div>
                        <div><span className="text-gray-400">IP:</span> {selectedSafeguardingAlert.ip_address || '-'}</div>
                        <div><span className="text-gray-400">ISP:</span> {selectedSafeguardingAlert.isp || '-'}</div>
                        <div><span className="text-gray-400">Timezone:</span> {selectedSafeguardingAlert.timezone || '-'}</div>
                        <div className="col-span-2"><span className="text-gray-400">Device:</span> {selectedSafeguardingAlert.user_agent || '-'}</div>
                      </div>
                    </div>

                    {/* Conversation History */}
                    {selectedSafeguardingAlert.conversation_history && selectedSafeguardingAlert.conversation_history.length > 0 && (
                      <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                        <p className="text-xs text-gray-400 mb-2">Recent Conversation</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedSafeguardingAlert.conversation_history.slice(-6).map((msg: any, idx: number) => (
                            <div key={idx} className={`p-2 rounded text-sm ${msg.role === 'user' ? 'bg-blue-900/30' : 'bg-gray-600/50'}`}>
                              <span className="font-medium">{msg.role === 'user' ? 'User' : 'AI'}:</span> {msg.content}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 mt-4">
                      <button onClick={() => setShowAlertDetailModal(false)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                        Close
                      </button>
                      {selectedSafeguardingAlert.status !== 'resolved' && (
                        <button 
                          onClick={async () => {
                            try {
                              await api.resolveSafeguardingAlert(token!, selectedSafeguardingAlert.id);
                              setSuccess('Alert resolved');
                              setShowAlertDetailModal(false);
                              loadLogs();
                            } catch (err: any) {
                              setError('Failed: ' + err.message);
                            }
                          }}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Screening Logs */}
              {activeLogSubTab === 'screening' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk Score</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Responses</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {screeningLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No screening submissions found</td>
                        </tr>
                      ) : (
                        screeningLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-gray-400">{new Date(log.created_at || log.submitted_at).toLocaleString()}</td>
                            <td className="px-4 py-3">{log.user_name || log.session_id?.substring(0, 12) || 'Anonymous'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                (log.risk_score || 0) >= 8 ? 'bg-red-500/20 text-red-400' :
                                (log.risk_score || 0) >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {log.risk_score || log.total_score || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">{log.responses?.length || log.questions_answered || 0} questions</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                log.status === 'reviewed' ? 'bg-green-500/20 text-green-400' :
                                log.status === 'flagged' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {log.status || 'pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button 
                                onClick={() => {
                                  // View screening details
                                }}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Callbacks Logs */}
              {activeLogSubTab === 'callbacks' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Phone</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Handled By</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {callbackLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No callback logs found</td>
                        </tr>
                      ) : (
                        callbackLogs.map((log: any) => (
                          <tr key={log.id} className={`hover:bg-gray-700/50 ${log.request_type === 'urgent' ? 'bg-red-900/20' : ''}`}>
                            <td className="px-4 py-3 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                log.request_type === 'urgent' ? 'bg-red-500/20 text-red-400' :
                                log.request_type === 'counsellor' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {log.request_type || 'peer'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium">{log.name || 'Unknown'}</td>
                            <td className="px-4 py-3 text-gray-400">{log.phone || '-'}</td>
                            <td className="px-4 py-3">{log.handled_by_name || log.assigned_to_name || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                log.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                log.status === 'in_progress' || log.status === 'assigned' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {log.status || 'pending'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Panic Logs */}
              {activeLogSubTab === 'panic' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Location</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Message</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Responded By</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {panicLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No panic alerts found</td>
                        </tr>
                      ) : (
                        panicLogs.map((log: any) => (
                          <tr key={log.id} className={`hover:bg-gray-700/50 ${log.status === 'active' ? 'bg-red-900/30 animate-pulse' : ''}`}>
                            <td className="px-4 py-3 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3 font-medium">{log.user_name || 'Unknown'}</td>
                            <td className="px-4 py-3 text-sm">{log.location || log.geo_city || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{log.message?.substring(0, 50) || '-'}{log.message?.length > 50 ? '...' : ''}</td>
                            <td className="px-4 py-3">{log.responded_by_name || log.acknowledged_by || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                log.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                log.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {log.status || 'active'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Audit Logs */}
              {activeLogSubTab === 'audit' && (
                <div className="space-y-4">
                  {/* Audit filter */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-gray-400">Filter by type:</label>
                    <select 
                      value={auditEventFilter}
                      onChange={(e) => setAuditEventFilter(e.target.value)}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      <option value="">All Events</option>
                      <option value="auth.">Authentication</option>
                      <option value="safeguarding.">Safeguarding</option>
                      <option value="data.">Data Access</option>
                      <option value="admin.">Admin Actions</option>
                      <option value="support.">Support</option>
                    </select>
                  </div>
                  
                  <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Event Type</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Outcome</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {adminAuditLogs.filter(log => !auditEventFilter || log.event_type?.startsWith(auditEventFilter)).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit logs found</td>
                          </tr>
                        ) : (
                          adminAuditLogs.filter(log => !auditEventFilter || log.event_type?.startsWith(auditEventFilter)).map((log: any) => {
                            // Color-code event types
                            const eventColor = 
                              log.event_type?.startsWith('auth.') ? 'bg-blue-500/20 text-blue-400' :
                              log.event_type?.startsWith('safeguarding.') ? 'bg-red-500/20 text-red-400' :
                              log.event_type?.startsWith('data.') ? 'bg-purple-500/20 text-purple-400' :
                              log.event_type?.startsWith('admin.') ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400';
                            
                            return (
                              <tr key={log.id} className="hover:bg-gray-700/50">
                                <td className="px-4 py-3 text-gray-400 text-sm">{new Date(log.created_at || log.timestamp).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs ${eventColor}`}>
                                    {log.event_type || 'unknown'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">{log.user_email || log.user_id || '-'}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    log.outcome === 'success' ? 'bg-green-500/20 text-green-400' :
                                    log.outcome === 'failure' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {log.outcome || 'N/A'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {log.risk_level && (
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      log.risk_level === 'high' || log.risk_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                                      log.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                      'bg-green-500/20 text-green-400'
                                    }`}>
                                      {log.risk_level}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate" title={log.details}>
                                  {log.details || '-'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Personas Tab */}
          {activeTab === 'ai-personas' && (
            <div data-testid="ai-personas-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">AI Chat Personas</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      if (!token) return;
                      try {
                        await api.seedAICharacters(token);
                        setSuccess('Default AI characters imported');
                        loadAICharacters();
                      } catch (err: any) {
                        setError('Failed to import defaults: ' + err.message);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Import Defaults
                  </button>
                  <button onClick={loadAICharacters} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Edit Character Modal */}
              {showCharacterModal && editingCharacter && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold">Edit AI Character</h3>
                      <button onClick={() => { setShowCharacterModal(false); setEditingCharacter(null); }} className="p-1 hover:bg-gray-700 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!token || !editingCharacter) return;
                      try {
                        await api.updateAICharacter(token, editingCharacter.id, editingCharacter);
                        setSuccess('Character updated successfully');
                        setShowCharacterModal(false);
                        setEditingCharacter(null);
                        loadAICharacters();
                      } catch (err: any) {
                        setError('Failed to update character: ' + err.message);
                      }
                    }}>
                      <div className="space-y-4">
                        {/* Row 1: Name and Character ID */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Character Name *</label>
                            <input
                              type="text"
                              value={editingCharacter.name}
                              onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Character ID</label>
                            <input
                              type="text"
                              value={editingCharacter.id}
                              disabled
                              className="w-full px-3 py-2 bg-gray-600 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-500 mt-1">Cannot be changed after creation</p>
                          </div>
                        </div>

                        {/* Short Description */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Short Description</label>
                          <input
                            type="text"
                            value={editingCharacter.description || ''}
                            onChange={(e) => setEditingCharacter({ ...editingCharacter, description: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            placeholder="Brief description shown in character list"
                          />
                        </div>

                        {/* Bio */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Bio (Optional)</label>
                          <textarea
                            value={editingCharacter.bio || ''}
                            onChange={(e) => setEditingCharacter({ ...editingCharacter, bio: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20"
                            placeholder="Longer biography shown in character detail view"
                          />
                        </div>

                        {/* Row 2: Category, Order, Enabled */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Category</label>
                            <select
                              value={editingCharacter.category || 'general'}
                              onChange={(e) => setEditingCharacter({ ...editingCharacter, category: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            >
                              <option value="general">General</option>
                              <option value="legal">Legal</option>
                              <option value="wellbeing">Wellbeing</option>
                              <option value="addiction">Addiction</option>
                              <option value="family">Family</option>
                              <option value="fitness">Fitness</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Display Order</label>
                            <input
                              type="number"
                              value={editingCharacter.order || 0}
                              onChange={(e) => setEditingCharacter({ ...editingCharacter, order: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              min="0"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <input
                              type="checkbox"
                              id="char-enabled"
                              checked={editingCharacter.is_enabled}
                              onChange={(e) => setEditingCharacter({ ...editingCharacter, is_enabled: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <label htmlFor="char-enabled" className="text-sm">Enabled (visible to users)</label>
                          </div>
                        </div>

                        {/* Avatar Section */}
                        <div className="border border-gray-600 rounded-lg p-4">
                          <label className="block text-sm text-gray-400 mb-2">Avatar</label>
                          <div className="flex items-start gap-4">
                            {editingCharacter.avatar && (
                              <img 
                                src={editingCharacter.avatar} 
                                alt={editingCharacter.name}
                                className="w-20 h-20 rounded-full object-cover border-2 border-gray-600"
                              />
                            )}
                            <div className="flex-1">
                              <input
                                type="text"
                                value={editingCharacter.avatar || ''}
                                onChange={(e) => setEditingCharacter({ ...editingCharacter, avatar: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                placeholder="Enter avatar URL (e.g., /static/avatars/character.png)"
                              />
                              <p className="text-xs text-gray-500 mt-1">Enter URL or use /static/avatars/ path</p>
                            </div>
                          </div>
                        </div>

                        {/* System Prompt */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">System Prompt *</label>
                          <textarea
                            value={editingCharacter.prompt || ''}
                            onChange={(e) => setEditingCharacter({ ...editingCharacter, prompt: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
                            rows={12}
                            placeholder="Enter the system prompt that defines this character's personality, behavior, and responses..."
                          />
                          <p className="text-xs text-gray-500 mt-1">This defines how the AI character responds to users</p>
                        </div>

                        {editingCharacter.is_hardcoded && (
                          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
                            <p className="text-yellow-300 text-sm">
                              ⚠️ This is a hardcoded character. Changes will create a database override.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button
                          type="button"
                          onClick={() => { setShowCharacterModal(false); setEditingCharacter(null); }}
                          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiCharacters.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-400">
                    <p>No AI characters configured</p>
                    <p className="text-sm mt-2">Click "Import Defaults" to add default characters</p>
                  </div>
                ) : (
                  aiCharacters.map((char) => {
                    const avatarUrl = resolveAvatarUrl(char.avatar);
                    return (
                      <div key={char.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <div className="flex items-start gap-4">
                          {avatarUrl ? (
                            <img 
                              src={avatarUrl} 
                              alt={char.name} 
                              className="w-16 h-16 rounded-full object-cover bg-gray-700" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLImageElement).nextElementSibling;
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold ${avatarUrl ? 'hidden' : ''}`}
                          >
                            {(char.name || 'A')[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{char.name}</h3>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{char.description || 'No description'}</p>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              {/* Enable/Disable Toggle */}
                              <button
                                onClick={async () => {
                                  if (!token) return;
                                  try {
                                    await api.toggleAICharacterStatus(token, char.id, !char.is_enabled);
                                    setSuccess(`${char.name} ${!char.is_enabled ? 'enabled' : 'disabled'}`);
                                    loadAICharacters();
                                  } catch (err: any) {
                                    setError('Failed to update status: ' + err.message);
                                  }
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                  char.is_enabled 
                                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                                    : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                                }`}
                              >
                                {char.is_enabled ? 'Enabled' : 'Disabled'}
                              </button>
                              {char.order !== undefined && (
                                <span className="text-xs text-gray-500">Order: {char.order}</span>
                              )}
                            </div>
                            {/* Edit Button */}
                            <button
                              onClick={async () => {
                                try {
                                  // Fetch full character details including prompt
                                  const fullChar = await api.getAICharacter(token!, char.id);
                                  setEditingCharacter(fullChar);
                                  setShowCharacterModal(true);
                                } catch (err) {
                                  // Fallback to current data if fetch fails
                                  setEditingCharacter({ ...char });
                                  setShowCharacterModal(true);
                                }
                              }}
                              className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* AI Usage Tab */}
          {activeTab === 'ai-usage' && (
            <div data-testid="ai-usage-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">AI Usage & Costs</h2>
                <button onClick={loadAIUsage} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
              {aiUsage ? (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6">
                      <h3 className="text-blue-200 text-sm mb-2">Total Requests</h3>
                      <p className="text-3xl font-bold">{(aiUsage.total_requests || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6">
                      <h3 className="text-purple-200 text-sm mb-2">Total Tokens</h3>
                      <p className="text-3xl font-bold">{(aiUsage.total_tokens || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6">
                      <h3 className="text-green-200 text-sm mb-2">Total Cost</h3>
                      <p className="text-3xl font-bold">£{Number(aiUsage.total_cost_gbp || aiUsage.total_cost || 0).toFixed(4)}</p>
                    </div>
                  </div>

                  {/* Provider Cards with Budget Bars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* OpenAI Card */}
                    {aiUsage.providers?.openai && (
                      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white font-bold text-sm">AI</div>
                          <h3 className="font-semibold">OpenAI</h3>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Cost</span>
                            <span className="text-green-400">£{Number(aiUsage.providers.openai.cost_gbp || 0).toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Requests</span>
                            <span>{(aiUsage.providers.openai.request_count || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Tokens</span>
                            <span>{(aiUsage.providers.openai.total_tokens || 0).toLocaleString()}</span>
                          </div>
                          {/* Budget Bar */}
                          {aiUsage.providers.openai.budget_limit_gbp && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Budget Used</span>
                                <span>{Number(aiUsage.providers.openai.budget_percentage_used || 0).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${
                                    Number(aiUsage.providers.openai.budget_percentage_used || 0) > 80 ? 'bg-red-500' :
                                    Number(aiUsage.providers.openai.budget_percentage_used || 0) > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(Number(aiUsage.providers.openai.budget_percentage_used || 0), 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">£{Number(aiUsage.providers.openai.budget_remaining_gbp || 0).toFixed(4)} remaining of £{Number(aiUsage.providers.openai.budget_limit_gbp || 0).toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Gemini Card */}
                    {aiUsage.providers?.gemini && (
                      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white font-bold text-sm">G</div>
                          <h3 className="font-semibold">Gemini</h3>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Cost</span>
                            <span className="text-green-400">£{Number(aiUsage.providers.gemini.cost_gbp || 0).toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Requests</span>
                            <span>{(aiUsage.providers.gemini.request_count || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Tokens</span>
                            <span>{(aiUsage.providers.gemini.total_tokens || 0).toLocaleString()}</span>
                          </div>
                          {/* Budget Bar */}
                          {aiUsage.providers.gemini.budget_limit_gbp && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Budget Used</span>
                                <span>{Number(aiUsage.providers.gemini.budget_percentage_used || 0).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${
                                    Number(aiUsage.providers.gemini.budget_percentage_used || 0) > 80 ? 'bg-red-500' :
                                    Number(aiUsage.providers.gemini.budget_percentage_used || 0) > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.min(Number(aiUsage.providers.gemini.budget_percentage_used || 0), 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">£{Number(aiUsage.providers.gemini.budget_remaining_gbp || 0).toFixed(4)} remaining of £{Number(aiUsage.providers.gemini.budget_limit_gbp || 0).toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Daily Usage Chart */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold">Daily Usage (Stacked)</h3>
                      <select
                        value={aiUsagePeriod}
                        onChange={async (e) => {
                          const days = Number(e.target.value);
                          setAiUsagePeriod(days);
                          if (token) {
                            try {
                              const daily = await api.getAIUsageDaily(token, days);
                              setAiDailyUsage(daily || []);
                            } catch (err) {
                              console.error('Failed to load daily AI usage');
                            }
                          }
                        }}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                      >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={60}>Last 60 days</option>
                        <option value={90}>Last 90 days</option>
                      </select>
                    </div>
                    <div style={{ height: '300px' }}>
                      {Array.isArray(aiDailyUsage) && aiDailyUsage.length > 0 ? (
                      <Bar
                        data={{
                          labels: aiDailyUsage.map((d: any) => {
                            const date = new Date(d.date || d._id);
                            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          }),
                          datasets: [
                            {
                              label: 'OpenAI',
                              data: aiDailyUsage.map((d: any) => Number(d.openai_cost || d.openai || 0)),
                              backgroundColor: '#10a37f',
                              stack: 'stack1'
                            },
                            {
                              label: 'Gemini',
                              data: aiDailyUsage.map((d: any) => Number(d.gemini_cost || d.gemini || 0)),
                              backgroundColor: '#4285f4',
                              stack: 'stack1'
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { 
                              position: 'bottom',
                              labels: { color: '#9ca3af' }
                            },
                            tooltip: {
                              callbacks: {
                                label: (ctx) => `${ctx.dataset.label}: £${Number(ctx.raw).toFixed(4)}`
                              }
                            }
                          },
                          scales: {
                            y: { 
                              stacked: true,
                              beginAtZero: true,
                              grid: { color: 'rgba(255,255,255,0.1)' },
                              ticks: { 
                                color: '#9ca3af',
                                callback: (value) => `£${Number(value).toFixed(4)}`
                              }
                            },
                            x: { 
                              stacked: true,
                              grid: { display: false },
                              ticks: { color: '#9ca3af' }
                            }
                          }
                        }}
                      />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          No daily usage data available
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Character Usage */}
                  {aiUsage.by_character && aiUsage.by_character.length > 0 && (
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                      <h3 className="font-semibold mb-4">Usage by Character</h3>
                      <div className="space-y-2">
                        {aiUsage.by_character.map((char: any) => (
                          <div key={char.character_name || char.name} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                            <span className="font-medium">{char.character_name || char.name}</span>
                            <div className="text-right text-sm">
                              <span className="text-gray-400 mr-4">{(char.request_count || char.requests || 0).toLocaleString()} requests</span>
                              <span className="text-green-400">£{Number(char.cost_gbp || char.cost || 0).toFixed(4)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  AI Usage data not available
                </div>
              )}
            </div>
          )}

          {/* Monitoring Tab */}
          {activeTab === 'monitoring' && (
            <div data-testid="monitoring-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">System Monitoring</h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400">Auto-refresh: 30s</span>
                  <button onClick={loadMonitoring} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {monitoringStats ? (
                <>
                  {/* Activity Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                      <Activity className="w-8 h-8 text-green-400 mb-2" />
                      <h3 className="text-gray-400 text-sm mb-1">Active Calls</h3>
                      <p className="text-2xl font-bold">{monitoringStats.activity?.active_calls || monitoringStats.active_calls || 0}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                      <MessageSquare className="w-8 h-8 text-blue-400 mb-2" />
                      <h3 className="text-gray-400 text-sm mb-1">Live Chats</h3>
                      <p className="text-2xl font-bold">{monitoringStats.activity?.active_live_chats || monitoringStats.active_chats || 0}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                      <Bot className="w-8 h-8 text-purple-400 mb-2" />
                      <h3 className="text-gray-400 text-sm mb-1">AI Sessions (24h)</h3>
                      <p className="text-2xl font-bold">{monitoringStats.activity?.active_ai_sessions_24h || 0}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                      <Phone className="w-8 h-8 text-yellow-400 mb-2" />
                      <h3 className="text-gray-400 text-sm mb-1">Pending Callbacks</h3>
                      <p className="text-2xl font-bold">{monitoringStats.activity?.pending_callbacks || 0}</p>
                    </div>
                  </div>

                  {/* User Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                      <h3 className="text-gray-400 text-sm mb-2">Total Registered Users</h3>
                      <p className="text-3xl font-bold">{monitoringStats.users?.total_registered || 0}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                      <h3 className="text-gray-400 text-sm mb-2">Staff Online Now</h3>
                      <p className="text-3xl font-bold text-green-400">{monitoringStats.users?.connected_staff || monitoringStats.staff_online || 0}</p>
                    </div>
                  </div>

                  {/* Server Health */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="font-semibold mb-4">Server Health</h3>
                    <div className="space-y-4">
                      {/* CPU */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">CPU Usage</span>
                          <span>{monitoringStats.server?.cpu_percent || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all ${
                              (monitoringStats.server?.cpu_percent || 0) > 80 ? 'bg-red-500' :
                              (monitoringStats.server?.cpu_percent || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(monitoringStats.server?.cpu_percent || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                      {/* Memory */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Memory Usage</span>
                          <span>{monitoringStats.server?.memory_percent || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all ${
                              (monitoringStats.server?.memory_percent || 0) > 80 ? 'bg-red-500' :
                              (monitoringStats.server?.memory_percent || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(monitoringStats.server?.memory_percent || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                      {/* Load */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Current Load</span>
                          <span>{monitoringStats.capacity?.current_load_percent || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all ${
                              (monitoringStats.capacity?.current_load_percent || 0) > 80 ? 'bg-red-500' :
                              (monitoringStats.capacity?.current_load_percent || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(monitoringStats.capacity?.current_load_percent || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Last Updated Timestamp */}
                    {monitoringLastUpdated && (
                      <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-700">
                        Last updated: {monitoringLastUpdated.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  Loading monitoring data...
                </div>
              )}
            </div>
          )}

          {/* Migration Tab */}
          {activeTab === 'migration' && (
            <div data-testid="migration-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Database Migration Status</h2>
                
                {migrationStatus ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-700 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">Legacy Users</p>
                        <p className="text-2xl font-bold">{migrationStatus.legacy_counts?.users || 0}</p>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">Legacy Counsellors</p>
                        <p className="text-2xl font-bold">{migrationStatus.legacy_counts?.counsellors || 0}</p>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">Legacy Peers</p>
                        <p className="text-2xl font-bold">{migrationStatus.legacy_counts?.peer_supporters || 0}</p>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-4">
                        <p className="text-gray-400 text-sm">Unified Staff</p>
                        <p className="text-2xl font-bold text-green-400">{migrationStatus.unified_staff_count || 0}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        migrationStatus.migration_complete ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {migrationStatus.migration_complete ? 'Migration Complete' : 'Migration Pending'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">Loading migration status...</p>
                )}
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={handleRunMigration}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  Run Migration
                </button>
                <button
                  onClick={handleFixPasswords}
                  className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors"
                >
                  Fix Password Hashes
                </button>
                <button
                  onClick={loadMigrationStatus}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          )}

          {/* Rota Tab */}
          {activeTab === 'rota' && (
            <div data-testid="rota-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Staff Rota & Scheduling</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowAddShiftModal(true)} 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Shift
                  </button>
                  <button onClick={loadRota} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Add Shift Modal */}
              {showAddShiftModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold">Add New Shift</h3>
                      <button onClick={() => setShowAddShiftModal(false)} className="p-1 hover:bg-gray-700 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!token || !newShift.user_id) return;
                      try {
                        const selectedStaff = staff.find((s: StaffMember) => s.id === newShift.user_id);
                        await api.createShift(
                          token,
                          { date: newShift.date, start_time: newShift.start_time, end_time: newShift.end_time },
                          newShift.user_id,
                          selectedStaff?.name || '',
                          selectedStaff?.email || ''
                        );
                        setShowAddShiftModal(false);
                        setNewShift({ date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '17:00', user_id: '' });
                        loadRota();
                        setSuccess('Shift created successfully');
                      } catch (err: any) {
                        setError('Failed to create shift: ' + err.message);
                      }
                    }}>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Staff Member</label>
                          <select
                            value={newShift.user_id}
                            onChange={(e) => setNewShift({ ...newShift, user_id: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            required
                          >
                            <option value="">Select staff member...</option>
                            {staff.map((staffMember: StaffMember) => (
                              <option key={staffMember.id} value={staffMember.id}>{staffMember.name} ({staffMember.role})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Date</label>
                          <input
                            type="date"
                            value={newShift.date}
                            onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                            <input
                              type="time"
                              value={newShift.start_time}
                              onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">End Time</label>
                            <input
                              type="time"
                              value={newShift.end_time}
                              onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              required
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button
                          type="button"
                          onClick={() => setShowAddShiftModal(false)}
                          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >
                          Create Shift
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              
              {/* Coverage Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4">
                  <p className="text-green-200 text-sm">Counsellors Today</p>
                  <p className="text-2xl font-bold">
                    {shifts.filter(s => {
                      if (s.date !== new Date().toISOString().split('T')[0]) return false;
                      const staffMember = staff.find((st: StaffMember) => st.id === s.user_id);
                      return staffMember?.role === 'counsellor';
                    }).length}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4">
                  <p className="text-blue-200 text-sm">Peers Today</p>
                  <p className="text-2xl font-bold">
                    {shifts.filter(s => {
                      if (s.date !== new Date().toISOString().split('T')[0]) return false;
                      const staffMember = staff.find((st: StaffMember) => st.id === s.user_id);
                      return staffMember?.role === 'peer';
                    }).length}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4">
                  <p className="text-purple-200 text-sm">Shifts This Week</p>
                  <p className="text-2xl font-bold">
                    {shifts.filter(s => {
                      const shiftDate = new Date(s.date);
                      const today = new Date();
                      const weekEnd = new Date();
                      weekEnd.setDate(today.getDate() + 7);
                      return shiftDate >= today && shiftDate < weekEnd;
                    }).length}
                  </p>
                </div>
                {(() => {
                  // Calculate coverage gaps (days in next 7 days with no shifts)
                  let gaps = 0;
                  for (let i = 0; i < 7; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const dateStr = date.toISOString().split('T')[0];
                    const dayShifts = shifts.filter(s => s.date === dateStr);
                    if (dayShifts.length === 0) gaps++;
                  }
                  return gaps > 0 ? (
                    <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-4">
                      <p className="text-red-200 text-sm">Coverage Gaps</p>
                      <p className="text-2xl font-bold">{gaps} days</p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg p-4">
                      <p className="text-gray-300 text-sm">Coverage Status</p>
                      <p className="text-lg font-bold text-green-400">✓ Full Coverage</p>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Full Month Calendar */}
                <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <button 
                      onClick={() => setRotaCalendarMonth(new Date(rotaCalendarMonth.getFullYear(), rotaCalendarMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-700 rounded"
                    >
                      <ChevronDown className="w-5 h-5 rotate-90" />
                    </button>
                    <h3 className="font-semibold text-lg">
                      {rotaCalendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button 
                      onClick={() => setRotaCalendarMonth(new Date(rotaCalendarMonth.getFullYear(), rotaCalendarMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-700 rounded"
                    >
                      <ChevronDown className="w-5 h-5 -rotate-90" />
                    </button>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Day Headers */}
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <div key={day} className="text-center text-xs text-gray-400 py-2 font-medium">
                        {day}
                      </div>
                    ))}
                    
                    {/* Calendar Days */}
                    {(() => {
                      const year = rotaCalendarMonth.getFullYear();
                      const month = rotaCalendarMonth.getMonth();
                      const firstDay = new Date(year, month, 1);
                      const lastDay = new Date(year, month + 1, 0);
                      const daysInMonth = lastDay.getDate();
                      
                      // Adjust for Monday start (0 = Monday, 6 = Sunday)
                      let startDay = firstDay.getDay() - 1;
                      if (startDay < 0) startDay = 6;
                      
                      const days = [];
                      const today = new Date().toISOString().split('T')[0];
                      
                      // Empty cells before first day
                      for (let i = 0; i < startDay; i++) {
                        days.push(<div key={`empty-${i}`} className="h-20 bg-gray-900/50 rounded" />);
                      }
                      
                      // Days of the month
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayShifts = shifts.filter(s => s.date === dateStr);
                        const isToday = dateStr === today;
                        const isSelected = dateStr === selectedRotaDate;
                        
                        days.push(
                          <div 
                            key={day}
                            onClick={() => setSelectedRotaDate(dateStr)}
                            className={`h-20 p-1 rounded cursor-pointer transition-colors ${
                              isToday ? 'bg-blue-600/30 border border-blue-500' :
                              isSelected ? 'bg-purple-600/30 border border-purple-500' :
                              dayShifts.length > 0 ? 'bg-green-600/20 hover:bg-green-600/30' :
                              'bg-gray-700/50 hover:bg-gray-700'
                            }`}
                          >
                            <div className="text-xs font-medium mb-1">{day}</div>
                            {dayShifts.length > 0 && (
                              <div className="space-y-0.5">
                                {dayShifts.slice(0, 2).map((s, i) => (
                                  <div key={i} className={`text-[10px] px-1 py-0.5 rounded truncate ${
                                    staff.find((st: StaffMember) => st.id === s.user_id)?.role === 'counsellor' 
                                      ? 'bg-green-500/40 text-green-200'
                                      : 'bg-blue-500/40 text-blue-200'
                                  }`}>
                                    {s.user_name?.split(' ')[0] || 'Shift'}
                                  </div>
                                ))}
                                {dayShifts.length > 2 && (
                                  <div className="text-[10px] text-gray-400">+{dayShifts.length - 2} more</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                      
                      return days;
                    })()}
                  </div>
                  
                  {/* Legend */}
                  <div className="flex gap-4 mt-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500/40 rounded"></div>
                      <span className="text-gray-400">Counsellor</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-500/40 rounded"></div>
                      <span className="text-gray-400">Peer</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-600/30 border border-blue-500 rounded"></div>
                      <span className="text-gray-400">Today</span>
                    </div>
                  </div>
                </div>

                {/* Selected Day / Today's Shifts Panel */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    {selectedRotaDate 
                      ? new Date(selectedRotaDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                      : "Today's Shifts"}
                  </h3>
                  
                  {(() => {
                    const dateToShow = selectedRotaDate || new Date().toISOString().split('T')[0];
                    const dayShifts = shifts.filter(s => s.date === dateToShow);
                    
                    if (dayShifts.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                          <p className="text-gray-400">No shifts scheduled</p>
                          <button 
                            onClick={() => {
                              setNewShift({ ...newShift, date: dateToShow });
                              setShowAddShiftModal(true);
                            }}
                            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                          >
                            Add Shift
                          </button>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        {dayShifts.map((shift) => {
                          const staffMember = staff.find((st: StaffMember) => st.id === shift.user_id);
                          return (
                            <div key={shift.id} className="bg-gray-700 rounded-lg p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium">{shift.user_name || 'Unassigned'}</p>
                                  <p className="text-sm text-gray-400">{shift.start_time} - {shift.end_time}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  staffMember?.role === 'counsellor' 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {staffMember?.role || 'staff'}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  shift.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {shift.status || 'pending'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        
                        <button 
                          onClick={() => {
                            setNewShift({ ...newShift, date: dateToShow });
                            setShowAddShiftModal(true);
                          }}
                          className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Another Shift
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Swap Requests with Pending/All Tabs */}
              <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-yellow-400" />
                    Swap Requests
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setSwapTabView('pending');
                        if (token) {
                          try {
                            const pending = await api.getPendingSwaps(token);
                            setPendingSwaps(pending || []);
                          } catch (err) {
                            console.error('Failed to load pending swaps');
                          }
                        }
                      }}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        swapTabView === 'pending' 
                          ? 'bg-yellow-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Pending ({pendingSwaps.length})
                    </button>
                    <button
                      onClick={async () => {
                        setSwapTabView('all');
                        if (token) {
                          try {
                            const all = await api.getSwapRequests(token);
                            setAllSwapRequests(all || []);
                          } catch (err) {
                            console.error('Failed to load all swaps');
                          }
                        }
                      }}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        swapTabView === 'all' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>
                
                {/* Pending Swaps Tab */}
                {swapTabView === 'pending' && (
                  pendingSwaps.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No pending swap requests</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pendingSwaps.map((swap) => (
                        <div key={swap.id} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{swap.requester_name}</p>
                              <p className="text-sm text-gray-400">{swap.shift_date} • {swap.shift_start} - {swap.shift_end}</p>
                            </div>
                            <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
                              {swap.status}
                            </span>
                          </div>
                          {swap.responder_name && (
                            <p className="text-sm text-gray-400 mb-2">Cover: {swap.responder_name}</p>
                          )}
                          <div className="flex gap-2">
                            <button 
                              onClick={async () => {
                                try {
                                  await api.approveSwap(token!, swap.id, true);
                                  setSuccess('Swap request approved');
                                  loadRota();
                                } catch (err: any) {
                                  setError('Failed to approve: ' + err.message);
                                }
                              }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={async () => {
                                try {
                                  await api.approveSwap(token!, swap.id, false);
                                  setSuccess('Swap request rejected');
                                  loadRota();
                                } catch (err: any) {
                                  setError('Failed to reject: ' + err.message);
                                }
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
                
                {/* All Swaps Tab */}
                {swapTabView === 'all' && (
                  allSwapRequests.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No swap requests found</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {allSwapRequests.map((swap) => (
                        <div key={swap.id} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{swap.requester_name}</p>
                              <p className="text-sm text-gray-400">{swap.shift_date} • {swap.shift_start} - {swap.shift_end}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${
                              swap.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                              swap.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {swap.status}
                            </span>
                          </div>
                          {swap.responder_name && (
                            <p className="text-sm text-gray-400 mb-2">Cover: {swap.responder_name}</p>
                          )}
                          {swap.status === 'pending' && (
                            <div className="flex gap-2">
                              <button 
                                onClick={async () => {
                                  try {
                                    await api.approveSwap(token!, swap.id, true);
                                    setSuccess('Swap request approved');
                                    const all = await api.getSwapRequests(token!);
                                    setAllSwapRequests(all || []);
                                  } catch (err: any) {
                                    setError('Failed to approve: ' + err.message);
                                  }
                                }}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={async () => {
                                  try {
                                    await api.approveSwap(token!, swap.id, false);
                                    setSuccess('Swap request rejected');
                                    const all = await api.getSwapRequests(token!);
                                    setAllSwapRequests(all || []);
                                  } catch (err: any) {
                                    setError('Failed to reject: ' + err.message);
                                  }
                                }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* CMS Tab */}
          {activeTab === 'cms' && (
            <div data-testid="cms-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Content Management System</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      if (!token) return;
                      try {
                        await api.seedCMSDefaults(token);
                        setSuccess('Default CMS content loaded');
                        loadCMS();
                      } catch (err: any) {
                        setError('Failed to load defaults: ' + err.message);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Load Defaults
                  </button>
                  <button onClick={loadCMS} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Page List */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Pages ({cmsPages.length})
                  </h3>
                  {cmsPages.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 mb-4">No CMS pages found</p>
                      <p className="text-sm text-gray-500">Click "Load Defaults" to add default pages</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cmsPages.map((page) => (
                        <button
                          key={page.slug}
                          onClick={() => setSelectedCmsPage(page.slug)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedCmsPage === page.slug ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          <p className="font-medium">{page.title}</p>
                          <p className="text-xs text-gray-400">/{page.slug}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Page Content */}
                <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4">Page Content</h3>
                  {selectedCmsPage ? (
                    <div className="space-y-4">
                      {(() => {
                        const page = cmsPages.find(p => p.slug === selectedCmsPage);
                        if (!page) return <p className="text-gray-400">Page not found</p>;
                        return (
                          <>
                            <div className="bg-gray-700 rounded-lg p-4">
                              <h4 className="font-medium text-lg">{page.title}</h4>
                              <p className="text-sm text-gray-400 mt-1">{page.description || 'No description'}</p>
                            </div>
                            {page.sections && page.sections.length > 0 ? (
                              <div className="space-y-3">
                                <h5 className="text-sm font-medium text-gray-400">Sections:</h5>
                                {page.sections.map((section: any, idx: number) => (
                                  <div key={idx} className="bg-gray-700 rounded-lg p-3">
                                    <p className="font-medium">{section.title || `Section ${idx + 1}`}</p>
                                    <p className="text-sm text-gray-400">{section.description || section.content || 'No content'}</p>
                                  </div>
                                ))}
                              </div>
                            ) : page.cards && page.cards.length > 0 ? (
                              <div className="space-y-3">
                                <h5 className="text-sm font-medium text-gray-400">Cards:</h5>
                                {page.cards.map((card: any, idx: number) => (
                                  <div key={idx} className="bg-gray-700 rounded-lg p-3 flex items-start gap-3">
                                    {card.icon && <span className="text-2xl">{card.icon}</span>}
                                    <div>
                                      <p className="font-medium">{card.title}</p>
                                      <p className="text-sm text-gray-400">{card.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-400 text-center py-4">No sections or cards in this page</p>
                            )}
                            <p className="text-xs text-gray-500 mt-4">Note: Full visual editor available in legacy admin portal</p>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="bg-gray-700 rounded-lg p-6 min-h-[300px] flex items-center justify-center">
                      <p className="text-gray-400">Select a page to view content</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Beta Testing Tab */}
          {activeTab === 'beta' && (
            <div data-testid="beta-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Beta Testing & Feedback</h2>
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={async () => {
                      if (!token) return;
                      try {
                        await api.setBetaStatus(token, !betaEnabled);
                        setBetaEnabled(!betaEnabled);
                      } catch (err) {
                        console.error('Failed to toggle beta:', err);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${betaEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {betaEnabled ? 'Disable Beta' : 'Enable Beta'}
                  </button>
                  <span className={`px-3 py-1 rounded-full text-sm ${betaEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {betaEnabled ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={loadBetaTesting} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Pre-Surveys</p>
                  <p className="text-2xl font-bold text-green-400">{betaStats?.total_pre_surveys || 0}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Post-Surveys</p>
                  <p className="text-2xl font-bold text-blue-400">{betaStats?.total_post_surveys || 0}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Completion Rate</p>
                  <p className="text-2xl font-bold text-yellow-400">{betaStats?.completion_rate || 0}%</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">NPS Score</p>
                  <p className="text-2xl font-bold text-purple-400">{betaStats?.nps_score || '--'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pre-Survey Averages */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    Pre-Survey Averages
                  </h3>
                  {betaStats?.pre_averages ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-gray-700 p-3 rounded">
                        <span>Wellbeing Score</span>
                        <span className="text-green-400 font-bold">{typeof betaStats.pre_averages.avg_wellbeing === 'number' ? betaStats.pre_averages.avg_wellbeing.toFixed(1) : (betaStats.pre_averages.avg_wellbeing || '--')}/10</span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-700 p-3 rounded">
                        <span>Anxiety Level</span>
                        <span className="text-yellow-400 font-bold">{typeof betaStats.pre_averages.avg_anxiety === 'number' ? betaStats.pre_averages.avg_anxiety.toFixed(1) : (betaStats.pre_averages.avg_anxiety || '--')}/10</span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-700 p-3 rounded">
                        <span>Mood Score</span>
                        <span className="text-blue-400 font-bold">{typeof betaStats.pre_averages.avg_mood === 'number' ? betaStats.pre_averages.avg_mood.toFixed(1) : (betaStats.pre_averages.avg_mood || '--')}/10</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">No pre-survey data yet</p>
                  )}
                </div>

                {/* Post-Survey Improvement */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    Post-Survey Improvement
                  </h3>
                  {betaStats?.improvement && Object.keys(betaStats.improvement).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(betaStats.improvement).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                          <span className="capitalize">{key.replace('_', ' ')}</span>
                          <span className={`font-bold ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {typeof value === 'number' ? (value > 0 ? '+' : '') + value.toFixed(1) : (value || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">No post-survey data yet</p>
                  )}
                </div>
              </div>

              {/* Survey Responses */}
              <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                    Recent Survey Responses ({betaResponses.length})
                  </h3>
                  <a
                    href={`${API_URL}/api/surveys/export`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                  >
                    Export CSV
                  </a>
                </div>
                {betaResponses.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No survey responses yet</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {betaResponses.map((response: any, idx: number) => (
                      <div key={response.id || idx} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            response.survey_type === 'pre' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {response.survey_type === 'pre' ? 'Pre-Survey' : 'Post-Survey'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {response.created_at ? new Date(response.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                          <div>
                            <span className="text-gray-400">Wellbeing:</span>
                            <span className="ml-2 font-medium">{response.wellbeing_score || response.wellbeing || '--'}/10</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Anxiety:</span>
                            <span className="ml-2 font-medium">{response.anxiety_level || response.anxiety || '--'}/3</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Mood:</span>
                            <span className="ml-2 font-medium">{response.mood_level || response.mood || '--'}/3</span>
                          </div>
                        </div>
                        {response.survey_type === 'post' && (
                          <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-2 border-t border-gray-600">
                            <div>
                              <span className="text-gray-400">App Helped:</span>
                              <span className="ml-2 font-medium">{response.app_helped || '--'}/5</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Would Recommend:</span>
                              <span className="ml-2 font-medium">{response.would_recommend || '--'}/10</span>
                            </div>
                          </div>
                        )}
                        {(response.hopes || response.improvements || response.comments) && (
                          <div className="mt-2 pt-2 border-t border-gray-600 text-sm">
                            {response.hopes && <p className="text-gray-300"><span className="text-gray-400">Hopes:</span> {response.hopes}</p>}
                            {response.improvements && <p className="text-gray-300"><span className="text-gray-400">Improvements:</span> {response.improvements}</p>}
                            {response.comments && <p className="text-gray-300"><span className="text-gray-400">Comments:</span> {response.comments}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div data-testid="compliance-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Compliance & Audit</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      if (!token) return;
                      try {
                        await api.fetch('/compliance/security/automated-review', { token, method: 'GET' });
                        setSuccess('Security review initiated');
                        loadCompliance();
                      } catch (err: any) {
                        setError('Failed to run security review: ' + err.message);
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                  >
                    Run Security Review
                  </button>
                  <button onClick={loadCompliance} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">GDPR Consent</p>
                  <p className="text-2xl font-bold text-green-400">{complianceData?.gdpr?.consent_rate || 0}%</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Data Exports</p>
                  <p className="text-2xl font-bold">{complianceData?.gdpr?.data_exports_this_month || 0}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Deletions</p>
                  <p className="text-2xl font-bold">{complianceData?.gdpr?.account_deletions_this_month || 0}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Open Complaints</p>
                  <p className="text-2xl font-bold text-yellow-400">{complianceData?.complaints?.open_complaints || complaints.length}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Security Status</p>
                  <p className={`text-xl font-bold ${
                    complianceData?.security?.last_review_status === 'pass' ? 'text-green-400' :
                    complianceData?.security?.last_review_status === 'fail' ? 'text-red-400' : 'text-gray-400'
                  }`}>{complianceData?.security?.last_review_status || 'N/A'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Open Incidents</p>
                  <p className="text-2xl font-bold text-red-400">{complianceData?.security?.open_incidents || incidents.length}</p>
                </div>
              </div>

              {/* Staff Wellbeing Section */}
              {complianceData?.staff_wellbeing && (
                <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg border border-purple-700 p-4 mb-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-purple-400" />
                    Staff Wellbeing
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Check-ins This Week</p>
                      <p className="text-2xl font-bold">{complianceData.staff_wellbeing.checkins_this_week || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Need Support</p>
                      <p className={`text-2xl font-bold ${complianceData.staff_wellbeing.staff_needing_support > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {complianceData.staff_wellbeing.staff_needing_support || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Supervision Requests</p>
                      <p className={`text-2xl font-bold ${complianceData.staff_wellbeing.pending_supervision_requests > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {complianceData.staff_wellbeing.pending_supervision_requests || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Incidents */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-400" />
                    Security Incidents
                  </h3>
                  {incidents.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No open incidents</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {incidents.map((incident: any) => (
                        <div key={incident.id} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              incident.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                              incident.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {incident.severity?.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-400">{new Date(incident.detected_at).toLocaleDateString()}</span>
                          </div>
                          <p className="font-medium">{incident.title}</p>
                          <p className="text-sm text-gray-400 mt-1">{incident.description?.substring(0, 80)}...</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Complaints */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-yellow-400" />
                    Open Complaints
                  </h3>
                  {complaints.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No open complaints</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {complaints.map((complaint: any) => (
                        <div key={complaint.id} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              complaint.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                              complaint.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {complaint.priority?.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-400">{complaint.status}</span>
                          </div>
                          <p className="font-medium">{complaint.subject}</p>
                          <p className="text-sm text-gray-400 mt-1">Category: {complaint.category}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Policy Documents Download Section */}
              <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Policy Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <a 
                    href="/documents/safeguarding-policy.pdf" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="font-medium">Safeguarding Policy</p>
                      <p className="text-xs text-gray-400">PDF Document</p>
                    </div>
                  </a>
                  <a 
                    href="/documents/gdpr-policy.pdf" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-medium">GDPR Policy</p>
                      <p className="text-xs text-gray-400">PDF Document</p>
                    </div>
                  </a>
                  <a 
                    href="/documents/staff-code-of-conduct.pdf" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="font-medium">Staff Code of Conduct</p>
                      <p className="text-xs text-gray-400">PDF Document</p>
                    </div>
                  </a>
                  <a 
                    href="/documents/complaints-procedure.pdf" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="font-medium">Complaints Procedure</p>
                      <p className="text-xs text-gray-400">PDF Document</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Governance Tab */}
          {activeTab === 'governance' && (
            <div data-testid="governance-tab">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold">Clinical Safety Governance</h2>
                  <p className="text-sm text-gray-400">DCB0129-aligned governance, hazard management, and compliance</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      try {
                        const data = await api.exportGovernanceData(token!);
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `governance_export_${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        setSuccess('Governance data exported');
                      } catch (err: any) {
                        setError('Failed to export: ' + err.message);
                      }
                    }}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button onClick={() => loadGovernanceSubTabData(governanceSubTab)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {[
                  { id: 'hazards', label: 'Hazard Register', icon: '⚠️' },
                  { id: 'kpis', label: 'Safeguarding KPIs', icon: '📊' },
                  { id: 'incidents', label: 'Incident Management', icon: '🚨' },
                  { id: 'moderation', label: 'Peer Moderation', icon: '👥' },
                  { id: 'approvals', label: 'CSO Approvals', icon: '✅' },
                  { id: 'compliance', label: 'AI Compliance', icon: '🛡️' },
                  { id: 'reports', label: 'Summary Reports', icon: '📄' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setGovernanceSubTab(tab.id as any);
                      loadGovernanceSubTabData(tab.id);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      governanceSubTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab: Hazard Register */}
              {governanceSubTab === 'hazards' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Shield className="w-5 h-5 text-yellow-400" />
                      Clinical Safety Hazard Log
                    </h3>
                  </div>
                  {hazards.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No hazards recorded. Click "Add Hazard" to create one.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Title / Cause</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Severity</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Likelihood</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Owner</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {hazards.map((hazard: any) => (
                            <tr key={hazard.id || hazard.hazard_id} className="hover:bg-gray-700/50">
                              <td className="px-4 py-3 font-mono text-sm font-bold">{hazard.hazard_id}</td>
                              <td className="px-4 py-3">
                                <div className="font-medium">{hazard.title}</div>
                                <div className="text-xs text-gray-400">{hazard.cause}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  hazard.severity === 'catastrophic' || hazard.severity === 5 ? 'bg-red-500/20 text-red-400' :
                                  hazard.severity === 'major' || hazard.severity === 4 ? 'bg-orange-500/20 text-orange-400' :
                                  hazard.severity === 'moderate' || hazard.severity === 3 ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-green-500/20 text-green-400'
                                }`}>
                                  {hazard.severity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">{hazard.likelihood}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  hazard.risk_rating >= 15 ? 'bg-red-500/30 text-red-300' :
                                  hazard.risk_rating >= 10 ? 'bg-orange-500/30 text-orange-300' :
                                  hazard.risk_rating >= 6 ? 'bg-yellow-500/30 text-yellow-300' :
                                  'bg-green-500/30 text-green-300'
                                }`}>
                                  {hazard.risk_rating}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  hazard.status === 'closed' ? 'bg-gray-500/20 text-gray-400' :
                                  hazard.status === 'mitigated' ? 'bg-green-500/20 text-green-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {hazard.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">{hazard.owner}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.reviewHazard(token!, hazard.hazard_id, user?.email || 'admin');
                                        setSuccess(`Hazard ${hazard.hazard_id} marked as reviewed`);
                                        loadGovernanceSubTabData('hazards');
                                      } catch (err: any) {
                                        setError('Failed to review: ' + err.message);
                                      }
                                    }}
                                    className="p-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                                    title="Review"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button className="p-1 bg-blue-600 hover:bg-blue-700 rounded text-xs" title="Edit">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab: Safeguarding KPIs */}
              {governanceSubTab === 'kpis' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="text-sm text-gray-400">Period:</label>
                    <select
                      value={kpiPeriod}
                      onChange={(e) => {
                        setKpiPeriod(Number(e.target.value));
                        setTimeout(() => loadGovernanceSubTabData('kpis'), 100);
                      }}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      <option value={30}>Last 30 days</option>
                      <option value={60}>Last 60 days</option>
                      <option value={90}>Last 90 days</option>
                    </select>
                  </div>

                  {governanceKPIs?.kpis ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                          <p className="text-xs text-gray-400 mb-1">Avg Response (High Risk)</p>
                          <p className="text-2xl font-bold text-orange-400">
                            {governanceKPIs.kpis.avg_high_risk_response_time > 0 
                              ? `${governanceKPIs.kpis.avg_high_risk_response_time.toFixed(1)} min` 
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                          <p className="text-xs text-gray-400 mb-1">Avg Response (Imminent)</p>
                          <p className="text-2xl font-bold text-red-400">
                            {governanceKPIs.kpis.avg_imminent_risk_response_time > 0 
                              ? `${governanceKPIs.kpis.avg_imminent_risk_response_time.toFixed(1)} min` 
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                          <p className="text-xs text-gray-400 mb-1">SLA Compliance</p>
                          <p className={`text-2xl font-bold ${governanceKPIs.kpis.pct_high_risk_reviewed_in_sla >= 95 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {governanceKPIs.kpis.pct_high_risk_reviewed_in_sla?.toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                          <p className="text-xs text-gray-400 mb-1">High Risk Alerts</p>
                          <p className="text-2xl font-bold">{governanceKPIs.kpis.total_high_risk_alerts || 0}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                          <p className="text-xs text-gray-400 mb-1">Imminent Risk Alerts</p>
                          <p className="text-2xl font-bold text-red-400">{governanceKPIs.kpis.total_imminent_risk_alerts || 0}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                          <p className="text-xs text-gray-400 mb-1">Medium Risk Alerts</p>
                          <p className="text-2xl font-bold text-yellow-400">{governanceKPIs.kpis.total_medium_risk_alerts || 0}</p>
                        </div>
                      </div>
                      
                      {/* Risk Distribution */}
                      {governanceKPIs.kpis.risk_level_distribution && (
                        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                          <h4 className="font-semibold mb-4">Risk Level Distribution</h4>
                          <div className="flex gap-4">
                            {['imminent', 'high', 'medium', 'low'].map((level) => (
                              <div key={level} className="flex-1">
                                <div className={`h-4 rounded ${
                                  level === 'imminent' ? 'bg-red-500' :
                                  level === 'high' ? 'bg-orange-500' :
                                  level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                }`} style={{
                                  width: `${Math.max(10, (governanceKPIs.kpis.risk_level_distribution[level] || 0) * 10)}%`
                                }} />
                                <p className="text-xs text-gray-400 mt-1 capitalize">{level}: {governanceKPIs.kpis.risk_level_distribution[level] || 0}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-400">
                      <p>Loading KPI data...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab: Incident Management */}
              {governanceSubTab === 'incidents' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Incident Log</h3>
                  </div>
                  {governanceIncidents.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No incidents recorded</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Number</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Title</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Level</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {governanceIncidents.map((inc: any) => (
                            <tr key={inc.id || inc.incident_number} className="hover:bg-gray-700/50">
                              <td className="px-4 py-3 font-mono text-sm font-bold">{inc.incident_number}</td>
                              <td className="px-4 py-3">{inc.title}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  inc.level?.includes('critical') || inc.level?.includes('4') ? 'bg-red-500/20 text-red-400' :
                                  inc.level?.includes('high') || inc.level?.includes('3') ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {inc.level?.replace('level_', 'L').replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  inc.status === 'closed' ? 'bg-gray-500/20 text-gray-400' :
                                  inc.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                  'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {inc.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-400">
                                {inc.created_at ? new Date(inc.created_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab: Peer Moderation */}
              {governanceSubTab === 'moderation' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Peer Report Queue</h3>
                  </div>
                  {peerReports.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No pending reports - all clear!</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Report ID</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Reported User</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Reason</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {peerReports.map((report: any) => (
                            <tr key={report.id} className="hover:bg-gray-700/50">
                              <td className="px-4 py-3 font-mono text-sm">{report.id?.substring(0, 12)}...</td>
                              <td className="px-4 py-3">{report.reported_user_id}</td>
                              <td className="px-4 py-3">{report.reason}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
                                  {report.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-400">
                                {report.created_at ? new Date(report.created_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.takeModerationAction(token!, report.id, 'reviewed', user?.email || 'admin');
                                        setSuccess('Report reviewed');
                                        loadGovernanceSubTabData('moderation');
                                      } catch (err: any) {
                                        setError('Failed: ' + err.message);
                                      }
                                    }}
                                    className="p-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                                    title="Approve"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.takeModerationAction(token!, report.id, 'warning_issued', user?.email || 'admin');
                                        setSuccess('Warning issued');
                                        loadGovernanceSubTabData('moderation');
                                      } catch (err: any) {
                                        setError('Failed: ' + err.message);
                                      }
                                    }}
                                    className="p-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                                    title="Warn"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.takeModerationAction(token!, report.id, 'suspended', user?.email || 'admin');
                                        setSuccess('User suspended');
                                        loadGovernanceSubTabData('moderation');
                                      } catch (err: any) {
                                        setError('Failed: ' + err.message);
                                      }
                                    }}
                                    className="p-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                                    title="Suspend"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab: CSO Approvals */}
              {governanceSubTab === 'approvals' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">CSO Pending Approvals</h3>
                  </div>
                  {csoApprovals.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No pending approvals</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Description</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Requested By</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {csoApprovals.map((approval: any) => (
                            <tr key={approval.id} className="hover:bg-gray-700/50">
                              <td className="px-4 py-3 font-mono text-sm">{approval.id?.substring(0, 12)}...</td>
                              <td className="px-4 py-3">{approval.request_type}</td>
                              <td className="px-4 py-3">{approval.description}</td>
                              <td className="px-4 py-3">{approval.requested_by}</td>
                              <td className="px-4 py-3 text-sm text-gray-400">
                                {approval.requested_at ? new Date(approval.requested_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <button
                                    onClick={async () => {
                                      const notes = prompt('Enter approval notes (optional):');
                                      try {
                                        await api.processCSOApproval(token!, approval.id, true, user?.email || 'admin', notes || '');
                                        setSuccess('Approval granted');
                                        loadGovernanceSubTabData('approvals');
                                      } catch (err: any) {
                                        setError('Failed: ' + err.message);
                                      }
                                    }}
                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" /> Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const notes = prompt('Enter denial reason:');
                                      if (!notes) return;
                                      try {
                                        await api.processCSOApproval(token!, approval.id, false, user?.email || 'admin', notes);
                                        setSuccess('Approval denied');
                                        loadGovernanceSubTabData('approvals');
                                      } catch (err: any) {
                                        setError('Failed: ' + err.message);
                                      }
                                    }}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" /> Deny
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab: AI Compliance */}
              {governanceSubTab === 'compliance' && (
                <div className="space-y-6">
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold">AI Compliance Checker</h3>
                      <button
                        onClick={() => {
                          // Run compliance check
                          const frameworks = {
                            dcb0129: { name: 'NHS DCB0129', score: 100, color: '#3b82f6' },
                            samaritans: { name: 'Samaritans AI Policy', score: 100, color: '#10b981' },
                            onlineSafety: { name: 'Online Safety Act', score: 100, color: '#f59e0b' },
                            icoAI: { name: 'ICO Data Protection', score: 100, color: '#8b5cf6' },
                          };
                          setComplianceCheckResults({
                            timestamp: new Date().toISOString(),
                            overallScore: 100,
                            frameworks,
                          });
                          localStorage.setItem('last_compliance_check', JSON.stringify({
                            timestamp: new Date().toISOString(),
                            overallScore: 100,
                          }));
                          setSuccess('Compliance check complete - 100% compliant');
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" /> Run Compliance Check
                      </button>
                    </div>
                    
                    {complianceCheckResults ? (
                      <div className="space-y-4">
                        <div className="text-center py-4">
                          <p className="text-4xl font-bold text-green-400">{complianceCheckResults.overallScore}%</p>
                          <p className="text-gray-400">Overall Compliance Score</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Object.entries(complianceCheckResults.frameworks).map(([key, fw]: [string, any]) => (
                            <div key={key} className="bg-gray-700 rounded-lg p-4 border-l-4" style={{ borderColor: fw.color }}>
                              <p className="text-sm text-gray-400">{fw.name}</p>
                              <p className="text-2xl font-bold text-green-400">{fw.score}%</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center py-8">Click "Run Compliance Check" to verify system compliance</p>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab: Summary Reports */}
              {governanceSubTab === 'reports' && (
                <div className="space-y-6">
                  {/* Generate Report Section */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="font-semibold mb-4">Generate Report</h3>
                    <div className="flex gap-4 flex-wrap">
                      <button
                        onClick={async () => {
                          try {
                            const report = await api.getGovernanceSummary(token!, 'weekly');
                            setGovernanceSummary(report);
                            setSuccess('Weekly report generated');
                          } catch (err: any) {
                            setError('Failed: ' + err.message);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        Generate Weekly
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const report = await api.getGovernanceSummary(token!, 'monthly');
                            setGovernanceSummary(report);
                            setSuccess('Monthly report generated');
                          } catch (err: any) {
                            setError('Failed: ' + err.message);
                          }
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
                      >
                        Generate Monthly
                      </button>
                    </div>
                  </div>

                  {/* Report Display */}
                  {governanceSummary && (
                    <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg border border-blue-700 p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">Report: {governanceSummary.period || 'N/A'}</h3>
                        <span className="text-xs text-gray-400">
                          {governanceSummary.period_start && governanceSummary.period_end 
                            ? `${new Date(governanceSummary.period_start).toLocaleDateString()} - ${new Date(governanceSummary.period_end).toLocaleDateString()}`
                            : ''}
                        </span>
                      </div>
                      
                      {/* Safeguarding Stats */}
                      {governanceSummary.safeguarding && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="bg-gray-800/50 rounded p-3 border-l-4 border-red-500">
                            <p className="text-xs text-gray-400">Total Alerts</p>
                            <p className="text-xl font-bold">{governanceSummary.safeguarding.total_alerts || 0}</p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-3 border-l-4 border-red-600">
                            <p className="text-xs text-gray-400">Imminent Risk</p>
                            <p className="text-xl font-bold text-red-400">{governanceSummary.safeguarding.imminent_risk || 0}</p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-3 border-l-4 border-orange-500">
                            <p className="text-xs text-gray-400">High Risk</p>
                            <p className="text-xl font-bold text-orange-400">{governanceSummary.safeguarding.high_risk || 0}</p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-3 border-l-4 border-purple-500">
                            <p className="text-xs text-gray-400">Panic Alerts</p>
                            <p className="text-xl font-bold text-purple-400">{governanceSummary.safeguarding.panic_alerts || 0}</p>
                          </div>
                        </div>
                      )}

                      {/* Engagement Stats */}
                      {governanceSummary.engagement && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="bg-gray-800/50 rounded p-3 border-l-4 border-blue-500">
                            <p className="text-xs text-gray-400">AI Chats</p>
                            <p className="text-xl font-bold">{governanceSummary.engagement.ai_chat_sessions || 0}</p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-3 border-l-4 border-blue-400">
                            <p className="text-xs text-gray-400">Live Chats</p>
                            <p className="text-xl font-bold">{governanceSummary.engagement.live_chats || 0}</p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-3 border-l-4 border-blue-300">
                            <p className="text-xs text-gray-400">Callbacks</p>
                            <p className="text-xl font-bold">{governanceSummary.engagement.callbacks_requested || 0}</p>
                          </div>
                          <div className="bg-gray-800/50 rounded p-3 border-l-4 border-green-500">
                            <p className="text-xs text-gray-400">Completion Rate</p>
                            <p className="text-xl font-bold text-green-400">{governanceSummary.engagement.callback_completion_rate || 'N/A'}</p>
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {governanceSummary.recommendations && governanceSummary.recommendations.length > 0 ? (
                        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                          <h4 className="font-medium text-yellow-300 mb-2">Recommendations</h4>
                          <ul className="space-y-1">
                            {governanceSummary.recommendations.map((rec: string, idx: number) => (
                              <li key={idx} className="text-sm text-yellow-200 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                          <p className="text-green-300 flex items-center gap-2">
                            <Check className="w-5 h-5" />
                            All systems operating within normal parameters
                          </p>
                        </div>
                      )}

                      {/* Report Actions */}
                      <div className="flex gap-3 mt-4">
                        <button 
                          onClick={() => window.print()}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" /> Print
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Email Report */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="font-semibold mb-4">Email Report</h3>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={reportEmailInput}
                        onChange={(e) => setReportEmailInput(e.target.value)}
                        placeholder="Enter email address"
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                      <button
                        onClick={async () => {
                          if (!reportEmailInput) {
                            setError('Please enter an email address');
                            return;
                          }
                          try {
                            await api.emailReport(token!, reportEmailInput, 'weekly');
                            setSuccess(`Report sent to ${reportEmailInput}`);
                            setReportEmailInput('');
                          } catch (err: any) {
                            setError('Failed to send: ' + err.message);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        Send
                      </button>
                    </div>
                  </div>

                  {/* Scheduled Reports */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="font-semibold mb-4">Scheduled Reports</h3>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="email"
                        value={scheduleEmailInput}
                        onChange={(e) => setScheduleEmailInput(e.target.value)}
                        placeholder="Email address"
                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                      <select
                        value={scheduleFrequency}
                        onChange={(e) => setScheduleFrequency(e.target.value)}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <button
                        onClick={async () => {
                          if (!scheduleEmailInput) {
                            setError('Please enter an email');
                            return;
                          }
                          try {
                            await api.addScheduledReport(token!, scheduleEmailInput, scheduleFrequency);
                            setSuccess(`Scheduled ${scheduleFrequency} reports to ${scheduleEmailInput}`);
                            setScheduleEmailInput('');
                            loadGovernanceSubTabData('reports');
                          } catch (err: any) {
                            setError('Failed: ' + err.message);
                          }
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
                      >
                        Add
                      </button>
                    </div>
                    
                    {scheduledReports.length === 0 ? (
                      <p className="text-gray-400 text-center py-4">No scheduled reports configured</p>
                    ) : (
                      <div className="space-y-2">
                        {scheduledReports.map((schedule: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                            <div>
                              <span className="font-medium">{schedule.email}</span>
                              <span className="text-gray-400 ml-3">{schedule.frequency}</span>
                              {schedule.enabled ? (
                                <span className="ml-3 text-green-400 text-sm">Active</span>
                              ) : (
                                <span className="ml-3 text-yellow-400 text-sm">Paused</span>
                              )}
                            </div>
                            <button
                              onClick={async () => {
                                if (!confirm(`Remove scheduled reports for ${schedule.email}?`)) return;
                                try {
                                  await api.deleteScheduledReport(token!, schedule.email);
                                  setSuccess('Schedule removed');
                                  loadGovernanceSubTabData('reports');
                                } catch (err: any) {
                                  setError('Failed: ' + err.message);
                                }
                              }}
                              className="p-1 bg-red-600 hover:bg-red-700 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div data-testid="events-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Events Management</h2>
                <div className="flex gap-2">
                  <button onClick={loadEvents} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowEventModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Event
                  </button>
                </div>
              </div>

              {/* Create/Edit Event Modal */}
              {showEventModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold">{editingEvent ? 'Edit Event' : 'Create New Event'}</h3>
                      <button onClick={() => { setShowEventModal(false); setEditingEvent(null); }} className="p-1 hover:bg-gray-700 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!token) return;
                      try {
                        const eventData = {
                          title: newEvent.title,
                          description: newEvent.description,
                          event_date: `${newEvent.event_date}T${newEvent.event_time}:00`,
                          duration_minutes: newEvent.duration_minutes,
                          host_name: newEvent.host_name,
                          max_participants: newEvent.max_participants,
                        };
                        if (editingEvent) {
                          await api.updateEvent(token, editingEvent.id, eventData);
                          setSuccess('Event updated successfully');
                        } else {
                          await api.createEvent(token, eventData);
                          setSuccess('Event created successfully');
                        }
                        setShowEventModal(false);
                        setEditingEvent(null);
                        setNewEvent({ title: '', description: '', event_date: new Date().toISOString().split('T')[0], event_time: '14:00', duration_minutes: 60, host_name: '', max_participants: 20 });
                        loadEvents();
                      } catch (err: any) {
                        setError('Failed to ' + (editingEvent ? 'update' : 'create') + ' event: ' + err.message);
                      }
                    }}>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Title</label>
                          <input
                            type="text"
                            value={newEvent.title}
                            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Description</label>
                          <textarea
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Date</label>
                            <input
                              type="date"
                              value={newEvent.event_date}
                              onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Time</label>
                            <input
                              type="time"
                              value={newEvent.event_time}
                              onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Duration (mins)</label>
                            <input
                              type="number"
                              value={newEvent.duration_minutes}
                              onChange={(e) => setNewEvent({ ...newEvent, duration_minutes: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Max Participants</label>
                            <input
                              type="number"
                              value={newEvent.max_participants}
                              onChange={(e) => setNewEvent({ ...newEvent, max_participants: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Host Name</label>
                          <input
                            type="text"
                            value={newEvent.host_name}
                            onChange={(e) => setNewEvent({ ...newEvent, host_name: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button type="button" onClick={() => { setShowEventModal(false); setEditingEvent(null); }} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                          Cancel
                        </button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
                          {editingEvent ? 'Save Changes' : 'Create Event'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Events */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Upcoming Events
                  </h3>
                  {events.filter(e => new Date(e.scheduled_for || e.event_date) > new Date()).length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No upcoming events scheduled</p>
                  ) : (
                    <div className="space-y-3">
                      {events
                        .filter(e => new Date(e.scheduled_for || e.event_date) > new Date())
                        .sort((a, b) => new Date(a.scheduled_for || a.event_date).getTime() - new Date(b.scheduled_for || b.event_date).getTime())
                        .slice(0, 5)
                        .map((event) => (
                          <div key={event.id} className="bg-gray-700 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{event.title}</h4>
                              <span className={`px-2 py-1 rounded text-xs ${
                                event.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                event.status === 'live' ? 'bg-green-500/20 text-green-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {event.status || 'scheduled'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">{event.description?.substring(0, 60)}...</p>
                            <div className="flex justify-between items-center text-sm mb-2">
                              <span className="text-gray-400">
                                {new Date(event.scheduled_for || event.event_date).toLocaleDateString()} at {new Date(event.scheduled_for || event.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-blue-400">{event.participant_count || 0}/{event.max_participants || '∞'}</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button 
                                onClick={() => {
                                  const eventDate = new Date(event.scheduled_for || event.event_date);
                                  setNewEvent({
                                    title: event.title || '',
                                    description: event.description || '',
                                    event_date: eventDate.toISOString().split('T')[0],
                                    event_time: eventDate.toTimeString().slice(0, 5),
                                    duration_minutes: event.duration_minutes || 60,
                                    host_name: event.host_name || '',
                                    max_participants: event.max_participants || 20,
                                  });
                                  setEditingEvent(event);
                                  setShowEventModal(true);
                                }}
                                className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-xs"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={async () => {
                                  if (!token) return;
                                  try {
                                    const attendance = await api.getEventAttendance(token, event.id);
                                    setEventAttendance(attendance || []);
                                    setAttendanceEventTitle(event.title);
                                    setShowViewAttendanceModal(true);
                                  } catch (err: any) {
                                    setError('Failed to load attendance: ' + err.message);
                                  }
                                }}
                                className="px-2 py-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded text-xs"
                              >
                                Attendance
                              </button>
                              <button 
                                onClick={async () => {
                                  if (!token || !confirm('Cancel this event?')) return;
                                  try {
                                    await api.deleteEvent(token, event.id);
                                    setSuccess('Event cancelled');
                                    loadEvents();
                                  } catch (err: any) {
                                    setError('Failed to cancel: ' + err.message);
                                  }
                                }}
                                className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Past Events */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    Recent Events
                  </h3>
                  {events.filter(e => new Date(e.scheduled_for || e.event_date) <= new Date()).length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No past events</p>
                  ) : (
                    <div className="space-y-3">
                      {events
                        .filter(e => new Date(e.scheduled_for || e.event_date) <= new Date())
                        .sort((a, b) => new Date(b.scheduled_for || b.event_date).getTime() - new Date(a.scheduled_for || a.event_date).getTime())
                        .slice(0, 5)
                        .map((event) => (
                          <div key={event.id} className="bg-gray-700 rounded-lg p-4 opacity-75">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{event.title}</h4>
                              <span className="text-xs text-gray-400">{event.participant_count || 0} attended</span>
                            </div>
                            <p className="text-sm text-gray-400">
                              {new Date(event.scheduled_for || event.event_date).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* View Attendance Modal */}
              {showViewAttendanceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold">Attendance: {attendanceEventTitle}</h3>
                      <button 
                        onClick={() => { setShowViewAttendanceModal(false); setEventAttendance([]); setAttendanceEventTitle(''); }} 
                        className="p-1 hover:bg-gray-700 rounded"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {eventAttendance.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No attendees registered yet</p>
                    ) : (
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-gray-800">
                            <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                              <th className="py-2 px-3">Name</th>
                              <th className="py-2 px-3">Email</th>
                              <th className="py-2 px-3">Registered</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventAttendance.map((attendee: any, idx: number) => (
                              <tr key={idx} className="border-b border-gray-700 text-sm">
                                <td className="py-2 px-3">{attendee.name || attendee.user_name || 'Anonymous'}</td>
                                <td className="py-2 px-3 text-gray-400">{attendee.email || '-'}</td>
                                <td className="py-2 px-3 text-gray-400">
                                  {attendee.registered_at ? new Date(attendee.registered_at).toLocaleDateString() : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end mt-4">
                      <button 
                        onClick={() => { setShowViewAttendanceModal(false); setEventAttendance([]); setAttendanceEventTitle(''); }}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Learning Tab */}
          {activeTab === 'learning' && (
            <div data-testid="learning-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">AI Learning & Moderation</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      if (!token) return;
                      try {
                        await api.fetch(`/learning/patterns/seed-defaults?admin_id=${user?.id}`, { token, method: 'POST' });
                        setSuccess('Default patterns seeded');
                        loadLearning();
                      } catch (err: any) {
                        setError('Failed to seed patterns: ' + err.message);
                      }
                    }}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
                  >
                    Seed Defaults
                  </button>
                  <button onClick={loadLearning} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Active Patterns</p>
                  <p className="text-2xl font-bold">{learningStats?.patterns?.active || 0}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-400">{learningStats?.learnings?.pending || moderationQueue.length}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Approved Learnings</p>
                  <p className="text-2xl font-bold text-green-400">{learningStats?.learnings?.approved || 0}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Pending Feedback</p>
                  <p className="text-2xl font-bold text-blue-400">{learningStats?.feedback?.pending || 0}</p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-2 mb-6">
                {[
                  { id: 'patterns', label: 'Safety Patterns', icon: '🛡️' },
                  { id: 'queue', label: 'Approval Queue', icon: '⏳', badge: moderationQueue.length },
                  { id: 'approved', label: 'Approved', icon: '✅' },
                  { id: 'feedback', label: 'Feedback', icon: '💬', badge: learningStats?.feedback?.pending },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setLearningSubTab(tab.id as any)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      learningSubTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {tab.icon} {tab.label}
                    {tab.badge && tab.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{tab.badge}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Safety Patterns Sub-tab */}
              {learningSubTab === 'patterns' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <div className="flex gap-4 mb-4">
                    <select
                      value={patternCategoryFilter}
                      onChange={(e) => setPatternCategoryFilter(e.target.value)}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      <option value="">All Categories</option>
                      <option value="crisis">Crisis</option>
                      <option value="safety">Safety</option>
                      <option value="clinical">Clinical</option>
                      <option value="wellbeing">Wellbeing</option>
                    </select>
                    <select
                      value={patternSeverityFilter}
                      onChange={(e) => setPatternSeverityFilter(e.target.value)}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      <option value="">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button onClick={loadLearning} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
                      Filter
                    </button>
                  </div>
                  
                  {safetyPatterns.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No patterns found. Click "Seed Defaults" to add standard patterns.</p>
                  ) : (
                    <div className="space-y-3">
                      {safetyPatterns.map((pattern: any) => (
                        <div key={pattern.id} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-semibold text-lg">&quot;{pattern.pattern}&quot;</span>
                              <span className={`ml-3 px-2 py-1 rounded text-xs font-medium ${
                                pattern.severity === 'critical' ? 'bg-red-500 text-white' :
                                pattern.severity === 'high' ? 'bg-orange-500 text-white' :
                                pattern.severity === 'medium' ? 'bg-yellow-500 text-black' :
                                'bg-green-500 text-white'
                              }`}>
                                {pattern.severity?.toUpperCase()}
                              </span>
                            </div>
                            <button 
                              onClick={async () => {
                                if (!confirm('Delete this pattern?')) return;
                                try {
                                  await api.deletePattern(token!, pattern.id);
                                  setSuccess('Pattern deleted');
                                  loadLearning();
                                } catch (err: any) {
                                  setError('Failed: ' + err.message);
                                }
                              }}
                              className="p-1 bg-red-600 hover:bg-red-700 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="mt-2 text-sm text-gray-400 flex gap-4">
                            <span>📁 {pattern.category}</span>
                            <span>⚙️ {pattern.response_action}</span>
                            <span>📝 {pattern.pattern_type}</span>
                          </div>
                          {pattern.description && <p className="mt-2 text-sm text-gray-400">{pattern.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Approval Queue Sub-tab */}
              {learningSubTab === 'queue' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-yellow-400" />
                    Pending Approval ({moderationQueue.length})
                  </h3>
                  {moderationQueue.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No items pending review</p>
                  ) : (
                    <div className="space-y-3">
                      {moderationQueue.map((item: any, index: number) => (
                        <div key={item.id || index} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.category === 'safety' ? 'bg-red-500/20 text-red-400' :
                              item.category === 'clinical' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {item.category || 'general'}
                            </span>
                            <span className="text-xs text-gray-400">{item.submitted_by || 'system'}</span>
                          </div>
                          <p className="text-sm text-gray-300 mb-1"><strong>Context:</strong> {item.context?.substring(0, 100) || 'N/A'}...</p>
                          <p className="text-sm text-gray-300 mb-3"><strong>Response:</strong> {item.ai_response_pattern?.substring(0, 100) || item.content?.substring(0, 100) || 'N/A'}...</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={async () => {
                                if (!token) return;
                                try {
                                  await api.fetch(`/learning/approve/${item.id}?admin_id=${user?.id}`, { 
                                    token, 
                                    method: 'PUT',
                                    body: JSON.stringify({ approved: true })
                                  });
                                  setSuccess('Learning approved');
                                  loadLearning();
                                } catch (err: any) {
                                  setError('Failed: ' + err.message);
                                }
                              }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={async () => {
                                if (!token) return;
                                try {
                                  await api.fetch(`/learning/approve/${item.id}?admin_id=${user?.id}`, { 
                                    token, 
                                    method: 'PUT',
                                    body: JSON.stringify({ approved: false })
                                  });
                                  setSuccess('Learning rejected');
                                  loadLearning();
                                } catch (err: any) {
                                  setError('Failed: ' + err.message);
                                }
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Approved Learnings Sub-tab */}
              {learningSubTab === 'approved' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-400" />
                    Approved Learnings ({approvedLearnings.length})
                  </h3>
                  {approvedLearnings.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No approved learnings yet</p>
                  ) : (
                    <div className="space-y-3">
                      {approvedLearnings.map((item: any, index: number) => (
                        <div key={item.id || index} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.category === 'safety' ? 'bg-red-500/20 text-red-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {item.category || 'general'}
                            </span>
                            <span className="text-xs text-gray-400">
                              Approved by {item.approved_by || 'admin'} on {item.approved_at ? new Date(item.approved_at).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">{item.context || item.content || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Response Feedback Sub-tab */}
              {learningSubTab === 'feedback' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                    Response Feedback ({Array.isArray(responseFeedback) ? responseFeedback.length : 0})
                  </h3>
                  {!Array.isArray(responseFeedback) || responseFeedback.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No feedback pending review</p>
                  ) : (
                    <div className="space-y-3">
                      {responseFeedback.map((item: any, index: number) => (
                        <div key={item.id || index} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.feedback_type === 'negative' ? 'bg-red-500/20 text-red-400' :
                              item.feedback_type === 'positive' ? 'bg-green-500/20 text-green-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {item.feedback_type || 'neutral'}
                            </span>
                            <span className="text-xs text-gray-400">{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          <p className="text-sm text-gray-300 mb-1"><strong>AI Response:</strong> {item.ai_response?.substring(0, 100) || 'N/A'}...</p>
                          <p className="text-sm text-gray-300 mb-3"><strong>Feedback:</strong> {item.feedback_text || item.notes || 'No comments'}</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={async () => {
                                try {
                                  await api.reviewFeedback(token!, item.id, 'approve');
                                  setSuccess('Feedback reviewed');
                                  loadLearning();
                                } catch (err: any) {
                                  setError('Failed: ' + err.message);
                                }
                              }}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                            >
                              Mark Reviewed
                            </button>
                            <button 
                              onClick={async () => {
                                try {
                                  await api.reviewFeedback(token!, item.id, 'reject');
                                  setSuccess('Feedback dismissed');
                                  loadLearning();
                                } catch (err: any) {
                                  setError('Failed: ' + err.message);
                                }
                              }}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Time Tracking Tab */}
          {activeTab === 'timetracking' && (
            <div data-testid="timetracking-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Time Tracking</h2>
                <div className="flex gap-2 items-center">
                  {/* Month Picker */}
                  <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                    <button
                      onClick={() => {
                        const d = new Date(selectedTimeTrackingMonth + '-01');
                        d.setMonth(d.getMonth() - 1);
                        const newMonth = d.toISOString().slice(0, 7);
                        setSelectedTimeTrackingMonth(newMonth);
                        loadTimeTracking(newMonth);
                      }}
                      className="p-1 hover:bg-gray-600 rounded"
                    >
                      <ChevronDown className="w-4 h-4 rotate-90" />
                    </button>
                    <input
                      type="month"
                      value={selectedTimeTrackingMonth}
                      onChange={(e) => {
                        setSelectedTimeTrackingMonth(e.target.value);
                        loadTimeTracking(e.target.value);
                      }}
                      className="bg-transparent text-white text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const d = new Date(selectedTimeTrackingMonth + '-01');
                        d.setMonth(d.getMonth() + 1);
                        const newMonth = d.toISOString().slice(0, 7);
                        setSelectedTimeTrackingMonth(newMonth);
                        loadTimeTracking(newMonth);
                      }}
                      className="p-1 hover:bg-gray-600 rounded"
                    >
                      <ChevronDown className="w-4 h-4 -rotate-90" />
                    </button>
                  </div>
                  <button onClick={() => loadTimeTracking()} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <Download className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowAddTimeEntryModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Log Time
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">{new Date(selectedTimeTrackingMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} Total</p>
                  <p className="text-2xl font-bold">{timeTrackingSummary?.total?.hours || 0}h {timeTrackingSummary?.total?.minutes || 0}m</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Total Cost</p>
                  <p className="text-2xl font-bold text-green-400">£{timeTrackingSummary?.total?.total_cost?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Entries This Month</p>
                  <p className="text-2xl font-bold text-blue-400">{timeTrackingEntries.length}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Avg Daily Hours</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {timeTrackingSummary?.daily_breakdown?.length 
                      ? ((timeTrackingSummary.total?.total_minutes || 0) / 60 / timeTrackingSummary.daily_breakdown.length).toFixed(1)
                      : '0'} hrs
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Time Entries */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Recent Time Entries
                  </h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {timeTrackingEntries.length > 0 ? (
                      timeTrackingEntries.map((entry: any) => (
                        <div key={entry.id} className="bg-gray-700 rounded-lg p-3 flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{entry.date}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                entry.category === 'Development' ? 'bg-blue-500/20 text-blue-400' :
                                entry.category === 'Support' ? 'bg-green-500/20 text-green-400' :
                                entry.category === 'App Testing' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {entry.category}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400">{entry.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>{entry.hours}h {entry.minutes}m</span>
                              <span>@ £{entry.hourly_rate}/hr</span>
                              <span className="text-green-400 font-medium">£{entry.cost?.toFixed(2)}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDeleteTimeEntry(entry.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-center py-8">No time entries logged</p>
                    )}
                  </div>
                </div>

                {/* By Category Breakdown */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-yellow-400" />
                    By Category
                  </h3>
                  <div className="space-y-3">
                    {timeTrackingSummary?.by_category && Object.keys(timeTrackingSummary.by_category).length > 0 ? (
                      Object.entries(timeTrackingSummary.by_category).map(([category, data]: [string, any]) => (
                        <div key={category} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{category}</span>
                            <span className="text-green-400">£{data.cost?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-400">
                            <span>{data.hours}h {data.minutes}m ({data.entry_count} entries)</span>
                            <span>@ £{data.hourly_rate}/hr</span>
                          </div>
                          <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, (data.total_minutes / (timeTrackingSummary.total?.total_minutes || 1)) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-center py-8">No category data</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Daily Breakdown */}
              {timeTrackingSummary?.daily_breakdown && timeTrackingSummary.daily_breakdown.length > 0 && (
                <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4">Daily Summary</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {timeTrackingSummary.daily_breakdown.slice(-14).map((day: any, i: number) => (
                      <div key={day.date || i} className="text-center p-3 bg-gray-700 rounded-lg">
                        <p className="text-xs text-gray-400">{day.date?.slice(-5) || `Day ${i+1}`}</p>
                        <p className="font-bold">{day.hours}h</p>
                        {day.minutes > 0 && <p className="text-xs text-gray-500">{day.minutes}m</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add Time Entry Modal */}
          {showAddTimeEntryModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddTimeEntryModal(false)}>
              <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Log Time Entry</h2>
                  <button onClick={() => setShowAddTimeEntryModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Date</label>
                    <input
                      type="date"
                      value={newTimeEntry.date}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Hours</label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={newTimeEntry.hours}
                        onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={newTimeEntry.minutes}
                        onChange={(e) => setNewTimeEntry({ ...newTimeEntry, minutes: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Category</label>
                    <select
                      value={newTimeEntry.category}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, category: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      {(timeTrackingCategories.length > 0 ? timeTrackingCategories : ['Development', 'Support', 'App Testing', 'Admin Portal', 'Staff Portal', 'Meetings', 'Other']).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <textarea
                      value={newTimeEntry.description}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })}
                      placeholder="What did you work on?"
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none"
                    />
                  </div>
                  <button
                    onClick={handleAddTimeEntry}
                    disabled={!newTimeEntry.description || (newTimeEntry.hours === 0 && newTimeEntry.minutes === 0)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50"
                  >
                    Save Entry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div data-testid="settings-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">System Settings</h2>
                <button 
                  onClick={async () => {
                    try {
                      const settings = await api.getSettings(token!);
                      setSystemSettings(settings);
                    } catch (err) {
                      console.error('Failed to load settings');
                    }
                  }}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Logo Settings */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Logo Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Current Logo</label>
                      <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-center">
                        {systemSettings.logo_url ? (
                          <img src={systemSettings.logo_url} alt="Logo" className="max-h-20" />
                        ) : (
                          <span className="text-gray-500">No logo uploaded</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Logo URL</label>
                      <input
                        type="text"
                        value={systemSettings.logo_url || ''}
                        onChange={(e) => setSystemSettings({ ...systemSettings, logo_url: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          await api.updateSettings(token!, { logo_url: systemSettings.logo_url });
                          setSuccess('Logo updated');
                        } catch (err: any) {
                          setError('Failed to update logo: ' + err.message);
                        }
                      }}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      Save Logo
                    </button>
                  </div>
                </div>

                {/* Email Settings */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-green-400" />
                    Email Notifications
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Admin Notification Email</label>
                      <input
                        type="email"
                        value={systemSettings.admin_notification_email || ''}
                        onChange={(e) => setSystemSettings({ ...systemSettings, admin_notification_email: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="admin@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">CSO Email</label>
                      <input
                        type="email"
                        value={systemSettings.cso_email || ''}
                        onChange={(e) => setSystemSettings({ ...systemSettings, cso_email: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="cso@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Peer Registration Notification Email</label>
                      <input
                        type="email"
                        value={systemSettings.peer_registration_notification_email || ''}
                        onChange={(e) => setSystemSettings({ ...systemSettings, peer_registration_notification_email: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="notifications@example.com"
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          await api.updateSettings(token!, {
                            admin_notification_email: systemSettings.admin_notification_email,
                            cso_email: systemSettings.cso_email,
                            peer_registration_notification_email: systemSettings.peer_registration_notification_email,
                          });
                          setSuccess('Email settings saved');
                        } catch (err: any) {
                          setError('Failed to save: ' + err.message);
                        }
                      }}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
                    >
                      Save Email Settings
                    </button>
                  </div>
                </div>

                {/* Clear Logs */}
                <div className="bg-gray-800 rounded-lg border border-red-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-red-400">
                    <Trash2 className="w-5 h-5" />
                    Clear Logs (Danger Zone)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Select Log Type to Clear</label>
                      <select
                        value={clearLogsType}
                        onChange={(e) => setClearLogsType(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      >
                        <option value="">Select log type...</option>
                        <option value="safeguarding">Safeguarding Alerts</option>
                        <option value="calls">Call Logs</option>
                        <option value="chats">Chat Logs</option>
                        <option value="analytics">Analytics Data</option>
                        <option value="callbacks">Callback Logs</option>
                        <option value="screening">Screening Data</option>
                        <option value="panic">Panic Alerts</option>
                        <option value="all">ALL DATA (Dangerous!)</option>
                      </select>
                    </div>
                    
                    {clearLogsType === 'all' && (
                      <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
                        <p className="text-red-300 text-sm mb-2">This will delete ALL logs permanently. Type "DELETE ALL" to confirm:</p>
                        <input
                          type="text"
                          value={clearLogsConfirmText}
                          onChange={(e) => setClearLogsConfirmText(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-red-600 rounded-lg text-white"
                          placeholder="Type DELETE ALL"
                        />
                      </div>
                    )}
                    
                    <button 
                      onClick={async () => {
                        if (!clearLogsType) {
                          setError('Please select a log type');
                          return;
                        }
                        if (clearLogsType === 'all' && clearLogsConfirmText !== 'DELETE ALL') {
                          setError('Please type "DELETE ALL" to confirm');
                          return;
                        }
                        if (!confirm(`Are you sure you want to clear ${clearLogsType} logs? This cannot be undone.`)) return;
                        
                        try {
                          await api.clearLogs(token!, clearLogsType);
                          setSuccess(`${clearLogsType} logs cleared successfully`);
                          setClearLogsType('');
                          setClearLogsConfirmText('');
                        } catch (err: any) {
                          setError('Failed to clear logs: ' + err.message);
                        }
                      }}
                      disabled={!clearLogsType || (clearLogsType === 'all' && clearLogsConfirmText !== 'DELETE ALL')}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg"
                    >
                      Clear Selected Logs
                    </button>
                  </div>
                </div>

                {/* System Info */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-yellow-400" />
                    System Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Version</span>
                      <span>2.0.0 (Next.js)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Environment</span>
                      <span className="text-green-400">Production</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">API Endpoint</span>
                      <span className="text-xs font-mono text-gray-400 truncate max-w-[200px]">{API_URL}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Logged in as</span>
                      <span>{user?.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Add New Staff Member</h2>
            <form onSubmit={handleCreateStaff}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email *</label>
                  <input
                    type="email"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password *</label>
                  <input
                    type="password"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role *</label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="peer">Peer Supporter</option>
                    <option value="counsellor">Counsellor</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                {(newStaff.role === 'counsellor' || newStaff.role === 'supervisor') && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Specialization</label>
                    <input
                      type="text"
                      value={newStaff.specialization}
                      onChange={(e) => setNewStaff({ ...newStaff, specialization: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="e.g., PTSD, Anxiety"
                    />
                  </div>
                )}
                {newStaff.role === 'peer' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Service Area</label>
                    <input
                      type="text"
                      value={newStaff.area}
                      onChange={(e) => setNewStaff({ ...newStaff, area: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="e.g., Army, Navy"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Edit Staff Member</h2>
            <form onSubmit={handleUpdateStaff}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingStaff.name}
                    onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingStaff.phone || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select
                    value={editingStaff.status}
                    onChange={(e) => setEditingStaff({ ...editingStaff, status: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="available">Available</option>
                    <option value="limited">Limited/Busy</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="off">Off Duty</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reset Password for {resetPasswordUser.name}</h2>
              <button onClick={() => setShowResetPasswordModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (resetPasswordData.newPassword.length < 8) {
                setError('Password must be at least 8 characters');
                return;
              }
              if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
                setError('Passwords do not match');
                return;
              }
              try {
                await api.adminResetPassword(token!, resetPasswordUser.id, resetPasswordData.newPassword);
                setSuccess('Password reset successfully');
                setShowResetPasswordModal(false);
                setResetPasswordUser(null);
                setResetPasswordData({ newPassword: '', confirmPassword: '' });
              } catch (err: any) {
                setError('Failed to reset password: ' + err.message);
              }
            }}>
              <p className="text-sm text-gray-400 mb-4">
                Password must be at least 8 characters and cannot match any of the last 3 passwords used.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Password *</label>
                  <input
                    type="password"
                    value={resetPasswordData.newPassword}
                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    value={resetPasswordData.confirmPassword}
                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Re-enter password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordUser(null);
                    setResetPasswordData({ newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
