'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { staffApi, SafeguardingAlert, PanicAlert, LiveChatRoom, Case, Callback } from '@/lib/api';
import Link from 'next/link';
import {
  LayoutDashboard, AlertTriangle, MessageSquare, Briefcase, Phone,
  Calendar, Users, FileText, Shield, LogOut, Bell, Volume2, VolumeX,
  CheckCircle, Clock, User, ChevronRight, RefreshCw, X, Send
} from 'lucide-react';

type TabType = 'dashboard' | 'alerts' | 'livechat' | 'cases' | 'callbacks' | 'rota' | 'team' | 'notes' | 'supervision';

export default function StaffPortalPage() {
  const { user, profile, token, isLoading, login, logout, updateStatus } = useStaffAuth();

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // App state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Data state
  const [safeguardingAlerts, setSafeguardingAlerts] = useState<SafeguardingAlert[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<PanicAlert[]>([]);
  const [liveChatRooms, setLiveChatRooms] = useState<LiveChatRoom[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [callbacks, setCallbacks] = useState<Callback[]>([]);

  // Modal state
  const [activeChatRoom, setActiveChatRoom] = useState<LiveChatRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Load data
  const loadAlerts = useCallback(async () => {
    if (!token) return;
    try {
      const [safeguarding, panic] = await Promise.all([
        staffApi.getSafeguardingAlerts(token),
        staffApi.getPanicAlerts(token),
      ]);
      setSafeguardingAlerts(safeguarding);
      setPanicAlerts(panic);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  }, [token]);

  const loadLiveChats = useCallback(async () => {
    if (!token) return;
    try {
      const rooms = await staffApi.getLiveChatRooms(token);
      setLiveChatRooms(rooms);
    } catch (err) {
      console.error('Failed to load live chats:', err);
    }
  }, [token]);

  const loadCases = useCallback(async () => {
    if (!token) return;
    try {
      const response = await staffApi.getCases(token);
      setCases(response.cases || []);
    } catch (err) {
      console.error('Failed to load cases:', err);
    }
  }, [token]);

  const loadCallbacks = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getCallbacks(token);
      setCallbacks(data);
    } catch (err) {
      console.error('Failed to load callbacks:', err);
    }
  }, [token]);

  // Initial data load and polling
  useEffect(() => {
    if (token) {
      loadAlerts();
      loadLiveChats();
      loadCases();
      loadCallbacks();

      // Poll for alerts every 30 seconds
      const alertInterval = setInterval(loadAlerts, 30000);
      const chatInterval = setInterval(loadLiveChats, 30000);

      return () => {
        clearInterval(alertInterval);
        clearInterval(chatInterval);
      };
    }
  }, [token, loadAlerts, loadLiveChats, loadCases, loadCallbacks]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (status: string) => {
    try {
      await updateStatus(status);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Alert actions
  const handleAcknowledgeSafeguarding = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.acknowledgeSafeguardingAlert(token, id);
      loadAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolveSafeguarding = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.resolveSafeguardingAlert(token, id);
      loadAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  // Live chat actions
  const handleJoinChat = async (room: LiveChatRoom) => {
    if (!token) return;
    try {
      await staffApi.joinLiveChat(token, room.room_id || room._id);
      const messages = await staffApi.getLiveChatMessages(token, room.room_id || room._id);
      setActiveChatRoom(room);
      setChatMessages(messages);
      loadLiveChats();
    } catch (err) {
      console.error('Failed to join chat:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!token || !activeChatRoom || !newMessage.trim()) return;
    try {
      await staffApi.sendLiveChatMessage(token, activeChatRoom.room_id || activeChatRoom._id, newMessage);
      setNewMessage('');
      const messages = await staffApi.getLiveChatMessages(token, activeChatRoom.room_id || activeChatRoom._id);
      setChatMessages(messages);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleEndChat = async () => {
    if (!token || !activeChatRoom) return;
    try {
      await staffApi.endLiveChat(token, activeChatRoom.room_id || activeChatRoom._id);
      setActiveChatRoom(null);
      setChatMessages([]);
      loadLiveChats();
    } catch (err) {
      console.error('Failed to end chat:', err);
    }
  };

  // Callback actions
  const handleTakeCallback = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.takeCallback(token, id);
      loadCallbacks();
    } catch (err) {
      console.error('Failed to take callback:', err);
    }
  };

  const handleCompleteCallback = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.completeCallback(token, id);
      loadCallbacks();
    } catch (err) {
      console.error('Failed to complete callback:', err);
    }
  };

  // Helper functions
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // Counts for badges
  const activeAlertsCount = safeguardingAlerts.filter(a => a.status === 'active').length + 
                           panicAlerts.filter(a => a.status === 'active').length;
  const waitingChatsCount = liveChatRooms.filter(r => r.status === 'waiting').length;
  const pendingCallbacksCount = callbacks.filter(c => c.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-primary-dark p-4">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-secondary mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Staff Portal</h2>
            <p className="text-gray-400 text-sm mt-1">Sign in to access the staff dashboard</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                placeholder="your@email.com"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-primary-light hover:bg-primary text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Navigation items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: activeAlertsCount },
    { id: 'livechat', label: 'Live Support', icon: MessageSquare, badge: waitingChatsCount },
    { id: 'cases', label: 'Cases', icon: Briefcase },
    { id: 'callbacks', label: 'Callbacks', icon: Phone, badge: pendingCallbacksCount },
    { id: 'rota', label: 'Rota', icon: Calendar },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'notes', label: 'Notes', icon: FileText },
    ...(user.is_supervisor ? [{ id: 'supervision', label: 'Supervision', icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-primary-dark">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png"
              alt="Radio Check"
              className="w-8 h-8"
            />
            <span className="font-semibold">Staff Portal</span>
          </Link>
        </div>

        {/* Status selector */}
        <div className="p-4 border-b border-border">
          <label className="block text-xs text-gray-400 mb-2">My Status</label>
          <div className="flex gap-2">
            {['available', 'busy', 'offline'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm capitalize transition-colors ${
                  profile?.status === status 
                    ? `${getStatusColor(status)} text-white` 
                    : 'bg-primary-dark border border-border hover:bg-white/5'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors ${
                  activeTab === item.id
                    ? 'bg-secondary/10 text-secondary border-l-2 border-secondary'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Sound toggle & Logout */}
        <div className="p-4 border-t border-border space-y-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-full flex items-center gap-2 text-gray-400 hover:text-white"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="text-sm">{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
          </button>
          <div className="text-sm text-gray-400">{profile?.name || user.name}</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-secondary" />
              Dashboard
            </h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-gray-400">Active Alerts</span>
                </div>
                <div className="text-3xl font-bold">{activeAlertsCount}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-400">Waiting Chats</span>
                </div>
                <div className="text-3xl font-bold">{waitingChatsCount}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Briefcase className="w-5 h-5 text-purple-400" />
                  <span className="text-gray-400">Open Cases</span>
                </div>
                <div className="text-3xl font-bold">{cases.filter(c => c.status !== 'closed').length}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="w-5 h-5 text-green-400" />
                  <span className="text-gray-400">Pending Callbacks</span>
                </div>
                <div className="text-3xl font-bold">{pendingCallbacksCount}</div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Recent Safeguarding Alerts</h3>
                <button onClick={() => setActiveTab('alerts')} className="text-sm text-secondary hover:underline">
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {safeguardingAlerts.slice(0, 3).map((alert) => (
                  <div key={alert._id} className={`p-4 rounded-lg border ${alert.status === 'active' ? 'border-red-500 bg-red-500/10' : 'border-border'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs text-white ${getRiskBadgeColor(alert.risk_level)}`}>
                            {alert.risk_level.toUpperCase()}
                          </span>
                          <span className="text-gray-400 text-sm">{formatTimeAgo(alert.created_at)}</span>
                        </div>
                        <p className="text-sm truncate max-w-md">{alert.trigger_message}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        alert.status === 'active' ? 'bg-red-500/20 text-red-400' :
                        alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {alert.status}
                      </span>
                    </div>
                  </div>
                ))}
                {safeguardingAlerts.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No alerts</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-secondary" />
                Safeguarding Alerts
              </h1>
              <button onClick={loadAlerts} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {safeguardingAlerts.map((alert) => (
                <div key={alert._id} className={`bg-card border rounded-xl p-6 ${alert.status === 'active' ? 'border-red-500' : 'border-border'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded text-xs text-white ${getRiskBadgeColor(alert.risk_level)}`}>
                          {alert.risk_level.toUpperCase()} RISK
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          alert.status === 'active' ? 'bg-red-500/20 text-red-400' :
                          alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {alert.status.toUpperCase()}
                        </span>
                      </div>
                      {alert.user_name && <p className="font-semibold">{alert.user_name}</p>}
                      {alert.character_name && <p className="text-sm text-gray-400">Talking to: {alert.character_name}</p>}
                    </div>
                    <span className="text-sm text-gray-400">{formatTimeAgo(alert.created_at)}</span>
                  </div>

                  <div className="bg-primary-dark/50 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-gray-400 mb-1">Trigger Message:</p>
                    <p>{alert.trigger_message}</p>
                  </div>

                  {alert.trigger_phrases && alert.trigger_phrases.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {alert.trigger_phrases.map((phrase, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                          {phrase}
                        </span>
                      ))}
                    </div>
                  )}

                  {alert.status !== 'resolved' && (
                    <div className="flex gap-3">
                      {alert.status === 'active' && (
                        <button
                          onClick={() => handleAcknowledgeSafeguarding(alert._id)}
                          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => handleResolveSafeguarding(alert._id)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {safeguardingAlerts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No safeguarding alerts</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Chat Tab */}
        {activeTab === 'livechat' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-secondary" />
                Live Support Requests
              </h1>
              <button onClick={loadLiveChats} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {liveChatRooms.filter(r => r.status !== 'ended').map((room) => (
                <div key={room._id} className={`bg-card border rounded-xl p-6 ${room.status === 'waiting' ? 'border-yellow-500' : 'border-border'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-5 h-5 text-gray-400" />
                        <span className="font-semibold">{room.user_name || 'Anonymous User'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          room.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                          room.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {room.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Waiting since: {formatTimeAgo(room.created_at)}
                      </p>
                    </div>
                    {room.status === 'waiting' && (
                      <button
                        onClick={() => handleJoinChat(room)}
                        className="px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light font-semibold"
                      >
                        Join Chat
                      </button>
                    )}
                    {room.status === 'active' && room.staff_id === user?.id && (
                      <button
                        onClick={() => handleJoinChat(room)}
                        className="px-4 py-2 bg-primary-light text-white rounded-lg hover:bg-primary"
                      >
                        Continue Chat
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {liveChatRooms.filter(r => r.status !== 'ended').length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active chat requests</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cases Tab */}
        {activeTab === 'cases' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-secondary" />
              Cases
            </h1>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-primary-dark/50">
                  <tr className="text-left text-sm text-gray-400">
                    <th className="px-6 py-4">Case #</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Risk Level</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Assigned To</th>
                    <th className="px-6 py-4">Updated</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c._id} className="border-t border-border hover:bg-white/5">
                      <td className="px-6 py-4 font-mono">{c.case_number}</td>
                      <td className="px-6 py-4">{c.user_name || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs text-white ${getRiskBadgeColor(c.risk_level)}`}>
                          {c.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          c.status === 'open' ? 'bg-blue-500/20 text-blue-400' :
                          c.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                          c.status === 'escalated' ? 'bg-red-500/20 text-red-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">{c.assigned_to_name || '-'}</td>
                      <td className="px-6 py-4 text-gray-400">{formatTimeAgo(c.updated_at)}</td>
                      <td className="px-6 py-4">
                        <button className="text-secondary hover:underline text-sm">
                          View <ChevronRight className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cases.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No cases found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Callbacks Tab */}
        {activeTab === 'callbacks' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Phone className="w-6 h-6 text-secondary" />
              Callback Requests
            </h1>

            <div className="space-y-4">
              {callbacks.filter(c => c.status !== 'completed').map((callback) => (
                <div key={callback._id} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold">{callback.user_name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          callback.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                          callback.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          callback.priority === 'normal' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {callback.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          callback.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {callback.status}
                        </span>
                      </div>
                      <p className="text-secondary font-mono">{callback.phone}</p>
                      {callback.reason && <p className="text-sm text-gray-400 mt-1">{callback.reason}</p>}
                      <p className="text-xs text-gray-500 mt-2">Requested: {formatTimeAgo(callback.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      {callback.status === 'pending' && (
                        <button
                          onClick={() => handleTakeCallback(callback._id)}
                          className="px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
                        >
                          Take
                        </button>
                      )}
                      {callback.status === 'taken' && callback.taken_by === user?.id && (
                        <button
                          onClick={() => handleCompleteCallback(callback._id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {callbacks.filter(c => c.status !== 'completed').length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pending callbacks</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rota Tab */}
        {activeTab === 'rota' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-secondary" />
              My Shifts
            </h1>
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-gray-400 text-center py-8">Rota calendar coming soon...</p>
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-secondary" />
              Team On Duty
            </h1>
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-gray-400 text-center py-8">Team view coming soon...</p>
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6 text-secondary" />
              Notes
            </h1>
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-gray-400 text-center py-8">Notes feature coming soon...</p>
            </div>
          </div>
        )}

        {/* Supervision Tab */}
        {activeTab === 'supervision' && user?.is_supervisor && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Shield className="w-6 h-6 text-secondary" />
              Supervision
            </h1>
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-gray-400 text-center py-8">Supervision features coming soon...</p>
            </div>
          </div>
        )}
      </main>

      {/* Live Chat Modal */}
      {activeChatRoom && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Chat with {activeChatRoom.user_name || 'User'}</h3>
                <p className="text-sm text-gray-400">Room: {activeChatRoom.room_id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEndChat}
                  className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                >
                  End Chat
                </button>
                <button
                  onClick={() => { setActiveChatRoom(null); setChatMessages([]); }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg max-w-[80%] ${
                    msg.sender_type === 'staff' 
                      ? 'bg-secondary/20 ml-auto' 
                      : 'bg-primary-light/30'
                  }`}
                >
                  <p className="text-xs text-gray-400 mb-1">{msg.sender_name}</p>
                  <p>{msg.message}</p>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-secondary text-primary-dark rounded-lg disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
