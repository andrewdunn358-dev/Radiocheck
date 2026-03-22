'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '@/lib/admin-api';
import HazardsSubTab from './HazardsSubTab';
import KPIsSubTab from './KPIsSubTab';
import IncidentsSubTab from './IncidentsSubTab';
import ModerationSubTab from './ModerationSubTab';
import ApprovalsSubTab from './ApprovalsSubTab';
import ComplianceSubTab from './ComplianceSubTab';
import ReportsSubTab from './ReportsSubTab';

const GOVERNANCE_SUBTABS = [
  { id: 'hazards', label: 'Hazard Register', icon: '⚠️' },
  { id: 'kpis', label: 'Safeguarding KPIs', icon: '📊' },
  { id: 'incidents', label: 'Incident Management', icon: '🚨' },
  { id: 'moderation', label: 'Peer Moderation', icon: '👥' },
  { id: 'approvals', label: 'CSO Approvals', icon: '✅' },
  { id: 'compliance', label: 'AI Compliance', icon: '🛡️' },
  { id: 'reports', label: 'Summary Reports', icon: '📄' },
];

type GovernanceSubTabType = 'hazards' | 'kpis' | 'incidents' | 'moderation' | 'approvals' | 'compliance' | 'reports';

interface GovernanceTabProps {
  token: string;
  userEmail?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function GovernanceTab({ token, userEmail, onSuccess, onError }: GovernanceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<GovernanceSubTabType>('hazards');
  
  // Data state for all sub-tabs
  const [hazards, setHazards] = useState<any[]>([]);
  const [governanceKPIs, setGovernanceKPIs] = useState<any>(null);
  const [governanceIncidents, setGovernanceIncidents] = useState<any[]>([]);
  const [peerReports, setPeerReports] = useState<any[]>([]);
  const [csoApprovals, setCsoApprovals] = useState<any[]>([]);
  const [governanceSummary, setGovernanceSummary] = useState<any>(null);
  const [scheduledReports, setScheduledReports] = useState<any[]>([]);
  const [complianceCheckResults, setComplianceCheckResults] = useState<any>(null);
  
  // Filter state
  const [kpiPeriod, setKpiPeriod] = useState(30);

  const loadSubTabData = useCallback(async (subtab: string) => {
    if (!token) return;
    try {
      switch (subtab) {
        case 'hazards':
          const hazardsData = await api.getHazards(token).catch(() => []);
          setHazards(Array.isArray(hazardsData) ? hazardsData : (hazardsData?.hazards || []));
          break;
        case 'kpis':
          const kpiData = await api.getGovernanceKPIs(token, kpiPeriod).catch(() => null);
          setGovernanceKPIs(kpiData);
          break;
        case 'incidents':
          const incidentsData = await api.getGovernanceIncidents(token).catch(() => []);
          setGovernanceIncidents(Array.isArray(incidentsData) ? incidentsData : (incidentsData?.incidents || []));
          break;
        case 'moderation':
          const reportsData = await api.getPeerReports(token, 'pending').catch(() => []);
          setPeerReports(Array.isArray(reportsData) ? reportsData : (reportsData?.reports || []));
          break;
        case 'approvals':
          const approvalsData = await api.getCSOApprovals(token).catch(() => []);
          setCsoApprovals(Array.isArray(approvalsData) ? approvalsData : (approvalsData?.approvals || []));
          break;
        case 'reports':
          const [summaryData, schedulesData] = await Promise.all([
            api.getGovernanceSummary(token).catch(() => null),
            api.getScheduledReports(token).catch(() => ({ schedules: [] })),
          ]);
          setGovernanceSummary(summaryData);
          setScheduledReports(schedulesData?.schedules || []);
          break;
      }
    } catch (err: any) {
      console.error('Failed to load governance sub-tab data:', err);
    }
  }, [token, kpiPeriod]);

  useEffect(() => {
    loadSubTabData(activeSubTab);
  }, [activeSubTab, loadSubTabData]);

  const handleExport = async () => {
    try {
      const data = await api.exportGovernanceData(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `governance_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onSuccess('Governance data exported');
    } catch (err: any) {
      onError('Failed to export: ' + err.message);
    }
  };

  return (
    <div data-testid="governance-tab">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Clinical Safety Governance</h2>
          <p className="text-sm text-gray-400">DCB0129-aligned governance, hazard management, and compliance</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => loadSubTabData(activeSubTab)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {GOVERNANCE_SUBTABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as GovernanceSubTabType)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeSubTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab Content */}
      {activeSubTab === 'hazards' && (
        <HazardsSubTab
          hazards={hazards}
          token={token}
          userEmail={userEmail}
          onSuccess={onSuccess}
          onError={onError}
          onRefresh={() => loadSubTabData('hazards')}
        />
      )}

      {activeSubTab === 'kpis' && (
        <KPIsSubTab
          governanceKPIs={governanceKPIs}
          kpiPeriod={kpiPeriod}
          setKpiPeriod={setKpiPeriod}
          onRefresh={() => loadSubTabData('kpis')}
        />
      )}

      {activeSubTab === 'incidents' && (
        <IncidentsSubTab governanceIncidents={governanceIncidents} />
      )}

      {activeSubTab === 'moderation' && (
        <ModerationSubTab
          peerReports={peerReports}
          token={token}
          userEmail={userEmail}
          onSuccess={onSuccess}
          onError={onError}
          onRefresh={() => loadSubTabData('moderation')}
        />
      )}

      {activeSubTab === 'approvals' && (
        <ApprovalsSubTab
          csoApprovals={csoApprovals}
          token={token}
          userEmail={userEmail}
          onSuccess={onSuccess}
          onError={onError}
          onRefresh={() => loadSubTabData('approvals')}
        />
      )}

      {activeSubTab === 'compliance' && (
        <ComplianceSubTab
          complianceCheckResults={complianceCheckResults}
          setComplianceCheckResults={setComplianceCheckResults}
          onSuccess={onSuccess}
        />
      )}

      {activeSubTab === 'reports' && (
        <ReportsSubTab
          token={token}
          governanceSummary={governanceSummary}
          setGovernanceSummary={setGovernanceSummary}
          scheduledReports={scheduledReports}
          onSuccess={onSuccess}
          onError={onError}
          onRefresh={() => loadSubTabData('reports')}
        />
      )}
    </div>
  );
}
