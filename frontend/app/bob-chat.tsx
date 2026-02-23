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

interface AvailableStaff {
  counsellors: any[];
  peers: any[];
}

const BOB_AVATAR = 'https://static.prod-images.emergentagent.com/jobs/e42bf70a-a287-4141-b70d-0728db3b1a3c/images/5ccb4f3dba33762dc691a5023cd5a26342d43ef9a7e95308f48f38301df65f8c.png';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bob';
  timestamp: Date;
}

export default function BobChatScreen() {
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
  const [sessionId] = useState(() => `bob-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // Verification modal state for returning users
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyPin, setVerifyPin] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [pendingMessages, setPendingMessages] = useState<Message[] | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [hasAcceptedConsent, setHasAcceptedConsent] = useState(false);

  useEffect(() => {
    checkAIConsent();
  }, []);

  const checkAIConsent = async () => {
    try {
      const consent = await AsyncStorage.getItem('ai_chat_consent_bob');
      if (consent === 'true') {
        setHasAcceptedConsent(true);
        loadSavedSession();
      } else {
        setShowAIConsent(true);
      }
    } catch (error) {
      setShowAIConsent(true);
    }
  };

  const handleAcceptConsent = async () => {
    try {
      await AsyncStorage.setItem('ai_chat_consent_bob', 'true');
      await AsyncStorage.setItem('ai_chat_consent_date', new Date().toISOString());
      setHasAcceptedConsent(true);
      setShowAIConsent(false);
      loadSavedSession();
    } catch (error) {
      console.error('Error saving consent:', error);
      setShowAIConsent(false);
      loadSavedSession();
    }
  };
  
  useEffect(() => {
    // Only show welcome message if no saved session or after verification
    if (hasLoadedSession && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        text: "Hey, good to see you here. What's been going on?",
        sender: 'bob',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [hasLoadedSession]);

  const loadSavedSession = async () => {
    try {
      const storedEmail = await AsyncStorage.getItem('bob_email');
      const storedPin = await AsyncStorage.getItem('bob_pin');
      const storedMessages = await AsyncStorage.getItem('bob_messages');
      
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
      await AsyncStorage.removeItem('bob_email');
      await AsyncStorage.removeItem('bob_pin');
      await AsyncStorage.removeItem('bob_messages');
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
        await AsyncStorage.setItem('bob_messages', JSON.stringify(newMessages));
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    }
  };

  const handleSetupEmail = async () => {
    if (email && pin.length === 4) {
      try {
        await AsyncStorage.setItem('bob_email', email);
        await AsyncStorage.setItem('bob_pin', pin);
        setSavedEmail(email);
        setIsAuthenticated(true);
        setShowEmailModal(false);
        // Save current messages
        await AsyncStorage.setItem('bob_messages', JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving email/pin:', error);
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
      let fullMessage = `Safeguarding callback request from Bob chat. Session: ${sessionId}.`;
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
      const response = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputText.trim(),
          sessionId: sessionId,
          character: 'bob',
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
      
      const bobMessage: Message = {
        id: `bob-${Date.now()}`,
        text: data.reply || "I'm here to listen. Tell me more, mate.",
        sender: 'bob',
        timestamp: new Date(),
      };

      const updatedMessages = [...newMessages, bobMessage];
      setMessages(updatedMessages);
      await saveMessages(updatedMessages);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: `bob-${Date.now()}`,
        text: "Having trouble connecting right now, mate. If you need immediate help, Samaritans are on 116 123 or Combat Stress on 0800 138 1619.",
        sender: 'bob',
        timestamp: new Date(),
      };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Image source={{ uri: BOB_AVATAR }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Bob</Text>
          <Text style={styles.headerSubtitle}>Ex-Para Peer Support</Text>
        </View>
        <TouchableOpacity onPress={() => setMessages([{
          id: 'welcome',
          text: "Alright mate, Bob here. Ex-Para, been around the block a bit. What's on your mind?",
          sender: 'bob',
          timestamp: new Date(),
        }])} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Save conversation banner */}
      {!isAuthenticated && (
        <TouchableOpacity 
          style={styles.saveBanner}
          onPress={() => setShowEmailModal(true)}
        >
          <Ionicons name="bookmark-outline" size={18} color="#3b82f6" />
          <Text style={styles.saveBannerText}>Save conversation to continue later</Text>
          <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
        </TouchableOpacity>
      )}

      {/* AI Profile Card */}
      {messages.length <= 1 && (
        <View style={styles.aiProfileCard}>
          <Image source={{ uri: BOB_AVATAR }} style={styles.aiProfileAvatar} />
          <View style={styles.aiProfileInfo}>
            <Text style={styles.aiProfileName}>Bob</Text>
            <Text style={styles.aiProfileRole}>Ex-Para Peer Support</Text>
            <Text style={styles.aiProfileDesc}>
              British Army veteran. Here to listen, share a brew, and help you work through whatever is on your mind.
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message) => (
          <View 
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'user' ? styles.userBubble : styles.bobBubble,
            ]}
          >
            {message.sender === 'bob' && (
              <View style={styles.bobLabel}>
                <Image source={{ uri: BOB_AVATAR }} style={styles.bobLabelAvatar} />
                <Text style={styles.bobLabelText}>Bob</Text>
              </View>
            )}
            <Text style={[
              styles.messageText,
              message.sender === 'user' ? styles.userText : styles.bobText,
            ]}>
              {message.text}
            </Text>
          </View>
        ))}
        
        {isLoading && (
          <View style={[styles.messageBubble, styles.bobBubble]}>
            <View style={styles.bobLabel}>
              <Image source={{ uri: BOB_AVATAR }} style={styles.bobLabelAvatar} />
              <Text style={styles.bobLabelText}>Bob</Text>
            </View>
            <ActivityIndicator size="small" color="#7c9cbf" />
          </View>
        )}
      </ScrollView>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color="#64748b" />
        <Text style={styles.disclaimerText}>
          Not a crisis line. For emergencies call 999. Crisis support: 0800 138 1619
        </Text>
      </View>

      {/* Input */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={20} color="#fff" />
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
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
            
            <Ionicons name="bookmark" size={48} color="#3b82f6" />
            <Text style={styles.modalTitle}>Save Your Conversation</Text>
            <Text style={styles.modalDescription}>
              Enter your email and create a 4-digit PIN to save this conversation. You can continue where you left off next time.
            </Text>

            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark" size={20} color="#22c55e" />
              <Text style={styles.privacyText}>
                Your conversation is stored only on your device, not in any database. Your privacy is protected.
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

      {/* AI Consent Modal */}
      <AIConsentModal
        visible={showAIConsent}
        onAccept={handleAcceptConsent}
        characterName="Bob"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
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
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  refreshButton: {
    padding: 8,
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e3a5f',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  saveBannerText: {
    fontSize: 13,
    color: '#93c5fd',
    fontWeight: '500',
  },
  aiProfileCard: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    gap: 14,
  },
  aiProfileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  aiProfileInfo: {
    flex: 1,
  },
  aiProfileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  aiProfileRole: {
    fontSize: 13,
    color: '#93c5fd',
    marginBottom: 6,
  },
  aiProfileDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
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
  bobBubble: {
    backgroundColor: '#1e3a5f',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bobLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bobLabelAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  bobLabelText: {
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
  bobText: {
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: '#6ee7b7',
    lineHeight: 18,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 8,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
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
