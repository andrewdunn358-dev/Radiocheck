'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/admin-api';
import type { ChatRoom } from '@/types/admin';

interface ChatsSubTabProps {
  chatRooms: ChatRoom[];
  token: string;
  onError: (message: string) => void;
}

export default function ChatsSubTab({ chatRooms, token, onError }: ChatsSubTabProps) {
  const [selectedChatHistory, setSelectedChatHistory] = useState<any[]>([]);
  const [showChatHistoryModal, setShowChatHistoryModal] = useState(false);

  const handleViewChat = async (roomId: string) => {
    try {
      const messages = await api.getChatMessages(token, roomId);
      setSelectedChatHistory(Array.isArray(messages) ? messages : messages?.messages || []);
      setShowChatHistoryModal(true);
    } catch (err) {
      onError('Failed to load chat history');
    }
  };

  return (
    <>
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-testid="chats-subtab">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Staff</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Messages</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {chatRooms.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No chat logs found</td>
              </tr>
            ) : (
              chatRooms.map((room) => (
                <tr key={room.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-400">{new Date(room.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      room.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{room.user_name || 'Anonymous'}</td>
                  <td className="px-4 py-3">{room.staff_name || 'N/A'}</td>
                  <td className="px-4 py-3">{room.message_count || 0}</td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => handleViewChat(room.id)}
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

      {/* Chat History Modal */}
      {showChatHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Chat History</h3>
              <button onClick={() => setShowChatHistoryModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {selectedChatHistory.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No messages in this chat</p>
              ) : (
                selectedChatHistory.map((msg: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded-lg ${msg.sender_type === 'staff' ? 'bg-gray-700 ml-8' : 'bg-blue-900/30 mr-8'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">{msg.sender_name || msg.sender_type || 'User'}</span>
                      <span className="text-xs text-gray-500">{new Date(msg.created_at || msg.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm">{msg.content || msg.message}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowChatHistoryModal(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
