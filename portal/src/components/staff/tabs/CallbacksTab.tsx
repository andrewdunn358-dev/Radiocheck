'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Phone, RefreshCw, PhoneCall, PhoneOff, Mic, MicOff
} from 'lucide-react';
import { staffApi, Callback } from '@/lib/api';

interface CallbacksTabProps {
  token: string;
  user: any;
  twilioPhone: any;
}

type CallbacksSubTab = 'pending' | 'active' | 'completed';

export default function CallbacksTab({
  token,
  user,
  twilioPhone,
}: CallbacksTabProps) {
  // Sub-tab state
  const [callbacksSubTab, setCallbacksSubTab] = useState<CallbacksSubTab>('pending');
  
  // Data state
  const [callbacks, setCallbacks] = useState<Callback[]>([]);

  // Load callbacks
  const loadCallbacks = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getCallbacks(token);
      setCallbacks(data);
    } catch (err) {
      console.error('Failed to load callbacks:', err);
    }
  }, [token]);

  // Initial load and polling
  useEffect(() => {
    if (!token) return;
    loadCallbacks();
    const interval = setInterval(loadCallbacks, 30000);
    return () => clearInterval(interval);
  }, [token, loadCallbacks]);

  // Handler functions
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

  // Counts for badges
  const pendingCallbacksCount = callbacks.filter(c => c.status === 'pending').length;
  const activeCallbacksCount = callbacks.filter(c => c.status === 'taken').length;

  return (
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
  );
}

// Export a hook for other components to use callback counts
export function useCallbackCounts(token: string | null) {
  const [callbacks, setCallbacks] = useState<Callback[]>([]);

  useEffect(() => {
    if (!token) return;
    
    const loadCallbacks = async () => {
      try {
        const data = await staffApi.getCallbacks(token);
        setCallbacks(data);
      } catch (err) {
        console.error('Failed to load callbacks for counts:', err);
      }
    };

    loadCallbacks();
    const interval = setInterval(loadCallbacks, 30000);
    return () => clearInterval(interval);
  }, [token]);

  return {
    callbacks,
    pendingCallbacksCount: callbacks.filter(c => c.status === 'pending').length,
    activeCallbacksCount: callbacks.filter(c => c.status === 'taken').length,
  };
}
