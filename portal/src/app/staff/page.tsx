'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import useWebRTCPhone from '@/hooks/useWebRTCPhone';
import useTwilioPhone from '@/hooks/useTwilioPhone';
import { staffApi, Callback, Shift, ShiftSwap, TeamMember, StaffNote, Escalation, InternalMessage } from '@/lib/api';
import Link from 'next/link';
import {
  LayoutDashboard, AlertTriangle, MessageSquare, Briefcase, Phone,
  Calendar, Users, FileText, Shield, LogOut, Bell, Volume2, VolumeX,
  CheckCircle, Clock, User, ChevronRight, RefreshCw, X, Send,
  Plus, Edit, Edit2, Trash2, ChevronLeft, ArrowLeftRight, Eye, PhoneCall, Wifi, WifiOff,
  PhoneIncoming, PhoneOff, Mic, MicOff, MapPin, Globe, Info, AlertOctagon, ArrowUp, Share2, Mail
} from 'lucide-react';

// Import extracted tab components
import AlertsTab, { useAlertCounts } from '@/components/staff/tabs/AlertsTab';
import LiveChatTab, { useLiveChatCounts } from '@/components/staff/tabs/LiveChatTab';
import CasesTab, { useCaseCounts } from '@/components/staff/tabs/CasesTab';

type TabType = 'dashboard' | 'alerts' | 'livechat' | 'cases' | 'callbacks' | 'rota' | 'team' | 'notes' | 'supervision';
type AlertsSubTab = 'safeguarding' | 'panic';
type CallbacksSubTab = 'pending' | 'active' | 'completed';

// Get API URL - MUST be the backend, not the frontend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

console.log('[StaffPortal] Using API_URL:', API_URL);

