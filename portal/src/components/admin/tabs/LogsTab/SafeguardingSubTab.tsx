'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/admin-api';
import type { SafeguardingAlert } from '@/types/admin';

interface SafeguardingSubTabProps {
  safeguardingAlerts: SafeguardingAlert[];
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export default function SafeguardingSubTab({ 
  safeguardingAlerts, 
  token, 
  onSuccess, 
  onError, 
  onRefresh 
}: SafeguardingSubTabProps) {
  const [selectedSafeguardingAlert, setSelectedSafeguardingAlert] = useState<SafeguardingAlert | null>(null);
  const [showAlertDetailModal, setShowAlertDetailModal] = useState(false);

  const handleViewAlert = async (alert: SafeguardingAlert) => {
    try {
      const detail = await api.getSafeguardingAlertDetail(token, alert.id);
      setSelectedSafeguardingAlert(detail);
      setShowAlertDetailModal(true);
    } catch (err) {
      setSelectedSafeguardingAlert(alert);
      setShowAlertDetailModal(true);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.acknowledgeSafeguardingAlert(token, alertId);
      onSuccess('Alert acknowledged');
      onRefresh();
    } catch (err: any) {
      onError('Failed to acknowledge: ' + err.message);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await api.resolveSafeguardingAlert(token, alertId);
      onSuccess('Alert resolved');
      onRefresh();
    } catch (err: any) {
      onError('Failed to resolve: ' + err.message);
    }
  };

  const handleResolveFromModal = async () => {
    if (!selectedSafeguardingAlert) return;
    try {
      await api.resolveSafeguardingAlert(token, selectedSafeguardingAlert.id);
      onSuccess('Alert resolved');
      setShowAlertDetailModal(false);
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  return (
    <>
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-testid="safeguarding-subtab">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Score</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Session</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Location</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {safeguardingAlerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No safeguarding alerts</td>
              </tr>
            ) : (
              safeguardingAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-400 text-sm">{new Date(alert.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      alert.risk_level === 'imminent' || alert.risk_level === 'critical' ? 'bg-red-600 text-white' :
                      alert.risk_level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      alert.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {(alert.risk_level || 'unknown').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{alert.risk_score || alert.score || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{alert.session_id?.substring(0, 12) || '-'}...</td>
                  <td className="px-4 py-3 text-sm">
                    {alert.geo_city || alert.location_city || '-'}
                    {(alert.geo_country || alert.location_country) && `, ${alert.geo_country || alert.location_country}`}
                    {!alert.geo_city && !alert.location_city && alert.ip_address && <span className="text-gray-500">{alert.ip_address}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      alert.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      alert.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {alert.status || 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleViewAlert(alert)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                      >
                        View
                      </button>
                      {alert.status !== 'acknowledged' && alert.status !== 'resolved' && (
                        <button 
                          onClick={() => handleAcknowledge(alert.id)}
                          className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                        >
                          Ack
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button 
                          onClick={() => handleResolve(alert.id)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Safeguarding Alert Detail Modal */}
      {showAlertDetailModal && selectedSafeguardingAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${
                  selectedSafeguardingAlert.risk_level === 'imminent' || selectedSafeguardingAlert.risk_level === 'critical' ? 'text-red-500' :
                  selectedSafeguardingAlert.risk_level === 'high' ? 'text-orange-500' : 'text-yellow-500'
                }`} />
                Safeguarding Alert Details
              </h3>
              <button onClick={() => setShowAlertDetailModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-700/50 rounded p-3">
                <p className="text-xs text-gray-400">Risk Level</p>
                <p className={`text-lg font-bold ${
                  selectedSafeguardingAlert.risk_level === 'imminent' ? 'text-red-500' :
                  selectedSafeguardingAlert.risk_level === 'high' ? 'text-orange-500' : 'text-yellow-500'
                }`}>{(selectedSafeguardingAlert.risk_level || 'unknown').toUpperCase()}</p>
              </div>
              <div className="bg-gray-700/50 rounded p-3">
                <p className="text-xs text-gray-400">Risk Score</p>
                <p className="text-lg font-bold">{selectedSafeguardingAlert.risk_score || selectedSafeguardingAlert.score || '-'}</p>
              </div>
            </div>

            {/* Trigger Info */}
            {(selectedSafeguardingAlert.trigger_phrase || selectedSafeguardingAlert.triggered_indicators) && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
                <p className="text-xs text-red-400 mb-2">Triggered By</p>
                <p className="text-white font-medium">
                  {selectedSafeguardingAlert.trigger_phrase || selectedSafeguardingAlert.triggered_indicators?.join(', ')}
                </p>
                {selectedSafeguardingAlert.triggering_message && (
                  <p className="text-gray-300 mt-2 italic">&ldquo;{selectedSafeguardingAlert.triggering_message}&rdquo;</p>
                )}
              </div>
            )}

            {/* Location & Tracking Info */}
            <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2">Tracking Information</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-400">Location:</span> {selectedSafeguardingAlert.geo_city || selectedSafeguardingAlert.location_city || '-'}, {selectedSafeguardingAlert.geo_country || selectedSafeguardingAlert.location_country || '-'}</div>
                <div><span className="text-gray-400">IP:</span> {selectedSafeguardingAlert.ip_address || '-'}</div>
                <div><span className="text-gray-400">ISP:</span> {selectedSafeguardingAlert.isp || '-'}</div>
                <div><span className="text-gray-400">Timezone:</span> {selectedSafeguardingAlert.timezone || '-'}</div>
                <div className="col-span-2"><span className="text-gray-400">Device:</span> {selectedSafeguardingAlert.user_agent || '-'}</div>
              </div>
            </div>

            {/* Conversation History */}
            {selectedSafeguardingAlert.conversation_history && selectedSafeguardingAlert.conversation_history.length > 0 && (
              <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                <p className="text-xs text-gray-400 mb-2">Recent Conversation</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedSafeguardingAlert.conversation_history.slice(-6).map((msg: any, idx: number) => (
                    <div key={idx} className={`p-2 rounded text-sm ${msg.role === 'user' ? 'bg-blue-900/30' : 'bg-gray-600/50'}`}>
                      <span className="font-medium">{msg.role === 'user' ? 'User' : 'AI'}:</span> {msg.content}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAlertDetailModal(false)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                Close
              </button>
              {selectedSafeguardingAlert.status !== 'resolved' && (
                <button 
                  onClick={handleResolveFromModal}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
                >
                  Mark Resolved
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
