'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, Download, Trash2, BarChart3, MapPin } from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { api } from '@/lib/admin-api';
import type { CallLog, ChatRoom, SafeguardingAlert } from '@/types/admin';
import CallsSubTab from './CallsSubTab';
import ChatsSubTab from './ChatsSubTab';
import SafeguardingSubTab from './SafeguardingSubTab';
import ScreeningSubTab from './ScreeningSubTab';
import CallbacksSubTab from './CallbacksSubTab';
import PanicSubTab from './PanicSubTab';
import AuditSubTab from './AuditSubTab';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Dynamic import for LocationMap to avoid SSR issues
const LocationMap = dynamic(() => import('@/app/components/LocationMap'), { 
  ssr: false,
  loading: () => <div className="h-96 bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">Loading map...</div>
});

const LOG_SUBTABS = [
  { id: 'calls', label: 'Calls' },
  { id: 'chats', label: 'Chats' },
  { id: 'safeguarding', label: 'Safeguarding' },
  { id: 'screening', label: 'Screening' },
  { id: 'callbacks', label: 'Callbacks' },
  { id: 'panic', label: 'Panic' },
  { id: 'audit', label: 'Audit' },
];

interface LogsTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function LogsTab({ token, onSuccess, onError }: LogsTabProps) {
  const [activeLogSubTab, setActiveLogSubTab] = useState('calls');
  
