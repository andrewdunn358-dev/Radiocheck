'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Calendar, FileText, Bot, Shield, Activity, 
  Settings, BarChart3, Clock, BookOpen, AlertTriangle,
  LogOut, Menu, X, Plus, Edit, Trash2, Search,
  Phone, MessageSquare, Bell, ChevronDown, ChevronRight,
  Download, RefreshCw, Check, XCircle, Eye, Filter
} from 'lucide-react';

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
  staff_name?: string;
  status: string;
  created_at: string;
  message_count?: number;
}

interface SafeguardingAlert {
  id: string;
  user_name?: string;
  risk_level: string;
  trigger_phrase?: string;
  status: string;
  created_at: string;
  acknowledged_by?: string;
  resolved_by?: string;
}

interface AICharacter {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  is_enabled: boolean;
  order?: number;
  personality?: string;
  background?: string;
  greeting_message?: string;
  voice_style?: string;
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
  }>;
  by_provider?: Record<string, { tokens: number; cost: number }>;
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

  // Logs - Call Logs (returns {total_calls, recent_logs})
  getCallLogs: (token: string, days: number = 30) =>
    api.fetch<{ total_calls: number; recent_logs: CallLog[] }>(`/call-logs?days=${days}`, { token }),
  
  // Logs - Chat Rooms
  getChatRooms: (token: string) =>
    api.fetch<ChatRoom[]>('/live-chat/rooms', { token }),
  
  // Logs - Safeguarding Alerts
  getSafeguardingAlerts: (token: string) =>
    api.fetch<SafeguardingAlert[]>('/safeguarding-alerts', { token }),

  // AI Characters - Correct endpoint is /ai-characters/admin/all
  getAICharacters: (token: string) =>
    api.fetch<{ characters: AICharacter[]; source: string }>('/ai-characters/admin/all', { token }),
  
  updateAICharacter: (token: string, id: string, data: Partial<AICharacter>) =>
    api.fetch<AICharacter>(`/ai-characters/admin/${id}`, {
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

  // App Usage Analytics
  getAppUsageStats: (token: string) =>
    api.fetch<any>('/analytics/usage', { token }),
  
  getAIChatStats: (token: string, days: number = 7) =>
    api.fetch<any>(`/ai-chat/stats?days=${days}`, { token }),

  // Governance
  getHazards: (token: string) =>
    api.fetch<any>('/governance/hazards', { token }),
  
  getGovernanceSummary: (token: string, period: string = '30d') =>
    api.fetch<any>(`/governance/summary-report?period=${period}`, { token }),

  // Learning/AI Training
  getLearningStats: (token: string) =>
    api.fetch<any>('/learning/stats', { token }),
  
  getSafetyPatterns: (token: string) =>
    api.fetch<any>('/learning/patterns?is_active=true', { token }),
  
  getLearningQueue: (token: string) =>
    api.fetch<any>('/learning/queue?status=pending', { token }),
  
  getApprovedLearnings: (token: string) =>
    api.fetch<any>('/learning/approved', { token }),

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
  { id: 'calls', label: 'Call Logs' },
  { id: 'chats', label: 'Chat Logs' },
  { id: 'safeguarding', label: 'Safeguarding' },
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
  
  // Learning state
  const [learningStats, setLearningStats] = useState<any>(null);
  const [moderationQueue, setModerationQueue] = useState<any[]>([]);
  
  // Beta Testing state
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [betaStats, setBetaStats] = useState<any>(null);
  
  // App Usage Analytics state
  const [appUsageStats, setAppUsageStats] = useState<any>(null);
  const [aiChatStats, setAiChatStats] = useState<any>(null);

  // AI Character editing state
  const [editingCharacter, setEditingCharacter] = useState<AICharacter | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  
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

  // Add Shift modal state
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [newShift, setNewShift] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    user_id: '',
  });

  // Check for existing session
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

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
        }
      } catch (err: any) {
        setError(err.message);
      }
    };
    
    loadData();
  }, [token, activeTab, activeLogSubTab, staffRoleFilter]);

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
      // Always load app usage and AI chat stats for the dashboard view
      const [usageData, aiStatsData] = await Promise.all([
        api.getAppUsageStats(token).catch(() => null),
        api.getAIChatStats(token).catch(() => null),
      ]);
      setAppUsageStats(usageData);
      setAiChatStats(aiStatsData);
      
      switch (activeLogSubTab) {
        case 'calls':
          const callsResponse = await api.getCallLogs(token).catch(() => ({ total_calls: 0, recent_logs: [] }));
          // Handle the response format: {total_calls, recent_logs}
          const logs = callsResponse?.recent_logs || callsResponse;
          setCallLogs(Array.isArray(logs) ? logs : []);
          break;
        case 'chats':
          const chats = await api.getChatRooms(token).catch(() => []);
          setChatRooms(Array.isArray(chats) ? chats : []);
          break;
        case 'safeguarding':
          const alerts = await api.getSafeguardingAlerts(token).catch(() => []);
          setSafeguardingAlerts(Array.isArray(alerts) ? alerts : []);
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
    } catch (err: any) {
      console.error('AI Usage not available:', err);
    }
  };

  const loadMonitoring = async () => {
    if (!token) return;
    try {
      const data = await api.getMonitoringStats(token);
      setMonitoringStats(data);
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
      const [hazardsData, summaryData] = await Promise.all([
        api.getHazards(token).catch(() => []),
        api.getGovernanceSummary(token).catch(() => null),
      ]);
      // Hazards endpoint returns array directly, not {hazards: []}
      setHazards(Array.isArray(hazardsData) ? hazardsData : (hazardsData?.hazards || []));
      setGovernanceSummary(summaryData);
    } catch (err: any) {
      console.error('Governance data not available:', err);
    }
  };

  // Load Learning
  const loadLearning = async () => {
    if (!token) return;
    try {
      const [statsData, queueData, patternsData] = await Promise.all([
        api.getLearningStats(token).catch(() => null),
        api.getLearningQueue(token).catch(() => ({ learnings: [] })),
        api.getSafetyPatterns(token).catch(() => ({ patterns: [] })),
      ]);
      setLearningStats(statsData);
      setModerationQueue(queueData?.learnings || queueData?.queue || []);
    } catch (err: any) {
      console.error('Learning data not available:', err);
    }
  };

  // Load Beta Testing
  const loadBetaTesting = async () => {
    if (!token) return;
    try {
      const [statusData, statsData] = await Promise.all([
        api.getBetaStatus(token).catch(() => ({ beta_enabled: false })),
        api.getBetaStats(token).catch(() => null),
      ]);
      setBetaEnabled(statusData?.beta_enabled || false);
      setBetaStats(statsData);
    } catch (err: any) {
      console.error('Beta testing data not available:', err);
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
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <h1 className="text-xl font-bold">{TABS.find(t => t.id === activeTab)?.label}</h1>
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
                            <span className="font-medium">{member.name}</span>
                            {member._source && (
                              <span className="ml-2 text-xs text-gray-500">({member._source})</span>
                            )}
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
                <button onClick={loadLogs} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                  <RefreshCw className="w-5 h-5" />
                </button>
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
                      <h4 className="font-medium mb-3 text-red-400">📍 Visitors by Region (30 days)</h4>
                      <div className="space-y-2">
                        {appUsageStats?.regions && Object.keys(appUsageStats.regions).length > 0 ? (
                          Object.entries(appUsageStats.regions).map(([region, count]: [string, any]) => (
                            <div key={region} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                              <span className="capitalize">{region.replace('_', ' ')}</span>
                              <strong>{count}</strong>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">No region data yet</p>
                        )}
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
                          Object.entries(appUsageStats.devices).map(([device, count]: [string, any]) => (
                            <div key={device} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                              <span className="capitalize flex items-center gap-2">
                                {device === 'mobile' ? '📱' : device === 'desktop' ? '🖥️' : '📟'} {device}
                              </span>
                              <strong>{count}</strong>
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
                          Object.entries(appUsageStats.browsers).map(([browser, count]: [string, any]) => (
                            <div key={browser} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                              <span className="capitalize">{browser}</span>
                              <strong>{count}</strong>
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
                          Object.entries(appUsageStats.operating_systems).map(([os, count]: [string, any]) => (
                            <div key={os} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                              <span className="capitalize flex items-center gap-2">
                                {os === 'windows' ? '🪟' : os === 'apple' ? '🍎' : os === 'android' ? '🤖' : '💻'} 
                                {os === 'apple' ? 'Apple (iOS/Mac)' : os.charAt(0).toUpperCase() + os.slice(1)}
                              </span>
                              <strong>{count}</strong>
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
                        <p className="text-5xl font-bold">{typeof appUsageStats?.return_rate === 'number' ? appUsageStats.return_rate.toFixed(1) : (appUsageStats?.return_rate || 0)}%</p>
                        <p className="text-purple-200 mt-2">
                          {appUsageStats?.returning_visitors || 0} returning / {appUsageStats?.['30_days']?.unique_visitors || 0} total visitors
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Room ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Staff</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Messages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {chatRooms.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No chat logs found</td>
                        </tr>
                      ) : (
                        chatRooms.map((room) => (
                          <tr key={room.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-gray-400">{new Date(room.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3 font-mono text-sm">{room.id}</td>
                            <td className="px-4 py-3">{room.staff_name || 'N/A'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                room.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {room.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">{room.message_count || 0}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Safeguarding Alerts */}
              {activeLogSubTab === 'safeguarding' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk Level</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Trigger</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {safeguardingAlerts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No safeguarding alerts</td>
                        </tr>
                      ) : (
                        safeguardingAlerts.map((alert) => (
                          <tr key={alert.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-gray-400">{new Date(alert.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">{alert.user_name || 'Anonymous'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                alert.risk_level === 'high' || alert.risk_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                                alert.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {alert.risk_level}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">{alert.trigger_phrase || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                alert.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {alert.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
                  <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
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
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Name</label>
                          <input
                            type="text"
                            value={editingCharacter.name}
                            onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Description</label>
                          <textarea
                            value={editingCharacter.description || ''}
                            onChange={(e) => setEditingCharacter({ ...editingCharacter, description: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Personality</label>
                          <textarea
                            value={editingCharacter.personality || ''}
                            onChange={(e) => setEditingCharacter({ ...editingCharacter, personality: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Greeting Message</label>
                          <textarea
                            value={editingCharacter.greeting_message || ''}
                            onChange={(e) => setEditingCharacter({ ...editingCharacter, greeting_message: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Order</label>
                            <input
                              type="number"
                              value={editingCharacter.order || 0}
                              onChange={(e) => setEditingCharacter({ ...editingCharacter, order: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                            <label htmlFor="char-enabled" className="text-sm">Enabled</label>
                          </div>
                        </div>
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
                              onClick={() => {
                                setEditingCharacter({ ...char });
                                setShowCharacterModal(true);
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
              {aiUsage ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="text-gray-400 text-sm mb-2">Total Tokens</h3>
                    <p className="text-3xl font-bold">{(aiUsage.total_tokens || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="text-gray-400 text-sm mb-2">Total Cost</h3>
                    <p className="text-3xl font-bold">£{Number(aiUsage.total_cost_gbp || aiUsage.total_cost || 0).toFixed(4)}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="text-gray-400 text-sm mb-2">Providers</h3>
                    <div className="space-y-2">
                      {aiUsage.providers && Object.entries(aiUsage.providers).map(([provider, data]: [string, any]) => (
                        <div key={provider} className="flex justify-between text-sm bg-gray-700/50 p-2 rounded">
                          <span className="capitalize">{provider}</span>
                          <div className="text-right">
                            <span className="text-gray-400">{(data.total_tokens || 0).toLocaleString()} tokens</span>
                            <span className="ml-2 text-green-400">£{Number(data.cost_gbp || 0).toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                      {(!aiUsage.providers || Object.keys(aiUsage.providers).length === 0) && (
                        <p className="text-gray-500 text-sm">No provider data</p>
                      )}
                    </div>
                  </div>
                </div>
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
              {monitoringStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <Activity className="w-8 h-8 text-green-400 mb-2" />
                    <h3 className="text-gray-400 text-sm mb-1">Active Calls</h3>
                    <p className="text-2xl font-bold">{monitoringStats.active_calls || 0}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <MessageSquare className="w-8 h-8 text-blue-400 mb-2" />
                    <h3 className="text-gray-400 text-sm mb-1">Active Chats</h3>
                    <p className="text-2xl font-bold">{monitoringStats.active_chats || 0}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <Users className="w-8 h-8 text-purple-400 mb-2" />
                    <h3 className="text-gray-400 text-sm mb-1">Staff Online</h3>
                    <p className="text-2xl font-bold">{monitoringStats.staff_online || 0}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <AlertTriangle className="w-8 h-8 text-yellow-400 mb-2" />
                    <h3 className="text-gray-400 text-sm mb-1">Pending Alerts</h3>
                    <p className="text-2xl font-bold">{monitoringStats.pending_alerts || 0}</p>
                  </div>
                </div>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Shifts */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Today&apos;s Shifts
                  </h3>
                  {shifts.filter(s => s.date === new Date().toISOString().split('T')[0]).length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No shifts scheduled for today</p>
                  ) : (
                    <div className="space-y-3">
                      {shifts
                        .filter(s => s.date === new Date().toISOString().split('T')[0])
                        .map((shift) => (
                          <div key={shift.id} className="bg-gray-700 rounded-lg p-3 flex justify-between items-center">
                            <div>
                              <p className="font-medium">{shift.user_name || 'Unassigned'}</p>
                              <p className="text-sm text-gray-400">{shift.start_time} - {shift.end_time}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${
                              shift.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {shift.status || 'pending'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Pending Swap Requests */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-yellow-400" />
                    Pending Swap Requests
                    {pendingSwaps.length > 0 && (
                      <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">{pendingSwaps.length}</span>
                    )}
                  </h3>
                  {pendingSwaps.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No swap requests pending approval</p>
                  ) : (
                    <div className="space-y-3">
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
                            <button className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
                              Approve
                            </button>
                            <button className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Week View */}
              <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="font-semibold mb-4">Week Overview</h3>
                <div className="grid grid-cols-7 gap-2">
                  {[...Array(7)].map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const dateStr = date.toISOString().split('T')[0];
                    const dayShifts = shifts.filter(s => s.date === dateStr);
                    return (
                      <div key={i} className={`text-center p-3 rounded-lg ${i === 0 ? 'bg-blue-600' : 'bg-gray-700'}`}>
                        <p className="text-xs text-gray-400">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                        <p className="font-bold">{date.getDate()}</p>
                        <p className="text-xs mt-1">{dayShifts.length} shifts</p>
                      </div>
                    );
                  })}
                </div>
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
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div data-testid="compliance-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Compliance & Audit</h2>
                <button onClick={loadCompliance} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">GDPR Consent Rate</p>
                  <p className="text-2xl font-bold text-green-400">{complianceData?.gdpr?.consent_rate || 0}%</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Open Complaints</p>
                  <p className="text-2xl font-bold text-yellow-400">{complianceData?.complaints?.open_complaints || complaints.length}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Security Status</p>
                  <p className="text-2xl font-bold text-blue-400">{complianceData?.security?.last_review_status || 'N/A'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Open Incidents</p>
                  <p className="text-2xl font-bold text-red-400">{incidents.length}</p>
                </div>
              </div>

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
            </div>
          )}

          {/* Governance Tab */}
          {activeTab === 'governance' && (
            <div data-testid="governance-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Governance & Clinical Safety</h2>
                <button onClick={loadGovernance} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {/* Summary Stats */}
              {governanceSummary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <p className="text-gray-400 text-sm">Total Hazards</p>
                    <p className="text-2xl font-bold">{governanceSummary.total_hazards || hazards.length}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <p className="text-gray-400 text-sm">Open Hazards</p>
                    <p className="text-2xl font-bold text-red-400">{governanceSummary.open_hazards || 0}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <p className="text-gray-400 text-sm">Mitigated</p>
                    <p className="text-2xl font-bold text-green-400">{governanceSummary.mitigated_hazards || 0}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <p className="text-gray-400 text-sm">KPIs Met</p>
                    <p className="text-2xl font-bold text-blue-400">{governanceSummary.kpis_met || 0}%</p>
                  </div>
                </div>
              )}

              {/* Hazard Log */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-yellow-400" />
                  Clinical Safety Hazard Log
                </h3>
                {hazards.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No hazards recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Description</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Severity</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Mitigation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {hazards.map((hazard: any) => (
                          <tr key={hazard.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 font-mono text-sm">{hazard.hazard_id || hazard.id?.substring(0, 8)}</td>
                            <td className="px-4 py-3">{hazard.description?.substring(0, 50)}...</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                hazard.severity === 'catastrophic' || hazard.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                hazard.severity === 'major' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {hazard.severity}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                hazard.status === 'mitigated' ? 'bg-green-500/20 text-green-400' :
                                hazard.status === 'open' ? 'bg-red-500/20 text-red-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {hazard.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">{hazard.mitigation?.substring(0, 30) || '-'}...</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
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
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Event
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Events */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Upcoming Events
                  </h3>
                  {events.filter(e => new Date(e.scheduled_for) > new Date()).length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No upcoming events scheduled</p>
                  ) : (
                    <div className="space-y-3">
                      {events
                        .filter(e => new Date(e.scheduled_for) > new Date())
                        .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
                        .slice(0, 5)
                        .map((event) => (
                          <div key={event.id} className="bg-gray-700 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{event.title}</h4>
                              <span className={`px-2 py-1 rounded text-xs ${
                                event.event_type === 'group_chat' ? 'bg-purple-500/20 text-purple-400' :
                                event.event_type === 'webinar' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {event.event_type?.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">{event.description?.substring(0, 80)}...</p>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-400">
                                {new Date(event.scheduled_for).toLocaleDateString()} at {new Date(event.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-blue-400">{event.max_participants || '∞'} max</span>
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
                  {events.filter(e => new Date(e.scheduled_for) <= new Date()).length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No past events</p>
                  ) : (
                    <div className="space-y-3">
                      {events
                        .filter(e => new Date(e.scheduled_for) <= new Date())
                        .sort((a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime())
                        .slice(0, 5)
                        .map((event) => (
                          <div key={event.id} className="bg-gray-700 rounded-lg p-4 opacity-75">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{event.title}</h4>
                              <span className="text-xs text-gray-400">{event.participant_count || 0} attended</span>
                            </div>
                            <p className="text-sm text-gray-400">
                              {new Date(event.scheduled_for).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Learning Tab */}
          {activeTab === 'learning' && (
            <div data-testid="learning-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">AI Learning & Moderation</h2>
                <button onClick={loadLearning} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                  <RefreshCw className="w-5 h-5" />
                </button>
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

              {/* Moderation Queue */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-yellow-400" />
                  Moderation Queue
                </h3>
                {moderationQueue.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No items pending review</p>
                ) : (
                  <div className="space-y-3">
                    {moderationQueue.slice(0, 10).map((item: any, index: number) => (
                      <div key={item.id || index} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                            item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {item.priority || 'normal'}
                          </span>
                          <span className="text-xs text-gray-400">{item.reason || 'Manual review'}</span>
                        </div>
                        <p className="text-sm mb-3">{item.content?.substring(0, 100)}...</p>
                        <div className="flex gap-2">
                          <button className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">Approve</button>
                          <button className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">Reject</button>
                          <button className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">View Full</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Time Tracking Tab */}
          {activeTab === 'timetracking' && (
            <div data-testid="timetracking-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Time Tracking</h2>
                <div className="flex gap-2">
                  <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                    <Download className="w-5 h-5" />
                  </button>
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Log Time
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">This Week</p>
                  <p className="text-2xl font-bold">0 hrs</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">This Month</p>
                  <p className="text-2xl font-bold">0 hrs</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Pending Approval</p>
                  <p className="text-2xl font-bold text-yellow-400">0</p>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <p className="text-gray-400 text-sm">Overtime</p>
                  <p className="text-2xl font-bold text-red-400">0 hrs</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Time Entries */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Recent Time Entries
                  </h3>
                  <p className="text-gray-400 text-center py-8">No time entries logged</p>
                </div>

                {/* Pending Approvals */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Check className="w-5 h-5 text-yellow-400" />
                    Pending Approval
                  </h3>
                  <p className="text-gray-400 text-center py-8">No entries pending approval</p>
                </div>
              </div>

              {/* Weekly Summary */}
              <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h3 className="font-semibold mb-4">Weekly Summary</h3>
                <div className="grid grid-cols-7 gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                    <div key={day} className="text-center p-3 bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-400">{day}</p>
                      <p className="font-bold">0h</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div data-testid="settings-tab">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">System Settings</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* General Settings */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    General Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Dark Mode</p>
                        <p className="text-sm text-gray-400">Enable dark theme</p>
                      </div>
                      <div className="w-12 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                        <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-gray-400">Receive email alerts</p>
                      </div>
                      <div className="w-12 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                        <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Sound Notifications</p>
                        <p className="text-sm text-gray-400">Play sounds for alerts</p>
                      </div>
                      <div className="w-12 h-6 bg-gray-600 rounded-full relative cursor-pointer">
                        <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Settings */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-400" />
                    Security
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-400">Add extra security layer</p>
                      </div>
                      <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">Enable</button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Session Timeout</p>
                        <p className="text-sm text-gray-400">Auto-logout after inactivity</p>
                      </div>
                      <select className="px-3 py-1 bg-gray-700 rounded text-sm">
                        <option>30 minutes</option>
                        <option>1 hour</option>
                        <option>2 hours</option>
                        <option>Never</option>
                      </select>
                    </div>
                    <button className="w-full mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm">
                      Change Password
                    </button>
                  </div>
                </div>

                {/* API Settings */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    API & Integrations
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-gray-700 rounded-lg p-3">
                      <p className="font-medium">API Endpoint</p>
                      <p className="text-sm text-gray-400 font-mono break-all">{API_URL}</p>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-3">
                      <p className="font-medium">Twilio Status</p>
                      <p className="text-sm text-green-400">Connected</p>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-3">
                      <p className="font-medium">Socket.IO Status</p>
                      <p className="text-sm text-green-400">Connected</p>
                    </div>
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
                      <span className="text-gray-400">Last Updated</span>
                      <span>{new Date().toLocaleDateString()}</span>
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
    </div>
  );
}
