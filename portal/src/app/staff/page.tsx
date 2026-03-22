'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import useWebRTCPhone from '@/hooks/useWebRTCPhone';
import useTwilioPhone from '@/hooks/useTwilioPhone';
import { staffApi, TeamMember, InternalMessage } from '@/lib/api';
import Link from 'next/link';
import {
  LayoutDashboard, AlertTriangle, MessageSquare, Briefcase, Phone,
  Calendar, Users, FileText, Shield, LogOut, Bell, Volume2, VolumeX,
  CheckCircle, Clock, User, ChevronRight, X, Send, Wifi, WifiOff,
  PhoneCall, PhoneIncoming, PhoneOff, Mic, MicOff, Mail
} from 'lucide-react';

// Import extracted tab components
import AlertsTab, { useAlertCounts } from '@/components/staff/tabs/AlertsTab';
import LiveChatTab, { useLiveChatCounts } from '@/components/staff/tabs/LiveChatTab';
import CasesTab, { useCaseCounts } from '@/components/staff/tabs/CasesTab';
import CallbacksTab, { useCallbackCounts } from '@/components/staff/tabs/CallbacksTab';
import RotaTab from '@/components/staff/tabs/RotaTab';
import TeamTab from '@/components/staff/tabs/TeamTab';
import NotesTab from '@/components/staff/tabs/NotesTab';
import SupervisionTab from '@/components/staff/tabs/SupervisionTab';

type TabType = 'dashboard' | 'alerts' | 'livechat' | 'cases' | 'callbacks' | 'rota' | 'team' | 'notes' | 'supervision';

// Get API URL - MUST be the backend, not the frontend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

console.log('[StaffPortal] Using API_URL:', API_URL);

export default function StaffPortalPage() {
  const { user, profile, token, isLoading, login, logout, updateStatus } = useStaffAuth();

  // Use hooks for badge counts and dashboard data (these poll independently for nav/dashboard)
  const { safeguardingAlerts, panicAlerts, activeSafeguardingCount, activePanicCount, activeAlertsCount } = useAlertCounts(token);
  const { waitingChatsCount } = useLiveChatCounts(token);
  const { openCasesCount } = useCaseCounts(token);
  const { pendingCallbacksCount } = useCallbackCounts(token);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // App state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
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

  // Internal Messages state (kept - used in sidebar and global modal)
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [newMessageTo, setNewMessageTo] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  // Team members needed for messages dropdown
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Panic button state (for dashboard - kept for peer support)
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicReason, setPanicReason] = useState('');
  const [triggeringPanic, setTriggeringPanic] = useState(false);

  // Load team members (needed for messages dropdown)
  const loadTeam = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getTeamOnDuty(token);
      setTeamMembers(data);
    } catch (err) {
      console.error('Failed to load team:', err);
    }
  }, [token]);

  // Initial data load for messages dropdown
  useEffect(() => {
    if (token) {
      loadTeam();
    }
  }, [token, loadTeam]);

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

        {/* Callbacks Tab - Extracted to CallbacksTab component */}
        {activeTab === 'callbacks' && (
          <CallbacksTab
            token={token!}
            user={user}
            twilioPhone={twilioPhone}
          />
        )}

        {/* Rota Tab - Extracted to RotaTab component */}
        {activeTab === 'rota' && (
          <RotaTab
            token={token!}
            user={user}
          />
        )}

        {/* Team Tab - Extracted to TeamTab component */}
        {activeTab === 'team' && (
          <TeamTab
            token={token!}
            user={user}
            webrtcPhone={webrtcPhone}
          />
        )}

        {/* Notes Tab - Extracted to NotesTab component */}
        {activeTab === 'notes' && (
          <NotesTab
            token={token!}
            user={user}
          />
        )}

        {/* Supervision Tab - Extracted to SupervisionTab component */}
        {activeTab === 'supervision' && user?.is_supervisor && (
          <SupervisionTab
            token={token!}
            user={user}
          />
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
