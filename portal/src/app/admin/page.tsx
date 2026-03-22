'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Calendar, FileText, Bot, Shield, Activity, 
  Settings, BarChart3, Clock, BookOpen,
  LogOut, Menu, X, Bell, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/admin-api';
import { useMainAdminAuth } from '@/hooks/useMainAdminAuth';

// Import tab components
import StaffTab from '@/components/admin/tabs/StaffTab';
import AIPersonasTab from '@/components/admin/tabs/AIPersonasTab';
import SettingsTab from '@/components/admin/tabs/SettingsTab';
import LogsTab from '@/components/admin/tabs/LogsTab';
import RotaTab from '@/components/admin/tabs/RotaTab';
import GovernanceTab from '@/components/admin/tabs/GovernanceTab';
import EventsTab from '@/components/admin/tabs/EventsTab';
import AIUsageTab from '@/components/admin/tabs/AIUsageTab';
import MonitoringTab from '@/components/admin/tabs/MonitoringTab';
import MigrationTab from '@/components/admin/tabs/MigrationTab';
import CMSTab from '@/components/admin/tabs/CMSTab';
import BetaTestingTab from '@/components/admin/tabs/BetaTestingTab';
import ComplianceTab from '@/components/admin/tabs/ComplianceTab';
import LearningTab from '@/components/admin/tabs/LearningTab';
import TimeTrackingTab from '@/components/admin/tabs/TimeTrackingTab';

// Tab definitions
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
  
  // Real-time alert counter state
  const [pendingAlertCount, setPendingAlertCount] = useState(0);

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
            <AIUsageTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}

          {/* Monitoring Tab */}
          {activeTab === 'monitoring' && (
            <MonitoringTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}

          {/* Migration Tab */}
          {activeTab === 'migration' && (
            <MigrationTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
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
            <CMSTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}

          {/* Beta Testing Tab */}
          {activeTab === 'beta' && (
            <BetaTestingTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <ComplianceTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
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
            <LearningTab
              token={token!}
              userId={user?.id}
              onSuccess={setSuccess}
              onError={setError}
            />
          )}

          {/* Time Tracking Tab */}
          {activeTab === 'timetracking' && (
            <TimeTrackingTab
              token={token!}
              onSuccess={setSuccess}
              onError={setError}
            />
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
