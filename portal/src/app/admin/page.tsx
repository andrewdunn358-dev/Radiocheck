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
  role: 'admin' | 'supervisor' | 'counsellor' | 'peer';
  status: string;
  phone?: string;
  specialization?: string;
  area?: string;
  is_supervisor?: boolean;
  created_at?: string;
  _source?: string;
}

interface CallLog {
  id: string;
  caller_name?: string;
  caller_phone?: string;
  staff_name?: string;
  duration?: number;
  outcome?: string;
  created_at: string;
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
}

interface AIUsageSummary {
  total_tokens: number;
  total_cost: number;
  by_provider: Record<string, { tokens: number; cost: number }>;
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

  // Logs - Call Logs
  getCallLogs: (token: string) =>
    api.fetch<CallLog[]>('/call-logs', { token }),
  
  // Logs - Chat Rooms
  getChatRooms: (token: string) =>
    api.fetch<ChatRoom[]>('/live-chat/rooms', { token }),
  
  // Logs - Safeguarding Alerts
  getSafeguardingAlerts: (token: string) =>
    api.fetch<SafeguardingAlert[]>('/safeguarding-alerts', { token }),

  // AI Characters
  getAICharacters: (token: string) =>
    api.fetch<{ characters: AICharacter[]; source: string }>('/ai-characters/admin', { token }),
  
