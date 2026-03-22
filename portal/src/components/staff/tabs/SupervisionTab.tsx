'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield } from 'lucide-react';
import { staffApi, Escalation } from '@/lib/api';

interface SupervisionTabProps {
  token: string;
  user: any;
}

export default function SupervisionTab({
  token,
  user,
}: SupervisionTabProps) {
  // Sub-tab state
  const [escalationsTab, setEscalationsTab] = useState<'pending' | 'all'>('pending');
  
  // Data state
  const [escalations, setEscalations] = useState<Escalation[]>([]);

  // Load escalations
  const loadEscalations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getEscalations(token);
      setEscalations(data);
    } catch (err) {
      console.error('Failed to load escalations:', err);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (token && user?.is_supervisor) {
      loadEscalations();
    }
  }, [token, user?.is_supervisor, loadEscalations]);

  // Handler functions
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

  // Helper function
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

  // Only render for supervisors
  if (!user?.is_supervisor) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Access restricted to supervisors</p>
      </div>
    );
  }

  return (
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
  );
}
