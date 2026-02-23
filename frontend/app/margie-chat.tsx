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
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AIConsentModal from '../src/components/AIConsentModal';
import { API_URL } from '../src/config/api';

const MARGIE_AVATAR = 'https://static.prod-images.emergentagent.com/jobs/fba61e42-5a99-4622-a43b-84a14c5bcf87/images/313a20c933febb69cc523b6b3647ba814a5b9123a3ea7f674f7a87695a8a4789.png';

interface AvailableStaff {
  counsellors: any[];
  peers: any[];
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'margie';
  timestamp: Date;
}

export default function MargieChatScreen() {
  const router = useRouter();
  const navigation = useNavigation();
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
  const [sessionId] = useState(() => `margie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [hasAcceptedConsent, setHasAcceptedConsent] = useState(false);

  useEffect(() => {
    checkAIConsent();
  }, []);

  const checkAIConsent = async () => {
    try {
      const consent = await AsyncStorage.getItem('ai_chat_consent_margie');
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
      await AsyncStorage.setItem('ai_chat_consent_margie', 'true');
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
        text: "Hello love, I'm Margie. No judgement here, just a friendly ear. Whatever you're going through with alcohol or substances, you're not alone. What's on your mind?",
        sender: 'margie',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [hasLoadedSession]);

  const saveMessages = async (newMessages: Message[]) => {
    if (isAuthenticated) {
      try {
        await AsyncStorage.setItem('margie_messages', JSON.stringify(newMessages));
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    }
  };

  const handleSetupEmail = async () => {
    if (email && pin.length === 4) {
      try {
        await AsyncStorage.setItem('margie_email', email);
        await AsyncStorage.setItem('margie_pin', pin);
        setSavedEmail(email);
        setIsAuthenticated(true);
        setShowEmailModal(false);
        await AsyncStorage.setItem('margie_messages', JSON.stringify(messages));
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
      let fullMessage = `Safeguarding callback request from Margie chat (Substance Support). Session: ${sessionId}.`;
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
          character: 'margie',
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      if (data.safeguardingTriggered) {
        setCurrentAlertId(data.safeguardingAlertId);
        checkAvailability();
        setShowSafeguardingModal(true);
      }
      
      const margieMessage: Message = {
        id: `margie-${Date.now()}`,
        text: data.reply || "I'm here to listen, love. Tell me more.",
        sender: 'margie',
        timestamp: new Date(),
      };

      const updatedMessages = [...newMessages, margieMessage];
      setMessages(updatedMessages);
      await saveMessages(updatedMessages);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: `margie-${Date.now()}`,
        text: "Having trouble connecting right now. If you need immediate help with alcohol or substance issues, Drinkline is on 0300 123 1110 or FRANK on 0300 123 6600.",
        sender: 'margie',
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
      router.push('/substance-support');
    }
  };

  const clearConversation = () => {
    const welcomeMessage: Message = {
      id: 'welcome-new',
      text: "Hello love, I'm Margie. Starting fresh - no judgement here. What's on your mind?",
      sender: 'margie',
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
        <Image source={{ uri: MARGIE_AVATAR }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Margie</Text>
          <Text style={styles.headerSubtitle}>Alcohol & Substance Support</Text>
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
          <Ionicons name="bookmark-outline" size={18} color="#d97706" />
          <Text style={styles.saveBannerText}>Save conversation to continue later</Text>
          <Ionicons name="chevron-forward" size={18} color="#d97706" />
        </TouchableOpacity>
      )}

      {/* AI Profile Card */}
      {messages.length <= 1 && (
        <View style={styles.aiProfileCard}>
          <Image source={{ uri: MARGIE_AVATAR }} style={styles.aiProfileAvatar} />
          <View style={styles.aiProfileInfo}>
            <Text style={styles.aiProfileName}>Margie</Text>
            <Text style={styles.aiProfileRole}>Alcohol & Substance Support</Text>
            <Text style={styles.aiProfileDesc}>
              Here to listen without judgement. Many serving personnel and veterans struggle with alcohol or substances - you're not alone, and recovery is possible.
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
              message.sender === 'user' ? styles.userBubble : styles.margieBubble,
            ]}
          >
            {message.sender === 'margie' && (
              <View style={styles.margieLabel}>
                <Image source={{ uri: MARGIE_AVATAR }} style={styles.margieLabelAvatar} />
                <Text style={styles.margieLabelText}>Margie</Text>
              </View>
            )}
            <Text style={[
              styles.messageText,
              message.sender === 'user' ? styles.userText : styles.margieText,
            ]}>
              {message.text}
            </Text>
          </View>
        ))}
        
        {isLoading && (
          <View style={[styles.messageBubble, styles.margieBubble]}>
            <View style={styles.margieLabel}>
              <Image source={{ uri: MARGIE_AVATAR }} style={styles.margieLabelAvatar} />
              <Text style={styles.margieLabelText}>Margie</Text>
            </View>
            <ActivityIndicator size="small" color="#d97706" />
          </View>
        )}
      </ScrollView>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color="#64748b" />
        <Text style={styles.disclaimerText}>
          Not a crisis line. For emergencies call 999. Drinkline: 0300 123 1110
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
            
            <Ionicons name="bookmark" size={48} color="#d97706" />
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
                    onPress={() => Linking.openURL('tel:03001231110')}
                  >
                    <FontAwesome5 name="wine-bottle" size={24} color="#d97706" />
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={styles.safeguardingOptionTitle}>Drinkline</Text>
                      <Text style={styles.safeguardingOptionDesc}>Call 0300 123 1110</Text>
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
                <View style={styles.successIcon}>
                  <FontAwesome5 name="check-circle" size={48} color="#16a34a" />
                </View>
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
            
            {safeguardingView === 'connecting' && (
              <View style={styles.connectingView}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.connectingTitle}>Connecting you now...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* AI Consent Modal */}
      <AIConsentModal
        visible={showAIConsent}
        onAccept={handleAcceptConsent}
        characterName="Margie"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2e44',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#243b53',
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
    color: '#d97706',
  },
  refreshButton: {
    padding: 8,
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#451a03',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  saveBannerText: {
    fontSize: 13,
    color: '#fcd34d',
    fontWeight: '500',
  },
  aiProfileCard: {
    flexDirection: 'row',
    backgroundColor: '#243b53',
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
    borderColor: '#d97706',
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
    color: '#d97706',
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
    backgroundColor: '#d97706',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  margieBubble: {
    backgroundColor: '#243b53',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  margieLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  margieLabelAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  margieLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  margieText: {
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
    backgroundColor: '#243b53',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1a2e44',
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
    backgroundColor: '#d97706',
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
    backgroundColor: '#d97706',
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
  submitCallbackButton: {
    backgroundColor: '#d97706',
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
  },
  successCloseButton: {
    backgroundColor: '#d97706',
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
});
