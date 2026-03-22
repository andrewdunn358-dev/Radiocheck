'use client';

import type { CallLog } from '@/types/admin';

interface CallsSubTabProps {
  callLogs: CallLog[];
}

export default function CallsSubTab({ callLogs }: CallsSubTabProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-testid="calls-subtab">
      <table className="w-full">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date/Time</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Contact Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Method</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Phone</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {callLogs.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No call logs found</td>
            </tr>
          ) : (
            callLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-3 text-gray-400">{new Date(log.timestamp || log.created_at || '').toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{log.contact_name || 'Unknown'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.contact_type === 'peer' ? 'bg-green-500/20 text-green-400' : 
                    log.contact_type === 'counsellor' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {log.contact_type || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.call_method === 'webrtc' ? 'bg-purple-500/20 text-purple-400' : 
                    log.call_method === 'phone' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {log.call_method || 'phone'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{log.contact_phone || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
