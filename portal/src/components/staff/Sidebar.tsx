'use client';

import Link from 'next/link';
import {
  LayoutDashboard, AlertTriangle, MessageSquare, Briefcase, Phone,
  Calendar, Users, FileText, Shield, LogOut, Volume2, VolumeX, Mail
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: number;
}

interface SidebarProps {
  user: any;
  profile: any;
  activeTab: string;
  soundEnabled: boolean;
  unreadMessageCount: number;
  activeAlertsCount: number;
  waitingChatsCount: number;
  pendingCallbacksCount: number;
  onTabChange: (tab: string) => void;
  onStatusChange: (status: string) => void;
  onToggleSound: () => void;
  onShowMessages: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  user,
  profile,
  activeTab,
  soundEnabled,
  unreadMessageCount,
  activeAlertsCount,
  waitingChatsCount,
  pendingCallbacksCount,
  onTabChange,
  onStatusChange,
  onToggleSound,
  onShowMessages,
  onLogout,
}: SidebarProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: activeAlertsCount },
    { id: 'livechat', label: 'Live Support', icon: MessageSquare, badge: waitingChatsCount },
    { id: 'cases', label: 'Cases', icon: Briefcase },
    { id: 'callbacks', label: 'Callbacks', icon: Phone, badge: pendingCallbacksCount },
    { id: 'rota', label: 'Rota', icon: Calendar },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'notes', label: 'Notes', icon: FileText },
    ...(user?.is_supervisor ? [{ id: 'supervision', label: 'Supervision', icon: Shield }] : []),
  ];

  const statusOptions = [
    { value: 'available', label: 'Available', color: 'bg-green-500' },
    { value: 'limited', label: 'Busy', color: 'bg-yellow-500' },
    { value: 'unavailable', label: 'Off Duty', color: 'bg-gray-500' }
  ];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
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
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              data-testid={`status-btn-${opt.value}`}
              onClick={() => onStatusChange(opt.value)}
              disabled={!profile}
              className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                profile?.status === opt.value 
                  ? `${opt.color} text-white` 
                  : 'bg-primary-dark border border-border hover:bg-white/5'
              } ${!profile ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {opt.label}
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
              onClick={() => onTabChange(item.id)}
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

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        <button 
          onClick={onShowMessages} 
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
          onClick={onToggleSound} 
          className="w-full flex items-center gap-2 text-gray-400 hover:text-white"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="text-sm">{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
        </button>
        <div className="text-sm text-gray-400">{profile?.name || user?.name}</div>
        <button onClick={onLogout} className="flex items-center gap-2 text-gray-400 hover:text-white">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
