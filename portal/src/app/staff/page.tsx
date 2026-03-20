'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import useWebRTCPhone from '@/hooks/useWebRTCPhone';
import useTwilioPhone from '@/hooks/useTwilioPhone';
import { staffApi, SafeguardingAlert, PanicAlert, LiveChatRoom, Case, Callback, Shift, ShiftSwap, TeamMember, StaffNote, Escalation, LiveChatMessage } from '@/lib/api';
import Link from 'next/link';
import {
  LayoutDashboard, AlertTriangle, MessageSquare, Briefcase, Phone,
  Calendar, Users, FileText, Shield, LogOut, Bell, Volume2, VolumeX,
  CheckCircle, Clock, User, ChevronRight, RefreshCw, X, Send,
  Plus, Edit, Trash2, ChevronLeft, ArrowLeftRight, Eye, PhoneCall, Wifi, WifiOff,
  PhoneIncoming, PhoneOff, Mic, MicOff, MapPin, Globe, Info, AlertOctagon, ArrowUp
} from 'lucide-react';

type TabType = 'dashboard' | 'alerts' | 'livechat' | 'cases' | 'callbacks' | 'rota' | 'team' | 'notes' | 'supervision';
type AlertsSubTab = 'safeguarding' | 'panic';
type CallbacksSubTab = 'pending' | 'active' | 'completed';

// Get API URL - MUST be the backend, not the frontend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

