'use client';

import { Shield, Check, Edit } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface HazardsSubTabProps {
  hazards: any[];
  token: string;
  userEmail?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export default function HazardsSubTab({ hazards, token, userEmail, onSuccess, onError, onRefresh }: HazardsSubTabProps) {
  const handleReview = async (hazardId: string) => {
    try {
      await api.reviewHazard(token, hazardId, userEmail || 'admin');
      onSuccess(`Hazard ${hazardId} marked as reviewed`);
      onRefresh();
    } catch (err: any) {
      onError('Failed to review: ' + err.message);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6" data-testid="hazards-subtab">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-yellow-400" />
          Clinical Safety Hazard Log
        </h3>
      </div>
      {hazards.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No hazards recorded. Click "Add Hazard" to create one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Title / Cause</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Severity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Likelihood</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Owner</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {hazards.map((hazard: any) => (
                <tr key={hazard.id || hazard.hazard_id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-mono text-sm font-bold">{hazard.hazard_id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{hazard.title}</div>
                    <div className="text-xs text-gray-400">{hazard.cause}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      hazard.severity === 'catastrophic' || hazard.severity === 5 ? 'bg-red-500/20 text-red-400' :
                      hazard.severity === 'major' || hazard.severity === 4 ? 'bg-orange-500/20 text-orange-400' :
                      hazard.severity === 'moderate' || hazard.severity === 3 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {hazard.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{hazard.likelihood}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      hazard.risk_rating >= 15 ? 'bg-red-500/30 text-red-300' :
                      hazard.risk_rating >= 10 ? 'bg-orange-500/30 text-orange-300' :
                      hazard.risk_rating >= 6 ? 'bg-yellow-500/30 text-yellow-300' :
                      'bg-green-500/30 text-green-300'
                    }`}>
                      {hazard.risk_rating}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      hazard.status === 'closed' ? 'bg-gray-500/20 text-gray-400' :
                      hazard.status === 'mitigated' ? 'bg-green-500/20 text-green-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {hazard.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{hazard.owner}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleReview(hazard.hazard_id)}
                        className="p-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                        title="Review"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button className="p-1 bg-blue-600 hover:bg-blue-700 rounded text-xs" title="Edit">
                        <Edit className="w-4 h-4" />
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
