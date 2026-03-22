'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, MessageSquare, Bot, Phone, RefreshCw } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface MonitoringTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function MonitoringTab({ token, onSuccess, onError }: MonitoringTabProps) {
  const [monitoringStats, setMonitoringStats] = useState<any>(null);
  const [monitoringLastUpdated, setMonitoringLastUpdated] = useState<Date | null>(null);

  const loadMonitoring = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getMonitoringStats(token);
      setMonitoringStats(data);
      setMonitoringLastUpdated(new Date());
    } catch (err: any) {
      console.error('Monitoring stats not available:', err);
    }
  }, [token]);

  useEffect(() => {
    loadMonitoring();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadMonitoring();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadMonitoring]);

  return (
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
  );
}
