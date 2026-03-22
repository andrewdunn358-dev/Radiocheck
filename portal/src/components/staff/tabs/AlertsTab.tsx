'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle, Shield, AlertOctagon, RefreshCw, CheckCircle, Info,
  Globe, MessageSquare, Phone, PhoneCall, PhoneOff, Mic, MicOff
} from 'lucide-react';
import { staffApi, SafeguardingAlert, PanicAlert } from '@/lib/api';

interface AlertsTabProps {
  token: string;
  user: any;
  webrtcUserId?: string;
  twilioPhone: any;
  soundEnabled: boolean;
  onPlayAlertSound: () => void;
}

export default function AlertsTab({
  token,
  user,
  webrtcUserId,
  twilioPhone,
  soundEnabled,
  onPlayAlertSound,
}: AlertsTabProps) {
  // Sub-tab state
  const [alertsSubTab, setAlertsSubTab] = useState<'safeguarding' | 'panic'>('safeguarding');
  
  // Alert data state
  const [safeguardingAlerts, setSafeguardingAlerts] = useState<SafeguardingAlert[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<PanicAlert[]>([]);
  
  // Sound alert tracking refs
  const prevSafeguardingCountRef = useRef<number>(0);
  const prevPanicCountRef = useRef<number>(0);

  // Load alerts function
  const loadAlerts = useCallback(async () => {
    if (!token) {
      console.log('[AlertsTab] loadAlerts: No token, skipping');
      return;
    }
    console.log('[AlertsTab] loadAlerts: Loading safeguarding and panic alerts...');
    try {
      const [safeguarding, panic] = await Promise.all([
        staffApi.getSafeguardingAlerts(token),
        staffApi.getPanicAlerts(token),
      ]);
      console.log('[AlertsTab] loadAlerts: Received safeguarding:', safeguarding?.length || 0, 'alerts');
      console.log('[AlertsTab] loadAlerts: Received panic:', panic?.length || 0, 'alerts');
      setSafeguardingAlerts(safeguarding || []);
      setPanicAlerts(panic || []);
    } catch (err) {
      console.error('[AlertsTab] loadAlerts: Failed to load alerts:', err);
    }
  }, [token]);

  // Initial load and polling - CRITICAL: Real-time polling for safety alerts
  useEffect(() => {
    if (!token) return;
    
    // Initial load
    loadAlerts();
    
    // Poll for alerts every 30 seconds
    const alertInterval = setInterval(loadAlerts, 30000);
    
    return () => {
      clearInterval(alertInterval);
    };
  }, [token, loadAlerts]);

  // Check for new alerts and play sound - CRITICAL: Real-time sound notifications
  useEffect(() => {
    const activeAlertCount = safeguardingAlerts.filter(a => a.status === 'active').length;
    const activePanicCount = panicAlerts.filter(a => a.status === 'active').length;
    
    // Play sound if new alerts appeared
    if (activeAlertCount > prevSafeguardingCountRef.current ||
        activePanicCount > prevPanicCountRef.current) {
      onPlayAlertSound();
    }
    
    prevSafeguardingCountRef.current = activeAlertCount;
    prevPanicCountRef.current = activePanicCount;
  }, [safeguardingAlerts, panicAlerts, onPlayAlertSound]);

  // Handler functions
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

  // Counts for badges
  const activeSafeguardingCount = safeguardingAlerts.filter(a => a.status === 'active').length;
  const activePanicCount = panicAlerts.filter(a => a.status === 'active').length;

  return (
    <div data-testid="alerts-tab">
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
              
              {/* Tracking info section - matching backend field names */}
              {(alert.client_ip || alert.geo_city || alert.geo_country) && (
                <div className="bg-primary-dark/30 rounded-lg p-3 mb-4 text-xs">
                  <p className="text-gray-400 font-semibold mb-2 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Tracking Info
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-gray-500">
                    {alert.client_ip && <p>IP: {alert.client_ip}</p>}
                    {(alert.geo_city || alert.geo_region || alert.geo_country) && (
                      <p>Location: {[alert.geo_city, alert.geo_region, alert.geo_country].filter(Boolean).join(', ')}</p>
                    )}
                    {alert.geo_isp && <p>ISP: {alert.geo_isp}</p>}
                    {alert.geo_timezone && <p>Timezone: {alert.geo_timezone}</p>}
                    {alert.user_agent && <p className="col-span-2 truncate">Browser: {alert.user_agent}</p>}
                  </div>
                  {/* Map placeholder - could add Leaflet map if coords available */}
                  {alert.geo_lat && alert.geo_lon && (
                    <p className="mt-2 text-gray-600">📍 Coordinates: {alert.geo_lat.toFixed(4)}, {alert.geo_lon.toFixed(4)}</p>
                  )}
                </div>
              )}

              {/* Conversation History - matching legacy portal */}
              {alert.conversation_history && alert.conversation_history.length > 0 && (
                <details className="bg-primary-dark/30 rounded-lg p-3 mb-4">
                  <summary className="cursor-pointer text-sm text-gray-400 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> 
                    View Conversation History ({alert.conversation_history.length} messages)
                  </summary>
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {alert.conversation_history.slice(-6).map((msg, idx) => (
                      <div key={idx} className={`p-2 rounded text-xs ${msg.role === 'user' ? 'bg-blue-500/10 text-blue-300' : 'bg-gray-500/10 text-gray-300'}`}>
                        <span className="font-semibold">{msg.role === 'user' ? 'User' : (alert.character === 'tommy' ? 'Tommy' : 'Rachel')}:</span>{' '}
                        {msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content}
                      </div>
                    ))}
                  </div>
                </details>
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
                  {!twilioPhone.isInCall && (
                    <button 
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                      onClick={() => alert.phone && twilioPhone.makeCall(alert.phone)}
                    >
                      Call Now
                    </button>
                  )}
                  {twilioPhone.isInCall && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400 animate-pulse flex items-center gap-1">
                        <PhoneCall className="w-3 h-3" />
                        {twilioPhone.formattedDuration}
                      </span>
                      <button 
                        onClick={twilioPhone.toggleMute}
                        className={`px-2 py-1 rounded text-xs ${twilioPhone.isMuted ? 'bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
                      >
                        {twilioPhone.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      </button>
                      <button 
                        onClick={twilioPhone.hangUp}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 flex items-center gap-1"
                      >
                        <PhoneOff className="w-3 h-3" />
                        Hang Up
                      </button>
                    </div>
                  )}
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
  );
}

// Export alert counts for parent component to use in nav badges
export function useAlertCounts(token: string | null) {
  const [safeguardingAlerts, setSafeguardingAlerts] = useState<SafeguardingAlert[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<PanicAlert[]>([]);

  const loadAlerts = useCallback(async () => {
    if (!token) return;
    try {
      const [safeguarding, panic] = await Promise.all([
        staffApi.getSafeguardingAlerts(token),
        staffApi.getPanicAlerts(token),
      ]);
      setSafeguardingAlerts(safeguarding || []);
      setPanicAlerts(panic || []);
    } catch (err) {
      console.error('Failed to load alerts for counts:', err);
    }
  }, [token]);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const activeSafeguardingCount = safeguardingAlerts.filter(a => a.status === 'active').length;
  const activePanicCount = panicAlerts.filter(a => a.status === 'active').length;

  return {
    safeguardingAlerts,
    panicAlerts,
    activeSafeguardingCount,
    activePanicCount,
    activeAlertsCount: activeSafeguardingCount + activePanicCount,
    loadAlerts,
  };
}
