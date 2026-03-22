'use client';

interface PanicSubTabProps {
  panicLogs: any[];
}

export default function PanicSubTab({ panicLogs }: PanicSubTabProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-testid="panic-subtab">
      <table className="w-full">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Location</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Message</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Responded By</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {panicLogs.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No panic alerts found</td>
            </tr>
          ) : (
            panicLogs.map((log: any) => (
              <tr key={log.id} className={`hover:bg-gray-700/50 ${log.status === 'active' ? 'bg-red-900/30 animate-pulse' : ''}`}>
                <td className="px-4 py-3 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{log.user_name || 'Unknown'}</td>
                <td className="px-4 py-3 text-sm">{log.location || log.geo_city || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{log.message?.substring(0, 50) || '-'}{log.message?.length > 50 ? '...' : ''}</td>
                <td className="px-4 py-3">{log.responded_by_name || log.acknowledged_by || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    log.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                    log.status === 'acknowledged' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {log.status || 'active'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
