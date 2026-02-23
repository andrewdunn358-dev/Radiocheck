import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AIConsentModal from '../src/components/AIConsentModal';
import { API_URL } from '../src/config/api';

const FINCH_AVATAR = 'https://static.prod-images.emergentagent.com/jobs/26fef91b-7832-48ee-9b54-6cd204a344d5/images/f2058ae7a5d15ff3f002514d4ada7039eeddf405b897ae4fc1f0a68a1114e1d8.png';

interface AvailableStaff {
  counsellors: any[];
  peers: any[];
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'finch';
  timestamp: Date;
}

export default function FinchChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [hasAcceptedConsent, setHasAcceptedConsent] = useState(false);
  
  // Safeguarding state
  const [showSafeguardingModal, setShowSafeguardingModal] = useState(false);
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [safeguardingView, setSafeguardingView] = useState<'main' | 'callback' | 'connecting' | 'callback_success'>('main');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackName, setCallbackName] = useState('');
  const [callbackEmail, setCallbackEmail] = useState('');
  const [callbackMessage, setCallbackMessage] = useState('');
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff>({ counsellors: [], peers: [] });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [sessionId] = useState(() => `finch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // Verification modal state for returning users
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyPin, setVerifyPin] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [pendingMessages, setPendingMessages] = useState<Message[] | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);

  useEffect(() => {
    checkAIConsent();
    loadSavedSession();
  }, []);

  const checkAIConsent = async () => {
    try {
      const consent = await AsyncStorage.getItem('ai_chat_consent_finch');
      if (consent === 'true') {
        setHasAcceptedConsent(true);
      } else {
        setShowAIConsent(true);
      }
    } catch (error) {
      setShowAIConsent(true);
    }
  };

  const handleAcceptConsent = async () => {
    try {
      await AsyncStorage.setItem('ai_chat_consent_finch', 'true');
      await AsyncStorage.setItem('ai_chat_consent_date', new Date().toISOString());
      setHasAcceptedConsent(true);
      setShowAIConsent(false);
    } catch (error) {
      console.error('Error saving consent:', error);
      setShowAIConsent(false);
    }
  };
  
  useEffect(() => {
    // Only show welcome message if no saved session or after verification
    if (hasLoadedSession && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        text: "Hello, what can I help you with today?",
        sender: 'finch',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [hasLoadedSession]);

  const loadSavedSession = async () => {
    try {
      const storedEmail = await AsyncStorage.getItem('finch_email');
      const storedPin = await AsyncStorage.getItem('finch_pin');
      const storedMessages = await AsyncStorage.getItem('finch_messages');
      
      if (storedEmail && storedPin && storedMessages) {
        const parsed = JSON.parse(storedMessages);
        const messagesWithDates = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        
        // Store pending data and show verification modal
        setPendingMessages(messagesWithDates);
        setPendingEmail(storedEmail);
        setPendingPin(storedPin);
        setShowVerifyModal(true);
      } else {
        setHasLoadedSession(true);
      }
    } catch (error) {
      console.error('Error loading session:', error);
      setHasLoadedSession(true);
    }
  };
  
  const handleVerifyIdentity = () => {
    if (verifyEmail.toLowerCase() === pendingEmail?.toLowerCase() && verifyPin === pendingPin) {
      // Verification successful - load the conversation
      if (pendingMessages) {
        setMessages(pendingMessages);
      }
      setSavedEmail(pendingEmail);
      setIsAuthenticated(true);
      setShowVerifyModal(false);
      setHasLoadedSession(true);
      setVerifyError('');
      // Clear pending data
      setPendingMessages(null);
      setPendingEmail(null);
      setPendingPin(null);
    } else {
      setVerifyError('Email or PIN does not match. Please try again.');
    }
  };
  
  const handleStartFresh = async () => {
    // User wants to start a new conversation - clear saved data
    try {
      await AsyncStorage.removeItem('finch_email');
      await AsyncStorage.removeItem('finch_pin');
      await AsyncStorage.removeItem('finch_messages');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
    
    // Clear state and start fresh
    setPendingMessages(null);
    setPendingEmail(null);
    setPendingPin(null);
    setShowVerifyModal(false);
    setVerifyEmail('');
    setVerifyPin('');
    setVerifyError('');
    setHasLoadedSession(true);
  };

  const saveMessages = async (newMessages: Message[]) => {
    if (isAuthenticated) {
      try {
        await AsyncStorage.setItem('finch_messages', JSON.stringify(newMessages));
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    }
  };

  const handleSetupEmail = async () => {
    if (email && pin.length === 4) {
      try {
        await AsyncStorage.setItem('finch_email', email);
        await AsyncStorage.setItem('finch_pin', pin);
        setSavedEmail(email);
        setIsAuthenticated(true);
        setShowEmailModal(false);
        // Save current messages
        await saveMessages(messages);
      } catch (error) {
        console.error('Error saving credentials:', error);
      }
    }
  };

  // Check for available counsellors/peers
  const checkAvailability = async () => {
    setIsCheckingAvailability(true);
    try {
      const [counsellorsRes, peersRes] = await Promise.all([
        fetch(`${API_URL}/api/counsellors/available`),
        fetch(`${API_URL}/api/peer-supporters/available`)
      ]);
      
      const counsellors = await counsellorsRes.json();
      const peers = await peersRes.json();
      
      setAvailableStaff({
        counsellors: Array.isArray(counsellors) ? counsellors : [],
        peers: Array.isArray(peers) ? peers : []
      });
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailableStaff({ counsellors: [], peers: [] });
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Submit callback request
  const submitCallbackRequest = async () => {
    if (!callbackPhone.trim()) {
      Alert.alert('Phone Required', 'Please enter your phone number so we can call you back.');
      return;
    }

    setIsSubmittingCallback(true);

    try {
      let fullMessage = `Safeguarding callback request from Finch chat. Session: ${sessionId}.`;
      if (currentAlertId) {
        fullMessage += ` Alert ID: ${currentAlertId}.`;
      }
      if (callbackMessage.trim()) {
        fullMessage += ` User message: "${callbackMessage.trim()}"`;
      }

      const response = await fetch(`${API_URL}/api/callbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: callbackName.trim() || 'Anonymous',
          phone: callbackPhone.trim(),
          email: callbackEmail.trim() || null,
          request_type: 'counsellor',
          message: fullMessage,
          is_urgent: true,
          safeguarding_alert_id: currentAlertId || null
        }),
      });

      if (response.ok) {
        setSafeguardingView('callback_success');
      } else {
        Alert.alert('Error', 'Failed to submit callback request. Please try again or call 116 123.');
      }
    } catch (error) {
      console.error('Callback error:', error);
      Alert.alert('Error', 'Failed to submit callback request. Please try again or call 116 123.');
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  // Handle connecting to live person
  const handleLiveConnect = async (type: 'counsellor' | 'peer') => {
    setSafeguardingView('connecting');
    
    setTimeout(() => {
      setShowSafeguardingModal(false);
      setSafeguardingView('main');
      router.push({
        pathname: '/live-chat',
        params: { 
          staffType: type,
          alertId: currentAlertId || '',
          sessionId: sessionId,
        }
      });
    }, 1500);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      // Use the same endpoint as Tommy & Doris - ai-buddies/chat
      const response = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputText.trim(),
          sessionId: sessionId,
          character: 'sentry',
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      // Check if safeguarding was triggered
      if (data.safeguardingTriggered) {
        setCurrentAlertId(data.safeguardingAlertId);
        checkAvailability(); // Check who's available
        setShowSafeguardingModal(true);
      }
      
      const finchMessage: Message = {
        id: `finch-${Date.now()}`,
        text: data.reply || "I'm here to listen. Please tell me more about what you're going through.",
        sender: 'finch',
        timestamp: new Date(),
      };

      const updatedMessages = [...newMessages, finchMessage];
      setMessages(updatedMessages);
      await saveMessages(updatedMessages);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: `finch-${Date.now()}`,
        text: "I'm having trouble connecting right now. Please know that support is available. If you need immediate help, please contact Combat Stress on 0800 138 1619 or Samaritans on 116 123.",
        sender: 'finch',
        timestamp: new Date(),
      };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = async () => {
    const welcomeMessage: Message = {
      id: 'welcome-new',
      text: "I've started a fresh conversation. How can I support you today?",
      sender: 'finch',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    if (isAuthenticated) {
      await AsyncStorage.setItem('sentry_messages', JSON.stringify([welcomeMessage]));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Image source={{ uri: FINCH_AVATAR }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Finch</Text>
          <Text style={styles.headerSubtitle}>Legal Support Companion</Text>
        </View>
        <TouchableOpacity onPress={clearConversation} style={styles.menuButton}>
          <Ionicons name="refresh" size={22} color="#7c9cbf" />
        </TouchableOpacity>
      </View>

      {/* Save Conversation Banner */}
      {!isAuthenticated && (
        <TouchableOpacity 
          style={styles.saveBanner}
          onPress={() => setShowEmailModal(true)}
        >
          <Ionicons name="bookmark-outline" size={20} color="#3b82f6" />
          <Text style={styles.saveBannerText}>Save conversation to continue later</Text>
          <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
        </TouchableOpacity>
      )}

      {isAuthenticated && (
        <View style={styles.authenticatedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
          <Text style={styles.authenticatedText}>Conversation saved locally as {savedEmail}</Text>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'user' ? styles.userBubble : styles.finchBubble,
            ]}
          >
            {message.sender === 'finch' && (
              <View style={styles.finchLabel}>
                <Image source={{ uri: FINCH_AVATAR }} style={styles.finchLabelAvatar} />
                <Text style={styles.finchLabelText}>Finch</Text>
              </View>
            )}
            <Text style={[
              styles.messageText,
              message.sender === 'user' ? styles.userText : styles.finchText,
            ]}>
              {message.text}
            </Text>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.finchBubble]}>
            <View style={styles.finchLabel}>
              <Image source={{ uri: FINCH_AVATAR }} style={styles.finchLabelAvatar} />
              <Text style={styles.finchLabelText}>Finch</Text>
            </View>
            <ActivityIndicator size="small" color="#7c9cbf" />
          </View>
        )}
      </ScrollView>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle" size={14} color="#64748b" />
        <Text style={styles.disclaimerText}>
          Not legal advice. For emergencies call 999. Crisis support: 0800 138 1619
        </Text>
      </View>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#64748b"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Email Setup Modal */}
      <Modal
        visible={showEmailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setShowEmailModal(false)}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
            
            <Ionicons name="bookmark" size={48} color="#3b82f6" />
            <Text style={styles.modalTitle}>Save Your Conversation</Text>
            <Text style={styles.modalDescription}>
              Enter your email and create a 4-digit PIN to save this conversation on your device. 
              You can continue where you left off next time.
            </Text>

            <View style={styles.privacyNotice}>
              <Ionicons name="shield-checkmark" size={20} color="#22c55e" />
              <Text style={styles.privacyText}>
                Your conversation is stored only on your device, not in any database. 
                Your privacy is protected.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>4-Digit PIN</Text>
            <TextInput
              style={styles.modalInput}
              value={pin}
              onChangeText={(text) => setPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="1234"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />

            <TouchableOpacity
              style={[
                styles.modalButton,
                (!email || pin.length !== 4) && styles.modalButtonDisabled
              ]}
              onPress={handleSetupEmail}
              disabled={!email || pin.length !== 4}
            >
              <Text style={styles.modalButtonText}>Save Conversation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Verification Modal for Returning Users */}
      <Modal
        visible={showVerifyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleStartFresh}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="person-circle" size={48} color="#3b82f6" />
            <Text style={styles.modalTitle}>Welcome Back</Text>
            <Text style={styles.modalDescription}>
              We found a saved conversation. Please verify your identity to continue where you left off.
            </Text>

            {verifyError ? (
              <View style={styles.verifyErrorContainer}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <Text style={styles.verifyErrorText}>{verifyError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={verifyEmail}
              onChangeText={setVerifyEmail}
              placeholder="your@email.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>4-Digit PIN</Text>
            <TextInput
              style={styles.modalInput}
              value={verifyPin}
              onChangeText={(text) => setVerifyPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="1234"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />

            <TouchableOpacity
              style={[
                styles.modalButton,
                (!verifyEmail || verifyPin.length !== 4) && styles.modalButtonDisabled
              ]}
              onPress={handleVerifyIdentity}
              disabled={!verifyEmail || verifyPin.length !== 4}
            >
              <Text style={styles.modalButtonText}>Continue Conversation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.startFreshButton}
              onPress={handleStartFresh}
            >
              <Text style={styles.startFreshText}>Start a New Conversation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Safeguarding Support Modal */}
      <Modal
        visible={showSafeguardingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.safeguardingOverlay}>
          <View style={styles.safeguardingModal}>
            {/* Main View */}
            {safeguardingView === 'main' && (
              <>
                <View style={styles.safeguardingHeader}>
                  <FontAwesome5 name="heart" size={32} color="#dc2626" />
                  <Text style={styles.safeguardingTitle}>We're Here For You</Text>
                </View>
                
                <Text style={styles.safeguardingText}>
                  It sounds like you might be going through something difficult. 
                  You don't have to face this alone.
                </Text>
                
                <ScrollView style={styles.safeguardingScroll} showsVerticalScrollIndicator={false}>
                  {/* Option A: Request Callback */}
                  <TouchableOpacity
                    style={styles.safeguardingOption}
                    onPress={() => setSafeguardingView('callback')}
                  >
                    <FontAwesome5 name="phone-alt" size={24} color="#2563eb" />
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={styles.safeguardingOptionTitle}>Request a Callback</Text>
                      <Text style={styles.safeguardingOptionDesc}>Leave your number, we'll call you</Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                  
                  {/* Connect Now Section */}
                  <View style={styles.liveConnectSection}>
                    <Text style={styles.liveConnectLabel}>Connect Now</Text>
                    {isCheckingAvailability ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <>
                        {availableStaff.counsellors.length > 0 && (
                          <TouchableOpacity
                            style={[styles.safeguardingOption, styles.liveOption]}
                            onPress={() => handleLiveConnect('counsellor')}
                          >
                            <View style={styles.availableDot} />
                            <FontAwesome5 name="user-md" size={20} color="#16a34a" />
                            <View style={styles.safeguardingOptionContent}>
                              <Text style={styles.safeguardingOptionTitle}>Counsellor Available</Text>
                              <Text style={styles.safeguardingOptionDesc}>{availableStaff.counsellors[0].name} is online</Text>
                            </View>
                            <FontAwesome5 name="chevron-right" size={16} color="#94a3b8" />
                          </TouchableOpacity>
                        )}
                        
                        {availableStaff.peers.length > 0 && (
                          <TouchableOpacity
                            style={[styles.safeguardingOption, styles.liveOption]}
                            onPress={() => handleLiveConnect('peer')}
                          >
                            <View style={styles.availableDot} />
                            <FontAwesome5 name="users" size={20} color="#16a34a" />
                            <View style={styles.safeguardingOptionContent}>
                              <Text style={styles.safeguardingOptionTitle}>Peer Available</Text>
                              <Text style={styles.safeguardingOptionDesc}>{availableStaff.peers[0].name} is online</Text>
                            </View>
                            <FontAwesome5 name="chevron-right" size={16} color="#94a3b8" />
                          </TouchableOpacity>
                        )}
                        
                        {availableStaff.counsellors.length === 0 && availableStaff.peers.length === 0 && (
                          <Text style={styles.noOneAvailable}>No one available right now - please request a callback</Text>
                        )}
                      </>
                    )}
                  </View>
                  
                  {/* External Options */}
                  <TouchableOpacity
                    style={styles.safeguardingOption}
                    onPress={() => Linking.openURL('tel:116123')}
                  >
                    <FontAwesome5 name="phone-volume" size={24} color="#7c3aed" />
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={styles.safeguardingOptionTitle}>Samaritans</Text>
                      <Text style={styles.safeguardingOptionDesc}>Call 116 123 (free, 24/7)</Text>
                    </View>
                    <FontAwesome5 name="external-link-alt" size={14} color="#94a3b8" />
                  </TouchableOpacity>
                </ScrollView>
                
                <View style={styles.emergencyNote}>
                  <FontAwesome5 name="exclamation-triangle" size={14} color="#f59e0b" />
                  <Text style={styles.emergencyNoteText}>
                    If you're in immediate danger, call 999
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.safeguardingContinue}
                  onPress={() => {
                    setShowSafeguardingModal(false);
                    setSafeguardingView('main');
                  }}
                >
                  <Text style={styles.safeguardingContinueText}>
                    I understand, continue chatting
                  </Text>
                </TouchableOpacity>
              </>
            )}
            
            {/* Callback View */}
            {safeguardingView === 'callback' && (
              <>
                <TouchableOpacity 
                  style={styles.backToMain}
                  onPress={() => setSafeguardingView('main')}
                >
                  <FontAwesome5 name="arrow-left" size={16} color="#64748b" />
                  <Text style={styles.backToMainText}>Back</Text>
                </TouchableOpacity>
                
                <View style={styles.safeguardingHeader}>
                  <FontAwesome5 name="phone-alt" size={28} color="#2563eb" />
                  <Text style={styles.safeguardingTitle}>Request a Callback</Text>
                </View>
                
                <Text style={styles.safeguardingText}>
                  Leave your details and someone will call you back as soon as possible.
                </Text>
                
                <View style={styles.callbackForm}>
                  <Text style={styles.callbackInputLabel}>Your Name (optional)</Text>
                  <TextInput
                    style={styles.callbackInput}
                    placeholder="Your name"
                    placeholderTextColor="#94a3b8"
                    value={callbackName}
                    onChangeText={setCallbackName}
                  />
                  
                  <Text style={styles.callbackInputLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.callbackInput}
                    placeholder="Your phone number"
                    placeholderTextColor="#94a3b8"
                    value={callbackPhone}
                    onChangeText={setCallbackPhone}
                    keyboardType="phone-pad"
                  />
                  
                  <Text style={styles.callbackInputLabel}>Email (optional)</Text>
                  <TextInput
                    style={styles.callbackInput}
                    placeholder="your.email@example.com"
                    placeholderTextColor="#94a3b8"
                    value={callbackEmail}
                    onChangeText={setCallbackEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  
                  <Text style={styles.callbackInputLabel}>Anything you'd like us to know? (optional)</Text>
                  <TextInput
                    style={[styles.callbackInput, styles.callbackMessageInput]}
                    placeholder="Is there anything you'd like to share?"
                    placeholderTextColor="#94a3b8"
                    value={callbackMessage}
                    onChangeText={setCallbackMessage}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  
                  <TouchableOpacity
                    style={[styles.submitCallbackButton, isSubmittingCallback && styles.buttonDisabled]}
                    onPress={submitCallbackRequest}
                    disabled={isSubmittingCallback}
                  >
                    {isSubmittingCallback ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitCallbackText}>Request Callback</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {/* Callback Success View */}
            {safeguardingView === 'callback_success' && (
              <View style={styles.successView}>
                <View style={styles.successIcon}>
                  <FontAwesome5 name="check-circle" size={48} color="#16a34a" />
                </View>
                <Text style={styles.successTitle}>Callback Requested</Text>
                <Text style={styles.successText}>
                  Someone will call you back as soon as possible. Please keep your phone nearby.
                </Text>
                <Text style={styles.successSubtext}>
                  If you need immediate help, call 999 or Samaritans on 116 123.
                </Text>
                <TouchableOpacity
                  style={styles.successCloseButton}
                  onPress={() => {
                    setShowSafeguardingModal(false);
                    setSafeguardingView('main');
                    setCallbackPhone('');
                    setCallbackName('');
                    setCallbackEmail('');
                    setCallbackMessage('');
                  }}
                >
                  <Text style={styles.successCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Connecting View */}
            {safeguardingView === 'connecting' && (
              <View style={styles.connectingView}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.connectingTitle}>Connecting you now...</Text>
                <Text style={styles.connectingText}>
                  We're alerting the team that you need to speak with someone.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2332',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#243447',
    borderBottomWidth: 1,
    borderBottomColor: '#3b5068',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7c9cbf',
  },
  menuButton: {
    padding: 8,
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  saveBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#93c5fd',
  },
  authenticatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14532d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  authenticatedText: {
    fontSize: 12,
    color: '#86efac',
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
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  finchBubble: {
    backgroundColor: '#243447',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  finchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  finchLabelAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  finchLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c9cbf',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  finchText: {
    color: '#e2e8f0',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    gap: 6,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748b',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#243447',
    borderTopWidth: 1,
    borderTopColor: '#3b5068',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a2332',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#14532d',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: '#86efac',
    lineHeight: 18,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonDisabled: {
    backgroundColor: '#475569',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  verifyErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#450a0a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  verifyErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#fca5a5',
  },
  startFreshButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  startFreshText: {
    fontSize: 14,
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
  // Safeguarding Modal Styles
  safeguardingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safeguardingModal: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '90%',
  },
  safeguardingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  safeguardingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  safeguardingText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  safeguardingScroll: {
    maxHeight: 280,
  },
  safeguardingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 14,
  },
  safeguardingOptionContent: {
    flex: 1,
  },
  safeguardingOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  safeguardingOptionDesc: {
    fontSize: 13,
    color: '#94a3b8',
  },
  liveConnectSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  liveConnectLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveOption: {
    borderColor: '#22c55e',
    borderWidth: 1,
  },
  availableDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    position: 'absolute',
    top: 12,
    right: 12,
  },
  noOneAvailable: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  emergencyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#451a03',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  emergencyNoteText: {
    fontSize: 14,
    color: '#fcd34d',
    fontWeight: '500',
  },
  safeguardingContinue: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  safeguardingContinueText: {
    fontSize: 14,
    color: '#64748b',
    textDecorationLine: 'underline',
  },
  backToMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backToMainText: {
    fontSize: 14,
    color: '#64748b',
  },
  callbackForm: {
    marginTop: 8,
  },
  callbackInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 12,
  },
  callbackInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  callbackMessageInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitCallbackButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitCallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    backgroundColor: '#475569',
  },
  successView: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  successSubtext: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  successCloseButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginTop: 24,
  },
  successCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  connectingView: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  connectingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
  },
  connectingText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
});
