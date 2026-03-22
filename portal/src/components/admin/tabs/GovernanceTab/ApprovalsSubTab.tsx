'use client';

import { Check, X } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface ApprovalsSubTabProps {
  csoApprovals: any[];
  token: string;
  userEmail?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export default function ApprovalsSubTab({ csoApprovals, token, userEmail, onSuccess, onError, onRefresh }: ApprovalsSubTabProps) {
  const handleApprove = async (approvalId: string) => {
    const notes = prompt('Enter approval notes (optional):');
    try {
      await api.processCSOApproval(token, approvalId, true, userEmail || 'admin', notes || '');
      onSuccess('Approval granted');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  const handleDeny = async (approvalId: string) => {
    const notes = prompt('Enter denial reason:');
    if (!notes) return;
    try {
      await api.processCSOApproval(token, approvalId, false, userEmail || 'admin', notes);
      onSuccess('Approval denied');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6" data-testid="approvals-subtab">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">CSO Pending Approvals</h3>
      </div>
      {csoApprovals.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No pending approvals</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Requested By</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {csoApprovals.map((approval: any) => (
                <tr key={approval.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-mono text-sm">{approval.id?.substring(0, 12)}...</td>
                  <td className="px-4 py-3">{approval.request_type}</td>
                  <td className="px-4 py-3">{approval.description}</td>
                  <td className="px-4 py-3">{approval.requested_by}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {approval.requested_at ? new Date(approval.requested_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => handleDeny(approval.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Deny
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
