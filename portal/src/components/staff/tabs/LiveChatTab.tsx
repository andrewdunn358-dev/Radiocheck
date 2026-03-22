'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare, RefreshCw, User, Clock, Shield, X, Send
} from 'lucide-react';
import { staffApi, LiveChatRoom } from '@/lib/api';

// Get API URL for direct fetch calls
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

interface LiveChatTabProps {
  token: string;
  user: any;
  webrtcUserId?: string;
  webrtcPhone: any;
  onPlayAlertSound: () => void;
}

export default function LiveChatTab({
  token,
  user,
  webrtcUserId,
  webrtcPhone,
  onPlayAlertSound,
}: LiveChatTabProps) {
  // Chat rooms state
  const [liveChatRooms, setLiveChatRooms] = useState<LiveChatRoom[]>([]);
  
  // Active chat state
  const [activeChatRoom, setActiveChatRoom] = useState<LiveChatRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // AI Feedback modal state
  const [showAiFeedbackModal, setShowAiFeedbackModal] = useState(false);
  const [aiFeedbackData, setAiFeedbackData] = useState<{ messageId: string; message: string; response: string } | null>(null);
  const [aiFeedbackRating, setAiFeedbackRating] = useState<'good' | 'needs_improvement' | 'inappropriate' | 'missed_risk' | null>(null);
  const [aiFeedbackComment, setAiFeedbackComment] = useState('');
  
  // Tracking for sound alerts
  const prevChatCountRef = useRef<number>(0);

  // Load live chats function
  const loadLiveChats = useCallback(async () => {
    if (!token) return;
    try {
      const rooms = await staffApi.getLiveChatRooms(token);
      setLiveChatRooms(rooms);
    } catch (err) {
      console.error('Failed to load live chats:', err);
    }
  }, [token]);

  // Initial load and polling - CRITICAL: Real-time polling for chat requests
  useEffect(() => {
    if (!token) return;
    
    // Initial load
    loadLiveChats();
    
    // Poll for chats every 30 seconds
    const chatInterval = setInterval(loadLiveChats, 30000);
    
    return () => {
      clearInterval(chatInterval);
    };
  }, [token, loadLiveChats]);

  // Check for new chats and play sound - CRITICAL: Real-time sound notifications
  useEffect(() => {
    const waitingChatCount = liveChatRooms.filter(r => r.status === 'waiting').length;
    
    // Play sound if new waiting chats appeared
    if (waitingChatCount > prevChatCountRef.current) {
      onPlayAlertSound();
    }
    
    prevChatCountRef.current = waitingChatCount;
  }, [liveChatRooms, onPlayAlertSound]);

  // AUTO-OPEN CHAT when chat_request_confirmed event is dispatched
  // CRITICAL: This is the RELIABLE way to open chat - listens for custom event from WebRTC hook
  // This matches the legacy portal behavior (webrtc-phone.js calling showLiveChatModal directly)
  useEffect(() => {
    const handleChatConfirmed = async (event: Event) => {
      const customEvent = event as CustomEvent<{ 
        room_id: string; 
        user_id: string; 
        user_name?: string; 
        session_id?: string;
      }>;
      const { room_id: roomId, user_id: userId, user_name: userName } = customEvent.detail;
      
      // CRITICAL: Use webrtcUserId (callable_user_id) for joining chat, NOT user.id
      // The chat room was created with the Socket.IO user_id which is callable_user_id
      const staffIdForChat = webrtcUserId || user?.id;
      
      if (!roomId || !token || !staffIdForChat || !user?.name) {
        console.log('[LiveChatTab] Cannot open chat - missing data:', { roomId, hasToken: !!token, staffIdForChat, userName: user?.name });
        return;
      }
      
      console.log('[LiveChatTab] *** CHAT CONFIRMED EVENT RECEIVED ***');
      console.log('[LiveChatTab] Opening chat room:', roomId, 'for user:', userId, userName);
      console.log('[LiveChatTab] Using staff ID for join:', staffIdForChat, '(webrtcUserId:', webrtcUserId, ', user.id:', user?.id, ')');
      
      try {
        // Join the chat room via API (like legacy joinLiveChat)
        // MUST use webrtcUserId (same as Socket.IO registration) to match room's staff_id
        await staffApi.joinLiveChat(token, roomId, staffIdForChat, user.name);
        
        // Get existing messages
        const messages = await staffApi.getLiveChatMessages(token, roomId);
        
        // Create room object and set as active
        const room: LiveChatRoom = {
          id: roomId,
          room_id: roomId,
          user_id: userId,
          user_name: userName || 'Veteran',
          status: 'active',
          staff_id: staffIdForChat,
          staff_name: user.name,
          created_at: new Date().toISOString(),
        };
        
        // Open the chat modal
        setActiveChatRoom(room);
        setChatMessages(messages);
        
        // Reload live chats to ensure list is up to date
        loadLiveChats();
        
        console.log('[LiveChatTab] Chat room opened successfully via event handler');
      } catch (err) {
        console.error('[LiveChatTab] Failed to open chat room:', err);
      }
    };
    
    // Listen for custom event dispatched by useWebRTCPhone
    window.addEventListener('chat_request_confirmed', handleChatConfirmed);
    
    return () => {
      window.removeEventListener('chat_request_confirmed', handleChatConfirmed);
    };
  }, [token, user?.id, user?.name, webrtcUserId, loadLiveChats]);

  // Listen for real-time chat messages via Socket.IO
  // CRITICAL: Real-time message handler for live chat
  useEffect(() => {
    const handleNewMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{
        room_id: string;
        message: string;
        sender_id: string;
        sender_name: string;
        sender_type: string;
        timestamp: string;
        message_id: string;
      }>;
      const data = customEvent.detail;
      
      console.log('[LiveChatTab] Received new_chat_message:', data);
      
      // Only add to messages if this is for the active chat room
      // AND the sender is not us (avoid duplicates from our own messages)
      const currentRoomId = activeChatRoom?.id || activeChatRoom?.room_id || activeChatRoom?._id;
      const myId = webrtcUserId || user?.id;
      
      if (data.room_id === currentRoomId && data.sender_id !== myId) {
        const newMsg = {
          id: data.message_id,
          text: data.message,
          sender: data.sender_type === 'staff' ? 'staff' : 'user',
          sender_name: data.sender_name,
          timestamp: data.timestamp
        };
        setChatMessages(prev => {
          // Prevent duplicates by checking message_id
          if (prev.some(m => m.id === data.message_id)) {
            return prev;
          }
          return [...prev, newMsg];
        });
      }
      
      // Reload live chats to update the list view
      loadLiveChats();
    };
    
    window.addEventListener('new_chat_message', handleNewMessage);
    
    return () => {
      window.removeEventListener('new_chat_message', handleNewMessage);
    };
  }, [activeChatRoom, webrtcUserId, user?.id, loadLiveChats]);

  // Handler functions
  const handleJoinChat = async (room: LiveChatRoom) => {
    if (!token || !user?.id || !user?.name) return;
    try {
      const roomId = room.id || room.room_id || room._id;
      if (!roomId) {
        console.error('No room ID found');
        return;
      }
      await staffApi.joinLiveChat(token, roomId, user.id, user.name);
      const messages = await staffApi.getLiveChatMessages(token, roomId);
      setActiveChatRoom(room);
      setChatMessages(messages);
      loadLiveChats();
    } catch (err) {
      console.error('Failed to join chat:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!token || !activeChatRoom || !newMessage.trim()) return;
    try {
      const roomId = activeChatRoom.id || activeChatRoom.room_id || activeChatRoom._id;
      if (!roomId) {
        console.error('No room ID found');
        return;
      }
      
      // CRITICAL: Use Socket.IO for real-time delivery (like legacy portal)
      const messageSent = webrtcPhone.sendChatMessage(
        roomId,
        newMessage,
        webrtcUserId || user?.id || '',
        user?.name || 'Staff',
        'staff'
      );
      
      // Also persist to database via REST API
      await staffApi.sendLiveChatMessage(token, roomId, newMessage);
      
      // Add message to local state immediately for responsive UI
      const newMsg = {
        id: `msg_${Date.now()}`,
        text: newMessage,
        sender: 'staff',
        sender_name: user?.name || 'Staff',
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, newMsg]);
      
      setNewMessage('');
      
      if (!messageSent) {
        console.warn('Socket message not sent - relying on API persistence');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleEndChat = async () => {
    if (!token || !activeChatRoom) return;
    try {
      const roomId = activeChatRoom.id || activeChatRoom.room_id || activeChatRoom._id;
      if (!roomId) {
        console.error('No room ID found');
        return;
      }
      await staffApi.endLiveChat(token, roomId);
      setActiveChatRoom(null);
      setChatMessages([]);
      loadLiveChats();
    } catch (err) {
      console.error('Failed to end chat:', err);
    }
  };

  // Submit AI feedback
  const submitAiFeedback = async () => {
    if (!token || !aiFeedbackData || !aiFeedbackRating) return;
    try {
      await fetch(`${API_URL}/api/ai-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: activeChatRoom?.room_id || 'staff_review',
          message_index: 0,
          ai_character: 'support_ai',
          rating: aiFeedbackRating === 'good' ? 5 : aiFeedbackRating === 'needs_improvement' ? 3 : 1,
          feedback_type: aiFeedbackRating,
          comment: aiFeedbackComment,
          user_message: aiFeedbackData.message,
          ai_response: aiFeedbackData.response,
        })
      });
      setShowAiFeedbackModal(false);
      setAiFeedbackData(null);
      setAiFeedbackRating(null);
      setAiFeedbackComment('');
      alert('Feedback submitted. Thank you!');
    } catch (err) {
      console.error('Failed to submit AI feedback:', err);
    }
  };

  // Helper functions
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

  // Counts for badges
  const waitingChatsCount = liveChatRooms.filter(r => r.status === 'waiting').length;

  return (
    <div data-testid="livechat-tab">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-secondary" />
          Live Support Requests
        </h1>
        <button onClick={loadLiveChats} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {liveChatRooms.filter(r => r.status !== 'ended').map((room) => {
          // Calculate message count and get last message
          const messageCount = room.messages?.length || 0;
          const lastMessage = room.messages && room.messages.length > 0 
            ? room.messages[room.messages.length - 1] 
            : null;
            
          return (
          <div key={room._id || room.id} className={`bg-card border rounded-xl p-6 ${
            room.status === 'waiting' ? 'border-yellow-500' : 
            room.safeguarding_alert_id ? 'border-red-500' : 'border-border'
          }`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="font-semibold">{room.user_name || 'Anonymous User'}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    room.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                    room.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {room.status}
                  </span>
                  {/* Staff type badge */}
                  {room.staff_type && (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                      {room.staff_type === 'counsellor' ? 'Counsellor' : 'Peer'} Request
                    </span>
                  )}
                </div>
                
                {/* Safeguarding Alert Link - IMPORTANT */}
                {room.safeguarding_alert_id && (
                  <div className="flex items-center gap-2 mb-2 text-red-400 text-sm">
                    <Shield className="w-4 h-4" />
                    <span className="font-semibold">🚨 Linked to Safeguarding Alert</span>
                    {room.risk_level && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        room.risk_level === 'RED' ? 'bg-red-500 text-white' :
                        room.risk_level === 'AMBER' ? 'bg-amber-500 text-white' :
                        'bg-yellow-500 text-white'
                      }`}>
                        {room.risk_level}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Meta info */}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Waiting: {formatTimeAgo(room.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    {messageCount} messages
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                {room.status === 'waiting' && (
                  <button
                    onClick={() => handleJoinChat(room)}
                    className="px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light font-semibold"
                  >
                    Join Chat
                  </button>
                )}
                {room.status === 'active' && room.staff_id === user?.id && (
                  <button
                    onClick={() => handleJoinChat(room)}
                    className="px-4 py-2 bg-primary-light text-white rounded-lg hover:bg-primary"
                  >
                    Continue Chat
                  </button>
                )}
              </div>
            </div>
            
            {/* Message preview */}
            {lastMessage ? (
              <div className="bg-primary-dark/50 rounded-lg p-3 mt-3">
                <p className="text-xs text-gray-500 mb-1">Latest message:</p>
                <p className="text-sm text-gray-300 truncate">
                  &quot;{lastMessage.text?.substring(0, 100)}{(lastMessage.text?.length || 0) > 100 ? '...' : ''}&quot;
                </p>
              </div>
            ) : (
              <div className="bg-primary-dark/50 rounded-lg p-3 mt-3">
                <p className="text-sm text-gray-500 italic">No messages yet - user just connected</p>
              </div>
            )}
          </div>
        )})}
        {liveChatRooms.filter(r => r.status !== 'ended').length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No active chat requests</p>
          </div>
        )}
      </div>

      {/* Live Chat Modal */}
      {activeChatRoom && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Chat with {activeChatRoom.user_name || 'User'}</h3>
                <p className="text-sm text-gray-400">Room: {activeChatRoom.room_id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEndChat}
                  className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                >
                  End Chat
                </button>
                <button
                  onClick={() => { setActiveChatRoom(null); setChatMessages([]); }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg max-w-[80%] ${
                    msg.sender === 'staff' 
                      ? 'bg-secondary/20 ml-auto' 
                      : msg.sender === 'ai' || msg.is_ai_response
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-primary-light/30'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs text-gray-400 mb-1">
                      {msg.sender === 'staff' ? 'You' : msg.sender === 'ai' || msg.is_ai_response ? 'AI Assistant' : 'User'}
                    </p>
                    {/* AI Feedback button for AI responses */}
                    {(msg.sender === 'ai' || msg.is_ai_response) && (
                      <button
                        data-testid={`ai-feedback-btn-${i}`}
                        onClick={() => {
                          // Find the user message this AI was responding to
                          const userMsg = chatMessages.slice(0, i).reverse().find(m => m.sender === 'user' || (!m.is_ai_response && m.sender !== 'staff'));
                          setAiFeedbackData({
                            messageId: msg.id || msg._id || `msg_${i}`,
                            message: userMsg?.text || 'Unknown user message',
                            response: msg.text
                          });
                          setShowAiFeedbackModal(true);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Feedback
                      </button>
                    )}
                  </div>
                  <p>{msg.text}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-secondary text-primary-dark rounded-lg disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Feedback Modal */}
      {showAiFeedbackModal && aiFeedbackData && (
        <div data-testid="ai-feedback-modal" className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-card rounded-2xl p-6 max-w-2xl w-full mx-4 my-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-secondary" />
              AI Response Feedback
            </h2>
            
            <div className="space-y-4 mb-6">
              <div className="bg-primary-dark rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">User message:</p>
                <p className="text-sm">{aiFeedbackData.message}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-xs text-blue-400 mb-1">AI response:</p>
                <p className="text-sm">{aiFeedbackData.response}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-3">Rate this response:</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'good', label: 'Good Response', icon: '✓', color: 'border-green-500 bg-green-500/10 text-green-400' },
                  { value: 'needs_improvement', label: 'Needs Improvement', icon: '!', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-400' },
                  { value: 'inappropriate', label: 'Inappropriate', icon: '✗', color: 'border-red-500 bg-red-500/10 text-red-400' },
                  { value: 'missed_risk', label: 'Missed Risk', icon: '⚠', color: 'border-orange-500 bg-orange-500/10 text-orange-400' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setAiFeedbackRating(option.value as any)}
                    className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${
                      aiFeedbackRating === option.value ? option.color : 'border-border hover:border-gray-600'
                    }`}
                  >
                    <span>{option.icon}</span>
                    <span className="text-sm">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Additional comments:</label>
              <textarea
                value={aiFeedbackComment}
                onChange={(e) => setAiFeedbackComment(e.target.value)}
                className="w-full p-3 rounded-lg bg-primary-dark border border-border focus:border-secondary outline-none"
                placeholder="What could be improved? What was missed?"
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowAiFeedbackModal(false);
                  setAiFeedbackData(null);
                  setAiFeedbackRating(null);
                  setAiFeedbackComment('');
                }}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                onClick={submitAiFeedback}
                disabled={!aiFeedbackRating}
                className="flex-1 px-4 py-3 rounded-lg bg-secondary text-black hover:bg-secondary/90 transition disabled:opacity-50"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export chat counts for parent component to use in nav badges
export function useLiveChatCounts(token: string | null) {
  const [liveChatRooms, setLiveChatRooms] = useState<LiveChatRoom[]>([]);

  const loadLiveChats = useCallback(async () => {
    if (!token) return;
    try {
      const rooms = await staffApi.getLiveChatRooms(token);
      setLiveChatRooms(rooms);
    } catch (err) {
      console.error('Failed to load chats for counts:', err);
    }
  }, [token]);

  useEffect(() => {
    loadLiveChats();
    const interval = setInterval(loadLiveChats, 30000);
    return () => clearInterval(interval);
  }, [loadLiveChats]);

  const waitingChatsCount = liveChatRooms.filter(r => r.status === 'waiting').length;

  return {
    liveChatRooms,
    waitingChatsCount,
    loadLiveChats,
  };
}
