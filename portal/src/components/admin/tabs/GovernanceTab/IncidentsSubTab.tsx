'use client';

interface IncidentsSubTabProps {
  governanceIncidents: any[];
}

export default function IncidentsSubTab({ governanceIncidents }: IncidentsSubTabProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6" data-testid="incidents-subtab">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Incident Log</h3>
      </div>
      {governanceIncidents.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No incidents recorded</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Number</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Level</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {governanceIncidents.map((inc: any) => (
                <tr key={inc.id || inc.incident_number} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-mono text-sm font-bold">{inc.incident_number}</td>
                  <td className="px-4 py-3">{inc.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      inc.level?.includes('critical') || inc.level?.includes('4') ? 'bg-red-500/20 text-red-400' :
                      inc.level?.includes('high') || inc.level?.includes('3') ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {inc.level?.replace('level_', 'L').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      inc.status === 'closed' ? 'bg-gray-500/20 text-gray-400' :
                      inc.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {inc.created_at ? new Date(inc.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                      View
                    </button>
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
