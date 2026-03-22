'use client';

import { Eye } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface QueueSubTabProps {
  token: string;
  userId?: string;
  moderationQueue: any[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export default function QueueSubTab({
  token,
  userId,
  moderationQueue,
  onSuccess,
  onError,
  onRefresh,
}: QueueSubTabProps) {
  const handleApprove = async (itemId: string) => {
    if (!token) return;
    try {
      await api.fetch(`/learning/approve/${itemId}?admin_id=${userId}`, { 
        token, 
        method: 'PUT',
        body: JSON.stringify({ approved: true })
      });
      onSuccess('Learning approved');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  const handleReject = async (itemId: string) => {
    if (!token) return;
    try {
      await api.fetch(`/learning/approve/${itemId}?admin_id=${userId}`, { 
        token, 
        method: 'PUT',
        body: JSON.stringify({ approved: false })
      });
      onSuccess('Learning rejected');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Eye className="w-5 h-5 text-yellow-400" />
        Pending Approval ({moderationQueue.length})
      </h3>
      {moderationQueue.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No items pending review</p>
      ) : (
        <div className="space-y-3">
          {moderationQueue.map((item: any, index: number) => (
            <div key={item.id || index} className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  item.category === 'safety' ? 'bg-red-500/20 text-red-400' :
                  item.category === 'clinical' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {item.category || 'general'}
                </span>
                <span className="text-xs text-gray-400">{item.submitted_by || 'system'}</span>
              </div>
              <p className="text-sm text-gray-300 mb-1"><strong>Context:</strong> {item.context?.substring(0, 100) || 'N/A'}...</p>
              <p className="text-sm text-gray-300 mb-3"><strong>Response:</strong> {item.ai_response_pattern?.substring(0, 100) || item.content?.substring(0, 100) || 'N/A'}...</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleApprove(item.id)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  Approve
                </button>
                <button 
                  onClick={() => handleReject(item.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
