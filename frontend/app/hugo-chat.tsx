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
  Alert,
  StatusBar,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AIConsentModal from '../src/components/AIConsentModal';
import { API_URL } from '../src/config/api';
import { useTheme } from '../src/context/ThemeContext';

const HUGO_AVATAR = 'https://static.prod-images.emergentagent.com/jobs/fba61e42-5a99-4622-a43b-84a14c5bcf87/images/7187a483ea030457c378a4933dc5d476b04b16d8ae15f0ff01e45912ba13042d.png';

interface AvailableStaff {
  counsellors: any[];
  peers: any[];
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'hugo';
  timestamp: Date;
}

export default function HugoChatScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, theme } = useTheme();
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
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff>({ counsellors: [], peers: [] });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [sessionId] = useState(() => `hugo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [hasAcceptedConsent, setHasAcceptedConsent] = useState(false);

  // Create dynamic styles based on theme
  const isDark = theme === 'dark';
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    checkAIConsent();
  }, []);

  const checkAIConsent = async () => {
    try {
      const consent = await AsyncStorage.getItem('ai_chat_consent_hugo');
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
      await AsyncStorage.setItem('ai_chat_consent_hugo', 'true');
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
  
  useEffect(() => {
    if (hasLoadedSession && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        text: "Hey, Hugo here! Ready to tackle today? Even if it's just one small thing, I'm here to help. What's on your mind?",
        sender: 'hugo',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [hasLoadedSession]);

  const saveMessages = async (newMessages: Message[]) => {
    if (isAuthenticated) {
      try {
        await AsyncStorage.setItem('hugo_messages', JSON.stringify(newMessages));
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    }
  };

  const handleSetupEmail = async () => {
    if (email && pin.length === 4) {
      try {
        await AsyncStorage.setItem('hugo_email', email);
        await AsyncStorage.setItem('hugo_pin', pin);
        setSavedEmail(email);
        setIsAuthenticated(true);
        setShowEmailModal(false);
        await AsyncStorage.setItem('hugo_messages', JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving email/pin:', error);
      }
    }
  };

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

  const submitCallbackRequest = async () => {
    if (!callbackPhone.trim()) {
      Alert.alert('Phone Required', 'Please enter your phone number so we can call you back.');
      return;
    }

    setIsSubmittingCallback(true);

    try {
      let fullMessage = `Safeguarding callback request from Hugo chat (Self-Help). Session: ${sessionId}.`;
      if (currentAlertId) {
        fullMessage += ` Alert ID: ${currentAlertId}.`;
      }

      const response = await fetch(`${API_URL}/api/callbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: callbackName.trim() || 'Anonymous',
          phone: callbackPhone.trim(),
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
          character: 'hugo',
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      if (data.safeguardingTriggered) {
        setCurrentAlertId(data.safeguardingAlertId);
        checkAvailability();
        setShowSafeguardingModal(true);
      }
      
      const hugoMessage: Message = {
        id: `hugo-${Date.now()}`,
        text: data.reply || "I'm here to help. What's one small thing we can work on today?",
        sender: 'hugo',
        timestamp: new Date(),
      };

      const updatedMessages = [...newMessages, hugoMessage];
      setMessages(updatedMessages);
      await saveMessages(updatedMessages);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: `hugo-${Date.now()}`,
        text: "Having trouble connecting right now. Remember - even taking a few deep breaths counts. If you need support, Samaritans are on 116 123.",
        sender: 'hugo',
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

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.push('/self-care');
    }
  };

  const clearConversation = () => {
    const welcomeMessage: Message = {
      id: 'welcome-new',
      text: "Fresh start! Hugo here. What's one thing we can tackle together today?",
      sender: 'hugo',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Image source={{ uri: HUGO_AVATAR }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Hugo</Text>
          <Text style={styles.headerSubtitle}>Self-Help & Wellness</Text>
        </View>
        <TouchableOpacity onPress={clearConversation} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Save conversation banner */}
      {!isAuthenticated && (
        <TouchableOpacity 
          style={styles.saveBanner}
          onPress={() => setShowEmailModal(true)}
        >
          <Ionicons name="bookmark-outline" size={18} color="#10b981" />
          <Text style={styles.saveBannerText}>Save conversation to continue later</Text>
          <Ionicons name="chevron-forward" size={18} color="#10b981" />
        </TouchableOpacity>
      )}

      {/* AI Profile Card */}
      {messages.length <= 1 && (
        <View style={styles.aiProfileCard}>
          <Image source={{ uri: HUGO_AVATAR }} style={styles.aiProfileAvatar} />
          <View style={styles.aiProfileInfo}>
            <Text style={styles.aiProfileName}>Hugo</Text>
            <Text style={styles.aiProfileRole}>Self-Help & Wellness Guide</Text>
            <Text style={styles.aiProfileDesc}>
              Here to help with daily habits, grounding techniques, and finding your routine. Small steps make big differences.
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
              message.sender === 'user' ? styles.userBubble : styles.hugoBubble,
            ]}
          >
            {message.sender === 'hugo' && (
              <View style={styles.hugoLabel}>
                <Image source={{ uri: HUGO_AVATAR }} style={styles.hugoLabelAvatar} />
                <Text style={styles.hugoLabelText}>Hugo</Text>
              </View>
            )}
            <Text style={[
              styles.messageText,
              message.sender === 'user' ? styles.userText : styles.hugoText,
            ]}>
              {message.text}
            </Text>
          </View>
        ))}
        
        {isLoading && (
          <View style={[styles.messageBubble, styles.hugoBubble]}>
            <View style={styles.hugoLabel}>
              <Image source={{ uri: HUGO_AVATAR }} style={styles.hugoLabelAvatar} />
              <Text style={styles.hugoLabelText}>Hugo</Text>
            </View>
            <ActivityIndicator size="small" color="#10b981" />
          </View>
        )}
      </ScrollView>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color="#64748b" />
        <Text style={styles.disclaimerText}>
          Not a crisis line. For emergencies call 999. Samaritans: 116 123
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
            
            <Ionicons name="bookmark" size={48} color="#10b981" />
            <Text style={styles.modalTitle}>Save Your Progress</Text>
            <Text style={styles.modalDescription}>
              Enter your email and create a 4-digit PIN to save this conversation. Track your wellness journey!
            </Text>

            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark" size={20} color="#22c55e" />
              <Text style={styles.privacyText}>
                Your conversation is stored only on your device. Your privacy is protected.
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

                  <TouchableOpacity
                    style={styles.safeguardingOption}
                    onPress={() => Linking.openURL('tel:08001381619')}
                  >
                    <FontAwesome5 name="shield-alt" size={24} color="#10b981" />
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={styles.safeguardingOptionTitle}>Combat Stress</Text>
                      <Text style={styles.safeguardingOptionDesc}>Call 0800 138 1619 (veterans)</Text>
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
            
            {safeguardingView === 'callback_success' && (
              <View style={styles.successView}>
                <FontAwesome5 name="check-circle" size={48} color="#16a34a" />
                <Text style={styles.successTitle}>Callback Requested</Text>
                <Text style={styles.successText}>
                  Someone will call you back as soon as possible.
                </Text>
                <TouchableOpacity
                  style={styles.successCloseButton}
                  onPress={() => {
                    setShowSafeguardingModal(false);
                    setSafeguardingView('main');
                    setCallbackPhone('');
                    setCallbackName('');
                  }}
                >
                  <Text style={styles.successCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* AI Consent Modal */}
      <AIConsentModal
        visible={showAIConsent}
        onAccept={handleAcceptConsent}
        characterName="Hugo"
      />
    </SafeAreaView>
  );
}

// Dynamic styles based on theme
const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    color: '#10b981',
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
    borderColor: '#10b981',
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
    color: '#10b981',
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
    backgroundColor: '#10b981',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  hugoBubble: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hugoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  hugoLabelAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  hugoLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  hugoText: {
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
    backgroundColor: '#10b981',
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
    backgroundColor: '#10b981',
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
    backgroundColor: '#10b981',
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
    backgroundColor: '#10b981',
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
