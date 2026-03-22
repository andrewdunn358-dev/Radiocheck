'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import useWebRTCPhone from '@/hooks/useWebRTCPhone';
import useTwilioPhone from '@/hooks/useTwilioPhone';
import { useMessages } from '@/hooks/useMessages';

// Tab components
import AlertsTab, { useAlertCounts } from '@/components/staff/tabs/AlertsTab';
import LiveChatTab, { useLiveChatCounts } from '@/components/staff/tabs/LiveChatTab';
import CasesTab, { useCaseCounts } from '@/components/staff/tabs/CasesTab';
import CallbacksTab, { useCallbackCounts } from '@/components/staff/tabs/CallbacksTab';
import RotaTab from '@/components/staff/tabs/RotaTab';
import TeamTab from '@/components/staff/tabs/TeamTab';
import NotesTab from '@/components/staff/tabs/NotesTab';
import SupervisionTab from '@/components/staff/tabs/SupervisionTab';
import DashboardTab from '@/components/staff/tabs/DashboardTab';

// Layout components
import LoginScreen from '@/components/staff/LoginScreen';
import Sidebar from '@/components/staff/Sidebar';
import ConnectionStatusBar from '@/components/staff/ConnectionStatusBar';

// Modal components
import IncomingCallModal from '@/components/staff/modals/IncomingCallModal';
import ActiveCallPanel from '@/components/staff/modals/ActiveCallPanel';
import ChatRequestBanner from '@/components/staff/modals/ChatRequestBanner';
import CallRequestBanner from '@/components/staff/modals/CallRequestBanner';
import SessionTimeoutModal from '@/components/staff/modals/SessionTimeoutModal';
import PanicModal from '@/components/staff/modals/PanicModal';
import MessagesModal from '@/components/staff/modals/MessagesModal';

type TabType = 'dashboard' | 'alerts' | 'livechat' | 'cases' | 'callbacks' | 'rota' | 'team' | 'notes' | 'supervision';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