  // Data state
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [safeguardingAlerts, setSafeguardingAlerts] = useState<SafeguardingAlert[]>([]);
  const [screeningLogs, setScreeningLogs] = useState<any[]>([]);
  const [callbackLogs, setCallbackLogs] = useState<any[]>([]);
  const [panicLogs, setPanicLogs] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  
  // Analytics state
  const [appUsageStats, setAppUsageStats] = useState<any>(null);
  const [aiChatStats, setAiChatStats] = useState<any>(null);
  const [locationData, setLocationData] = useState<any>(null);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    try {
      // Always load app usage, AI chat stats, and location data for the dashboard view
      const [usageData, aiStatsData, locData] = await Promise.all([
        api.getAppUsageStats(token).catch(() => null),
        api.getAIChatStats(token).catch(() => null),
        api.getLocationData(token).catch(() => null),
      ]);
      setAppUsageStats(usageData);
      setAiChatStats(aiStatsData);
      setLocationData(locData);
      
      switch (activeLogSubTab) {
        case 'calls':
          const callsResponse = await api.getCallLogs(token).catch(() => ({ total_calls: 0, recent_logs: [] }));
          const logs = callsResponse?.recent_logs || callsResponse;
          setCallLogs(Array.isArray(logs) ? logs : []);
          break;
        case 'chats':
          const chats = await api.getChatLogs(token).catch(() => []);
          const chatArr = chats?.rooms || chats;
          setChatRooms(Array.isArray(chatArr) ? chatArr : []);
          break;
        case 'safeguarding':
          const alerts = await api.getSafeguardingLogs(token).catch(() => []);
          const alertArr = alerts?.alerts || alerts;
          setSafeguardingAlerts(Array.isArray(alertArr) ? alertArr : []);
          break;
        case 'screening':
          const screening = await api.getScreeningLogs(token).catch(() => []);
          const screenArr = screening?.submissions || screening;
          setScreeningLogs(Array.isArray(screenArr) ? screenArr : []);
          break;
        case 'callbacks':
          const callbacks = await api.getCallbackLogs(token).catch(() => []);
          const callbackArr = callbacks?.callbacks || callbacks;
          setCallbackLogs(Array.isArray(callbackArr) ? callbackArr : []);
          break;
        case 'panic':
          const panic = await api.getPanicLogs(token).catch(() => []);
          const panicArr = panic?.alerts || panic;
          setPanicLogs(Array.isArray(panicArr) ? panicArr : []);
          break;
        case 'audit':
          const audit = await api.getAuditLogs(token, 100).catch(() => []);
          const auditArr = audit?.logs || audit;
          setAdminAuditLogs(Array.isArray(auditArr) ? auditArr : []);
          break;
      }
    } catch (err: any) {
      console.error('Failed to load logs:', err.message);
    }
  }, [token, activeLogSubTab]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Export CSV handler
  const handleExportCSV = () => {
    let data: any[] = [];
    let filename = '';
    const dateStr = new Date().toISOString().split('T')[0];
    
    if (activeLogSubTab === 'calls') {
      data = callLogs;
      filename = `calls-logs-${dateStr}.csv`;
    } else if (activeLogSubTab === 'chats') {
      data = chatRooms;
      filename = `chats-logs-${dateStr}.csv`;
    } else if (activeLogSubTab === 'safeguarding') {
      data = safeguardingAlerts;
      filename = `safeguarding-logs-${dateStr}.csv`;
    } else if (activeLogSubTab === 'screening') {
      data = screeningLogs;
      filename = `screening-logs-${dateStr}.csv`;
    } else if (activeLogSubTab === 'callbacks') {
      data = callbackLogs;
      filename = `callbacks-logs-${dateStr}.csv`;
    } else if (activeLogSubTab === 'panic') {
      data = panicLogs;
      filename = `panic-logs-${dateStr}.csv`;
    } else if (activeLogSubTab === 'audit') {
      data = adminAuditLogs;
      filename = `audit-logs-${dateStr}.csv`;
    }
    
    if (data.length === 0) {
      onError('No data to export');
      return;
    }
    
    // Convert to CSV
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',')
      )
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onSuccess('CSV exported successfully');
  };

  // Clear logs handler
  const handleClearLogs = async () => {
    const logTypeMap: Record<string, string> = {
      'calls': 'calls',
      'chats': 'chats',
      'safeguarding': 'safeguarding',
      'screening': 'screening',
      'callbacks': 'callbacks',
      'panic': 'panic',
      'audit': 'analytics'
    };
    const logType = logTypeMap[activeLogSubTab] || activeLogSubTab;
    
    if (!confirm(`Are you sure you want to permanently delete ${activeLogSubTab} logs?\n\nThis action cannot be undone!`)) {
      return;
    }
    
    try {
      await api.clearLogs(token, logType);
      onSuccess(`${activeLogSubTab} logs cleared successfully`);
      loadLogs();
    } catch (err: any) {
      onError('Failed to clear logs: ' + err.message);
    }
  };

  return (
    <div data-testid="logs-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Logs & Analytics</h2>
        <div className="flex gap-2">
          {/* Export CSV Button */}
          <button 
            onClick={handleExportCSV}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          {/* Clear Logs Button */}
          <button 
            onClick={handleClearLogs}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear Logs
          </button>
          <button onClick={loadLogs} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4">
          <p className="text-blue-200 text-sm">Total Calls</p>
          <p className="text-2xl font-bold">{callLogs.length}</p>
        </div>
        <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-lg p-4">
          <p className="text-cyan-200 text-sm">Live Chats</p>
          <p className="text-2xl font-bold">{chatRooms.length}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-4">
          <p className="text-yellow-200 text-sm">Safeguarding</p>
          <p className="text-2xl font-bold">{safeguardingAlerts.length}</p>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-4">
          <p className="text-red-200 text-sm">Panic Alerts</p>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4">
          <p className="text-purple-200 text-sm">AI Sessions</p>
          <p className="text-2xl font-bold">{aiChatStats?.total_sessions || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-pink-600 to-pink-700 rounded-lg p-4">
          <p className="text-pink-200 text-sm">AI Messages (7d)</p>
          <p className="text-2xl font-bold">{aiChatStats?.total_messages || 0}</p>
        </div>
      </div>

      {/* App Usage Analytics Section */}
      {appUsageStats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            App Usage Analytics
          </h3>
          
          {/* Period Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{appUsageStats?.currently_connected || 0}</p>
              <p className="text-green-200 text-sm">Connected Now</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{appUsageStats?.['7_days']?.unique_visitors || 0}</p>
              <p className="text-gray-400 text-sm">Last 7 Days</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{appUsageStats?.['30_days']?.unique_visitors || 0}</p>
              <p className="text-gray-400 text-sm">Last 30 Days</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{appUsageStats?.['6_months']?.unique_visitors || 0}</p>
              <p className="text-gray-400 text-sm">Last 6 Months</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{appUsageStats?.['12_months']?.unique_visitors || 0}</p>
              <p className="text-gray-400 text-sm">Last 12 Months</p>
            </div>
          </div>

          {/* Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Visitors by Region */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-3 text-red-400">Visitors by Region (30 days)</h4>
              <div className="space-y-2">
                {appUsageStats?.regions && (
                  Array.isArray(appUsageStats.regions) 
                    ? appUsageStats.regions.map((item: any, idx: number) => {
                        const regionName = String(item.region || item.name || item.country || 'Unknown');
                        const visitCount = Number(item.visits || item.unique || item.count || item.value || 0);
                        return (
                          <div key={idx} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                            <span className="capitalize">{regionName.replace(/_/g, ' ')}</span>
                            <strong>{visitCount}</strong>
                          </div>
                        );
                      })
                    : typeof appUsageStats.regions === 'object' && Object.keys(appUsageStats.regions).length > 0 
                      ? Object.entries(appUsageStats.regions).map(([region, data]: [string, any]) => {
                          const visitCount = typeof data === 'number' 
                            ? data 
                            : (typeof data === 'object' ? Number(data.visits || data.unique || data.count || 0) : 0);
                          return (
                            <div key={region} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                              <span className="capitalize">{region.replace(/_/g, ' ')}</span>
                              <strong>{visitCount}</strong>
                            </div>
                          );
                        })
                      : <p className="text-gray-500 text-sm">No region data yet</p>
                )}
                {!appUsageStats?.regions && <p className="text-gray-500 text-sm">No region data yet</p>}
              </div>
            </div>

            {/* Daily Trend */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-3 text-blue-400">Daily Trend (Last 7 days)</h4>
              <div className="space-y-1">
                {appUsageStats?.daily_trend?.slice(-7).map((day: any) => (
                  <div key={day._id} className="flex justify-between items-center bg-gray-700 p-2 rounded text-sm">
                    <span>{day._id}</span>
                    <span><strong>{day.unique_visitors}</strong> visitors</span>
                  </div>
                )) || <p className="text-gray-500 text-sm">No data yet</p>}
              </div>
            </div>

            {/* Device Type */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-3 text-purple-400">Device Type</h4>
              <div className="space-y-2">
                {appUsageStats?.devices && Object.keys(appUsageStats.devices).length > 0 ? (
                  Object.entries(appUsageStats.devices).map(([device, data]: [string, any]) => (
                    <div key={device} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                      <span className="capitalize flex items-center gap-2">
                        {device === 'mobile' ? '📱' : device === 'desktop' ? '🖥️' : '📟'} {device}
                      </span>
                      <strong>{typeof data === 'object' ? (data.count || data.visits || 0) : data}</strong>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No device data yet</p>
                )}
              </div>
            </div>

            {/* Browser */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-3 text-green-400">Browser</h4>
              <div className="space-y-2">
                {appUsageStats?.browsers && Object.keys(appUsageStats.browsers).length > 0 ? (
                  Object.entries(appUsageStats.browsers).map(([browser, data]: [string, any]) => (
                    <div key={browser} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                      <span className="capitalize">{browser}</span>
                      <strong>{typeof data === 'object' ? (data.count || data.visits || 0) : data}</strong>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No browser data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* OS and Return Rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Operating System */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-3 text-yellow-400">Operating System</h4>
              <div className="space-y-2">
                {appUsageStats?.operating_systems && Object.keys(appUsageStats.operating_systems).length > 0 ? (
                  Object.entries(appUsageStats.operating_systems).map(([os, data]: [string, any]) => (
                    <div key={os} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                      <span className="capitalize flex items-center gap-2">
                        {os === 'windows' ? '🪟' : os === 'apple' ? '🍎' : os === 'android' ? '🤖' : '💻'} 
                        {os === 'apple' ? 'Apple (iOS/Mac)' : os.charAt(0).toUpperCase() + os.slice(1)}
                      </span>
                      <strong>{typeof data === 'object' ? (data.count || data.visits || 0) : data}</strong>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No OS data yet</p>
                )}
              </div>
            </div>

            {/* Return Rate */}
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-4">
              <h4 className="font-medium mb-3 text-purple-200">Return Rate (30 days)</h4>
              <div className="text-center py-4">
                <p className="text-5xl font-bold">
                  {typeof appUsageStats?.return_rate === 'object' && appUsageStats?.return_rate?.percentage !== undefined
                    ? Number(appUsageStats.return_rate.percentage).toFixed(1)
                    : typeof appUsageStats?.return_rate === 'number'
                    ? Number(appUsageStats.return_rate).toFixed(1)
                    : '0.0'}%
                </p>
                <p className="text-purple-200 mt-2">
                  {typeof appUsageStats?.return_rate === 'object' && appUsageStats?.return_rate?.returning_visitors !== undefined
                    ? appUsageStats.return_rate.returning_visitors
                    : appUsageStats?.returning_visitors || 0} returning / {typeof appUsageStats?.return_rate === 'object' && appUsageStats?.return_rate?.total_visitors !== undefined
                    ? appUsageStats.return_rate.total_visitors
                    : appUsageStats?.['30_days']?.unique_visitors || 0} total visitors
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {appUsageStats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Usage Charts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Daily Visitors Line Chart */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-4 text-blue-400">Daily Visitors (Last 7 Days)</h4>
              <div style={{ height: '250px' }}>
                <Line
                  data={{
                    labels: appUsageStats?.daily_trend?.slice(-7).map((d: any) => d._id) || [],
                    datasets: [{
                      label: 'Visitors',
                      data: appUsageStats?.daily_trend?.slice(-7).map((d: any) => d.unique_visitors) || [],
                      borderColor: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      fill: true,
                      tension: 0.3
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#9ca3af' }
                      },
                      x: { 
                        grid: { display: false },
                        ticks: { color: '#9ca3af' }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Device Type Doughnut Chart */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-4 text-purple-400">Device Distribution</h4>
              <div style={{ height: '250px' }} className="flex justify-center">
                <Doughnut
                  data={{
                    labels: Object.keys(appUsageStats?.devices || { desktop: 0, mobile: 0 }),
                    datasets: [{
                      data: Object.values(appUsageStats?.devices || { desktop: 0, mobile: 0 }).map((d: any) => 
                        typeof d === 'object' ? (d.count || d.visits || 0) : d
                      ),
                      backgroundColor: ['#8b5cf6', '#06b6d4', '#10b981'],
                      borderWidth: 0
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { 
                        position: 'bottom',
                        labels: { color: '#9ca3af' }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Call Volume Bar Chart */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-4 text-green-400">Activity Summary</h4>
              <div style={{ height: '250px' }}>
                <Bar
                  data={{
                    labels: ['Calls', 'Chats', 'Safeguarding', 'AI Sessions'],
                    datasets: [{
                      label: 'Count',
                      data: [
                        callLogs.length,
                        chatRooms.length,
                        safeguardingAlerts.length,
                        aiChatStats?.total_sessions || 0
                      ],
                      backgroundColor: ['#3b82f6', '#06b6d4', '#eab308', '#8b5cf6']
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#9ca3af' }
                      },
                      x: { 
                        grid: { display: false },
                        ticks: { color: '#9ca3af' }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Browser Distribution Doughnut */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h4 className="font-medium mb-4 text-yellow-400">Browser Distribution</h4>
              <div style={{ height: '250px' }} className="flex justify-center">
                <Doughnut
                  data={{
                    labels: Object.keys(appUsageStats?.browsers || { chrome: 0 }),
                    datasets: [{
                      data: Object.values(appUsageStats?.browsers || { chrome: 0 }).map((d: any) =>
                        typeof d === 'object' ? (d.count || d.visits || 0) : d
                      ),
                      backgroundColor: ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#8b5cf6'],
                      borderWidth: 0
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { 
                        position: 'bottom',
                        labels: { color: '#9ca3af' }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Trend & Contact Type Charts Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-green-400" />
          Activity Trends
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Activity Trend Chart - Last 7 Days */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h4 className="font-medium mb-4 text-blue-400">Activity Trend (Last 7 Days)</h4>
            <div style={{ height: '250px' }}>
              <Line
                data={{
                  labels: (() => {
                    const days = [];
                    for (let i = 6; i >= 0; i--) {
                      const d = new Date();
                      d.setDate(d.getDate() - i);
                      days.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
                    }
                    return days;
                  })(),
                  datasets: [
                    {
                      label: 'Calls',
                      data: (() => {
                        const counts = new Array(7).fill(0);
                        callLogs.forEach((log: any) => {
                          const logDate = new Date(log.timestamp || log.created_at);
                          const daysAgo = Math.floor((Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24));
                          if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
                        });
                        return counts;
                      })(),
                      borderColor: '#22c55e',
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      tension: 0.3
                    },
                    {
                      label: 'Chats',
                      data: (() => {
                        const counts = new Array(7).fill(0);
                        chatRooms.forEach((room: any) => {
                          const roomDate = new Date(room.created_at);
                          const daysAgo = Math.floor((Date.now() - roomDate.getTime()) / (1000 * 60 * 60 * 24));
                          if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
                        });
                        return counts;
                      })(),
                      borderColor: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      tension: 0.3
                    },
                    {
                      label: 'Safeguarding Alerts',
                      data: (() => {
                        const counts = new Array(7).fill(0);
                        safeguardingAlerts.forEach((alert: any) => {
                          const alertDate = new Date(alert.created_at);
                          const daysAgo = Math.floor((Date.now() - alertDate.getTime()) / (1000 * 60 * 60 * 24));
                          if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo]++;
                        });
                        return counts;
                      })(),
                      borderColor: '#ef4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      tension: 0.3
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      position: 'bottom',
                      labels: { color: '#9ca3af' }
                    }
                  },
                  scales: {
                    y: { 
                      beginAtZero: true,
                      grid: { color: 'rgba(255,255,255,0.1)' },
                      ticks: { color: '#9ca3af' }
                    },
                    x: { 
                      grid: { display: false },
                      ticks: { color: '#9ca3af' }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Contact Type Doughnut Chart */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h4 className="font-medium mb-4 text-purple-400">Contact Type Distribution</h4>
            <div style={{ height: '250px' }} className="flex justify-center">
              <Doughnut
                data={{
                  labels: ['Counsellor', 'Peer', 'Organization', 'Crisis Line'],
                  datasets: [{
                    data: [
                      callLogs.filter((l: any) => l.contact_type === 'counsellor').length,
                      callLogs.filter((l: any) => l.contact_type === 'peer').length,
                      callLogs.filter((l: any) => l.contact_type === 'organization').length,
                      callLogs.filter((l: any) => l.contact_type === 'crisis_line').length
                    ],
                    backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      position: 'bottom',
                      labels: { color: '#9ca3af' }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Location Map Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-400" />
          Location Analytics
        </h3>
        <LocationMap data={locationData} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        {LOG_SUBTABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveLogSubTab(tab.id)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeLogSubTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab Content */}
      {activeLogSubTab === 'calls' && (
        <CallsSubTab callLogs={callLogs} />
      )}

      {activeLogSubTab === 'chats' && (
        <ChatsSubTab 
          chatRooms={chatRooms} 
          token={token}
          onError={onError}
        />
      )}

      {activeLogSubTab === 'safeguarding' && (
        <SafeguardingSubTab
          safeguardingAlerts={safeguardingAlerts}
          token={token}
          onSuccess={onSuccess}
          onError={onError}
          onRefresh={loadLogs}
        />
      )}

      {activeLogSubTab === 'screening' && (
        <ScreeningSubTab screeningLogs={screeningLogs} />
      )}

      {activeLogSubTab === 'callbacks' && (
        <CallbacksSubTab callbackLogs={callbackLogs} />
      )}

      {activeLogSubTab === 'panic' && (
        <PanicSubTab panicLogs={panicLogs} />
      )}

      {activeLogSubTab === 'audit' && (
        <AuditSubTab adminAuditLogs={adminAuditLogs} />
      )}
    </div>
  );
}
