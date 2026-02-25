/**
 * Unified AI Chat Component
 * 
 * A single, theme-aware chat component that works with all AI characters.
 * Characters are configured in /src/config/ai-characters.ts
 * 
 * Usage: Navigate to /unified-chat/[characterId] e.g., /unified-chat/hugo
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { API_URL } from '../src/config/api';
import { getCharacter, AICharacter } from '../src/config/ai-characters';
import AIConsentModal from '../src/components/AIConsentModal';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'buddy';
  timestamp: Date;
}

interface AvailableStaff {
  counsellors: any[];
  peers: any[];
}

export default function UnifiedAIChat() {
  const router = useRouter();
  const { characterId = 'hugo' } = useLocalSearchParams<{ characterId: string }>();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Get character config
  const character = useMemo(() => getCharacter(characterId), [characterId]);
  
  // Create dynamic styles
  const styles = useMemo(() => createStyles(colors, isDark, character.accentColor), [colors, isDark, character.accentColor]);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `${character.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // Auth state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  
  // Consent state
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [hasAcceptedConsent, setHasAcceptedConsent] = useState(false);
  
  // Safeguarding state
  const [showSafeguardingModal, setShowSafeguardingModal] = useState(false);
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [safeguardingView, setSafeguardingView] = useState<'main' | 'callback' | 'connecting' | 'callback_success' | 'live_chat'>('main');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackName, setCallbackName] = useState('');
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff>({ counsellors: [], peers: [] });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [staffAvailable, setStaffAvailable] = useState(false);

  // Check for available staff when safeguarding modal opens
  useEffect(() => {
    if (showSafeguardingModal) {
      checkStaffAvailability();
    }
  }, [showSafeguardingModal]);

  const checkStaffAvailability = async () => {
    setIsCheckingAvailability(true);
    try {
      const [counsellorsRes, peersRes] = await Promise.all([
        fetch(`${API_URL}/api/counsellors/available`),
        fetch(`${API_URL}/api/peer-supporters/available`)
      ]);
      
      const counsellors = await counsellorsRes.json();
      const peers = await peersRes.json();
      
      const availableCounsellors = Array.isArray(counsellors) ? counsellors : [];
      const availablePeers = Array.isArray(peers) ? peers : [];
      
      setAvailableStaff({ 
        counsellors: availableCounsellors, 
        peers: availablePeers 
      });
      setStaffAvailable(availableCounsellors.length > 0 || availablePeers.length > 0);
    } catch (error) {
      console.error('Error checking staff availability:', error);
      setStaffAvailable(false);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleConnectToStaff = () => {
    // Navigate to live chat with available staff
    router.push('/live-chat');
  };

  // Check consent on mount
  useEffect(() => {
    checkAIConsent();
  }, [character.consentKey]);

  const checkAIConsent = async () => {
    try {
      const consent = await AsyncStorage.getItem(character.consentKey);
      if (consent === 'true') {
        setHasAcceptedConsent(true);
        setHasLoadedSession(true);
      } else {
        setShowAIConsent(true);
      }
    } catch (error) {
      setShowAIConsent(true);
    }
  };

  const handleAcceptConsent = async () => {
    try {
      await AsyncStorage.setItem(character.consentKey, 'true');
      await AsyncStorage.setItem('ai_chat_consent_date', new Date().toISOString());
      setHasAcceptedConsent(true);
      setShowAIConsent(false);
      setHasLoadedSession(true);
    } catch (error) {
      console.error('Error saving consent:', error);
      setShowAIConsent(false);
      setHasLoadedSession(true);
    }
  };

  // Add welcome message when session loads
  useEffect(() => {
    if (hasLoadedSession && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        text: character.welcomeMessage,
        sender: 'buddy',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [hasLoadedSession, character.welcomeMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          character: character.id,
          sessionId: sessionId,
        }),
      });

      const data = await response.json();

      // Check for safeguarding alert
      if (data.safeguardingTriggered) {
        setCurrentAlertId(data.safeguardingAlertId);
        setShowSafeguardingModal(true);
      }

      const buddyMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.reply || "I'm here for you. Sometimes it helps to just talk.",
        sender: 'buddy',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, buddyMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        sender: 'buddy',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = async () => {
    setMessages([{
      id: 'welcome',
      text: character.welcomeMessage,
      sender: 'buddy',
      timestamp: new Date(),
    }]);
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleSetupEmail = async () => {
    if (!email || pin.length !== 4) return;
    try {
      await AsyncStorage.setItem(`${character.id}_email`, email);
      await AsyncStorage.setItem(`${character.id}_pin`, pin);
      setSavedEmail(email);
      setIsAuthenticated(true);
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error saving email:', error);
    }
  };

  // Submit callback request
  const submitCallback = async () => {
    if (!callbackPhone || !callbackName) return;
    setIsSubmittingCallback(true);
    try {
      await fetch(`${API_URL}/api/callbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: callbackName,
          phone: callbackPhone,
          message: `Safeguarding callback from ${character.name} chat`,
          request_type: 'counsellor',
          is_urgent: true,
          safeguarding_alert_id: currentAlertId,
        }),
      });
      setSafeguardingView('callback_success');
    } catch (error) {
      console.error('Error submitting callback:', error);
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  const closeSafeguardingModal = () => {
    setShowSafeguardingModal(false);
    setSafeguardingView('main');
    setCallbackPhone('');
    setCallbackName('');
  };

  // Show consent modal
  if (showAIConsent) {
    return (
      <AIConsentModal
        visible={showAIConsent}
        onAccept={handleAcceptConsent}
        onDecline={() => router.back()}
        characterName={character.name}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Image source={{ uri: character.avatar }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{character.name}</Text>
          <Text style={styles.headerSubtitle}>{character.role}</Text>
        </View>
        <TouchableOpacity onPress={clearConversation} style={styles.refreshButton} data-testid="clear-chat-btn">
          <Ionicons name="refresh" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Save conversation banner */}
      {!isAuthenticated && (
        <TouchableOpacity 
          style={styles.saveBanner}
          onPress={() => setShowEmailModal(true)}
          data-testid="save-conversation-btn"
        >
          <Ionicons name="bookmark-outline" size={18} color={character.accentColor} />
          <Text style={styles.saveBannerText}>Save conversation to continue later</Text>
          <Ionicons name="chevron-forward" size={18} color={character.accentColor} />
        </TouchableOpacity>
      )}

      {/* AI Profile Card - shows on first message */}
      {messages.length <= 1 && (
        <View style={styles.aiProfileCard}>
          <Image source={{ uri: character.avatar }} style={styles.aiProfileAvatar} />
          <View style={styles.aiProfileInfo}>
            <Text style={styles.aiProfileName}>{character.name}</Text>
            <Text style={styles.aiProfileRole}>{character.role}</Text>
            <Text style={styles.aiProfileDesc}>{character.description}</Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        data-testid="messages-container"
      >
        {messages.map((message) => (
          <View 
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'user' ? styles.userBubble : styles.buddyBubble
            ]}
          >
            {message.sender === 'buddy' && (
              <View style={styles.buddyLabel}>
                <Image source={{ uri: character.avatar }} style={styles.buddyLabelAvatar} />
                <Text style={styles.buddyLabelText}>{character.name}</Text>
              </View>
            )}
            <Text style={[
              styles.messageText,
              message.sender === 'user' ? styles.userText : styles.buddyText
            ]}>
              {message.text}
            </Text>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.buddyBubble]}>
            <ActivityIndicator size="small" color={character.accentColor} />
          </View>
        )}
      </ScrollView>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
        <Text style={styles.disclaimerText}>
          AI companion - not a substitute for professional help
        </Text>
      </View>

      {/* Input Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            data-testid="message-input"
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            data-testid="send-message-btn"
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
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>

            <Ionicons name="bookmark" size={40} color={character.accentColor} />
            <Text style={styles.modalTitle}>Save Your Conversation</Text>
            <Text style={styles.modalDescription}>
              Enter your email and a 4-digit PIN to save and continue your conversation later.
            </Text>

            <View style={styles.privacyNote}>
              <Ionicons name="lock-closed" size={18} color={isDark ? '#6ee7b7' : '#166534'} />
              <Text style={styles.privacyText}>
                Your conversation is private and encrypted. Only you can access it with your PIN.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>4-Digit PIN</Text>
            <TextInput
              style={styles.modalInput}
              value={pin}
              onChangeText={(text) => setPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="1234"
              placeholderTextColor={colors.textMuted}
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

      {/* Safeguarding Support Modal */}
      <Modal
        visible={showSafeguardingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.safeguardingOverlay}>
          <View style={styles.safeguardingModal}>
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
                  {/* Talk to Someone Now - Always show, with availability status */}
                  <TouchableOpacity
                    style={[styles.safeguardingOption, { backgroundColor: '#dcfce7', borderColor: '#16a34a', borderWidth: 2 }]}
                    onPress={handleConnectToStaff}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' }}>
                      <FontAwesome5 name="comments" size={18} color="#ffffff" />
                    </View>
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={[styles.safeguardingOptionTitle, { color: '#16a34a' }]}>Talk to Someone Now</Text>
                      <Text style={styles.safeguardingOptionDesc}>
                        {isCheckingAvailability 
                          ? 'Checking availability...'
                          : staffAvailable
                            ? (availableStaff.counsellors.length > 0 && availableStaff.peers.length > 0 
                                ? 'Counsellor & peer supporter available'
                                : availableStaff.counsellors.length > 0 
                                  ? 'Counsellor available now'
                                  : 'Peer supporter available now')
                            : 'Connect with our support team'}
                      </Text>
                    </View>
                    {staffAvailable && (
                      <View style={{ backgroundColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>LIVE</Text>
                      </View>
                    )}
                    {!staffAvailable && !isCheckingAvailability && (
                      <FontAwesome5 name="chevron-right" size={16} color="#16a34a" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.safeguardingOption}
                    onPress={() => setSafeguardingView('callback')}
                  >
                    <FontAwesome5 name="phone-alt" size={24} color="#2563eb" />
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={styles.safeguardingOptionTitle}>Request a Callback</Text>
                      <Text style={styles.safeguardingOptionDesc}>Leave your number, we'll call you</Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.safeguardingOption}
                    onPress={() => Linking.openURL('tel:116123')}
                  >
                    <FontAwesome5 name="hands-helping" size={24} color="#16a34a" />
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={styles.safeguardingOptionTitle}>Samaritans</Text>
                      <Text style={styles.safeguardingOptionDesc}>Free 24/7 support: 116 123</Text>
                    </View>
                    <FontAwesome5 name="external-link-alt" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.safeguardingOption}
                    onPress={() => Linking.openURL('tel:08001381619')}
                  >
                    <FontAwesome5 name="user-shield" size={24} color="#7c3aed" />
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={styles.safeguardingOptionTitle}>Combat Stress</Text>
                      <Text style={styles.safeguardingOptionDesc}>Veterans helpline: 0800 138 1619</Text>
                    </View>
                    <FontAwesome5 name="external-link-alt" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                </ScrollView>

                <View style={styles.emergencyNote}>
                  <FontAwesome5 name="exclamation-triangle" size={16} color={isDark ? '#fcd34d' : '#92400e'} />
                  <Text style={styles.emergencyNoteText}>
                    In immediate danger? Call 999
                  </Text>
                </View>

                <TouchableOpacity 
                  style={styles.safeguardingContinue}
                  onPress={closeSafeguardingModal}
                >
                  <Text style={styles.safeguardingContinueText}>Continue chatting with {character.name}</Text>
                </TouchableOpacity>
              </>
            )}

            {safeguardingView === 'callback' && (
              <>
                <TouchableOpacity 
                  style={styles.backToMain}
                  onPress={() => setSafeguardingView('main')}
                >
                  <FontAwesome5 name="arrow-left" size={14} color={colors.textMuted} />
                  <Text style={styles.backToMainText}>Back to options</Text>
                </TouchableOpacity>

                <Text style={styles.safeguardingTitle}>Request a Callback</Text>
                <Text style={styles.safeguardingText}>
                  One of our counsellors will call you back as soon as possible.
                </Text>

                <View style={styles.callbackForm}>
                  <Text style={styles.callbackInputLabel}>Your Name</Text>
                  <TextInput
                    style={styles.callbackInput}
                    value={callbackName}
                    onChangeText={setCallbackName}
                    placeholder="First name is fine"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={styles.callbackInputLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.callbackInput}
                    value={callbackPhone}
                    onChangeText={setCallbackPhone}
                    placeholder="07xxx xxxxxx"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />

                  <TouchableOpacity
                    style={[styles.submitCallbackButton, (!callbackPhone || !callbackName || isSubmittingCallback) && styles.buttonDisabled]}
                    onPress={submitCallback}
                    disabled={!callbackPhone || !callbackName || isSubmittingCallback}
                  >
                    {isSubmittingCallback ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.submitCallbackText}>Request Callback</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {safeguardingView === 'callback_success' && (
              <View style={styles.successView}>
                <FontAwesome5 name="check-circle" size={48} color="#16a34a" />
                <Text style={styles.successTitle}>Callback Requested</Text>
                <Text style={styles.successText}>
                  A counsellor will call you back as soon as possible. 
                  Please keep your phone nearby.
                </Text>
                <TouchableOpacity 
                  style={styles.successCloseButton}
                  onPress={closeSafeguardingModal}
                >
                  <Text style={styles.successCloseText}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Dynamic styles based on theme and character accent color
const createStyles = (colors: any, isDark: boolean, accentColor: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: accentColor,
  },
  refreshButton: {
    padding: 8,
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#064e3b' : '#dcfce7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  saveBannerText: {
    fontSize: 13,
    color: isDark ? '#6ee7b7' : '#166534',
    fontWeight: '500',
  },
  aiProfileCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiProfileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: accentColor,
  },
  aiProfileInfo: {
    flex: 1,
  },
  aiProfileName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  aiProfileRole: {
    fontSize: 13,
    color: accentColor,
    marginBottom: 6,
  },
  aiProfileDesc: {
    fontSize: 13,
    color: colors.textSecondary,
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
    backgroundColor: accentColor,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  buddyBubble: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buddyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  buddyLabelAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  buddyLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: accentColor,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  buddyText: {
    color: colors.text,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  disclaimerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: accentColor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
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
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#064e3b' : '#dcfce7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: isDark ? '#6ee7b7' : '#166534',
    lineHeight: 18,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  modalInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButton: {
    width: '100%',
    backgroundColor: accentColor,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  safeguardingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safeguardingModal: {
    backgroundColor: colors.surface,
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
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  safeguardingText: {
    fontSize: 15,
    color: colors.textSecondary,
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
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  safeguardingOptionContent: {
    flex: 1,
  },
  safeguardingOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  safeguardingOptionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emergencyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#451a03' : '#fef3c7',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  emergencyNoteText: {
    fontSize: 14,
    color: isDark ? '#fcd34d' : '#92400e',
    fontWeight: '500',
  },
  safeguardingContinue: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  safeguardingContinueText: {
    fontSize: 14,
    color: colors.textMuted,
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
    color: colors.textMuted,
  },
  callbackForm: {
    marginTop: 8,
  },
  callbackInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  callbackInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitCallbackButton: {
    backgroundColor: accentColor,
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
    backgroundColor: colors.textMuted,
  },
  successView: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  successCloseButton: {
    backgroundColor: accentColor,
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
});
