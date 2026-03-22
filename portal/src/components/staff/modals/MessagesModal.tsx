'use client';

import { Mail, X, Send } from 'lucide-react';
import { InternalMessage, TeamMember } from '@/lib/api';

interface MessagesModalProps {
  messages: InternalMessage[];
  teamMembers: TeamMember[];
  userId: string | undefined;
  unreadCount: number;
  newMessageTo: string;
  newMessageContent: string;
  onNewMessageToChange: (to: string) => void;
  onNewMessageContentChange: (content: string) => void;
  onSendMessage: () => void;
  onMarkRead: (id: string) => void;
  onClose: () => void;
}

// Helper function
const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
};

export default function MessagesModal({
  messages,
  teamMembers,
  userId,
  unreadCount,
  newMessageTo,
  newMessageContent,
  onNewMessageToChange,
  onNewMessageContentChange,
  onSendMessage,
  onMarkRead,
  onClose,
}: MessagesModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Internal Messages
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{unreadCount}</span>
            )}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-primary-dark rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* New Message Form */}
        <div className="p-4 border-b border-border bg-primary-dark/50">
          <div className="flex gap-2">
            <select
              value={newMessageTo}
              onChange={(e) => onNewMessageToChange(e.target.value)}
              className="flex-shrink-0 px-3 py-2 bg-primary-dark border border-border rounded-lg text-sm"
            >
              <option value="">Send to...</option>
              {teamMembers.filter(m => m.id !== userId).map(member => (
                <option key={member.id} value={member.id}>{member.name} ({member.role})</option>
              ))}
            </select>
            <input
              type="text"
              value={newMessageContent}
              onChange={(e) => onNewMessageContentChange(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 bg-primary-dark border border-border rounded-lg text-sm"
              onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
            />
            <button
              onClick={onSendMessage}
              disabled={!newMessageTo || !newMessageContent.trim()}
              className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/80 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No messages yet</p>
          ) : (
            messages.map(msg => {
              const isFromMe = msg.from_id === userId;
              const isUnread = !msg.read && msg.to_id === userId;
              return (
                <div 
                  key={msg.id} 
                  className={`p-3 rounded-lg ${isFromMe ? 'bg-secondary/20 ml-8' : 'bg-primary-dark mr-8'} ${isUnread ? 'border-l-4 border-blue-500' : ''}`}
                  onClick={() => isUnread && onMarkRead(msg.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">
                      {isFromMe ? `To: ${msg.to_name}` : `From: ${msg.from_name}`}
                    </span>
                    <span className="text-xs text-gray-500">{formatTimeAgo(msg.created_at)}</span>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
