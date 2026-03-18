'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { staffApi, SafeguardingAlert, PanicAlert, LiveChatRoom, Case, Callback, Shift, ShiftSwap, TeamMember, StaffNote, Escalation } from '@/lib/api';
import Link from 'next/link';
import {
  LayoutDashboard, AlertTriangle, MessageSquare, Briefcase, Phone,
  Calendar, Users, FileText, Shield, LogOut, Bell, Volume2, VolumeX,
  CheckCircle, Clock, User, ChevronRight, RefreshCw, X, Send,
  Plus, Edit, Trash2, ChevronLeft, ArrowLeftRight, Eye, PhoneCall, Wifi, WifiOff
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

  // Phone/WebRTC state
  const [phoneStatus, setPhoneStatus] = useState<'connecting' | 'ready' | 'error' | 'unavailable'>('connecting');
  const [chatConnected, setChatConnected] = useState(false);

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

  // Additional data state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [swapRequests, setSwapRequests] = useState<ShiftSwap[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Notes state
  const [notesTab, setNotesTab] = useState<'my' | 'shared'>('my');
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteShared, setNewNoteShared] = useState(false);

  // Shift modal state
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [newShiftType, setNewShiftType] = useState('morning');

  // Escalations state
  const [escalationsTab, setEscalationsTab] = useState<'pending' | 'all'>('pending');

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

  const loadShifts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getShifts(token);
      setShifts(data);
      const swaps = await staffApi.getSwapRequests(token);
      setSwapRequests(swaps);
    } catch (err) {
      console.error('Failed to load shifts:', err);
    }
  }, [token]);

  const loadTeam = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getTeamOnDuty(token);
      setTeamMembers(data);
    } catch (err) {
      console.error('Failed to load team:', err);
    }
  }, [token]);

  const loadNotes = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getNotes(token);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }, [token]);

  const loadEscalations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getEscalations(token);
      setEscalations(data);
    } catch (err) {
      console.error('Failed to load escalations:', err);
    }
  }, [token]);

  // Initial data load and polling
  useEffect(() => {
    if (token) {
      loadAlerts();
      loadLiveChats();
      loadCases();
      loadCallbacks();
      loadShifts();
      loadTeam();
      loadNotes();
      if (user?.is_supervisor) {
        loadEscalations();
      }

      // Check phone/Twilio status
      checkPhoneStatus();
      // Mark chat as connected since we're polling
      setChatConnected(true);

      // Poll for alerts every 30 seconds
      const alertInterval = setInterval(loadAlerts, 30000);
      const chatInterval = setInterval(loadLiveChats, 30000);

      return () => {
        clearInterval(alertInterval);
        clearInterval(chatInterval);
      };
    }
  }, [token, loadAlerts, loadLiveChats, loadCases, loadCallbacks, loadShifts, loadTeam, loadNotes, loadEscalations, user?.is_supervisor]);

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

  // Shift actions
  const handleAddShift = async () => {
    if (!token || !newShiftDate || !newShiftStart || !newShiftEnd) return;
    try {
      await staffApi.createShift(token, {
        date: newShiftDate,
        start_time: newShiftStart,
        end_time: newShiftEnd,
        shift_type: newShiftType,
      });
      setShowAddShift(false);
      setNewShiftDate('');
      setNewShiftStart('');
      setNewShiftEnd('');
      loadShifts();
    } catch (err) {
      console.error('Failed to add shift:', err);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!token || !confirm('Delete this shift?')) return;
    try {
      await staffApi.deleteShift(token, id);
      loadShifts();
    } catch (err) {
      console.error('Failed to delete shift:', err);
    }
  };

  const handleRequestSwap = async (shiftId: string) => {
    if (!token) return;
    const reason = prompt('Why do you need to swap this shift?');
    if (!reason) return;
    try {
      await staffApi.createSwapRequest(token, shiftId, reason);
      loadShifts();
      alert('Swap request submitted');
    } catch (err) {
      console.error('Failed to request swap:', err);
    }
  };

  // Notes actions
  const handleAddNote = async () => {
    if (!token || !newNoteTitle.trim() || !newNoteContent.trim()) return;
    try {
      await staffApi.createNote(token, {
        title: newNoteTitle,
        content: newNoteContent,
        is_shared: newNoteShared,
      });
      setShowAddNote(false);
      setNewNoteTitle('');
      setNewNoteContent('');
      setNewNoteShared(false);
      loadNotes();
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!token || !confirm('Delete this note?')) return;
    try {
      await staffApi.deleteNote(token, id);
      loadNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Escalation actions (supervisors)
  const handleAcknowledgeEscalation = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.acknowledgeEscalation(token, id);
      loadEscalations();
    } catch (err) {
      console.error('Failed to acknowledge escalation:', err);
    }
  };

  const handleResolveEscalation = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.resolveEscalation(token, id);
      loadEscalations();
    } catch (err) {
      console.error('Failed to resolve escalation:', err);
    }
  };

  // Phone status check
  const checkPhoneStatus = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';
      const response = await fetch(`${API_URL}/api/twilio/status`);
      const status = await response.json();
      if (status.configured) {
        setPhoneStatus('ready');
      } else {
        setPhoneStatus('unavailable');
      }
    } catch (err) {
      console.error('Failed to check phone status:', err);
      setPhoneStatus('error');
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(s => s.date === dateStr || s.date?.startsWith(dateStr));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
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
                name="email"
                autoComplete="email"
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
                name="password"
                autoComplete="current-password"
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
        {/* Connection Status Banner */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {/* In-App Calling Status */}
          <div className={`flex items-center justify-between p-4 rounded-xl border ${
            phoneStatus === 'ready' ? 'bg-green-500/10 border-green-500' :
            phoneStatus === 'connecting' ? 'bg-yellow-500/10 border-yellow-500' :
            'bg-red-500/10 border-red-500'
          }`}>
            <div className="flex items-center gap-3">
              <PhoneCall className={`w-5 h-5 ${
                phoneStatus === 'ready' ? 'text-green-400' :
                phoneStatus === 'connecting' ? 'text-yellow-400' :
                'text-red-400'
              }`} />
              <div>
                <p className="font-semibold text-sm">In-App Calling</p>
                <p className="text-xs text-gray-400">
                  {phoneStatus === 'ready' ? 'Ready for calls' :
                   phoneStatus === 'connecting' ? 'Connecting...' :
                   phoneStatus === 'unavailable' ? 'Not configured' :
                   'Connection error'}
                </p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              phoneStatus === 'ready' ? 'bg-green-500' :
              phoneStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`} />
          </div>

          {/* Live Chat Status */}
          <div className={`flex items-center justify-between p-4 rounded-xl border ${
            chatConnected ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'
          }`}>
            <div className="flex items-center gap-3">
              {chatConnected ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
              <div>
                <p className="font-semibold text-sm">Live Chat</p>
                <p className="text-xs text-gray-400">
                  {chatConnected ? 'Connected - monitoring for requests' : 'Disconnected'}
                </p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${chatConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>

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
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-secondary" />
                My Shifts
              </h1>
              <button
                onClick={() => setShowAddShift(true)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
              >
                <Plus className="w-4 h-4" />
                Add Shift
              </button>
            </div>

            {/* Calendar */}
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <button onClick={prevMonth} className="p-2 hover:bg-white/5 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-semibold">
                  {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={nextMonth} className="p-2 hover:bg-white/5 rounded">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm text-gray-400 py-2">{day}</div>
                ))}
                {(() => {
                  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);
                  const days = [];
                  for (let i = 0; i < startingDay; i++) {
                    days.push(<div key={`empty-${i}`} className="p-2" />);
                  }
                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                    const dayShifts = getShiftsForDate(date);
                    const isToday = new Date().toDateString() === date.toDateString();
                    days.push(
                      <div
                        key={day}
                        onClick={() => setSelectedDate(date)}
                        className={`p-2 text-center rounded cursor-pointer transition-colors ${
                          isToday ? 'bg-secondary/20 border border-secondary' :
                          selectedDate?.toDateString() === date.toDateString() ? 'bg-primary-light' :
                          'hover:bg-white/5'
                        }`}
                      >
                        <span className="text-sm">{day}</span>
                        {dayShifts.length > 0 && (
                          <div className="mt-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full mx-auto" />
                          </div>
                        )}
                      </div>
                    );
                  }
                  return days;
                })()}
              </div>
            </div>

            {/* Shifts List */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4">
                {selectedDate ? `Shifts for ${selectedDate.toLocaleDateString('en-GB')}` : 'Upcoming Shifts'}
              </h3>
              <div className="space-y-3">
                {(selectedDate ? getShiftsForDate(selectedDate) : shifts.slice(0, 10)).map(shift => (
                  <div key={shift._id} className="flex justify-between items-center p-4 bg-primary-dark/50 rounded-lg">
                    <div>
                      <p className="font-semibold">{new Date(shift.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                      <p className="text-sm text-gray-400">
                        {shift.start_time} - {shift.end_time}
                        <span className="ml-2 px-2 py-0.5 bg-primary-light rounded text-xs">{shift.shift_type}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRequestSwap(shift._id)} className="p-2 hover:bg-white/5 rounded" title="Request Swap">
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteShift(shift._id)} className="p-2 hover:bg-red-500/20 rounded text-red-400" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {shifts.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No shifts scheduled</p>
                )}
              </div>
            </div>

            {/* Swap Requests */}
            {swapRequests.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6 mt-6">
                <h3 className="font-semibold mb-4">Swap Requests</h3>
                <div className="space-y-3">
                  {swapRequests.map(swap => (
                    <div key={swap._id} className="flex justify-between items-center p-4 bg-primary-dark/50 rounded-lg">
                      <div>
                        <p className="text-sm">{swap.reason}</p>
                        <p className="text-xs text-gray-400">Requested by: {swap.requested_by_name}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        swap.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        swap.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {swap.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-secondary" />
                Team On Duty
              </h1>
              <button onClick={loadTeam} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Today's Team */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-secondary" />
                  Today&apos;s Team
                </h3>
                <div className="space-y-3">
                  {teamMembers.map(member => (
                    <div key={member._id || member.id} className="flex items-center gap-3 p-3 bg-primary-dark/50 rounded-lg">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                        member.status === 'available' ? 'bg-green-500' :
                        member.status === 'busy' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`}>
                        {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{member.role}</p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        member.status === 'available' ? 'bg-green-500' :
                        member.status === 'busy' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`} />
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No team members on duty</p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Team Stats</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {teamMembers.filter(m => m.status === 'available').length}
                      </div>
                      <div className="text-xs text-gray-400">Available</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {teamMembers.filter(m => m.status === 'busy').length}
                      </div>
                      <div className="text-xs text-gray-400">Busy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-400">
                        {teamMembers.filter(m => m.status === 'offline').length}
                      </div>
                      <div className="text-xs text-gray-400">Offline</div>
                    </div>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Role Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Counsellors</span>
                      <span>{teamMembers.filter(m => m.role === 'counsellor').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Peer Supporters</span>
                      <span>{teamMembers.filter(m => m.role === 'peer').length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-secondary" />
                Notes
              </h1>
              <button
                onClick={() => setShowAddNote(true)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
              >
                <Plus className="w-4 h-4" />
                New Note
              </button>
            </div>

            {/* Notes Tabs */}
            <div className="flex gap-4 mb-6 border-b border-border">
              <button
                onClick={() => setNotesTab('my')}
                className={`px-4 py-3 border-b-2 transition-colors ${
                  notesTab === 'my' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                My Notes
              </button>
              <button
                onClick={() => setNotesTab('shared')}
                className={`px-4 py-3 border-b-2 transition-colors ${
                  notesTab === 'shared' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Shared Notes
              </button>
            </div>

            {/* Notes Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes
                .filter(note => notesTab === 'my' ? !note.is_shared : note.is_shared)
                .map(note => (
                  <div key={note._id} className="bg-card border border-border rounded-xl p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold">{note.title}</h3>
                      <button onClick={() => handleDeleteNote(note._id)} className="p-1 hover:bg-red-500/20 rounded text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-3 mb-3">{note.content}</p>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{formatTimeAgo(note.created_at)}</span>
                      {note.is_shared && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Shared</span>}
                    </div>
                  </div>
                ))}
              {notes.filter(note => notesTab === 'my' ? !note.is_shared : note.is_shared).length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notes yet</p>
                </div>
              )}
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

            {/* Escalations Tabs */}
            <div className="flex gap-4 mb-6 border-b border-border">
              <button
                onClick={() => setEscalationsTab('pending')}
                className={`px-4 py-3 border-b-2 transition-colors ${
                  escalationsTab === 'pending' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Pending Escalations
                {escalations.filter(e => e.status === 'pending').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {escalations.filter(e => e.status === 'pending').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setEscalationsTab('all')}
                className={`px-4 py-3 border-b-2 transition-colors ${
                  escalationsTab === 'all' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                All Escalations
              </button>
            </div>

            {/* Escalations List */}
            <div className="space-y-4">
              {escalations
                .filter(e => escalationsTab === 'pending' ? e.status === 'pending' : true)
                .map(escalation => (
                  <div key={escalation._id} className={`bg-card border rounded-xl p-6 ${
                    escalation.status === 'pending' ? 'border-red-500' : 'border-border'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            escalation.status === 'pending' ? 'bg-red-500/20 text-red-400' :
                            escalation.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {escalation.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="font-semibold">Escalated by: {escalation.escalated_by_name}</p>
                        <p className="text-gray-400 text-sm mt-1">{escalation.reason}</p>
                      </div>
                      <span className="text-sm text-gray-400">{formatTimeAgo(escalation.created_at)}</span>
                    </div>

                    {escalation.status !== 'resolved' && (
                      <div className="flex gap-3">
                        {escalation.status === 'pending' && (
                          <button
                            onClick={() => handleAcknowledgeEscalation(escalation._id)}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => handleResolveEscalation(escalation._id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              {escalations.filter(e => escalationsTab === 'pending' ? e.status === 'pending' : true).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{escalationsTab === 'pending' ? 'No pending escalations' : 'No escalations'}</p>
                </div>
              )}
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

      {/* Add Shift Modal */}
      {showAddShift && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddShift(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-secondary" />
                Add Shift
              </h2>
              <button onClick={() => setShowAddShift(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={newShiftDate}
                  onChange={(e) => setNewShiftDate(e.target.value)}
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={newShiftStart}
                    onChange={(e) => setNewShiftStart(e.target.value)}
                    className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">End Time</label>
                  <input
                    type="time"
                    value={newShiftEnd}
                    onChange={(e) => setNewShiftEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Shift Type</label>
                <select
                  value={newShiftType}
                  onChange={(e) => setNewShiftType(e.target.value)}
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <button
                onClick={handleAddShift}
                disabled={!newShiftDate || !newShiftStart || !newShiftEnd}
                className="w-full py-3 bg-secondary text-primary-dark font-semibold rounded-lg disabled:opacity-50"
              >
                Add Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddNote(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-secondary" />
                New Note
              </h2>
              <button onClick={() => setShowAddNote(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Title</label>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Note title..."
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Content</label>
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Write your note..."
                  rows={5}
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newNoteShared}
                  onChange={(e) => setNewNoteShared(e.target.checked)}
                  className="w-4 h-4 accent-secondary"
                />
                <span className="text-sm">Share with team</span>
              </label>
              <button
                onClick={handleAddNote}
                disabled={!newNoteTitle.trim() || !newNoteContent.trim()}
                className="w-full py-3 bg-secondary text-primary-dark font-semibold rounded-lg disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
