'use client';

import { useState, useEffect, useCallback } from 'react';
import { staffApi, InternalMessage, TeamMember } from '@/lib/api';

export function useMessages(token: string | null) {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [newMessageTo, setNewMessageTo] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const response = await staffApi.getMessages(token);
      setMessages(response.messages || []);
      setUnreadMessageCount(response.unread_count || 0);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [token]);

  // Load team members (for messages dropdown)
  const loadTeam = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getTeamOnDuty(token);
      setTeamMembers(data);
    } catch (err) {
      console.error('Failed to load team:', err);
    }
  }, [token]);

  // Send message handler
  const handleSendInternalMessage = async () => {
    if (!token || !newMessageTo || !newMessageContent.trim()) return;
    try {
      await staffApi.sendMessage(token, {
        to_id: newMessageTo,
        content: newMessageContent.trim(),
      });
      setNewMessageContent('');
      loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Mark message read handler
  const handleMarkMessageRead = async (id: string) => {
    if (!token) return;
    try {
      await staffApi.markMessageRead(token, id);
      loadMessages();
    } catch (err) {
      console.error('Failed to mark message read:', err);
    }
  };

  // Initial load and polling
  useEffect(() => {
    if (!token) return;
    loadMessages();
    loadTeam();
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [token, loadMessages, loadTeam]);

  return {
    messages,
    unreadMessageCount,
    newMessageTo,
    newMessageContent,
    teamMembers,
    setNewMessageTo,
    setNewMessageContent,
    handleSendInternalMessage,
    handleMarkMessageRead,
    loadTeam,
  };
}