export default function StaffPortalPage() {
  const { user, profile, token, isLoading, login, logout, updateStatus } = useStaffAuth();

  // Use hooks for badge counts and dashboard data (these poll independently for nav/dashboard)
  const { safeguardingAlerts, panicAlerts, activeSafeguardingCount, activePanicCount, activeAlertsCount } = useAlertCounts(token);
  const { waitingChatsCount } = useLiveChatCounts(token);
  const { openCasesCount } = useCaseCounts(token);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // App state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Sub-tab states (only for tabs not yet extracted)
  const [callbacksSubTab, setCallbacksSubTab] = useState<CallbacksSubTab>('pending');
  
  // Session timeout state (2 hour inactivity timeout)
  const lastActivityRef = useRef<number>(Date.now());
  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
  const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
  const sessionStartRef = useRef<number>(Date.now());
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  // Sound alert refs (for parent-level sound only)
  const audioContextRef = useRef<AudioContext | null>(null);

  // Phone/WebRTC state - now using the hook
  const [phoneStatus, setPhoneStatus] = useState<'connecting' | 'ready' | 'error' | 'unavailable'>('connecting');
  const [chatConnected, setChatConnected] = useState(false);

  // Initialize WebRTC Phone (for peer-to-peer calls between staff)
  // CRITICAL: We MUST use callable_user_id from the profile, NOT user.id
  // The mobile app calls using peer_supporters.user_id, so we must register with that same ID
  // Wait for profile to load before determining the ID to avoid re-registration
  const webrtcUserId = profile ? ((profile as any)?.callable_user_id || profile?.user_id || profile?.id) : undefined;
  const webrtcPhone = useWebRTCPhone({
    serverUrl: API_URL,
    userId: webrtcUserId,
    userType: user?.role === 'counsellor' ? 'counsellor' : 'peer',
    userName: profile?.name || user?.name,
    enabled: !!token && !!user && !!profile && !!webrtcUserId,
  });

  // Initialize Twilio Phone (for browser-to-phone calls)
  const twilioPhone = useTwilioPhone({
    staffId: profile?.id || user?.id,
    staffName: user?.name,
    enabled: !!token && !!user && !!profile,
  });

  // Debug logging for WebRTC and Twilio
  useEffect(() => {
    console.log('[StaffPage] Auth state:', { 
      hasToken: !!token, 
      hasUser: !!user, 
      hasProfile: !!profile,
      userId: user?.id,
      profileId: profile?.id,
      callableUserId: (profile as any)?.callable_user_id,  // The ID for WebRTC calls
      webrtcUserId: webrtcUserId,  // What we're actually using
      userRole: user?.role,
      userName: user?.name,
      API_URL 
    });
    console.log('[StaffPage] WebRTC status:', webrtcPhone.status, 'registered:', webrtcPhone.isRegistered);
    console.log('[StaffPage] Twilio status:', twilioPhone.status, 'ready:', twilioPhone.isReady);
  }, [token, user, profile, webrtcUserId, webrtcPhone.status, webrtcPhone.isRegistered, twilioPhone.status, twilioPhone.isReady]);

  // Sync phone status from WebRTC hook
  useEffect(() => {
    if (webrtcPhone.isRegistered) {
      setPhoneStatus('ready');
      setChatConnected(true);
    } else if (webrtcPhone.status === 'error') {
      setPhoneStatus('error');
      setChatConnected(false);
    } else if (webrtcPhone.status === 'connecting') {
      setPhoneStatus('connecting');
    } else {
      setPhoneStatus('unavailable');
      setChatConnected(false);
    }
  }, [webrtcPhone.isRegistered, webrtcPhone.status]);

  // Data state (only for tabs not yet extracted)
  const [callbacks, setCallbacks] = useState<Callback[]>([]);

  // Additional data state (remaining tabs)
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
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null); // note ID to share
  const [selectedShareUsers, setSelectedShareUsers] = useState<string[]>([]);
  
  // Internal Messages state
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [newMessageTo, setNewMessageTo] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Shift modal state
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [newShiftType, setNewShiftType] = useState('morning');

  // Panic button state (for dashboard - kept for peer support)
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicReason, setPanicReason] = useState('');
  const [triggeringPanic, setTriggeringPanic] = useState(false);

  // Escalations state (for supervision tab - not yet extracted)
  const [escalationsTab, setEscalationsTab] = useState<'pending' | 'all'>('pending');

  // Load data (only for tabs not yet extracted)
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
      const response = await staffApi.getNotes(token);
      // API returns {notes: [...], count: ...} - extract the notes array
      setNotes(response.notes || []);
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

  // Initial data load and polling (only for tabs not yet extracted)
  // AlertsTab, LiveChatTab, and CasesTab now manage their own data loading
  useEffect(() => {
    if (token) {
      // Load data for remaining tabs only
      loadCallbacks();
      loadShifts();
      loadTeam();
      loadNotes();
      if (user?.is_supervisor) {
        loadEscalations();
      }
    }
  }, [token, loadCallbacks, loadShifts, loadTeam, loadNotes, loadEscalations, user?.is_supervisor]);

  // Listen for real-time status sync from other portals
  useEffect(() => {
    const handleStatusSync = (event: CustomEvent) => {
      console.log('[StaffPage] Status synced from another session:', event.detail);
      // Refresh team members to get updated statuses
      loadTeam();
    };

    const handleStaffOnline = (event: CustomEvent) => {
      console.log('[StaffPage] Staff came online:', event.detail);
      loadTeam();
    };

    const handleStaffOffline = (event: CustomEvent) => {
      console.log('[StaffPage] Staff went offline:', event.detail);
      loadTeam();
    };

    window.addEventListener('staff_status_sync', handleStatusSync as EventListener);
    window.addEventListener('staff_online', handleStaffOnline as EventListener);
    window.addEventListener('staff_offline', handleStaffOffline as EventListener);

    return () => {
      window.removeEventListener('staff_status_sync', handleStatusSync as EventListener);
      window.removeEventListener('staff_online', handleStaffOnline as EventListener);
      window.removeEventListener('staff_offline', handleStaffOffline as EventListener);
    };
  }, [loadTeam]);

  // Session timeout logic
  useEffect(() => {
    if (!token) return;
    
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (showTimeoutWarning) setShowTimeoutWarning(false);
    };
    
    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));
    
    // Check for timeout every minute
    const timeoutCheck = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;
      const sessionTime = now - sessionStartRef.current;
      
      // Absolute timeout (24 hours)
      if (sessionTime > ABSOLUTE_TIMEOUT_MS) {
        logout();
        return;
      }
      
      // Show warning 5 minutes before inactivity timeout
      if (inactiveTime > SESSION_TIMEOUT_MS - 5 * 60 * 1000 && inactiveTime < SESSION_TIMEOUT_MS) {
        setShowTimeoutWarning(true);
      }
      
      // Inactivity timeout
      if (inactiveTime > SESSION_TIMEOUT_MS) {
        logout();
      }
    }, 60000);
    
    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(timeoutCheck);
    };
  }, [token, logout, showTimeoutWarning]);

  // Sound alert function - passed to tab components
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      // Play 3 ascending beeps (800Hz, 1000Hz, 1200Hz)
      [800, 1000, 1200].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.15);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.15);
      });
    } catch (e) {
      console.error('Failed to play alert sound:', e);
    }
  }, [soundEnabled]);
  
  // Load sound preference from localStorage
  useEffect(() => {
    const savedSound = localStorage.getItem('staffPortalSoundEnabled');
    if (savedSound !== null) {
      setSoundEnabled(savedSound === 'true');
    }
  }, []);
  
  // Save sound preference
  useEffect(() => {
    localStorage.setItem('staffPortalSoundEnabled', String(soundEnabled));
  }, [soundEnabled]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword, rememberMe);
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

  // Callback actions (remaining - not yet extracted)
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

  const handleReleaseCallback = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.releaseCallback(token, id);
      loadCallbacks();
    } catch (err) {
      console.error('Failed to release callback:', err);
    }
  };
  
  // Panic alert function - kept for dashboard panic button
  const triggerPanicAlert = async () => {
    if (!token || triggeringPanic) return;
    setTriggeringPanic(true);
    try {
      await fetch(`${API_URL}/api/safeguarding/panic-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          staff_id: user?.id,
          staff_name: user?.name || user?.email,
          reason: panicReason || 'Staff member triggered panic button',
          location: 'staff_portal',
          risk_level: 'critical'
        })
      });
      setShowPanicModal(false);
      setPanicReason('');
      alert('Panic alert sent! A counsellor will be notified.');
    } catch (err) {
      console.error('Failed to trigger panic:', err);
      alert('Failed to send panic alert. Please try again.');
    } finally {
      setTriggeringPanic(false);
    }
  };

  // Shift actions (remaining - not yet extracted)
  const handleAddShift = async () => {
    if (!token || !user || !newShiftDate || !newShiftStart || !newShiftEnd) return;
    try {
      await staffApi.createShift(
        token, 
        {
          date: newShiftDate,
          start_time: newShiftStart,
          end_time: newShiftEnd,
        },
        user.id,
        user.name || '',
        user.email || ''
      );
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

  // Edit note handler
  const handleUpdateNote = async () => {
    if (!token || !editingNote) return;
    try {
      await staffApi.updateNote(token, editingNote.id || editingNote._id || '', {
        title: editingNote.title,
        content: editingNote.content,
        is_shared: editingNote.is_shared,
        tags: editingNote.tags,
      });
      setEditingNote(null);
      loadNotes();
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  // Share note handler
  const handleShareNote = async () => {
    if (!token || !showShareModal || selectedShareUsers.length === 0) return;
    try {
      await staffApi.shareNote(token, showShareModal, selectedShareUsers);
      setShowShareModal(null);
      setSelectedShareUsers([]);
      loadNotes();
    } catch (err) {
      console.error('Failed to share note:', err);
    }
  };

  // Messages handlers
  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const response = await staffApi.getMessages(token);
      setMessages(response.messages || []);
      setUnreadMessageCount(response.unread_count || 0);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [token]);

  const handleSendInternalMessage = async () => {
    if (!token || !newMessageTo || !newMessageContent.trim()) return;
    try {
      await staffApi.sendMessage(token, {
        to_id: newMessageTo,
        content: newMessageContent.trim(),
      });
      setNewMessageContent('');
      loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleMarkMessageRead = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.markMessageRead(token, id);
      loadMessages();
    } catch (err) {
      console.error('Failed to mark message read:', err);
    }
  };

  // Load messages periodically
  useEffect(() => {
    if (!token) return;
    loadMessages();
    const interval = setInterval(loadMessages, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [token, loadMessages]);

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
      case 'busy': 
      case 'limited': return 'bg-yellow-500';
      case 'offline': 
      case 'unavailable': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // Counts for badges (remaining - callbacks only; others from hooks)
  const pendingCallbacksCount = callbacks.filter(c => c.status === 'pending').length;
  const activeCallbacksCount = callbacks.filter(c => c.status === 'taken').length;

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
            <img 
              src="https://customer-assets.emergentagent.com/job_b298e80e-e613-4114-bd36-44dba2b1f918/artifacts/hcklvnmw_logo.png" 
              alt="Radio Check" 
              className="w-20 h-20 mx-auto mb-4"
            />
            <h2 className="text-2xl font-bold">Staff Portal</h2>
            <p className="text-gray-400 text-sm mt-1">Sign in to access the staff dashboard</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} data-testid="login-form">
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                data-testid="login-email"
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
                data-testid="login-password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                placeholder="Enter your password"
              />
            </div>
            <div className="mb-6 flex items-center">
              <input
                type="checkbox"
                id="remember-me"
                data-testid="remember-me-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 mr-2 rounded border-gray-600 bg-primary-dark text-secondary focus:ring-secondary"
              />
              <label htmlFor="remember-me" className="text-sm text-gray-400 cursor-pointer">
                Remember me on this device
              </label>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              For shared computers, leave unchecked to automatically log out when you close the browser.
            </p>
            <button
              type="submit"
              data-testid="login-submit"
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
      {/* Hidden audio element for WebRTC calls */}
      <audio id="remote-audio" autoPlay playsInline />
      
      {/* Incoming Call Modal */}
      {webrtcPhone.hasIncomingCall && webrtcPhone.callerInfo && (
        <div data-testid="incoming-call-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <PhoneIncoming className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>
            <p data-testid="caller-name" className="text-gray-400 mb-6">{webrtcPhone.callerInfo.name}</p>
            <div className="flex gap-4 justify-center">
              <button
                data-testid="decline-call-btn"
                onClick={webrtcPhone.rejectCall}
                className="px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center gap-2"
              >
                <PhoneOff className="w-5 h-5" />
                Decline
              </button>
              <button
                data-testid="answer-call-btn"
                onClick={webrtcPhone.answerCall}
                className="px-6 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 flex items-center gap-2"
              >
                <Phone className="w-5 h-5" />
                Answer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call UI */}
      {webrtcPhone.isInCall && (
        <div data-testid="active-call-ui" className="fixed bottom-4 right-4 bg-card rounded-xl p-4 shadow-lg z-40 border border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Phone className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="font-semibold">In Call</p>
              <p data-testid="call-duration" className="text-sm text-gray-400">{webrtcPhone.formattedDuration}</p>
            </div>
            <div className="flex gap-2">
              <button
                data-testid="mute-btn"
                onClick={webrtcPhone.toggleMute}
                className={`p-2 rounded-full ${webrtcPhone.isMuted ? 'bg-red-500' : 'bg-gray-600'}`}
              >
                {webrtcPhone.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                data-testid="end-call-btn"
                onClick={webrtcPhone.endCall}
                className="p-2 rounded-full bg-red-500 hover:bg-red-600"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Chat Request Banner (from mobile app users) */}
      {webrtcPhone.hasIncomingChatRequest && webrtcPhone.pendingRequest && (
        <div data-testid="incoming-chat-request-banner" className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4 z-50 shadow-lg animate-pulse">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-lg">Incoming Chat Request</p>
                <p className="text-sm opacity-90">
                  {webrtcPhone.pendingRequest.user_name} needs to chat with staff
                  {webrtcPhone.pendingRequest.risk_level && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      webrtcPhone.pendingRequest.risk_level === 'RED' ? 'bg-red-500' :
                      webrtcPhone.pendingRequest.risk_level === 'AMBER' ? 'bg-amber-500' :
                      'bg-yellow-500'
                    }`}>
                      {webrtcPhone.pendingRequest.risk_level}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                data-testid="dismiss-chat-request-btn"
                onClick={webrtcPhone.dismissRequest}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
              >
                Dismiss
              </button>
              <button
                data-testid="accept-chat-request-btn"
                onClick={() => {
                  webrtcPhone.acceptChatRequest();
                  // Switch to live chat tab (it will load its own data)
                  setActiveTab('livechat');
                }}
                className="px-4 py-2 bg-white text-blue-600 hover:bg-gray-100 rounded-lg text-sm font-semibold"
              >
                Accept Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call Request Banner (safeguarding - user wants to talk to someone) */}
      {webrtcPhone.hasIncomingCallRequest && webrtcPhone.pendingRequest && (
        <div data-testid="incoming-call-request-banner" className="fixed top-0 left-0 right-0 bg-gradient-to-r from-red-600 to-red-500 text-white p-4 z-50 shadow-lg animate-pulse">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-lg">🚨 URGENT: Call Request</p>
                <p className="text-sm opacity-90">
                  {webrtcPhone.pendingRequest.user_name} needs to speak with someone urgently
                  {webrtcPhone.pendingRequest.risk_level && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      webrtcPhone.pendingRequest.risk_level === 'RED' ? 'bg-white text-red-600' :
                      webrtcPhone.pendingRequest.risk_level === 'AMBER' ? 'bg-amber-300 text-amber-800' :
                      'bg-yellow-300 text-yellow-800'
                    }`}>
                      {webrtcPhone.pendingRequest.risk_level} RISK
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                data-testid="dismiss-call-request-btn"
                onClick={webrtcPhone.dismissRequest}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
              >
                Dismiss
              </button>
              <button
                data-testid="accept-call-request-btn"
                onClick={() => {
                  webrtcPhone.acceptCallRequest();
                }}
                className="px-4 py-2 bg-white text-red-600 hover:bg-gray-100 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                Accept & Call
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* Use status values that work for both counsellors and peers */}
            {[
              { value: 'available', label: 'Available', color: 'bg-green-500' },
              { value: 'limited', label: 'Busy', color: 'bg-yellow-500' },
              { value: 'unavailable', label: 'Off Duty', color: 'bg-gray-500' }
            ].map((statusOption) => (
              <button
                key={statusOption.value}
                data-testid={`status-btn-${statusOption.value}`}
                onClick={() => handleStatusChange(statusOption.value)}
                disabled={!profile}
                className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                  profile?.status === statusOption.value 
                    ? `${statusOption.color} text-white` 
                    : 'bg-primary-dark border border-border hover:bg-white/5'
                } ${!profile ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!profile ? 'Profile required to update status' : `Set status to ${statusOption.label}`}
              >
                {statusOption.label}
              </button>
            ))}
          </div>
          {!profile && (
            <p className="text-xs text-amber-400 mt-2">Status updates disabled - no profile linked</p>
          )}
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
          {/* Messages Button */}
          <button
            onClick={() => setShowMessagesModal(true)}
            className="w-full flex items-center gap-2 text-gray-400 hover:text-white relative"
          >
            <Mail className="w-4 h-4" />
            <span className="text-sm">Messages</span>
            {unreadMessageCount > 0 && (
              <span className="absolute top-0 right-0 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {unreadMessageCount}
              </span>
            )}
          </button>
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

        {/* Profile Warning Banner */}
        {!profile && user && (
          <div data-testid="no-profile-warning" className="mb-6 p-4 rounded-xl border border-amber-500 bg-amber-500/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-400">No Staff Profile Linked</p>
                <p className="text-sm text-gray-400 mt-1">
                  Your login (<span className="font-mono">{user.email}</span>) doesn&apos;t have a linked counsellor or peer supporter profile. 
                  Some features like status updates and taking callbacks are disabled. 
                  Please contact an administrator to link your profile.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active Call Floating Indicator */}
        {twilioPhone.isInCall && (
          <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-4 animate-pulse">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">Call in Progress</p>
                <p className="text-xs opacity-80">{twilioPhone.currentCallNumber || 'Unknown'} • {twilioPhone.formattedDuration}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-l border-white/30 pl-4">
              <button 
                onClick={twilioPhone.toggleMute}
                className={`p-2 rounded-lg ${twilioPhone.isMuted ? 'bg-yellow-500' : 'bg-white/20 hover:bg-white/30'}`}
                title={twilioPhone.isMuted ? 'Unmute' : 'Mute'}
              >
                {twilioPhone.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button 
                onClick={twilioPhone.hangUp}
                className="p-2 rounded-lg bg-red-500 hover:bg-red-600"
                title="Hang Up"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Socket Conflict Warning - shown when calls fail repeatedly */}
        {phoneStatus === 'error' && (
          <div data-testid="socket-error-warning" className="mb-6 p-4 rounded-xl border border-red-500 bg-red-500/10">
            <div className="flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-400">Connection Issue</p>
                <p className="text-sm text-gray-400 mt-1">
                  Could not connect to the calling service. If you have another staff portal tab open 
                  (including the old legacy portal), please close it and refresh this page.
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        )}

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
                <div className="text-3xl font-bold">{openCasesCount}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="w-5 h-5 text-green-400" />
                  <span className="text-gray-400">Pending Callbacks</span>
                </div>
                <div className="text-3xl font-bold">{pendingCallbacksCount}</div>
              </div>
            </div>

            {/* Panic Button for Peers */}
            {user?.role === 'peer' && (
              <div className="mb-6">
                <button
                  data-testid="panic-button"
                  onClick={() => setShowPanicModal(true)}
                  className="w-full p-4 bg-red-500/10 border-2 border-red-500 rounded-xl hover:bg-red-500/20 transition flex items-center justify-center gap-3 group"
                >
                  <AlertTriangle className="w-6 h-6 text-red-500 group-hover:animate-pulse" />
                  <span className="text-red-500 font-semibold text-lg">Need Help? Trigger Panic Alert</span>
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Click this button if you need immediate support from a counsellor
                </p>
              </div>
            )}

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
                  <div key={alert.id || alert._id} className={`p-4 rounded-lg border ${alert.status === 'active' ? 'border-red-500 bg-red-500/10' : 'border-border'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs text-white ${getRiskBadgeColor(alert.risk_level)}`}>
                            {alert.risk_level.toUpperCase()}
                          </span>
                          <span className="text-gray-400 text-sm">{formatTimeAgo(alert.created_at)}</span>
                        </div>
                        <p className="text-sm truncate max-w-md">{alert.triggering_message || alert.trigger_message}</p>
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

        {/* Alerts Tab - Extracted to AlertsTab component */}
        {activeTab === 'alerts' && (
          <AlertsTab
            token={token!}
            user={user}
            webrtcUserId={webrtcUserId}
            twilioPhone={twilioPhone}
            soundEnabled={soundEnabled}
            onPlayAlertSound={playAlertSound}
          />
        )}

        {/* Live Chat Tab - Extracted to LiveChatTab component */}
        {activeTab === 'livechat' && (
          <LiveChatTab
            token={token!}
            user={user}
            webrtcUserId={webrtcUserId}
            webrtcPhone={webrtcPhone}
            onPlayAlertSound={playAlertSound}
          />
        )}

        {/* Cases Tab - Extracted to CasesTab component */}
        {activeTab === 'cases' && (
          <CasesTab
            token={token!}
            user={user}
          />
        )}

        {/* Callbacks Tab */}
        {activeTab === 'callbacks' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Phone className="w-6 h-6 text-secondary" />
                Callback Requests
              </h1>
              <button onClick={loadCallbacks} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            
            {/* Callback Sub-tabs */}
            <div className="flex gap-4 mb-6 border-b border-border">
              <button
                onClick={() => setCallbacksSubTab('pending')}
                className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                  callbacksSubTab === 'pending' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Pending
                {pendingCallbacksCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                    {pendingCallbacksCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setCallbacksSubTab('active')}
                className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                  callbacksSubTab === 'active' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Active (Taken)
                {activeCallbacksCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    {activeCallbacksCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setCallbacksSubTab('completed')}
                className={`px-4 py-3 border-b-2 transition-colors ${
                  callbacksSubTab === 'completed' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Completed
              </button>
            </div>

            <div className="space-y-4">
              {callbacks
                .filter(c => {
                  if (callbacksSubTab === 'pending') return c.status === 'pending';
                  if (callbacksSubTab === 'active') return c.status === 'taken';
                  return c.status === 'completed';
                })
                .map((callback) => (
                <div key={callback.id || callback._id} className={`bg-card border rounded-xl p-6 ${
                  callback.status === 'pending' && callback.priority === 'urgent' ? 'border-red-500' : 'border-border'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
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
                          callback.status === 'taken' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {callback.status}
                        </span>
                        {callback.request_type && (
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                            {callback.request_type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <Phone className="w-4 h-4 text-green-400" />
                        <span className="text-secondary font-mono">{callback.phone}</span>
                        {/* Call Now button using Twilio */}
                        {callback.phone && twilioPhone.isReady && callback.status === 'taken' && callback.taken_by === user?.id && !twilioPhone.isInCall && (
                          <button 
                            onClick={() => twilioPhone.makeCall(callback.phone)}
                            className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 flex items-center gap-1"
                          >
                            <PhoneCall className="w-3 h-3" />
                            Call Now
                          </button>
                        )}
                        {/* Active Call Controls - Hang Up, Mute, Duration */}
                        {twilioPhone.isInCall && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-400 animate-pulse flex items-center gap-1">
                              <PhoneCall className="w-3 h-3" />
                              {twilioPhone.formattedDuration}
                            </span>
                            <button 
                              onClick={twilioPhone.toggleMute}
                              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${twilioPhone.isMuted ? 'bg-yellow-500 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'}`}
                              title={twilioPhone.isMuted ? 'Unmute' : 'Mute'}
                            >
                              {twilioPhone.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                            </button>
                            <button 
                              onClick={twilioPhone.hangUp}
                              className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 flex items-center gap-1"
                            >
                              <PhoneOff className="w-3 h-3" />
                              Hang Up
                            </button>
                          </div>
                        )}
                      </div>
                      {callback.reason && <p className="text-sm text-gray-400 mt-1">{callback.reason}</p>}
                      <p className="text-xs text-gray-500 mt-2">Requested: {formatTimeAgo(callback.created_at)}</p>
                      {callback.taken_by_name && (
                        <p className="text-xs text-gray-500">Taken by: {callback.taken_by_name}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {callback.status === 'pending' && (
                        <button
                          onClick={() => handleTakeCallback(callback.id || callback._id || '')}
                          className="px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
                        >
                          Take
                        </button>
                      )}
                      {callback.status === 'taken' && callback.taken_by === user?.id && (
                        <>
                          <button
                            onClick={() => handleReleaseCallback(callback.id || callback._id || '')}
                            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                          >
                            Release
                          </button>
                          <button
                            onClick={() => handleCompleteCallback(callback.id || callback._id || '')}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                          >
                            Complete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {callbacks.filter(c => {
                if (callbacksSubTab === 'pending') return c.status === 'pending';
                if (callbacksSubTab === 'active') return c.status === 'taken';
                return c.status === 'completed';
              }).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No {callbacksSubTab} callbacks</p>
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
                        (member.status === 'busy' || member.status === 'limited') ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`}>
                        {member.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{member.role}</p>
                      </div>
                      {/* Call button for available members */}
                      {member.status === 'available' && member.user_id !== user?.id && webrtcPhone.isRegistered && (
                        <button
                          onClick={() => member.user_id && webrtcPhone.makeCall(member.user_id)}
                          className="p-2 bg-green-500 hover:bg-green-600 rounded-lg text-white"
                          title="Call this team member"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      )}
                      <div className={`w-3 h-3 rounded-full ${
                        member.status === 'available' ? 'bg-green-500' :
                        (member.status === 'busy' || member.status === 'limited') ? 'bg-yellow-500' :
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
                        {teamMembers.filter(m => m.status === 'busy' || m.status === 'limited').length}
                      </div>
                      <div className="text-xs text-gray-400">Busy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-400">
                        {teamMembers.filter(m => m.status === 'offline' || m.status === 'unavailable').length}
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
              {(notes || [])
                .filter(note => notesTab === 'my' ? !note.is_shared : note.is_shared)
                .map(note => {
                  const noteId = note.id || note._id || '';
                  const isAuthor = note.author_id === user?.id;
                  return (
                  <div key={noteId} className="bg-card border border-border rounded-xl p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold">{note.title}</h3>
                      <div className="flex gap-1">
                        {isAuthor && (
                          <>
                            <button 
                              onClick={() => setEditingNote(note)} 
                              className="p-1 hover:bg-blue-500/20 rounded text-blue-400"
                              title="Edit note"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                setShowShareModal(noteId);
                                setSelectedShareUsers(note.share_with || []);
                              }} 
                              className="p-1 hover:bg-green-500/20 rounded text-green-400"
                              title="Share note"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteNote(noteId)} 
                              className="p-1 hover:bg-red-500/20 rounded text-red-400"
                              title="Delete note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-3 mb-3">{note.content}</p>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{formatTimeAgo(note.created_at)}</span>
                      <div className="flex gap-2">
                        {note.is_shared && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Shared</span>}
                        {!isAuthor && <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">From: {note.author_name}</span>}
                      </div>
                    </div>
                  </div>
                  );
                })}
              {(notes || []).filter(note => notesTab === 'my' ? !note.is_shared : note.is_shared).length === 0 && (
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

      {/* Session Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-yellow-500 rounded-xl w-full max-w-md p-6 text-center">
            <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Session Expiring Soon</h2>
            <p className="text-gray-400 mb-6">
              You will be logged out in 5 minutes due to inactivity. 
              Click anywhere or press any key to stay logged in.
            </p>
            <button
              onClick={() => {
                lastActivityRef.current = Date.now();
                setShowTimeoutWarning(false);
              }}
              className="px-6 py-3 bg-secondary text-primary-dark rounded-lg font-semibold hover:bg-secondary-light"
            >
              Stay Logged In
            </button>
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

      {/* Panic Button Modal (for peer supporters) */}
      {showPanicModal && (
        <div data-testid="panic-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-red-500">Trigger Panic Alert</h2>
              <p className="text-gray-400 mt-2">This will immediately notify all available counsellors</p>
            </div>
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Reason (optional)</label>
              <textarea
                data-testid="panic-reason"
                value={panicReason}
                onChange={(e) => setPanicReason(e.target.value)}
                className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                placeholder="Describe the situation..."
                rows={3}
              />
            </div>
            <div className="flex gap-4">
              <button
                data-testid="cancel-panic-btn"
                onClick={() => {
                  setShowPanicModal(false);
                  setPanicReason('');
                }}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-panic-btn"
                onClick={triggerPanicAlert}
                disabled={triggeringPanic}
                className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {triggeringPanic ? 'Sending...' : (
                  <>
                    <AlertTriangle className="w-5 h-5" />
                    Send Alert
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Note</h2>
              <button onClick={() => setEditingNote(null)} className="p-1 hover:bg-primary-dark rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={editingNote.title}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Content</label>
                <textarea
                  value={editingNote.content}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editNoteShared"
                  checked={editingNote.is_shared}
                  onChange={(e) => setEditingNote({ ...editingNote, is_shared: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="editNoteShared" className="text-sm">Share with team</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingNote(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateNote}
                className="flex-1 px-4 py-2 rounded-lg bg-secondary text-white hover:bg-secondary/80 transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Note Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Share Note</h2>
              <button onClick={() => { setShowShareModal(null); setSelectedShareUsers([]); }} className="p-1 hover:bg-primary-dark rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Select staff members to share this note with:</p>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {teamMembers.filter(m => m.id !== user?.id).map(member => {
                const memberId = member.id || member.user_id || '';
                return (
                <label key={memberId} className="flex items-center gap-3 p-3 bg-primary-dark rounded-lg cursor-pointer hover:bg-primary-dark/70">
                  <input
                    type="checkbox"
                    checked={selectedShareUsers.includes(memberId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedShareUsers([...selectedShareUsers, memberId]);
                      } else {
                        setSelectedShareUsers(selectedShareUsers.filter(id => id !== memberId));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                  </div>
                </label>
                );
              })}
              {teamMembers.filter(m => m.id !== user?.id).length === 0 && (
                <p className="text-gray-500 text-center py-4">No other team members available</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowShareModal(null); setSelectedShareUsers([]); }}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                onClick={handleShareNote}
                disabled={selectedShareUsers.length === 0}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Share with {selectedShareUsers.length} member{selectedShareUsers.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Messages Modal */}
      {showMessagesModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Internal Messages
                {unreadMessageCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{unreadMessageCount}</span>
                )}
              </h2>
              <button onClick={() => setShowMessagesModal(false)} className="p-1 hover:bg-primary-dark rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* New Message Form */}
            <div className="p-4 border-b border-border bg-primary-dark/50">
              <div className="flex gap-2">
                <select
                  value={newMessageTo}
                  onChange={(e) => setNewMessageTo(e.target.value)}
                  className="flex-shrink-0 px-3 py-2 bg-primary-dark border border-border rounded-lg text-sm"
                >
                  <option value="">Send to...</option>
                  {teamMembers.filter(m => m.id !== user?.id).map(member => (
                    <option key={member.id} value={member.id}>{member.name} ({member.role})</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newMessageContent}
                  onChange={(e) => setNewMessageContent(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 bg-primary-dark border border-border rounded-lg text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendInternalMessage()}
                />
                <button
                  onClick={handleSendInternalMessage}
                  disabled={!newMessageTo || !newMessageContent.trim()}
                  className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/80 transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No messages yet</p>
              ) : (
                messages.map(msg => {
                  const isFromMe = msg.from_id === user?.id;
                  const isUnread = !msg.read && msg.to_id === user?.id;
                  return (
                    <div 
                      key={msg.id} 
                      className={`p-3 rounded-lg ${isFromMe ? 'bg-secondary/20 ml-8' : 'bg-primary-dark mr-8'} ${isUnread ? 'border-l-4 border-blue-500' : ''}`}
                      onClick={() => isUnread && handleMarkMessageRead(msg.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">
                          {isFromMe ? `To: ${msg.to_name}` : `From: ${msg.from_name}`}
                        </span>
                        <span className="text-xs text-gray-500">{formatTimeAgo(msg.created_at)}</span>
                      </div>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
