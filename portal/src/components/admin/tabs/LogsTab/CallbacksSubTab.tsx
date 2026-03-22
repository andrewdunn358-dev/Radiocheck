'use client';

interface CallbacksSubTabProps {
  callbackLogs: any[];
}

export default function CallbacksSubTab({ callbackLogs }: CallbacksSubTabProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-testid="callbacks-subtab">
      <table className="w-full">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Phone</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Handled By</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {callbackLogs.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No callback logs found</td>
            </tr>
          ) : (
            callbackLogs.map((log: any) => (
              <tr key={log.id} className={`hover:bg-gray-700/50 ${log.request_type === 'urgent' ? 'bg-red-900/20' : ''}`}>
                <td className="px-4 py-3 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    log.request_type === 'urgent' ? 'bg-red-500/20 text-red-400' :
                    log.request_type === 'counsellor' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {log.request_type || 'peer'}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{log.name || 'Unknown'}</td>
                <td className="px-4 py-3 text-gray-400">{log.phone || '-'}</td>
                <td className="px-4 py-3">{log.handled_by_name || log.assigned_to_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    log.status === 'in_progress' || log.status === 'assigned' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {log.status || 'pending'}
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
