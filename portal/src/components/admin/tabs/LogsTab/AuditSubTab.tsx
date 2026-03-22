'use client';

import { useState } from 'react';

interface AuditSubTabProps {
  adminAuditLogs: any[];
}

export default function AuditSubTab({ adminAuditLogs }: AuditSubTabProps) {
  const [auditEventFilter, setAuditEventFilter] = useState<string>('');

  const filteredLogs = adminAuditLogs.filter(log => 
    !auditEventFilter || log.event_type?.startsWith(auditEventFilter)
  );

  return (
    <div className="space-y-4" data-testid="audit-subtab">
      {/* Audit filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-400">Filter by type:</label>
        <select 
          value={auditEventFilter}
          onChange={(e) => setAuditEventFilter(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="">All Events</option>
          <option value="auth.">Authentication</option>
          <option value="safeguarding.">Safeguarding</option>
          <option value="data.">Data Access</option>
          <option value="admin.">Admin Actions</option>
          <option value="support.">Support</option>
        </select>
      </div>
      
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Event Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Outcome</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit logs found</td>
              </tr>
            ) : (
              filteredLogs.map((log: any) => {
                // Color-code event types
                const eventColor = 
                  log.event_type?.startsWith('auth.') ? 'bg-blue-500/20 text-blue-400' :
                  log.event_type?.startsWith('safeguarding.') ? 'bg-red-500/20 text-red-400' :
                  log.event_type?.startsWith('data.') ? 'bg-purple-500/20 text-purple-400' :
                  log.event_type?.startsWith('admin.') ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400';
                
                return (
                  <tr key={log.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-400 text-sm">{new Date(log.created_at || log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${eventColor}`}>
                        {log.event_type || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{log.user_email || log.user_id || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.outcome === 'success' ? 'bg-green-500/20 text-green-400' :
                        log.outcome === 'failure' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {log.outcome || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.risk_level && (
                        <span className={`px-2 py-1 rounded text-xs ${
                          log.risk_level === 'high' || log.risk_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                          log.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {log.risk_level}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate" title={log.details}>
                      {log.details || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
