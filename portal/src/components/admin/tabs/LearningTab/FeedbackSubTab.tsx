'use client';

import { MessageSquare } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface FeedbackSubTabProps {
  token: string;
  responseFeedback: any[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

export default function FeedbackSubTab({
  token,
  responseFeedback,
  onSuccess,
  onError,
  onRefresh,
}: FeedbackSubTabProps) {
  const handleReviewFeedback = async (feedbackId: string, action: 'approve' | 'reject') => {
    try {
      await api.reviewFeedback(token, feedbackId, action);
      onSuccess(action === 'approve' ? 'Feedback reviewed' : 'Feedback dismissed');
      onRefresh();
    } catch (err: any) {
      onError('Failed: ' + err.message);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-400" />
        Response Feedback ({Array.isArray(responseFeedback) ? responseFeedback.length : 0})
      </h3>
      {!Array.isArray(responseFeedback) || responseFeedback.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No feedback pending review</p>
      ) : (
        <div className="space-y-3">
          {responseFeedback.map((item: any, index: number) => (
            <div key={item.id || index} className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  item.feedback_type === 'negative' ? 'bg-red-500/20 text-red-400' :
                  item.feedback_type === 'positive' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {item.feedback_type || 'neutral'}
                </span>
                <span className="text-xs text-gray-400">{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'N/A'}</span>
              </div>
              <p className="text-sm text-gray-300 mb-1"><strong>AI Response:</strong> {item.ai_response?.substring(0, 100) || 'N/A'}...</p>
              <p className="text-sm text-gray-300 mb-3"><strong>Feedback:</strong> {item.feedback_text || item.notes || 'No comments'}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleReviewFeedback(item.id, 'approve')}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  Mark Reviewed
                </button>
                <button 
                  onClick={() => handleReviewFeedback(item.id, 'reject')}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
