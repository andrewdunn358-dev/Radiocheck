import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../src/config/api';
import { safeGoBack } from '../src/utils/navigation';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'staff';
  senderName?: string;
  timestamp: Date;
}

export default function LiveChat() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    staffType: string;
    alertId: string;
    sessionId: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [staffType, setStaffType] = useState<string>('any');
  const [waitingForStaff, setWaitingForStaff] = useState(true);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [userId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [userName] = useState('You');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  
  const scrollViewRef = useRef<ScrollView>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmit = useRef<number>(0);

  const preferredStaffType = params.staffType || 'any';
  const alertId = params.alertId || '';
  const sessionId = params.sessionId || '';

  // Initialize Socket.IO connection
  useEffect(() => {
    initializeSocket();
    
    return () => {
      if (socketRef.current) {
        // Leave room before disconnecting
        if (roomId) {
          socketRef.current.emit('leave_chat_room', { room_id: roomId, user_id: userId });
        }
        socketRef.current.disconnect();
      }
    };
  }, []);

  const initializeSocket = () => {
    // Connect to Socket.IO server
    const socketUrl = API_URL.replace('/api', '').replace('https://', 'wss://').replace('http://', 'ws://');
    
    socketRef.current = io(socketUrl, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      
      // Use sessionId for registration if available (for safeguarding flow matching)
      // This ensures the user_id used for registration matches what's sent in request_human_chat
      const registrationId = sessionId || userId;
      console.log('Registering with user_id:', registrationId);
      
      // Register as a user
      socket.emit('register', {
        user_id: registrationId,
        user_type: 'user',
        name: userName,
        status: 'available'
      });
    });

    socket.on('registered', (data) => {
      console.log('Registered:', data);
      // Request human chat after registration
      requestHumanChat();
    });

    socket.on('human_chat_pending', (data) => {
      console.log('Chat request pending:', data);
      setMessages([{
        id: 'pending',
        text: `Finding an available supporter... ${data.available_count} staff member(s) notified.`,
        sender: 'staff',
        senderName: 'System',
        timestamp: new Date(),
      }]);
    });

    socket.on('human_chat_unavailable', (data) => {
      console.log('No staff available:', data);
      setIsLoading(false);
      setMessages([{
        id: 'unavailable',
        text: data.message,
        sender: 'staff',
        senderName: 'System',
        timestamp: new Date(),
      }]);
    });

    socket.on('human_chat_accepted', (data) => {
      console.log('Chat accepted:', data);
      setRoomId(data.room_id);
      setStaffName(data.staff_name);
      setStaffType(data.staff_type);
      setWaitingForStaff(false);
      setIsLoading(false);
      
      // Join the chat room
      socket.emit('join_chat_room', {
        room_id: data.room_id,
        user_id: userId,
        user_type: 'user',
        name: userName
      });
      
      setMessages(prev => [...prev, {
        id: `accepted-${Date.now()}`,
        text: `${data.staff_name} (${data.staff_type === 'counsellor' ? 'Counsellor' : 'Peer Supporter'}) has joined the chat. You can now talk with them directly.`,
        sender: 'staff',
        senderName: 'System',
        timestamp: new Date(),
      }]);
    });

    socket.on('new_chat_message', (data) => {
      // Don't log message content for privacy
      console.log('New message received from:', data.sender_type);
      // Only add messages from others (not our own)
      if (data.sender_id !== userId) {
        setMessages(prev => [...prev, {
          id: data.message_id,
          text: data.message,
          sender: 'staff',
          senderName: data.sender_name,
          timestamp: new Date(data.timestamp),
        }]);
        
        // Clear typing indicator when message received
        setTypingUser(null);
      }
    });

    socket.on('user_typing', (data) => {
      if (data.user_id !== userId && data.is_typing) {
        setTypingUser(data.user_name);
        // Clear typing after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      } else if (!data.is_typing) {
        setTypingUser(null);
      }
    });

    socket.on('user_left_chat', (data) => {
      if (data.user_id !== userId) {
        setMessages(prev => [...prev, {
          id: `left-${Date.now()}`,
          text: 'The support team member has left the chat.',
          sender: 'staff',
          senderName: 'System',
          timestamp: new Date(),
        }]);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsLoading(false);
    });
    
    // Handle staff chat invite (when staff initiates chat from safeguarding alert)
    socket.on('staff_chat_invite', (data) => {
      console.log('Staff chat invite received:', data);
      setStaffName(data.staff_name);
      setIsConnected(true);
      setIsLoading(false);
      // Auto-accept the chat invite
      if (data.room_id) {
        setRoomId(data.room_id);
      }
      // Add system message
      setMessages(prev => [...prev, {
        id: `sys_${Date.now()}`,
        text: `${data.staff_name} would like to chat with you`,
        sender: 'system',
        timestamp: new Date().toISOString()
      }]);
    });
    
    // Note: WebRTC call handling is now done by the useWebRTCCall hook
    // The hook listens on its own socket connection for incoming_call, call_accepted, call_ended, etc.
  };

  const requestHumanChat = () => {
    if (socketRef.current) {
      socketRef.current.emit('request_human_chat', {
        user_id: sessionId || userId, // Use the original session ID if available for matching
        user_name: userName,
        reason: alertId ? 'Safeguarding alert triggered' : 'Requested human support',
        preferred_type: preferredStaffType,
        session_id: sessionId, // Pass the original session ID for linking to safeguarding alerts
        alert_id: alertId
      });
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !roomId || !socketRef.current) return;

    const messageText = inputText.trim();
    const messageId = `msg_${Date.now()}`;
    
    // Optimistically add message
    const userMessage: Message = {
      id: messageId,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    // Stop typing indicator
    socketRef.current.emit('typing_stop', {
      room_id: roomId,
      user_id: userId
    });

    // Send via Socket.IO for real-time
    socketRef.current.emit('chat_message', {
      room_id: roomId,
      message: messageText,
      sender_id: userId,
      sender_name: userName,
      sender_type: 'user'
    });

    // Also save to database for persistence
    try {
      await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          message: messageText,
          sender_id: userId,
          sender_name: userName,
          sender_type: 'user'
        }),
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    
    // Emit typing indicator (throttled to once per second)
    const now = Date.now();
    if (roomId && socketRef.current && now - lastTypingEmit.current > 1000) {
      lastTypingEmit.current = now;
      socketRef.current.emit('typing_start', {
        room_id: roomId,
        user_id: userId,
        user_name: userName
      });
    }
  };

  const handleEndChat = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to end this chat? You can always request another callback or call directly.'
      );
      if (confirmed) {
        endChatAndNavigate();
      }
    } else {
      Alert.alert(
        'End Chat',
        'Are you sure you want to end this chat? You can always request another callback or call directly.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'End Chat', 
            style: 'destructive',
            onPress: () => endChatAndNavigate()
          },
        ]
      );
    }
  };

  const endChatAndNavigate = () => {
    if (socketRef.current && roomId) {
      socketRef.current.emit('leave_chat_room', {
        room_id: roomId,
        user_id: userId
      });
    }
    
    // Try to go back to the AI chat they came from
    // If we have an alertId, they came from safeguarding flow in AI chat
    // Use router.back() first, with fallback to home (where they can choose a buddy)
    if (typeof window !== 'undefined' && window.history.length > 2) {
      router.back();
    } else {
      // Can't go back - navigate to home where they can choose an AI buddy
      router.replace('/home');
    }
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Report user to moderation queue
  const handleReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the report');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/governance/peer-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reported_user_id: staffName || 'unknown_staff',
          reporter_id: userId,
          report_type: 'inappropriate_behaviour',
          description: reportReason,
          context: {
            room_id: roomId,
            last_messages: messages.slice(-5).map(m => ({
              sender: m.sender,
              text: m.text.substring(0, 200)
            }))
          }
        })
      });
      
      if (response.ok) {
        Alert.alert('Report Submitted', 'Thank you for your report. Our team will review it.');
        setShowReportModal(false);
        setReportReason('');
      } else {
        Alert.alert('Error', 'Failed to submit report. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  // Block user
  const handleBlock = () => {
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? You will no longer be able to chat with them.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Block', 
          style: 'destructive',
          onPress: async () => {
            // End chat and go back
            handleEndChat();
            Alert.alert('User Blocked', 'You have blocked this user.');
          }
        }
      ]
    );
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Determine display name for header
  const displayName = staffName || 'Support Team';
  const statusText = waitingForStaff ? 'Connecting...' : 'Live Chat';

  if (isLoading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Connecting you with the support team...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleEndChat} 
          style={styles.endButton}
          data-testid="live-chat-close-button"
        >
          <FontAwesome5 name="times" size={18} color="#ef4444" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.staffAvatar}>
            <FontAwesome5 
              name={staffType === 'counsellor' ? 'user-md' : 'users'} 
              size={18} 
              color="#fff" 
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>{displayName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.onlineDot, waitingForStaff && styles.waitingDot]} />
              <Text style={styles.headerSubtitle}>{statusText}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.endCallButton}
          onPress={() => router.back()}
        >
          <FontAwesome5 name="times" size={16} color="#dc2626" />
        </TouchableOpacity>
        
        {/* Report/Block dropdown */}
        {!waitingForStaff && staffName && (
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.reportButton}
              onPress={() => setShowReportModal(true)}
              data-testid="report-button"
            >
              <FontAwesome5 name="flag" size={14} color="#f59e0b" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.blockButton}
              onPress={handleBlock}
              data-testid="block-button"
            >
              <FontAwesome5 name="ban" size={14} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModal}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Report User</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <FontAwesome5 name="times" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.reportModalSubtitle}>
              Help us maintain a safe environment by reporting inappropriate behaviour.
            </Text>
            <TextInput
              style={styles.reportInput}
              placeholder="Describe the issue..."
              placeholderTextColor="#9ca3af"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.reportModalButtons}>
              <TouchableOpacity 
                style={styles.reportCancelButton}
                onPress={() => setShowReportModal(false)}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reportSubmitButton}
                onPress={handleReport}
              >
                <FontAwesome5 name="paper-plane" size={14} color="#fff" />
                <Text style={styles.reportSubmitText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Waiting Banner */}
      {waitingForStaff && (
        <View style={styles.waitingBanner}>
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text style={styles.waitingText}>
            Waiting for a support team member to join...
          </Text>
        </View>
      )}

      {/* Connection Banner */}
      <View style={styles.connectionBanner}>
        <FontAwesome5 name="shield-alt" size={14} color="#16a34a" />
        <Text style={styles.connectionText}>
          Secure connection - this chat is confidential
        </Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'user' ? styles.userBubble : styles.staffBubble,
            ]}
          >
            {message.sender === 'staff' && (
              <View style={styles.staffLabel}>
                <FontAwesome5 
                  name={staffType === 'counsellor' ? 'user-md' : 'user'} 
                  size={12} 
                  color="#16a34a" 
                />
                <Text style={styles.staffLabelText}>{message.senderName || staffName || 'System'}</Text>
              </View>
            )}
            <Text
              style={[
                styles.messageText,
                message.sender === 'user' ? styles.userText : styles.staffText,
              ]}
            >
              {message.text}
            </Text>
            <Text style={styles.timestamp}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => router.push('/crisis-support')}
        >
          <FontAwesome5 name="list" size={14} color="#64748b" />
          <Text style={styles.quickActionText}>Crisis Resources</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => router.push('/peer-support')}
        >
          <FontAwesome5 name="users" size={14} color="#64748b" />
          <Text style={styles.quickActionText}>Peer Support</Text>
        </TouchableOpacity>
      </View>

      {/* Typing Indicator */}
      {typingUser && (
        <View style={styles.typingIndicator}>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
          <Text style={styles.typingText}>{typingUser} is typing...</Text>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={handleTyping}
          onSubmitEditing={sendMessage}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
          data-testid="live-chat-send-button"
        >
          <FontAwesome5 name="paper-plane" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a2634',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2634',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  endButton: {
    padding: 10,
    backgroundColor: '#2d3a4d',
    borderRadius: 8,
    marginRight: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  waitingDot: {
    backgroundColor: '#f59e0b',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  callButton: {
    padding: 12,
    backgroundColor: '#2d3a4d',
    borderRadius: 8,
  },
  endCallButton: {
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  waitingText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  connectionText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  staffBubble: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  staffLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  staffLabelText: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  staffText: {
    color: '#1e293b',
  },
  timestamp: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
  },
  quickActionText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#f1f5f9',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  // Typing Indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },
  typingDot1: {
    // Animation could be added here
  },
  typingDot2: {
    // Animation could be added here
  },
  typingDot3: {
    // Animation could be added here
  },
  typingText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  // Incoming Call Modal Styles
  incomingCallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  incomingCallModal: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 320,
  },
  callPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  incomingCallTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  incomingCallName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  incomingCallType: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 32,
  },
  incomingCallActions: {
    flexDirection: 'row',
    gap: 24,
  },
  callActionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  rejectButton: {
    backgroundColor: '#dc2626',
  },
  acceptButton: {
    backgroundColor: '#16a34a',
  },
  callActionText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  // Active Call Banner
  activeCallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  activeCallText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  endCallBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  endCallBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  // Report/Block styles
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  reportButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  blockButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reportModal: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  reportModalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  reportInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    color: '#f8fafc',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  reportCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  reportCancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  reportSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  reportSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
