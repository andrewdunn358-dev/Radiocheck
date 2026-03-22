'use client';

import { Check, AlertTriangle, X } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface ModerationSubTabProps {
  peerReports: any[];
  token: string;
  userEmail?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export default function ModerationSubTab({ peerReports, token, userEmail, onSuccess, onError, onRefresh }: ModerationSubTabProps) {
  const handleAction = async (reportId: string, action: string) => {
    try {
      await api.takeModerationAction(token, reportId, action, userEmail || 'admin');
      onSuccess(action === 'reviewed' ? 'Report reviewed' : action === 'warning_issued' ? 'Warning issued' : 'User suspended');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6" data-testid="moderation-subtab">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Peer Report Queue</h3>
      </div>
      {peerReports.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No pending reports - all clear!</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Report ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Reported User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Reason</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {peerReports.map((report: any) => (
                <tr key={report.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-mono text-sm">{report.id?.substring(0, 12)}...</td>
                  <td className="px-4 py-3">{report.reported_user_id}</td>
                  <td className="px-4 py-3">{report.reason}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {report.created_at ? new Date(report.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAction(report.id, 'reviewed')}
                        className="p-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAction(report.id, 'warning_issued')}
                        className="p-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                        title="Warn"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAction(report.id, 'suspended')}
                        className="p-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        title="Suspend"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
