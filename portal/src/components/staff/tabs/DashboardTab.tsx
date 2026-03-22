'use client';

import {
  LayoutDashboard, AlertTriangle, MessageSquare, Briefcase, Phone, ChevronRight
} from 'lucide-react';

interface SafeguardingAlert {
  id?: string;
  _id?: string;
  risk_level: string;
  status: string;
  created_at: string;
  triggering_message?: string;
  trigger_message?: string;
}

interface DashboardTabProps {
  user: any;
  activeAlertsCount: number;
  waitingChatsCount: number;
  openCasesCount: number;
  pendingCallbacksCount: number;
  safeguardingAlerts: SafeguardingAlert[];
  onShowPanicModal: () => void;
  onNavigateToAlerts: () => void;
}

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

export default function DashboardTab({
  user,
  activeAlertsCount,
  waitingChatsCount,
  openCasesCount,
  pendingCallbacksCount,
  safeguardingAlerts,
  onShowPanicModal,
  onNavigateToAlerts,
}: DashboardTabProps) {
  return (
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
            onClick={onShowPanicModal}
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
          <button onClick={onNavigateToAlerts} className="text-sm text-secondary hover:underline">
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
  );
}
