'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Calendar, FileText, Bot, Shield, Activity, 
  Settings, BarChart3, Clock, BookOpen, AlertTriangle,
  LogOut, Menu, X, Plus, Edit, Trash2,
  Phone, MessageSquare, Bell, ChevronDown,
  Download, RefreshCw, Check, Eye, Heart, Play
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

// Import extracted modules
import { api, API_URL, resolveAvatarUrl } from '@/lib/admin-api';
import type { 
  StaffMember, 
  AIUsageSummary 
} from '@/types/admin';
import { useMainAdminAuth } from '@/hooks/useMainAdminAuth';

// Import tab components
import StaffTab from '@/components/admin/tabs/StaffTab';
import AIPersonasTab from '@/components/admin/tabs/AIPersonasTab';
import SettingsTab from '@/components/admin/tabs/SettingsTab';
import LogsTab from '@/components/admin/tabs/LogsTab';
import RotaTab from '@/components/admin/tabs/RotaTab';
import GovernanceTab from '@/components/admin/tabs/GovernanceTab';
import EventsTab from '@/components/admin/tabs/EventsTab';

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

// Main Component
export default function AdminPortal() {
  // Use the extracted auth hook
  const {
    token,
    user,
    isLoading,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginLoading,
    loginError,
    rememberMe,
    setRememberMe,
    login: handleLogin,
    logout: handleLogout,
  } = useMainAdminAuth();
  
  // UI state
  const [activeTab, setActiveTab] = useState('staff');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // AI Usage state
  const [aiUsage, setAIUsage] = useState<AIUsageSummary | null>(null);
  const [monitoringStats, setMonitoringStats] = useState<any>(null);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  
  // CMS state
  const [cmsPages, setCmsPages] = useState<any[]>([]);
  const [selectedCmsPage, setSelectedCmsPage] = useState<any>(null);
  
  // Compliance state
  const [complianceData, setComplianceData] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
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
  
  // Monitoring timestamp state
  const [monitoringLastUpdated, setMonitoringLastUpdated] = useState<Date | null>(null);
  
  // AI Usage Daily chart data
  const [aiDailyUsage, setAiDailyUsage] = useState<any[]>([]);
  const [aiUsagePeriod, setAiUsagePeriod] = useState(30);

  // Real-time alert counter state
  const [pendingAlertCount, setPendingAlertCount] = useState(0);

  // Load data when tab changes
  useEffect(() => {
    if (!token) return;
    
    const loadData = async () => {
      try {
        setError(null);
        switch (activeTab) {
          case 'staff':
            // StaffTab manages its own data loading
            break;
          case 'logs':
            // LogsTab manages its own data loading
            break;
          case 'ai-personas':
            // AIPersonasTab manages its own data loading
            break;
          case 'rota':
            // RotaTab manages its own data loading
            break;
          case 'governance':
            // GovernanceTab manages its own data loading
            break;
          case 'events':
            // EventsTab manages its own data loading
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
          case 'cms':
            await loadCMS();
            break;
          case 'compliance':
            await loadCompliance();
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
  }, [token, activeTab]);

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
            <img 
              src="https://customer-assets.emergentagent.com/job_b298e80e-e613-4114-bd36-44dba2b1f918/artifacts/hcklvnmw_logo.png" 
              alt="Radio Check" 
              className="w-20 h-20 mx-auto mb-4"
            />
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
            <div className="mb-6 flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                data-testid="admin-remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-400 cursor-pointer">
                Remember my credentials
              </label>
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
            <StaffTab 
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}


          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <LogsTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}

          {/* AI Personas Tab */}
          {activeTab === 'ai-personas' && (
            <AIPersonasTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
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
            <RotaTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
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
                    href={`${API_URL}/api/documents/download/SAFEGUARDING`}
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
                    href={`${API_URL}/api/documents/download/GDPR_AUDIT`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-medium">GDPR Audit Report</p>
                      <p className="text-xs text-gray-400">PDF Document</p>
                    </div>
                  </a>
                  <a 
                    href={`${API_URL}/api/documents/download/BACP_COMPLIANCE`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="font-medium">BACP Compliance</p>
                      <p className="text-xs text-gray-400">PDF Document</p>
                    </div>
                  </a>
                  <a 
                    href={`${API_URL}/api/documents/download/INCIDENT_RESPONSE`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="font-medium">Incident Response Plan</p>
                      <p className="text-xs text-gray-400">PDF Document</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Governance Tab */}
          {activeTab === 'governance' && (
            <GovernanceTab
              token={token!}
              userEmail={user?.email}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <EventsTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
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
            <SettingsTab
              token={token!}
              userEmail={user?.email}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}
        </div>
      </main>

    </div>
  );
}
