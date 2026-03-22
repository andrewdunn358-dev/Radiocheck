'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileText, MessageSquare, Trash2, BarChart3, Settings } from 'lucide-react';
import { api, API_URL } from '@/lib/admin-api';

interface SettingsTabProps {
  token: string;
  userEmail?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function SettingsTab({ token, userEmail, onSuccess, onError }: SettingsTabProps) {
  // Settings state
  const [systemSettings, setSystemSettings] = useState<any>({
    logo_url: '',
    admin_notification_email: '',
    cso_email: '',
    peer_registration_notification_email: '',
    safeguarding_alerts_enabled: true,
    ai_chat_enabled: true,
    live_chat_enabled: true,
    callbacks_enabled: true,
    events_enabled: true,
    panic_button_enabled: true,
  });
  
  // Clear logs state
  const [clearLogsType, setClearLogsType] = useState<string>('');
  const [clearLogsConfirmText, setClearLogsConfirmText] = useState('');

  // Load settings
  const loadSettings = useCallback(async () => {
    if (!token) return;
    try {
      const settings = await api.getSettings(token);
      setSystemSettings(settings);
    } catch (err) {
      console.error('Failed to load settings');
    }
  }, [token]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div data-testid="settings-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">System Settings</h2>
        <button 
          onClick={loadSettings}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Settings */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Logo Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Current Logo</label>
              <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-center">
                {systemSettings.logo_url ? (
                  <img src={systemSettings.logo_url} alt="Logo" className="max-h-20" />
                ) : (
                  <span className="text-gray-500">No logo uploaded</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Logo URL</label>
              <input
                type="text"
                value={systemSettings.logo_url || ''}
                onChange={(e) => setSystemSettings({ ...systemSettings, logo_url: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="https://example.com/logo.png"
              />
            </div>
            <button 
              onClick={async () => {
                try {
                  await api.updateSettings(token!, { logo_url: systemSettings.logo_url });
                  onSuccess('Logo updated');
                } catch (err: any) {
                  onError('Failed to update logo: ' + err.message);
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Save Logo
            </button>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-400" />
            Email Notifications
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Admin Notification Email</label>
              <input
                type="email"
                value={systemSettings.admin_notification_email || ''}
                onChange={(e) => setSystemSettings({ ...systemSettings, admin_notification_email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">CSO Email</label>
              <input
                type="email"
                value={systemSettings.cso_email || ''}
                onChange={(e) => setSystemSettings({ ...systemSettings, cso_email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="cso@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Peer Registration Notification Email</label>
              <input
                type="email"
                value={systemSettings.peer_registration_notification_email || ''}
                onChange={(e) => setSystemSettings({ ...systemSettings, peer_registration_notification_email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="notifications@example.com"
              />
            </div>
            <button 
              onClick={async () => {
                try {
                  await api.updateSettings(token!, {
                    admin_notification_email: systemSettings.admin_notification_email,
                    cso_email: systemSettings.cso_email,
                    peer_registration_notification_email: systemSettings.peer_registration_notification_email,
                  });
                  onSuccess('Email settings saved');
                } catch (err: any) {
                  onError('Failed to save: ' + err.message);
                }
              }}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
            >
              Save Email Settings
            </button>
          </div>
        </div>

        {/* Clear Logs */}
        <div className="bg-gray-800 rounded-lg border border-red-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" />
            Clear Logs (Danger Zone)
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Select Log Type to Clear</label>
              <select
                value={clearLogsType}
                onChange={(e) => setClearLogsType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Select log type...</option>
                <option value="safeguarding">Safeguarding Alerts</option>
                <option value="calls">Call Logs</option>
                <option value="chats">Chat Logs</option>
                <option value="analytics">Analytics Data</option>
                <option value="callbacks">Callback Logs</option>
                <option value="screening">Screening Data</option>
                <option value="panic">Panic Alerts</option>
                <option value="all">ALL DATA (Dangerous!)</option>
              </select>
            </div>
            
            {clearLogsType === 'all' && (
              <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
                <p className="text-red-300 text-sm mb-2">This will delete ALL logs permanently. Type "DELETE ALL" to confirm:</p>
                <input
                  type="text"
                  value={clearLogsConfirmText}
                  onChange={(e) => setClearLogsConfirmText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-red-600 rounded-lg text-white"
                  placeholder="Type DELETE ALL"
                />
              </div>
            )}
            
            <button 
              onClick={async () => {
                if (!clearLogsType) {
                  onError('Please select a log type');
                  return;
                }
                if (clearLogsType === 'all' && clearLogsConfirmText !== 'DELETE ALL') {
                  onError('Please type "DELETE ALL" to confirm');
                  return;
                }
                if (!confirm(`Are you sure you want to clear ${clearLogsType} logs? This cannot be undone.`)) return;
                
                try {
                  await api.clearLogs(token!, clearLogsType);
                  onSuccess(`${clearLogsType} logs cleared successfully`);
                  setClearLogsType('');
                  setClearLogsConfirmText('');
                } catch (err: any) {
                  onError('Failed to clear logs: ' + err.message);
                }
              }}
              disabled={!clearLogsType || (clearLogsType === 'all' && clearLogsConfirmText !== 'DELETE ALL')}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg"
            >
              Clear Selected Logs
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-yellow-400" />
            System Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Version</span>
              <span>2.0.0 (Next.js)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Environment</span>
              <span className="text-green-400">Production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">API Endpoint</span>
              <span className="text-xs font-mono text-gray-400 truncate max-w-[200px]">{API_URL}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Logged in as</span>
              <span>{userEmail}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Toggles Section */}
      <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          Feature Toggles
        </h3>
        <div className="space-y-4">
          {[
            { key: 'safeguarding_alerts_enabled', name: 'Safeguarding Alerts', desc: 'Enable real-time safeguarding alerts from AI chats', testId: 'toggle-safeguarding-alerts' },
            { key: 'ai_chat_enabled', name: 'AI Chat Buddies', desc: 'Enable AI companion chat feature for users', testId: 'toggle-ai-chat' },
            { key: 'live_chat_enabled', name: 'Live Chat', desc: 'Enable live chat with support staff', testId: 'toggle-live-chat' },
            { key: 'callbacks_enabled', name: 'Callback Requests', desc: 'Allow users to request phone callbacks', testId: 'toggle-callbacks' },
            { key: 'events_enabled', name: 'Events', desc: 'Enable community events feature', testId: 'toggle-events' },
            { key: 'panic_button_enabled', name: 'Panic Button', desc: 'Enable emergency panic button for users', testId: 'toggle-panic' },
          ].map((toggle) => (
            <div key={toggle.key} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium">{toggle.name}</p>
                <p className="text-sm text-gray-400">{toggle.desc}</p>
              </div>
              <button
                data-testid={toggle.testId}
                onClick={async () => {
                  try {
                    const newValue = !systemSettings[toggle.key];
                    await api.updateSettings(token!, { [toggle.key]: newValue });
                    setSystemSettings({ ...systemSettings, [toggle.key]: newValue });
                    onSuccess('Setting updated');
                  } catch (err: any) {
                    onError('Failed to update setting: ' + err.message);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  systemSettings[toggle.key] !== false ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    systemSettings[toggle.key] !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
