'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Folder, RefreshCw, Plus, Filter, X, Clock, User, AlertTriangle, 
  FileText, Send, ChevronRight, Phone, Mail
} from 'lucide-react';
import { staffApi, Case } from '@/lib/api';

// Get API URL for direct fetch calls
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

interface CasesTabProps {
  token: string;
  user: any;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function CasesTab({
  token,
  user,
  onSuccess,
  onError,
}: CasesTabProps) {
  // Cases state
  const [cases, setCases] = useState<Case[]>([]);
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>('');
  const [caseRiskFilter, setCaseRiskFilter] = useState<string>('');
  
  // Selected case modal state
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [caseSessions, setCaseSessions] = useState<any[]>([]);
  
  // Add session modal
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [newSessionNote, setNewSessionNote] = useState('');
  
  // Create case modal
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [newCaseUserId, setNewCaseUserId] = useState('');
  const [newCaseUserName, setNewCaseUserName] = useState('');
  const [newCaseNotes, setNewCaseNotes] = useState('');
  const [newCaseRiskLevel, setNewCaseRiskLevel] = useState('low');
  
  // Escalate case modal
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateCaseId, setEscalateCaseId] = useState<string | null>(null);
  const [escalateTo, setEscalateTo] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateNotes, setEscalateNotes] = useState('');
  const [availableCounsellors, setAvailableCounsellors] = useState<any[]>([]);

  // Load cases function
  const loadCases = useCallback(async () => {
    if (!token) return;
    try {
      let caseList = await staffApi.getCases(token);
      // Apply filters
      if (caseStatusFilter) {
        caseList = caseList.filter(c => c.status === caseStatusFilter);
      }
      if (caseRiskFilter) {
        caseList = caseList.filter(c => c.risk_level === caseRiskFilter);
      }
      setCases(caseList);
    } catch (err) {
      console.error('Failed to load cases:', err);
    }
  }, [token, caseStatusFilter, caseRiskFilter]);

  // Initial load
  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Load available counsellors for escalation
  const loadAvailableCounsellors = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/counsellors/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableCounsellors(data.counsellors || []);
      }
    } catch (err) {
      console.error('Failed to load counsellors:', err);
    }
  }, [token]);

  // Handler functions
  const handleViewCase = async (caseItem: Case) => {
    setSelectedCase(caseItem);
    setShowCaseModal(true);
    // Load case sessions
    try {
      const caseId = caseItem._id;
      if (caseId) {
        const response = await fetch(`${API_URL}/api/cases/${caseId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const fullCase = await response.json();
          setCaseSessions(fullCase.sessions || []);
        }
      }
    } catch (err) {
      console.error('Failed to load case details:', err);
      setCaseSessions([]);
    }
  };

  const handleAddSessionNote = async () => {
    if (!token || !selectedCase || !newSessionNote.trim()) return;
    try {
      const caseId = selectedCase._id;
      await staffApi.addCaseSession(token, caseId, {
        notes: newSessionNote,
        session_type: 'note'
      });
      setNewSessionNote('');
      setShowAddSessionModal(false);
      // Reload case details
      const sessions = await staffApi.getCaseSessions(token, caseId);
      setCaseSessions(sessions);
      onSuccess?.('Session note added');
    } catch (err: any) {
      console.error('Failed to add session note:', err);
      onError?.('Failed to add session note: ' + err.message);
    }
  };

  const handleCreateCase = async () => {
    if (!token || !newCaseUserName.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/cases/direct`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          user_id: newCaseUserId || `manual_${Date.now()}`,
          user_name: newCaseUserName,
          notes: newCaseNotes,
          risk_level: newCaseRiskLevel,
          assigned_to: user?.id,
          assigned_name: user?.name,
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create case');
      }
      
      setShowCreateCaseModal(false);
      setNewCaseUserId('');
      setNewCaseUserName('');
      setNewCaseNotes('');
      setNewCaseRiskLevel('low');
      loadCases();
      onSuccess?.('Case created successfully');
    } catch (err: any) {
      console.error('Failed to create case:', err);
      onError?.('Failed to create case: ' + err.message);
    }
  };

  const handleOpenEscalate = (caseId: string) => {
    setEscalateCaseId(caseId);
    setShowEscalateModal(true);
    loadAvailableCounsellors();
  };

  const handleEscalateCase = async () => {
    if (!token || !escalateCaseId || !escalateTo) return;
    try {
      // First share the case with the counsellor
      await fetch(`${API_URL}/api/cases/${escalateCaseId}/share`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          shared_with_id: escalateTo,
          permission: 'full'
        })
      });
      
      // Then add an escalation session note
      await fetch(`${API_URL}/api/cases/${escalateCaseId}/sessions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          session_type: 'escalation',
          notes: `Escalated to counsellor. Reason: ${escalateReason}. Notes: ${escalateNotes}`,
          staff_id: user?.id,
          staff_name: user?.name,
        })
      });
      
      setShowEscalateModal(false);
      setEscalateCaseId(null);
      setEscalateTo('');
      setEscalateReason('');
      setEscalateNotes('');
      loadCases();
      onSuccess?.('Case escalated successfully');
    } catch (err: any) {
      console.error('Failed to escalate case:', err);
      onError?.('Failed to escalate case: ' + err.message);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500/20 text-blue-400';
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'monitoring': return 'bg-yellow-500/20 text-yellow-400';
      case 'closed': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div data-testid="cases-tab">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Folder className="w-6 h-6 text-secondary" />
          Cases
        </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCreateCaseModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
          >
            <Plus className="w-4 h-4" />
            New Case
          </button>
          <button onClick={loadCases} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={caseStatusFilter}
          onChange={(e) => setCaseStatusFilter(e.target.value)}
          className="px-4 py-2 bg-card border border-border rounded-lg focus:border-secondary outline-none"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="active">Active</option>
          <option value="monitoring">Monitoring</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={caseRiskFilter}
          onChange={(e) => setCaseRiskFilter(e.target.value)}
          className="px-4 py-2 bg-card border border-border rounded-lg focus:border-secondary outline-none"
        >
          <option value="">All Risk Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        {cases.map((caseItem) => (
          <div key={caseItem._id} className="bg-card border border-border rounded-xl p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-semibold text-lg">{caseItem.user_name || 'Unknown User'}</span>
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${getRiskBadgeColor(caseItem.risk_level || 'low')}`}>
                    {(caseItem.risk_level || 'LOW').toUpperCase()} RISK
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(caseItem.status || 'open')}`}>
                    {(caseItem.status || 'open').toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Created: {formatTimeAgo(caseItem.created_at)}
                  </span>
                  {caseItem.assigned_to_name && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Assigned: {caseItem.assigned_to_name}
                    </span>
                  )}
                  {caseItem.session_count !== undefined && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {caseItem.session_count} sessions
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewCase(caseItem)}
                  className="px-4 py-2 bg-primary-light text-white rounded-lg hover:bg-primary flex items-center gap-1"
                >
                  View
                  <ChevronRight className="w-4 h-4" />
                </button>
                {user?.role === 'peer' && (
                  <button
                    onClick={() => handleOpenEscalate(caseItem._id)}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Escalate
                  </button>
                )}
              </div>
            </div>
            
            {caseItem.description && (
              <p className="text-sm text-gray-400 mt-2 line-clamp-2">{caseItem.description}</p>
            )}
          </div>
        ))}
        {cases.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No cases found</p>
          </div>
        )}
      </div>

      {/* Case Detail Modal */}
      {showCaseModal && selectedCase && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-card rounded-2xl p-6 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedCase.user_name}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${getRiskBadgeColor(selectedCase.risk_level || 'low')}`}>
                    {(selectedCase.risk_level || 'LOW').toUpperCase()} RISK
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedCase.status || 'open')}`}>
                    {(selectedCase.status || 'open').toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCaseModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Case Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-primary-dark rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Assigned To</p>
                <p className="font-medium">{selectedCase.assigned_to_name || 'Unassigned'}</p>
              </div>
              <div className="bg-primary-dark rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="font-medium">{new Date(selectedCase.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Description */}
            {selectedCase.description && (
              <div className="bg-primary-dark rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 mb-2">Description</p>
                <p className="text-sm">{selectedCase.description}</p>
              </div>
            )}

            {/* Sessions */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Sessions & Notes</h3>
                <button
                  onClick={() => setShowAddSessionModal(true)}
                  className="px-3 py-1 bg-secondary text-primary-dark rounded-lg text-sm hover:bg-secondary-light flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {caseSessions.length > 0 ? (
                  caseSessions.map((session, i) => (
                    <div key={session.id || i} className="bg-primary-dark/50 rounded-lg p-3 border-l-2 border-secondary">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          session.session_type === 'escalation' ? 'bg-orange-500/20 text-orange-400' :
                          session.session_type === 'call' ? 'bg-green-500/20 text-green-400' :
                          session.session_type === 'chat' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {session.session_type || 'note'}
                        </span>
                        <span className="text-xs text-gray-500">{formatTimeAgo(session.created_at)}</span>
                      </div>
                      <p className="text-sm">{session.notes}</p>
                      {session.staff_name && (
                        <p className="text-xs text-gray-500 mt-1">By: {session.staff_name}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">No sessions yet</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {user?.role === 'peer' && (
                <button
                  onClick={() => handleOpenEscalate(selectedCase._id)}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Escalate to Counsellor
                </button>
              )}
              <button
                onClick={() => setShowCaseModal(false)}
                className="flex-1 px-4 py-3 bg-card border border-border rounded-lg hover:bg-primary-dark"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Session Modal */}
      {showAddSessionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-card rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Session Note</h2>
            <textarea
              value={newSessionNote}
              onChange={(e) => setNewSessionNote(e.target.value)}
              className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none mb-4"
              placeholder="Enter your session notes..."
              rows={5}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAddSessionModal(false); setNewSessionNote(''); }}
                className="flex-1 px-4 py-2 bg-card border border-border rounded-lg hover:bg-primary-dark"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSessionNote}
                disabled={!newSessionNote.trim()}
                className="flex-1 px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateCaseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-card rounded-2xl p-6 max-w-md w-full mx-4 my-8">
            <h2 className="text-xl font-bold mb-4">Create New Case</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">User Name *</label>
                <input
                  type="text"
                  value={newCaseUserName}
                  onChange={(e) => setNewCaseUserName(e.target.value)}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                  placeholder="Enter name"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">User ID (optional)</label>
                <input
                  type="text"
                  value={newCaseUserId}
                  onChange={(e) => setNewCaseUserId(e.target.value)}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                  placeholder="Will be auto-generated if left blank"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Risk Level</label>
                <select
                  value={newCaseRiskLevel}
                  onChange={(e) => setNewCaseRiskLevel(e.target.value)}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Initial Notes</label>
                <textarea
                  value={newCaseNotes}
                  onChange={(e) => setNewCaseNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                  placeholder="Enter initial case notes..."
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateCaseModal(false);
                  setNewCaseUserId('');
                  setNewCaseUserName('');
                  setNewCaseNotes('');
                  setNewCaseRiskLevel('low');
                }}
                className="flex-1 px-4 py-2 bg-card border border-border rounded-lg hover:bg-primary-dark"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                disabled={!newCaseUserName.trim()}
                className="flex-1 px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light disabled:opacity-50"
              >
                Create Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Case Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-card rounded-2xl p-6 max-w-md w-full mx-4 my-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Escalate Case
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Escalate To *</label>
                <select
                  value={escalateTo}
                  onChange={(e) => setEscalateTo(e.target.value)}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                >
                  <option value="">Select a counsellor...</option>
                  {availableCounsellors.map((c: any) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.name} {c.status === 'online' && '(Online)'}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Reason for Escalation *</label>
                <select
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                >
                  <option value="">Select reason...</option>
                  <option value="risk_increase">Risk Level Increase</option>
                  <option value="clinical_need">Clinical Support Needed</option>
                  <option value="safeguarding">Safeguarding Concern</option>
                  <option value="complex_case">Case Complexity</option>
                  <option value="user_request">User Request</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Additional Notes</label>
                <textarea
                  value={escalateNotes}
                  onChange={(e) => setEscalateNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                  placeholder="Any additional context for the counsellor..."
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEscalateModal(false);
                  setEscalateCaseId(null);
                  setEscalateTo('');
                  setEscalateReason('');
                  setEscalateNotes('');
                }}
                className="flex-1 px-4 py-2 bg-card border border-border rounded-lg hover:bg-primary-dark"
              >
                Cancel
              </button>
              <button
                onClick={handleEscalateCase}
                disabled={!escalateTo || !escalateReason}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                Escalate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export case counts for parent component to use in nav badges
export function useCaseCounts(token: string | null) {
  const [cases, setCases] = useState<Case[]>([]);

  const loadCases = useCallback(async () => {
    if (!token) return;
    try {
      const caseList = await staffApi.getCases(token);
      setCases(caseList);
    } catch (err) {
      console.error('Failed to load cases for counts:', err);
    }
  }, [token]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const openCasesCount = cases.filter(c => c.status === 'open' || c.status === 'active').length;

  return {
    cases,
    openCasesCount,
    loadCases,
  };
}