  updateAICharacter: (token: string, id: string, data: Partial<AICharacter>) =>
    api.fetch<AICharacter>(`/ai-characters/${id}`, {
      token,
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // AI Usage
  getAIUsageSummary: (token: string, period?: string) =>
    api.fetch<AIUsageSummary>(`/admin/ai-usage/summary${period ? `?period=${period}` : ''}`, { token }),
  
  getAIUsageByCharacter: (token: string) =>
    api.fetch<any[]>('/admin/ai-usage/by-character', { token }),

  // Monitoring
  getMonitoringStats: (token: string) =>
    api.fetch<any>('/monitoring/stats', { token }),
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
        }
      } catch (err: any) {
        setError(err.message);
      }
    };
    
    loadData();
  }, [token, activeTab, activeLogSubTab]);

  // Load functions
  const loadStaff = async () => {
    if (!token) return;
    try {
      const data = await api.getStaff(token, staffRoleFilter !== 'all' ? staffRoleFilter : undefined);
      // Ensure we always have an array
      setStaff(Array.isArray(data) ? data : []);
    } catch (err: any) {
      // Fallback to legacy endpoints if new endpoint fails
      console.log('Falling back to legacy endpoints...', err.message);
      try {
        const [counsellors, peers] = await Promise.all([
          api.fetch<any[]>('/counsellors', { token }).catch(() => []),
          api.fetch<any[]>('/peer-supporters', { token }).catch(() => []),
        ]);
        const combined = [
          ...(Array.isArray(counsellors) ? counsellors : []).map((c: any) => ({ ...c, role: 'counsellor' })),
          ...(Array.isArray(peers) ? peers : []).map((p: any) => ({ ...p, role: 'peer', name: p.firstName || p.name })),
        ];
        setStaff(combined);
      } catch (legacyErr: any) {
        console.error('Failed to load staff:', legacyErr);
        setStaff([]);
      }
    }
  };

  const loadLogs = async () => {
    if (!token) return;
    try {
      switch (activeLogSubTab) {
        case 'calls':
          const calls = await api.getCallLogs(token).catch(() => []);
          setCallLogs(Array.isArray(calls) ? calls : []);
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
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              member.status === 'available' ? 'bg-green-500/20 text-green-400' :
                              member.status === 'busy' || member.status === 'limited' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {member.status || 'offline'}
                            </span>
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
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Caller</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Staff</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Duration</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Outcome</th>
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
                            <td className="px-4 py-3 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">{log.caller_name || log.caller_phone || 'Unknown'}</td>
                            <td className="px-4 py-3">{log.staff_name || 'N/A'}</td>
                            <td className="px-4 py-3">{log.duration ? `${Math.floor(log.duration / 60)}:${(log.duration % 60).toString().padStart(2, '0')}` : '-'}</td>
                            <td className="px-4 py-3">{log.outcome || '-'}</td>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiCharacters.map((char) => (
                  <div key={char.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-start gap-4">
                      {char.avatar && (
                        <img src={char.avatar} alt={char.name} className="w-16 h-16 rounded-full object-cover" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{char.name}</h3>
                        <p className="text-sm text-gray-400 mt-1">{char.description || 'No description'}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${char.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {char.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          {char.order !== undefined && (
                            <span className="text-xs text-gray-500">Order: {char.order}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                    <p className="text-3xl font-bold">{aiUsage.total_tokens?.toLocaleString() || 0}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="text-gray-400 text-sm mb-2">Total Cost</h3>
                    <p className="text-3xl font-bold">${(aiUsage.total_cost || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h3 className="text-gray-400 text-sm mb-2">Providers</h3>
                    <div className="space-y-1">
                      {Object.entries(aiUsage.by_provider || {}).map(([provider, data]: [string, any]) => (
                        <div key={provider} className="flex justify-between text-sm">
                          <span>{provider}</span>
                          <span className="text-gray-400">${data.cost?.toFixed(2)}</span>
                        </div>
                      ))}
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
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">Staff Rota & Scheduling</h2>
                <p className="text-gray-400 mb-4">Manage staff schedules and shift swaps.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Current Shifts</h3>
                    <p className="text-sm text-gray-400">View and edit today&apos;s shift assignments</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Swap Requests</h3>
                    <p className="text-sm text-gray-400">Pending shift swap requests to approve</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CMS Tab */}
          {activeTab === 'cms' && (
            <div data-testid="cms-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">Content Management System</h2>
                <p className="text-gray-400 mb-4">Edit website content and landing pages.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Hero Section</h3>
                    <p className="text-sm text-gray-400">Edit hero text and images</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">About Section</h3>
                    <p className="text-sm text-gray-400">Edit about us content</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Resources</h3>
                    <p className="text-sm text-gray-400">Manage resource links</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Beta Testing Tab */}
          {activeTab === 'beta' && (
            <div data-testid="beta-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">Beta Testing & Feedback</h2>
                <p className="text-gray-400 mb-4">Manage beta testers and collect feedback.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Beta Testers</h3>
                    <p className="text-sm text-gray-400">0 active testers</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Feedback Queue</h3>
                    <p className="text-sm text-gray-400">0 pending feedback items</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div data-testid="compliance-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">Compliance & Audit</h2>
                <p className="text-gray-400 mb-4">Track compliance metrics and audit logs.</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Call Compliance</h3>
                    <p className="text-2xl font-bold text-green-400">98%</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Response Time</h3>
                    <p className="text-2xl font-bold text-yellow-400">2.5m</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Documentation</h3>
                    <p className="text-2xl font-bold text-green-400">100%</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Training</h3>
                    <p className="text-2xl font-bold text-blue-400">95%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Governance Tab */}
          {activeTab === 'governance' && (
            <div data-testid="governance-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">Governance & Policies</h2>
                <p className="text-gray-400 mb-4">Manage policies, hazards, and incident reports.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Hazard Reports</h3>
                    <p className="text-sm text-gray-400">0 open reports</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Incidents</h3>
                    <p className="text-sm text-gray-400">0 pending review</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Policy Updates</h3>
                    <p className="text-sm text-gray-400">All policies current</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div data-testid="events-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">Events Management</h2>
                <p className="text-gray-400 mb-4">Manage virtual events and group sessions.</p>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg mb-4">
                  <Plus className="w-4 h-4 inline mr-2" />
                  Create Event
                </button>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-400 text-center">No upcoming events</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Learning Tab */}
          {activeTab === 'learning' && (
            <div data-testid="learning-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">AI Learning & Training</h2>
                <p className="text-gray-400 mb-4">Review AI conversations for training and improvement.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Conversations Queue</h3>
                    <p className="text-sm text-gray-400">0 pending review</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Approved Patterns</h3>
                    <p className="text-sm text-gray-400">0 patterns saved</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Feedback</h3>
                    <p className="text-sm text-gray-400">0 feedback items</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Time Tracking Tab */}
          {activeTab === 'timetracking' && (
            <div data-testid="timetracking-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">Time Tracking</h2>
                <p className="text-gray-400 mb-4">Track staff hours and generate reports.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">This Week</h3>
                    <p className="text-2xl font-bold">0 hours</p>
                    <p className="text-sm text-gray-400">Total logged hours</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Pending Approval</h3>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-gray-400">Time entries to review</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div data-testid="settings-tab">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4">System Settings</h2>
                <p className="text-gray-400">Settings panel coming soon...</p>
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
