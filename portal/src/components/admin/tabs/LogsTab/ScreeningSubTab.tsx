'use client';

interface ScreeningSubTabProps {
  screeningLogs: any[];
}

export default function ScreeningSubTab({ screeningLogs }: ScreeningSubTabProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-testid="screening-subtab">
      <table className="w-full">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Risk Score</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Responses</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {screeningLogs.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No screening submissions found</td>
            </tr>
          ) : (
            screeningLogs.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-3 text-gray-400">{new Date(log.created_at || log.submitted_at).toLocaleString()}</td>
                <td className="px-4 py-3">{log.user_name || log.session_id?.substring(0, 12) || 'Anonymous'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    (log.risk_score || 0) >= 8 ? 'bg-red-500/20 text-red-400' :
                    (log.risk_score || 0) >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {log.risk_score || log.total_score || 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{log.responses?.length || log.questions_answered || 0} questions</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.status === 'reviewed' ? 'bg-green-500/20 text-green-400' :
                    log.status === 'flagged' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {log.status || 'pending'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button 
                    onClick={() => {
                      // View screening details - could be expanded
                    }}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
