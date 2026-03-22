'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, FileText, Download, RefreshCw, Heart } from 'lucide-react';
import { api, API_URL } from '@/lib/admin-api';

interface ComplianceTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function ComplianceTab({ token, onSuccess, onError }: ComplianceTabProps) {
  const [complianceData, setComplianceData] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);

  const loadCompliance = useCallback(async () => {
    if (!token) return;
    try {
      const [dashboard, incidentsData, complaintsData] = await Promise.all([
        api.getComplianceDashboard(token).catch(() => null),
        api.getComplianceIncidents(token).catch(() => ({ incidents: [] })),
        api.getComplianceComplaints(token).catch(() => ({ complaints: [] })),
      ]);
      setComplianceData(dashboard);
      setIncidents(incidentsData?.incidents || []);
      setComplaints(complaintsData?.complaints || []);
    } catch (err: any) {
      console.error('Compliance data not available:', err);
    }
  }, [token]);

  useEffect(() => {
    loadCompliance();
  }, [loadCompliance]);

  const handleSecurityReview = async () => {
    if (!token) return;
    try {
      await api.fetch('/compliance/security/automated-review', { token, method: 'GET' });
      onSuccess('Security review initiated');
      loadCompliance();
    } catch (err: any) {
      onError('Failed to run security review: ' + err.message);
    }
  };

  return (
    <div data-testid="compliance-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Compliance & Audit</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleSecurityReview}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
          >
            Run Security Review
          </button>
          <button onClick={loadCompliance} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">GDPR Consent</p>
          <p className="text-2xl font-bold text-green-400">{complianceData?.gdpr?.consent_rate || 0}%</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Data Exports</p>
          <p className="text-2xl font-bold">{complianceData?.gdpr?.data_exports_this_month || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Deletions</p>
          <p className="text-2xl font-bold">{complianceData?.gdpr?.account_deletions_this_month || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Open Complaints</p>
          <p className="text-2xl font-bold text-yellow-400">{complianceData?.complaints?.open_complaints || complaints.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Security Status</p>
          <p className={`text-xl font-bold ${
            complianceData?.security?.last_review_status === 'pass' ? 'text-green-400' :
            complianceData?.security?.last_review_status === 'fail' ? 'text-red-400' : 'text-gray-400'
          }`}>{complianceData?.security?.last_review_status || 'N/A'}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Open Incidents</p>
          <p className="text-2xl font-bold text-red-400">{complianceData?.security?.open_incidents || incidents.length}</p>
        </div>
      </div>

      {/* Staff Wellbeing Section */}
      {complianceData?.staff_wellbeing && (
        <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg border border-purple-700 p-4 mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-purple-400" />
            Staff Wellbeing
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-400">Check-ins This Week</p>
              <p className="text-2xl font-bold">{complianceData.staff_wellbeing.checkins_this_week || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Need Support</p>
              <p className={`text-2xl font-bold ${complianceData.staff_wellbeing.staff_needing_support > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {complianceData.staff_wellbeing.staff_needing_support || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Supervision Requests</p>
              <p className={`text-2xl font-bold ${complianceData.staff_wellbeing.pending_supervision_requests > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {complianceData.staff_wellbeing.pending_supervision_requests || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Security Incidents
          </h3>
          {incidents.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No open incidents</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {incidents.map((incident: any) => (
                <div key={incident.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      incident.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      incident.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {incident.severity?.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(incident.detected_at).toLocaleDateString()}</span>
                  </div>
                  <p className="font-medium">{incident.title}</p>
                  <p className="text-sm text-gray-400 mt-1">{incident.description?.substring(0, 80)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Complaints */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-yellow-400" />
            Open Complaints
          </h3>
          {complaints.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No open complaints</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {complaints.map((complaint: any) => (
                <div key={complaint.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      complaint.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      complaint.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {complaint.priority?.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">{complaint.status}</span>
                  </div>
                  <p className="font-medium">{complaint.subject}</p>
                  <p className="text-sm text-gray-400 mt-1">Category: {complaint.category}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Policy Documents Download Section */}
      <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Policy Documents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a 
            href={`${API_URL}/api/documents/download/SAFEGUARDING`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Download className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-medium">Safeguarding Policy</p>
              <p className="text-xs text-gray-400">PDF Document</p>
            </div>
          </a>
          <a 
            href={`${API_URL}/api/documents/download/GDPR_AUDIT`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Download className="w-5 h-5 text-blue-400" />
            <div>
              <p className="font-medium">GDPR Audit Report</p>
              <p className="text-xs text-gray-400">PDF Document</p>
            </div>
          </a>
          <a 
            href={`${API_URL}/api/documents/download/BACP_COMPLIANCE`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Download className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-medium">BACP Compliance</p>
              <p className="text-xs text-gray-400">PDF Document</p>
            </div>
          </a>
          <a 
            href={`${API_URL}/api/documents/download/INCIDENT_RESPONSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Download className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="font-medium">Incident Response Plan</p>
              <p className="text-xs text-gray-400">PDF Document</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