export default function StaffPortalPage() {
  const { user, profile, token, isLoading, login, logout, updateStatus } = useStaffAuth();

  // Badge counts from hooks
  const { safeguardingAlerts, activeAlertsCount } = useAlertCounts(token);
  const { waitingChatsCount } = useLiveChatCounts(token);
  const { openCasesCount } = useCaseCounts(token);
  const { pendingCallbacksCount } = useCallbackCounts(token);

  // Messages hook
  const {
    messages, unreadMessageCount, newMessageTo, newMessageContent, teamMembers,
    setNewMessageTo, setNewMessageContent, handleSendInternalMessage, handleMarkMessageRead
  } = useMessages(token);

  // App state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  
  // Panic state
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicReason, setPanicReason] = useState('');
  const [triggeringPanic, setTriggeringPanic] = useState(false);
  
  // Session timeout
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
  const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

  // Phone status
  const [phoneStatus, setPhoneStatus] = useState<'connecting' | 'ready' | 'error' | 'unavailable'>('connecting');
  const [chatConnected, setChatConnected] = useState(false);

  // Sound refs
  const audioContextRef = useRef<AudioContext | null>(null);

  // WebRTC Phone
  const webrtcUserId = profile ? ((profile as any)?.callable_user_id || profile?.user_id || profile?.id) : undefined;
  const webrtcPhone = useWebRTCPhone({
    serverUrl: API_URL,
    userId: webrtcUserId,
    userType: user?.role === 'counsellor' ? 'counsellor' : 'peer',
    userName: profile?.name || user?.name,
    enabled: !!token && !!user && !!profile && !!webrtcUserId,
  });

  // Twilio Phone
  const twilioPhone = useTwilioPhone({
    staffId: profile?.id || user?.id,
    staffName: user?.name,
    enabled: !!token && !!user && !!profile,
  });

  // Sync phone status
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

  // Session timeout logic
  useEffect(() => {
    if (!token) return;
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (showTimeoutWarning) setShowTimeoutWarning(false);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));
    const timeoutCheck = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;
      const sessionTime = now - sessionStartRef.current;
      if (sessionTime > ABSOLUTE_TIMEOUT_MS) { logout(); return; }
      if (inactiveTime > SESSION_TIMEOUT_MS - 5 * 60 * 1000 && inactiveTime < SESSION_TIMEOUT_MS) {
        setShowTimeoutWarning(true);
      }
      if (inactiveTime > SESSION_TIMEOUT_MS) { logout(); }
    }, 60000);
    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(timeoutCheck);
    };
  }, [token, logout, showTimeoutWarning]);

  // Sound preferences
  useEffect(() => {
    const saved = localStorage.getItem('staffPortalSoundEnabled');
    if (saved !== null) setSoundEnabled(saved === 'true');
  }, []);
  useEffect(() => {
    localStorage.setItem('staffPortalSoundEnabled', String(soundEnabled));
  }, [soundEnabled]);

  // Sound function
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
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

  // Handlers
  const handleStatusChange = async (status: string) => {
    try { await updateStatus(status); } catch (err) { console.error('Failed to update status:', err); }
  };

  const triggerPanicAlert = async () => {
    if (!token || triggeringPanic) return;
    setTriggeringPanic(true);
    try {
      await fetch(`${API_URL}/api/safeguarding/panic-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          staff_id: user?.id, staff_name: user?.name || user?.email,
          reason: panicReason || 'Staff member triggered panic button',
          location: 'staff_portal', risk_level: 'critical'
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="min-h-screen flex bg-primary-dark">
      <audio id="remote-audio" autoPlay playsInline />
      
      {/* WebRTC Modals */}
      {webrtcPhone.hasIncomingCall && webrtcPhone.callerInfo && (
        <IncomingCallModal callerInfo={webrtcPhone.callerInfo} onAnswer={webrtcPhone.answerCall} onReject={webrtcPhone.rejectCall} />
      )}
      {webrtcPhone.isInCall && (
        <ActiveCallPanel formattedDuration={webrtcPhone.formattedDuration} isMuted={webrtcPhone.isMuted} onToggleMute={webrtcPhone.toggleMute} onEndCall={webrtcPhone.endCall} />
      )}
      {webrtcPhone.hasIncomingChatRequest && webrtcPhone.pendingRequest && (
        <ChatRequestBanner pendingRequest={webrtcPhone.pendingRequest} onDismiss={webrtcPhone.dismissRequest} onAccept={() => { webrtcPhone.acceptChatRequest(); setActiveTab('livechat'); }} />
      )}
      {webrtcPhone.hasIncomingCallRequest && webrtcPhone.pendingRequest && (
        <CallRequestBanner pendingRequest={webrtcPhone.pendingRequest} onDismiss={webrtcPhone.dismissRequest} onAccept={webrtcPhone.acceptCallRequest} />
      )}

      {/* Sidebar */}
      <Sidebar
        user={user}
        profile={profile}
        activeTab={activeTab}
        soundEnabled={soundEnabled}
        unreadMessageCount={unreadMessageCount}
        activeAlertsCount={activeAlertsCount}
        waitingChatsCount={waitingChatsCount}
        pendingCallbacksCount={pendingCallbacksCount}
        onTabChange={(tab) => setActiveTab(tab as TabType)}
        onStatusChange={handleStatusChange}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onShowMessages={() => setShowMessagesModal(true)}
        onLogout={logout}
      />

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <ConnectionStatusBar phoneStatus={phoneStatus} chatConnected={chatConnected} profile={profile} user={user} twilioPhone={twilioPhone} />

        {activeTab === 'dashboard' && (
          <DashboardTab user={user} activeAlertsCount={activeAlertsCount} waitingChatsCount={waitingChatsCount} openCasesCount={openCasesCount} pendingCallbacksCount={pendingCallbacksCount} safeguardingAlerts={safeguardingAlerts} onShowPanicModal={() => setShowPanicModal(true)} onNavigateToAlerts={() => setActiveTab('alerts')} />
        )}
        {activeTab === 'alerts' && <AlertsTab token={token!} user={user} webrtcUserId={webrtcUserId} twilioPhone={twilioPhone} soundEnabled={soundEnabled} onPlayAlertSound={playAlertSound} />}
        {activeTab === 'livechat' && <LiveChatTab token={token!} user={user} webrtcUserId={webrtcUserId} webrtcPhone={webrtcPhone} onPlayAlertSound={playAlertSound} />}
        {activeTab === 'cases' && <CasesTab token={token!} user={user} />}
        {activeTab === 'callbacks' && <CallbacksTab token={token!} user={user} twilioPhone={twilioPhone} />}
        {activeTab === 'rota' && <RotaTab token={token!} user={user} />}
        {activeTab === 'team' && <TeamTab token={token!} user={user} webrtcPhone={webrtcPhone} />}
        {activeTab === 'notes' && <NotesTab token={token!} user={user} />}
        {activeTab === 'supervision' && user?.is_supervisor && <SupervisionTab token={token!} user={user} />}
      </main>

      {/* Modals */}
      {showTimeoutWarning && <SessionTimeoutModal onStayLoggedIn={() => { lastActivityRef.current = Date.now(); setShowTimeoutWarning(false); }} />}
      {showPanicModal && <PanicModal panicReason={panicReason} onPanicReasonChange={setPanicReason} onCancel={() => { setShowPanicModal(false); setPanicReason(''); }} onConfirm={triggerPanicAlert} isTriggering={triggeringPanic} />}
      {showMessagesModal && (
        <MessagesModal messages={messages} teamMembers={teamMembers} userId={user?.id} unreadCount={unreadMessageCount} newMessageTo={newMessageTo} newMessageContent={newMessageContent} onNewMessageToChange={setNewMessageTo} onNewMessageContentChange={setNewMessageContent} onSendMessage={handleSendInternalMessage} onMarkRead={handleMarkMessageRead} onClose={() => setShowMessagesModal(false)} />
      )}
    </div>
  );
}