console.log('[StaffPortal] Using API_URL:', API_URL);

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
  
  // Sub-tab states
  const [alertsSubTab, setAlertsSubTab] = useState<AlertsSubTab>('safeguarding');
  const [callbacksSubTab, setCallbacksSubTab] = useState<CallbacksSubTab>('pending');
  
  // Case management state
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>('');
  const [caseRiskFilter, setCaseRiskFilter] = useState<string>('');
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [newSessionNote, setNewSessionNote] = useState('');
  const [caseSessions, setCaseSessions] = useState<any[]>([]);
  
  // Session timeout state (2 hour inactivity timeout)
  const lastActivityRef = useRef<number>(Date.now());
  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
  const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
  const sessionStartRef = useRef<number>(Date.now());
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  // Sound alert refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const prevSafeguardingCountRef = useRef<number>(0);
  const prevChatCountRef = useRef<number>(0);
  const prevPanicCountRef = useRef<number>(0);

  // Phone/WebRTC state - now using the hook
  const [phoneStatus, setPhoneStatus] = useState<'connecting' | 'ready' | 'error' | 'unavailable'>('connecting');
  const [chatConnected, setChatConnected] = useState(false);

  // Initialize WebRTC Phone (for peer-to-peer calls between staff)
  // CRITICAL: We MUST use callable_user_id from the profile, NOT user.id
  // The mobile app calls using peer_supporters.user_id, so we must register with that same ID
  const webrtcUserId = (profile as any)?.callable_user_id || profile?.user_id || user?.id;
  const webrtcPhone = useWebRTCPhone({
    serverUrl: API_URL,
    userId: webrtcUserId,
    userType: user?.role === 'counsellor' ? 'counsellor' : 'peer',
    userName: user?.name,
    enabled: !!token && !!user && !!webrtcUserId,
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

  // Panic button state (for peers)
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicReason, setPanicReason] = useState('');
  const [triggeringPanic, setTriggeringPanic] = useState(false);

  // AI Feedback modal state
  const [showAiFeedbackModal, setShowAiFeedbackModal] = useState(false);
  const [aiFeedbackData, setAiFeedbackData] = useState<{ messageId: string; message: string; response: string } | null>(null);
  const [aiFeedbackRating, setAiFeedbackRating] = useState<'good' | 'needs_improvement' | 'inappropriate' | 'missed_risk' | null>(null);
  const [aiFeedbackComment, setAiFeedbackComment] = useState('');

  // Case management state
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateCaseId, setEscalateCaseId] = useState<string | null>(null);
  const [escalateTo, setEscalateTo] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateNotes, setEscalateNotes] = useState('');
  const [newCaseUserId, setNewCaseUserId] = useState('');
  const [newCaseUserName, setNewCaseUserName] = useState('');
  const [newCaseNotes, setNewCaseNotes] = useState('');
  const [newCaseRiskLevel, setNewCaseRiskLevel] = useState('medium');
  const [availableCounsellors, setAvailableCounsellors] = useState<any[]>([]);

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
      const casesData = await staffApi.getCases(token);
      setCases(Array.isArray(casesData) ? casesData : []);
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

      // Poll for alerts every 30 seconds
      const alertInterval = setInterval(loadAlerts, 30000);
      const chatInterval = setInterval(loadLiveChats, 30000);

      return () => {
        clearInterval(alertInterval);
        clearInterval(chatInterval);
      };
    }
  }, [token, loadAlerts, loadLiveChats, loadCases, loadCallbacks, loadShifts, loadTeam, loadNotes, loadEscalations, user?.is_supervisor]);

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

  // AUTO-OPEN CHAT when pendingRequest.room_id is confirmed
  // This handles the "chat notification comes up but no chat window appears" issue
  useEffect(() => {
    const openConfirmedChat = async () => {
      // Check if we have a confirmed room_id from an accepted chat request
      if (webrtcPhone.pendingRequest?.room_id && token && user?.id && user?.name) {
        const roomId = webrtcPhone.pendingRequest.room_id;
        const userId = webrtcPhone.pendingRequest.user_id;
        const userName = webrtcPhone.pendingRequest.user_name;
        
        console.log('[StaffPage] Auto-opening confirmed chat room:', roomId, 'user:', userId);
        
        try {
          // Join the chat room via API
          await staffApi.joinLiveChat(token, roomId, user.id, user.name);
          
          // Get messages
          const messages = await staffApi.getLiveChatMessages(token, roomId);
          
          // Create room object and set as active
          const room: LiveChatRoom = {
            id: roomId,
            room_id: roomId,
            user_id: userId,
            user_name: userName || 'Veteran',
            status: 'active',
            staff_id: user.id,
            staff_name: user.name,
            created_at: new Date().toISOString(),
          };
          
          setActiveChatRoom(room);
          setChatMessages(messages);
          setActiveTab('livechat');
          
          // Reload live chats to ensure list is up to date
          loadLiveChats();
          
          console.log('[StaffPage] Chat room opened successfully');
        } catch (err) {
          console.error('[StaffPage] Failed to auto-open chat room:', err);
        }
      }
    };
    
    openConfirmedChat();
  }, [webrtcPhone.pendingRequest?.room_id, token, user?.id, user?.name, loadLiveChats]);

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
  
  // Sound alert function
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
  
  // Check for new alerts and play sound
  useEffect(() => {
    const activeAlertCount = safeguardingAlerts.filter(a => a.status === 'active').length;
    const waitingChatCount = liveChatRooms.filter(r => r.status === 'waiting').length;
    const activePanicCount = panicAlerts.filter(a => a.status === 'active').length;
    
    // Play sound if new alerts appeared
    if (activeAlertCount > prevSafeguardingCountRef.current ||
        waitingChatCount > prevChatCountRef.current ||
        activePanicCount > prevPanicCountRef.current) {
      playAlertSound();
    }
    
    prevSafeguardingCountRef.current = activeAlertCount;
    prevChatCountRef.current = waitingChatCount;
    prevPanicCountRef.current = activePanicCount;
  }, [safeguardingAlerts, liveChatRooms, panicAlerts, playAlertSound]);
  
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
    if (!token || !user?.id || !user?.name) return;
    try {
      const roomId = room.id || room.room_id || room._id;
      if (!roomId) {
        console.error('No room ID found');
        return;
      }
      await staffApi.joinLiveChat(token, roomId, user.id, user.name);
      const messages = await staffApi.getLiveChatMessages(token, roomId);
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
      const roomId = activeChatRoom.id || activeChatRoom.room_id || activeChatRoom._id;
      if (!roomId) {
        console.error('No room ID found');
        return;
      }
      await staffApi.sendLiveChatMessage(token, roomId, newMessage);
      setNewMessage('');
      const messages = await staffApi.getLiveChatMessages(token, roomId);
      setChatMessages(messages);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleEndChat = async () => {
    if (!token || !activeChatRoom) return;
    try {
      const roomId = activeChatRoom.id || activeChatRoom.room_id || activeChatRoom._id;
      if (!roomId) {
        console.error('No room ID found');
        return;
      }
      await staffApi.endLiveChat(token, roomId);
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

  const handleReleaseCallback = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.releaseCallback(token, id);
      loadCallbacks();
    } catch (err) {
      console.error('Failed to release callback:', err);
    }
  };
  
  // Panic alert actions
  const handleAcknowledgePanic = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.acknowledgePanicAlert(token, id);
      loadAlerts();
    } catch (err) {
      console.error('Failed to acknowledge panic alert:', err);
    }
  };
  
  const handleResolvePanic = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.resolvePanicAlert(token, id);
      loadAlerts();
    } catch (err) {
      console.error('Failed to resolve panic alert:', err);
    }
  };
  
  const handleTriggerPanic = async () => {
    if (!token) return;
    if (!confirm('Are you sure you want to trigger a panic alert? This will notify all supervisors and counsellors immediately.')) return;
    try {
      await staffApi.triggerPanic(token);
      loadAlerts();
      alert('Panic alert sent! Help is on the way.');
    } catch (err) {
      console.error('Failed to trigger panic:', err);
      alert('Failed to send panic alert. Please try again or call for help directly.');
    }
  };
  
  const handleAddSessionNote = async () => {
    if (!token || !selectedCase?._id || !newSessionNote.trim()) return;
    try {
      await staffApi.addCaseSession(token, selectedCase._id, {
        notes: newSessionNote,
        session_type: 'general',
        staff_id: user?.id,
        staff_name: user?.name
      });
      setNewSessionNote('');
      setShowAddSessionModal(false);
      // Reload sessions
      const sessions = await staffApi.getCaseSessions(token, selectedCase._id);
      setCaseSessions(sessions);
    } catch (err) {
      console.error('Failed to add session note:', err);
      alert('Failed to add session note');
    }
  };
  
  // Filter cases
  const filteredCases = cases.filter(c => {
    if (caseStatusFilter && c.status !== caseStatusFilter) return false;
    if (caseRiskFilter && c.risk_level !== caseRiskFilter) return false;
    return true;
  });

  // Shift actions
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

  // Counts for badges
  const activeSafeguardingCount = safeguardingAlerts.filter(a => a.status === 'active').length;
  const activePanicCount = panicAlerts.filter(a => a.status === 'active').length;
  const activeAlertsCount = activeSafeguardingCount + activePanicCount;
  const waitingChatsCount = liveChatRooms.filter(r => r.status === 'waiting').length;
  const pendingCallbacksCount = callbacks.filter(c => c.status === 'pending').length;
  const activeCallbacksCount = callbacks.filter(c => c.status === 'taken').length;

  // Trigger panic alert (for peer supporters)
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

  // Submit AI feedback
  const submitAiFeedback = async () => {
    if (!token || !aiFeedbackData || !aiFeedbackRating) return;
    try {
      await fetch(`${API_URL}/api/ai-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: activeChatRoom?.room_id || 'staff_review',
          message_index: 0,
          ai_character: 'support_ai',
          rating: aiFeedbackRating === 'good' ? 5 : aiFeedbackRating === 'needs_improvement' ? 3 : 1,
          feedback_type: aiFeedbackRating,
          comment: aiFeedbackComment,
          user_message: aiFeedbackData.message,
          ai_response: aiFeedbackData.response,
        })
      });
      setShowAiFeedbackModal(false);
      setAiFeedbackData(null);
      setAiFeedbackRating(null);
      setAiFeedbackComment('');
      alert('Feedback submitted. Thank you!');
    } catch (err) {
      console.error('Failed to submit AI feedback:', err);
    }
  };

  // Load available counsellors for escalation
  const loadAvailableCounsellors = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/counsellors/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAvailableCounsellors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load counsellors:', err);
    }
  };

  // Create a new case
  const handleCreateCase = async () => {
    if (!token || !newCaseUserName) return;
    try {
      const res = await fetch(`${API_URL}/api/cases/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_name: newCaseUserName,
          user_id: newCaseUserId || undefined,
          initial_notes: newCaseNotes,
          risk_level: newCaseRiskLevel,
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to create case');
      }
      setShowCreateCaseModal(false);
      setNewCaseUserName('');
      setNewCaseUserId('');
      setNewCaseNotes('');
      setNewCaseRiskLevel('medium');
      loadCases();
      alert('Case created successfully');
    } catch (err: any) {
      console.error('Failed to create case:', err);
      alert(err.message || 'Failed to create case. Please try again.');
    }
  };

  // View case details
  const handleViewCase = async (caseItem: Case) => {
    if (!token) return;
    const caseId = caseItem._id || (caseItem as any).id;
    try {
      const res = await fetch(`${API_URL}/api/cases/${caseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch case details');
      const data = await res.json();
      setSelectedCase(data);
      setShowCaseModal(true);
    } catch (err) {
      console.error('Failed to load case details:', err);
      // Still show what we have
      setSelectedCase(caseItem);
      setShowCaseModal(true);
    }
  };

  // Open escalation modal
  const handleOpenEscalate = (caseId: string) => {
    setEscalateCaseId(caseId);
    setEscalateTo('');
    setEscalateReason('');
    setEscalateNotes('');
    loadAvailableCounsellors();
    setShowEscalateModal(true);
  };

  // Escalate case to counsellor/supervisor
  const handleEscalateCase = async () => {
    if (!token || !escalateCaseId || !escalateTo || !escalateReason) return;
    try {
      // Share case with the counsellor
      await fetch(`${API_URL}/api/cases/${escalateCaseId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          counsellor_id: escalateTo
        })
      });
      
      // Add escalation session note
      await fetch(`${API_URL}/api/cases/${escalateCaseId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          presenting_issue: `Case escalated. Reason: ${escalateReason}${escalateNotes ? '. Notes: ' + escalateNotes : ''}`,
          risk_level: 'high',
          outcome: 'escalate_to_counsellor',
          actions_taken: ['Escalated to counsellor/supervisor']
        })
      });

      setShowEscalateModal(false);
      setShowCaseModal(false);
      setEscalateCaseId(null);
      loadCases();
      alert('Case escalated successfully. The counsellor has been notified.');
    } catch (err) {
      console.error('Failed to escalate case:', err);
      alert('Failed to escalate case. Please try again.');
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
            <Shield className="w-16 h-16 text-secondary mx-auto mb-4" />
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
                  // Switch to live chat tab
                  setActiveTab('livechat');
                  // Reload live chats to get the new room
                  setTimeout(() => loadLiveChats(), 1000);
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

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-secondary" />
                Alerts
              </h1>
              <div className="flex gap-2">
                {/* Panic Trigger Button for Peers */}
                {user?.role === 'peer' && (
                  <button 
                    onClick={handleTriggerPanic}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 animate-pulse"
                    data-testid="panic-trigger-btn"
                  >
                    <AlertOctagon className="w-5 h-5" />
                    PANIC
                  </button>
                )}
                <button onClick={loadAlerts} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
            
            {/* Alert Sub-tabs */}
            <div className="flex gap-4 mb-6 border-b border-border">
              <button
                onClick={() => setAlertsSubTab('safeguarding')}
                className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                  alertsSubTab === 'safeguarding' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4" />
                Safeguarding
                {activeSafeguardingCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {activeSafeguardingCount}
                  </span>
                )}
              </button>
              {/* Panic alerts visible only to counsellors/supervisors/admins */}
              {(user?.role === 'counsellor' || user?.is_supervisor || user?.role === 'admin') && (
                <button
                  onClick={() => setAlertsSubTab('panic')}
                  className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                    alertsSubTab === 'panic' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <AlertOctagon className="w-4 h-4" />
                  Panic Alerts
                  {activePanicCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse">
                      {activePanicCount}
                    </span>
                  )}
                </button>
              )}
            </div>
            
            {/* Safeguarding Alerts Sub-tab */}
            {alertsSubTab === 'safeguarding' && (
              <div className="space-y-4">
                {safeguardingAlerts.map((alert) => (
                  <div key={alert.id || alert._id} className={`bg-card border rounded-xl p-6 ${alert.status === 'active' ? 'border-red-500' : 'border-border'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded text-xs text-white ${getRiskBadgeColor(alert.risk_level || 'medium')}`}>
                            {(alert.risk_level || 'UNKNOWN').toUpperCase()} RISK
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            alert.status === 'active' ? 'bg-red-500/20 text-red-400' :
                            alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {(alert.status || 'unknown').toUpperCase()}
                          </span>
                          {/* Contact captured indicator */}
                          {alert.contact_captured ? (
                            <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Contact
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                              <Info className="w-3 h-3" /> No Contact
                            </span>
                          )}
                        </div>
                        {alert.user_name && <p className="font-semibold">{alert.user_name}</p>}
                        {alert.character_name && <p className="text-sm text-gray-400">Talking to: {alert.character_name}</p>}
                        {alert.session_id && <p className="text-xs text-gray-500 font-mono">Session: {alert.session_id}</p>}
                      </div>
                      <span className="text-sm text-gray-400">{formatTimeAgo(alert.created_at)}</span>
                    </div>

                    <div className="bg-primary-dark/50 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-gray-400 mb-1">Trigger Message:</p>
                      <p>{alert.triggering_message || alert.trigger_message}</p>
                    </div>

                    {((alert.triggered_indicators?.length ?? 0) > 0 || (alert.trigger_phrases?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(alert.triggered_indicators || alert.trigger_phrases || []).map((phrase: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                            {phrase}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Tracking info section */}
                    {(alert.ip_address || alert.location) && (
                      <div className="bg-primary-dark/30 rounded-lg p-3 mb-4 text-xs">
                        <p className="text-gray-400 font-semibold mb-2 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Tracking Info
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-gray-500">
                          {alert.ip_address && <p>IP: {alert.ip_address}</p>}
                          {alert.location && <p>Location: {alert.location}</p>}
                          {alert.user_agent && <p className="col-span-2 truncate">Browser: {alert.user_agent}</p>}
                        </div>
                      </div>
                    )}

                    {alert.status !== 'resolved' && (
                      <div className="flex gap-3">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => handleAcknowledgeSafeguarding(alert.id)}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => handleResolveSafeguarding(alert.id)}
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
            )}
            
            {/* Panic Alerts Sub-tab */}
            {alertsSubTab === 'panic' && (user?.role === 'counsellor' || user?.is_supervisor || user?.role === 'admin') && (
              <div className="space-y-4">
                {panicAlerts.map((alert) => (
                  <div key={alert.id || alert._id} className={`bg-card border rounded-xl p-6 ${alert.status === 'active' ? 'border-red-500 bg-red-500/5' : 'border-border'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2 py-1 rounded text-xs bg-red-600 text-white flex items-center gap-1">
                            <AlertOctagon className="w-3 h-3" /> PANIC ALERT
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            alert.status === 'active' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                            alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {alert.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="font-semibold text-lg">{alert.triggered_by_name || 'Staff Member'}</p>
                        <p className="text-sm text-gray-400">{alert.triggered_by_role || 'Peer Supporter'}</p>
                      </div>
                      <span className="text-sm text-gray-400">{formatTimeAgo(alert.created_at)}</span>
                    </div>

                    {alert.message && (
                      <div className="bg-red-500/10 rounded-lg p-4 mb-4 border border-red-500/30">
                        <p>{alert.message}</p>
                      </div>
                    )}
                    
                    {/* Contact info */}
                    {alert.phone && (
                      <div className="flex items-center gap-2 mb-4">
                        <Phone className="w-4 h-4 text-green-400" />
                        <span className="font-mono">{alert.phone}</span>
                        <button 
                          className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                          onClick={() => alert.phone && twilioPhone.makeCall(alert.phone)}
                        >
                          Call Now
                        </button>
                      </div>
                    )}

                    {alert.status !== 'resolved' && (
                      <div className="flex gap-3">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => handleAcknowledgePanic(alert.id || alert._id)}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => handleResolvePanic(alert.id || alert._id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {panicAlerts.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <AlertOctagon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No panic alerts</p>
                  </div>
                )}
              </div>
            )}
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
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Briefcase className="w-6 h-6 text-secondary" />
                My Cases
              </h1>
              <div className="flex gap-2">
                <button
                  data-testid="create-case-btn"
                  onClick={() => setShowCreateCaseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-black rounded-lg hover:bg-secondary/90"
                >
                  <Plus className="w-4 h-4" />
                  Create Case
                </button>
                <select
                  value={caseStatusFilter}
                  onChange={(e) => setCaseStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-card border border-border rounded-lg text-white"
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="active">Active</option>
                  <option value="in_progress">In Progress</option>
                  <option value="escalated">Escalated</option>
                  <option value="closed">Closed</option>
                </select>
                <select
                  value={caseRiskFilter}
                  onChange={(e) => setCaseRiskFilter(e.target.value)}
                  className="px-3 py-2 bg-card border border-border rounded-lg text-white"
                >
                  <option value="">All Risk</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <button onClick={loadCases} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-primary-dark/50">
                  <tr className="text-left text-sm text-gray-400">
                    <th className="px-6 py-4">Case #</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Risk Level</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Sessions</th>
                    <th className="px-6 py-4">Assigned To</th>
                    <th className="px-6 py-4">Updated</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((c) => (
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
                      <td className="px-6 py-4">
                        <span className="text-sm">{c.session_count || 0}/6</span>
                      </td>
                      <td className="px-6 py-4">{c.assigned_to_name || '-'}</td>
                      <td className="px-6 py-4 text-gray-400">{formatTimeAgo(c.updated_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button 
                            data-testid={`view-case-${c._id}`}
                            onClick={() => handleViewCase(c)}
                            className="text-secondary hover:underline text-sm flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" /> View
                          </button>
                          {(c.status === 'open' || c.status === 'active' || c.status === 'in_progress') && (
                            <button 
                              data-testid={`escalate-case-${c._id}`}
                              onClick={() => handleOpenEscalate(c._id)}
                              className="text-amber-400 hover:underline text-sm flex items-center gap-1"
                            >
                              <ArrowUp className="w-4 h-4" /> Escalate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCases.length === 0 && (
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
                <div key={callback._id} className={`bg-card border rounded-xl p-6 ${
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
                        {callback.phone && twilioPhone.isReady && callback.status === 'taken' && callback.taken_by === user?.id && (
                          <button 
                            onClick={() => twilioPhone.makeCall(callback.phone)}
                            className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 flex items-center gap-1"
                          >
                            <PhoneCall className="w-3 h-3" />
                            Call Now
                          </button>
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
                          onClick={() => handleTakeCallback(callback._id)}
                          className="px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
                        >
                          Take
                        </button>
                      )}
                      {callback.status === 'taken' && callback.taken_by === user?.id && (
                        <>
                          <button
                            onClick={() => handleReleaseCallback(callback._id)}
                            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                          >
                            Release
                          </button>
                          <button
                            onClick={() => handleCompleteCallback(callback._id)}
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
                {/* Call User Button */}
                <button
                  data-testid="call-from-chat-btn"
                  onClick={() => {
                    if (activeChatRoom.user_id) {
                      webrtcPhone.makeCall(activeChatRoom.user_id);
                    }
                  }}
                  disabled={!activeChatRoom.user_id || webrtcPhone.isInCall}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Phone className="w-4 h-4" />
                  Call User
                </button>
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
                    msg.sender === 'staff' 
                      ? 'bg-secondary/20 ml-auto' 
                      : msg.sender === 'ai' || msg.is_ai_response
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-primary-light/30'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs text-gray-400 mb-1">
                      {msg.sender === 'staff' ? 'You' : msg.sender === 'ai' || msg.is_ai_response ? 'AI Assistant' : 'User'}
                    </p>
                    {/* AI Feedback button for AI responses */}
                    {(msg.sender === 'ai' || msg.is_ai_response) && (
                      <button
                        data-testid={`ai-feedback-btn-${i}`}
                        onClick={() => {
                          // Find the user message this AI was responding to
                          const userMsg = chatMessages.slice(0, i).reverse().find(m => m.sender === 'user' || (!m.is_ai_response && m.sender !== 'staff'));
                          setAiFeedbackData({
                            messageId: msg.id || msg._id || `msg_${i}`,
                            message: userMsg?.text || 'Unknown user message',
                            response: msg.text
                          });
                          setShowAiFeedbackModal(true);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Feedback
                      </button>
                    )}
                  </div>
                  <p>{msg.text}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
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

      {/* Case Detail Modal */}
      {showCaseModal && selectedCase && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowCaseModal(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-card">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-secondary" />
                Case {selectedCase.case_number}
              </h2>
              <button onClick={() => setShowCaseModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6">
              {/* Case Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-400">User</p>
                  <p className="font-semibold">{selectedCase.user_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Risk Level</p>
                  <span className={`px-2 py-1 rounded text-xs text-white ${getRiskBadgeColor(selectedCase.risk_level)}`}>
                    {selectedCase.risk_level?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <span className={`px-2 py-1 rounded text-xs ${
                    selectedCase.status === 'open' ? 'bg-blue-500/20 text-blue-400' :
                    selectedCase.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                    selectedCase.status === 'escalated' ? 'bg-red-500/20 text-red-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {selectedCase.status?.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Assigned To</p>
                  <p>{selectedCase.assigned_to_name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Sessions</p>
                  <p>{selectedCase.session_count || 0} / 6</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Created</p>
                  <p>{formatTimeAgo(selectedCase.created_at)}</p>
                </div>
              </div>

              {/* Description */}
              {selectedCase.description && (
                <div className="mb-6">
                  <p className="text-sm text-gray-400 mb-2">Description</p>
                  <p className="bg-primary-dark/50 rounded-lg p-4">{selectedCase.description}</p>
                </div>
              )}

              {/* Safety Plan */}
              {selectedCase.safety_plan && (
                <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Safety Plan
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{selectedCase.safety_plan}</p>
                </div>
              )}

              {/* Sessions */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Session Notes ({caseSessions.length})</h3>
                  <button
                    onClick={() => setShowAddSessionModal(true)}
                    className="flex items-center gap-2 px-3 py-1 bg-secondary text-primary-dark rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Session
                  </button>
                </div>
                <div className="space-y-3">
                  {caseSessions.map((session, i) => (
                    <div key={session._id || i} className="bg-primary-dark/30 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm text-secondary font-medium">{session.session_type || 'General'}</span>
                        <span className="text-xs text-gray-500">{formatTimeAgo(session.created_at)}</span>
                      </div>
                      <p className="text-sm">{session.notes}</p>
                      {session.staff_name && (
                        <p className="text-xs text-gray-500 mt-2">By: {session.staff_name}</p>
                      )}
                    </div>
                  ))}
                  {caseSessions.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No session notes yet</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {user?.role === 'peer' && selectedCase.status !== 'escalated' && (
                  <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                    Escalate to Counsellor
                  </button>
                )}
                <button 
                  onClick={() => setShowCaseModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Session Modal */}
      {showAddSessionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setShowAddSessionModal(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-secondary" />
                Add Session Note
              </h2>
              <button onClick={() => setShowAddSessionModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Session Notes</label>
                <textarea
                  value={newSessionNote}
                  onChange={(e) => setNewSessionNote(e.target.value)}
                  placeholder="Write session notes..."
                  rows={6}
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none resize-none"
                />
              </div>
              <button
                onClick={handleAddSessionNote}
                disabled={!newSessionNote.trim()}
                className="w-full py-3 bg-secondary text-primary-dark font-semibold rounded-lg disabled:opacity-50"
              >
                Save Session Note
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

      {/* AI Feedback Modal */}
      {showAiFeedbackModal && aiFeedbackData && (
        <div data-testid="ai-feedback-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-card rounded-2xl p-6 max-w-2xl w-full mx-4 my-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-secondary" />
              AI Response Feedback
            </h2>
            
            <div className="space-y-4 mb-6">
              <div className="bg-primary-dark rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">User message:</p>
                <p className="text-sm">{aiFeedbackData.message}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-xs text-blue-400 mb-1">AI response:</p>
                <p className="text-sm">{aiFeedbackData.response}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-3">Rate this response:</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'good', label: 'Good Response', icon: '✓', color: 'border-green-500 bg-green-500/10 text-green-400' },
                  { value: 'needs_improvement', label: 'Needs Improvement', icon: '!', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-400' },
                  { value: 'inappropriate', label: 'Inappropriate', icon: '✗', color: 'border-red-500 bg-red-500/10 text-red-400' },
                  { value: 'missed_risk', label: 'Missed Risk', icon: '⚠', color: 'border-orange-500 bg-orange-500/10 text-orange-400' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setAiFeedbackRating(option.value as any)}
                    className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${
                      aiFeedbackRating === option.value ? option.color : 'border-border hover:border-gray-600'
                    }`}
                  >
                    <span>{option.icon}</span>
                    <span className="text-sm">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Additional comments:</label>
              <textarea
                value={aiFeedbackComment}
                onChange={(e) => setAiFeedbackComment(e.target.value)}
                className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                placeholder="What could be improved? What was missed?"
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowAiFeedbackModal(false);
                  setAiFeedbackData(null);
                  setAiFeedbackRating(null);
                  setAiFeedbackComment('');
                }}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                onClick={submitAiFeedback}
                disabled={!aiFeedbackRating}
                className="flex-1 px-4 py-3 rounded-lg bg-secondary text-black hover:bg-secondary/90 transition disabled:opacity-50"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateCaseModal && (
        <div data-testid="create-case-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-secondary" />
              Create New Case
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">User Name *</label>
                <input
                  data-testid="case-user-name"
                  type="text"
                  value={newCaseUserName}
                  onChange={(e) => setNewCaseUserName(e.target.value)}
                  className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                  placeholder="Enter the user's name"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">User ID (optional)</label>
                <input
                  data-testid="case-user-id"
                  type="text"
                  value={newCaseUserId}
                  onChange={(e) => setNewCaseUserId(e.target.value)}
                  className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                  placeholder="If known"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Risk Level</label>
                <select
                  data-testid="case-risk-level"
                  value={newCaseRiskLevel}
                  onChange={(e) => setNewCaseRiskLevel(e.target.value)}
                  className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Initial Notes</label>
                <textarea
                  data-testid="case-notes"
                  value={newCaseNotes}
                  onChange={(e) => setNewCaseNotes(e.target.value)}
                  className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                  placeholder="Describe the presenting issue..."
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowCreateCaseModal(false);
                  setNewCaseUserName('');
                  setNewCaseUserId('');
                  setNewCaseNotes('');
                  setNewCaseRiskLevel('medium');
                }}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                data-testid="submit-create-case"
                onClick={handleCreateCase}
                disabled={!newCaseUserName}
                className="flex-1 px-4 py-3 rounded-lg bg-secondary text-black hover:bg-secondary/90 transition disabled:opacity-50"
              >
                Create Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Case Modal */}
      {showEscalateModal && (
        <div data-testid="escalate-case-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-amber-400" />
              Escalate Case
            </h2>
            
            <p className="text-gray-400 mb-4">
              Select a counsellor or supervisor to escalate this case to. They will receive access and a notification.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Escalate To *</label>
                <select
                  data-testid="escalate-to"
                  value={escalateTo}
                  onChange={(e) => setEscalateTo(e.target.value)}
                  className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                >
                  <option value="">Select counsellor/supervisor...</option>
                  {availableCounsellors.map((c) => (
                    <option key={c.id || c.user_id} value={c.user_id || c.id}>
                      {c.name} {c.status === 'available' ? '(Available)' : ''}
                    </option>
                  ))}
                  {/* Also include team members who are supervisors/counsellors */}
                  {teamMembers.filter(m => m.role === 'supervisor' || m.role === 'counsellor').map((m) => (
                    <option key={m.id || m.user_id} value={m.user_id || m.id}>
                      {m.name} ({m.role}) {m.status === 'available' ? '(Available)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reason for Escalation *</label>
                <select
                  data-testid="escalate-reason"
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                >
                  <option value="">Select reason...</option>
                  <option value="high_risk">High Risk - Needs Immediate Attention</option>
                  <option value="complex_case">Complex Case - Beyond My Scope</option>
                  <option value="clinical_input">Needs Clinical Input</option>
                  <option value="safeguarding">Safeguarding Concern</option>
                  <option value="supervision_guidance">Need Supervision Guidance</option>
                  <option value="handover">Handover to Another Counsellor</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Additional Notes</label>
                <textarea
                  data-testid="escalate-notes"
                  value={escalateNotes}
                  onChange={(e) => setEscalateNotes(e.target.value)}
                  className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                  placeholder="Any additional information..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowEscalateModal(false);
                  setEscalateCaseId(null);
                  setEscalateTo('');
                  setEscalateReason('');
                  setEscalateNotes('');
                }}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                data-testid="submit-escalate"
                onClick={handleEscalateCase}
                disabled={!escalateTo || !escalateReason}
                className="flex-1 px-4 py-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50"
              >
                Escalate Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Detail Modal */}
      {showCaseModal && selectedCase && (
        <div data-testid="case-detail-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-card rounded-2xl p-6 max-w-2xl w-full mx-4 my-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-secondary" />
                  Case: {selectedCase.user_name || 'Unknown'}
                </h2>
                <p className="text-sm text-gray-400">Case #{selectedCase.case_number || selectedCase._id}</p>
              </div>
              <button
                onClick={() => { setShowCaseModal(false); setSelectedCase(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-primary-dark rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className={`font-semibold ${
                  selectedCase.status === 'active' ? 'text-blue-400' :
                  selectedCase.status === 'escalated' ? 'text-amber-400' :
                  selectedCase.status === 'closed' ? 'text-green-400' :
                  'text-gray-400'
                }`}>
                  {selectedCase.status?.replace('_', ' ') || 'Active'}
                </p>
              </div>
              <div className="bg-primary-dark rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Risk Level</p>
                <p className={`font-semibold ${
                  selectedCase.risk_level === 'critical' ? 'text-red-500' :
                  selectedCase.risk_level === 'high' ? 'text-amber-400' :
                  selectedCase.risk_level === 'medium' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {selectedCase.risk_level || 'Medium'}
                </p>
              </div>
              <div className="bg-primary-dark rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Sessions</p>
                <p className="font-semibold">{selectedCase.session_count || 0} / 6</p>
              </div>
              <div className="bg-primary-dark rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Assigned To</p>
                <p className="font-semibold">{selectedCase.assigned_to_name || 'You'}</p>
              </div>
            </div>

            {/* Sessions/Notes */}
            {(selectedCase as any).sessions && (selectedCase as any).sessions.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Session Notes</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {(selectedCase as any).sessions.map((session: any, i: number) => (
                    <div key={i} className="bg-primary-dark rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-gray-500">
                          {new Date(session.date || session.created_at).toLocaleDateString()}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          session.risk_level === 'high' || session.risk_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {session.risk_level}
                        </span>
                      </div>
                      <p className="text-sm">{session.presenting_issue || session.notes}</p>
                      {session.outcome && (
                        <p className="text-xs text-gray-500 mt-2">Outcome: {session.outcome.replace('_', ' ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => { setShowCaseModal(false); setSelectedCase(null); }}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Close
              </button>
              {(selectedCase.status === 'active' || selectedCase.status === 'open' || selectedCase.status === 'in_progress') && (
                <button
                  onClick={() => {
                    setShowCaseModal(false);
                    handleOpenEscalate(selectedCase._id);
                  }}
                  className="flex-1 px-4 py-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition flex items-center justify-center gap-2"
                >
                  <ArrowUp className="w-4 h-4" />
                  Escalate
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
