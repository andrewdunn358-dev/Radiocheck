'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, RefreshCw, Clock, Phone
} from 'lucide-react';
import { staffApi, TeamMember } from '@/lib/api';

interface TeamTabProps {
  token: string;
  user: any;
  webrtcPhone: any;
}

export default function TeamTab({
  token,
  user,
  webrtcPhone,
}: TeamTabProps) {
  // Data state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Load team
  const loadTeam = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getTeamOnDuty(token);
      setTeamMembers(data);
    } catch (err) {
      console.error('Failed to load team:', err);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (token) {
      loadTeam();
    }
  }, [token, loadTeam]);

  // Listen for real-time status sync from other portals
  useEffect(() => {
    const handleStatusSync = (event: CustomEvent) => {
      console.log('[TeamTab] Status synced from another session:', event.detail);
      loadTeam();
    };

    const handleStaffOnline = (event: CustomEvent) => {
      console.log('[TeamTab] Staff came online:', event.detail);
      loadTeam();
    };

    const handleStaffOffline = (event: CustomEvent) => {
      console.log('[TeamTab] Staff went offline:', event.detail);
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

  return (
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
  );
}
