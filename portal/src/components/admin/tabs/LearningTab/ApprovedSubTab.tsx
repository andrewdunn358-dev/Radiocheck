'use client';

import { Check } from 'lucide-react';

interface ApprovedSubTabProps {
  approvedLearnings: any[];
}

export default function ApprovedSubTab({ approvedLearnings }: ApprovedSubTabProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Check className="w-5 h-5 text-green-400" />
        Approved Learnings ({approvedLearnings.length})
      </h3>
      {approvedLearnings.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No approved learnings yet</p>
      ) : (
        <div className="space-y-3">
          {approvedLearnings.map((item: any, index: number) => (
            <div key={item.id || index} className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  item.category === 'safety' ? 'bg-red-500/20 text-red-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {item.category || 'general'}
                </span>
                <span className="text-xs text-gray-400">
                  Approved by {item.approved_by || 'admin'} on {item.approved_at ? new Date(item.approved_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <p className="text-sm text-gray-300">{item.context || item.content || 'N/A'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
