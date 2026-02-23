import React, { useState, useRef, useEffect } from 'react';
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
  Image,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../src/config/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'buddy';
  timestamp: Date;
}

interface CharacterInfo {
  name: string;
  avatar: string;
}

interface AvailableStaff {
  counsellors: any[];
  peers: any[];
}

export default function AIChat() {
  const router = useRouter();
  const { character = 'tommy' } = useLocalSearchParams<{ character: string }>();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo>(() => {
    // Set initial name based on character parameter
    const names: Record<string, string> = {
      tommy: 'Tommy',
      doris: 'Doris',
      hugo: 'Hugo',
      rita: 'Rita',
      bob: 'Bob',
      margie: 'Margie',
      sentry: 'Finch',
    };
    return { name: names[character] || 'Tommy', avatar: '' };
  });
  const [sessionId] = useState(() => `${character}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [showSafeguardingModal, setShowSafeguardingModal] = useState(false);
  const [safeguardingView, setSafeguardingView] = useState<'main' | 'callback' | 'connecting' | 'callback_success'>('main');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackName, setCallbackName] = useState('');
  const [callbackEmail, setCallbackEmail] = useState('');
  const [callbackMessage, setCallbackMessage] = useState('');
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff>({ counsellors: [], peers: [] });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(true);
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Email + PIN state for saving conversations
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [saveEmail, setSaveEmail] = useState('');
  const [savePin, setSavePin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  
  // Verification modal state for returning users
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyPin, setVerifyPin] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [pendingMessages, setPendingMessages] = useState<Message[] | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<string | null>(null);

  useEffect(() => {
    // Check for saved session on mount
    loadSavedSession();
  }, [character]);

  useEffect(() => {
    // Only start chat if disclaimer has been accepted
    if (hasAcceptedDisclaimer) {
      fetchCharacterInfo();
      sendInitialGreeting();
    }
  }, [character, hasAcceptedDisclaimer]);

  const loadSavedSession = async () => {
    try {
      const storageKey = `ai_chat_${character}`;
      const storedEmail = await AsyncStorage.getItem(`${storageKey}_email`);
      const storedPin = await AsyncStorage.getItem(`${storageKey}_pin`);
      const storedMessages = await AsyncStorage.getItem(`${storageKey}_messages`);
      
      if (storedEmail && storedPin && storedMessages) {
        // There's a saved session - require verification before loading
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
        setShowDisclaimerModal(false); // Hide disclaimer while verifying
      }
    } catch (error) {
      console.error('Error loading session:', error);
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
      setHasAcceptedDisclaimer(true);
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
      const storageKey = `ai_chat_${character}`;
      await AsyncStorage.removeItem(`${storageKey}_email`);
      await AsyncStorage.removeItem(`${storageKey}_pin`);
      await AsyncStorage.removeItem(`${storageKey}_messages`);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
    
    // Clear state and show disclaimer for new session
    setPendingMessages(null);
    setPendingEmail(null);
    setPendingPin(null);
    setShowVerifyModal(false);
    setShowDisclaimerModal(true);
    setVerifyEmail('');
    setVerifyPin('');
    setVerifyError('');
  };

  const saveMessages = async (newMessages: Message[]) => {
    if (isAuthenticated) {
      try {
        const storageKey = `ai_chat_${character}`;
        await AsyncStorage.setItem(`${storageKey}_messages`, JSON.stringify(newMessages));
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    }
  };

  const handleSetupEmail = async () => {
    if (saveEmail && savePin.length === 4) {
      try {
        const storageKey = `ai_chat_${character}`;
        await AsyncStorage.setItem(`${storageKey}_email`, saveEmail);
        await AsyncStorage.setItem(`${storageKey}_pin`, savePin);
        setSavedEmail(saveEmail);
        setIsAuthenticated(true);
        setShowEmailModal(false);
        await saveMessages(messages);
      } catch (error) {
        console.error('Error saving credentials:', error);
      }
    }
  };

  const handleAcceptDisclaimer = () => {
    setShowDisclaimerModal(false);
    setHasAcceptedDisclaimer(true);
  };

  const handleDeclineDisclaimer = () => {
    setShowDisclaimerModal(false);
    router.back();
  };

  const fetchCharacterInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai-buddies/characters`);
      const data = await response.json();
      const char = data.characters.find((c: any) => c.id === character);
      if (char) {
        setCharacterInfo({ name: char.name, avatar: char.avatar });
      }
    } catch (error) {
      console.error('Error fetching character:', error);
    }
  };

  const sendInitialGreeting = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello',
          sessionId: sessionId,
          character: character,
        }),
      });

      const data = await response.json();
      if (response.ok && data.reply) {
        setCharacterInfo({ name: data.characterName, avatar: data.characterAvatar });
        setMessages([{
          id: 'greeting',
          text: data.reply,
          sender: 'buddy',
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      console.error('Error getting greeting:', error);
      // Character-specific fallback greetings
      const greetings: Record<string, string> = {
        tommy: "Hello, I'm Tommy. I'm here to listen whenever you need to talk.",
        doris: "Hello love, I'm Doris. I'm here for you, whenever you need to chat.",
        hugo: "Hey, Hugo here. How are you doing today?",
        rita: "Hello love, I'm Rita. How are you doing today?",
        bob: "Alright mate, Bob here. What's on your mind?",
        margie: "Hello dear, I'm Margie. I'm here to listen.",
        sentry: "Hello, Finch here. I'm here to help however I can.",
      };
      const fallbackGreeting = greetings[character] || `Hello, I'm here to listen whenever you need to talk.`;
      setMessages([{
        id: 'greeting',
        text: fallbackGreeting,
        sender: 'buddy',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
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
      // Build the message with user's optional message
      let fullMessage = `Safeguarding callback request from AI chat. Session: ${sessionId}.`;
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
        // Show success view
        setSafeguardingView('callback_success');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Callback error:', errorData);
        Alert.alert('Error', 'Failed to submit callback request. Please try again or call 116 123.');
      }
    } catch (error) {
      console.error('Callback error:', error);
      Alert.alert('Error', 'Failed to submit callback request. Please try again or call 116 123.');
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  // Handle connecting to live person - creates chat room for ANY available staff to pick up
  const handleLiveConnect = async (type: 'counsellor' | 'peer') => {
    setSafeguardingView('connecting');
    
    // Navigate to live chat - room will be created and all staff will be alerted
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

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          sessionId: sessionId,
          character: character,
        }),
      });

      const data = await response.json();

      if (response.ok && data.reply) {
        const buddyMessage: Message = {
          id: `buddy-${Date.now()}`,
          text: data.reply,
          sender: 'buddy',
          timestamp: new Date(),
        };
        setMessages(prev => {
          const newMessages = [...prev, buddyMessage];
          saveMessages(newMessages);
          return newMessages;
        });
        
        // Check if safeguarding was triggered
        if (data.safeguardingTriggered) {
          setCurrentAlertId(data.safeguardingAlertId);
          checkAvailability(); // Check who's available
          setShowSafeguardingModal(true);
        }
      } else {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          text: data.detail || "I'm having trouble right now. Please try again or speak to a real person using the buttons below.",
          sender: 'buddy',
          timestamp: new Date(),
        };
        setMessages(prev => {
          const newMessages = [...prev, errorMessage];
          saveMessages(newMessages);
          return newMessages;
        });
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: "I'm having trouble connecting. Please check your internet or speak to a real person using the buttons below.",
        sender: 'buddy',
        timestamp: new Date(),
      };
      setMessages(prev => {
        const newMessages = [...prev, errorMessage];
        saveMessages(newMessages);
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Legal Disclaimer Modal */}
      <Modal
        visible={showDisclaimerModal}
        transparent
        animationType="fade"
        onRequestClose={handleDeclineDisclaimer}
      >
        <View style={styles.disclaimerModalOverlay}>
          <View style={styles.disclaimerModalContent}>
            <View style={styles.disclaimerModalHeader}>
              <FontAwesome5 name="shield-alt" size={32} color="#0d9488" />
              <Text style={styles.disclaimerModalTitle}>Before You Chat</Text>
              <Text style={styles.disclaimerSubtitle}>Important information about AI support</Text>
            </View>

            <ScrollView style={styles.disclaimerModalScroll}>
              <Text style={styles.disclaimerModalSection}>AI Companion Notice</Text>
              <Text style={styles.disclaimerModalText}>
                {characterInfo.name} is an <Text style={{fontWeight: '600'}}>AI companion</Text>, not a human 
                counsellor or therapist. While they can offer support and a listening ear, 
                they cannot provide professional mental health treatment.
              </Text>

              <Text style={styles.disclaimerModalSection}>What {characterInfo.name} Can Do</Text>
              <View style={styles.disclaimerModalList}>
                <Text style={styles.disclaimerModalListItem}>
                  <FontAwesome5 name="check-circle" size={12} color="#10b981" /> Listen without judgement
                </Text>
                <Text style={styles.disclaimerModalListItem}>
                  <FontAwesome5 name="check-circle" size={12} color="#10b981" /> Offer emotional support
                </Text>
                <Text style={styles.disclaimerModalListItem}>
                  <FontAwesome5 name="check-circle" size={12} color="#10b981" /> Share coping techniques
                </Text>
                <Text style={styles.disclaimerModalListItem}>
                  <FontAwesome5 name="check-circle" size={12} color="#10b981" /> Provide UK veteran resources
                </Text>
              </View>

              <Text style={styles.disclaimerModalSection}>What {characterInfo.name} Cannot Do</Text>
              <View style={styles.disclaimerModalList}>
                <Text style={styles.disclaimerModalListItem}>
                  <FontAwesome5 name="times-circle" size={12} color="#ef4444" /> Diagnose conditions
                </Text>
                <Text style={styles.disclaimerModalListItem}>
                  <FontAwesome5 name="times-circle" size={12} color="#ef4444" /> Prescribe medication
                </Text>
                <Text style={styles.disclaimerModalListItem}>
                  <FontAwesome5 name="times-circle" size={12} color="#ef4444" /> Replace professional therapy
                </Text>
                <Text style={styles.disclaimerModalListItem}>
                  <FontAwesome5 name="times-circle" size={12} color="#ef4444" /> Provide emergency response
                </Text>
              </View>

              <Text style={styles.disclaimerModalSection}>Your Privacy & Safety</Text>
              <Text style={styles.disclaimerModalText}>
                Your conversations are processed to provide support and detect crisis 
                situations. We use encryption to protect your data. If our system detects 
                you may be in crisis, we may alert our safeguarding team to ensure you 
                get the support you need.
              </Text>

              <View style={styles.disclaimerCrisisBox}>
                <Text style={styles.disclaimerCrisisTitle}>In an Emergency</Text>
                <Text style={styles.disclaimerCrisisText}>
                  <FontAwesome5 name="phone-alt" size={14} color="#fff" /> Call 999 for emergencies
                </Text>
                <Text style={styles.disclaimerCrisisText}>
                  <FontAwesome5 name="phone-alt" size={14} color="#fff" /> Samaritans: 116 123 (free, 24/7)
                </Text>
                <Text style={styles.disclaimerCrisisText}>
                  <FontAwesome5 name="phone-alt" size={14} color="#fff" /> Combat Stress: 0800 138 1619
                </Text>
              </View>
            </ScrollView>

            <View style={styles.disclaimerModalButtons}>
              <TouchableOpacity 
                style={styles.disclaimerDeclineButton}
                onPress={handleDeclineDisclaimer}
              >
                <Text style={styles.disclaimerDeclineText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.disclaimerAcceptButton}
                onPress={handleAcceptDisclaimer}
                data-testid="accept-disclaimer-btn"
              >
                <FontAwesome5 name="check" size={16} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.disclaimerAcceptText}>I Understand, Start Chat</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.disclaimerFooter}>
              By continuing, you acknowledge you have read and understood this information.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          {characterInfo.avatar ? (
            <Image source={{ uri: characterInfo.avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <FontAwesome5 name="user" size={20} color="#3b82f6" />
            </View>
          )}
          <View>
            <Text style={styles.headerTitle}>{characterInfo.name}</Text>
            <Text style={styles.headerSubtitle}>On stag 24/7</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/ai-buddies')} style={styles.switchButton}>
          <FontAwesome5 name="exchange-alt" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Save Conversation Banner */}
      {!isAuthenticated && (
        <TouchableOpacity 
          style={styles.saveBanner}
          onPress={() => setShowEmailModal(true)}
        >
          <Ionicons name="bookmark-outline" size={18} color="#3b82f6" />
          <Text style={styles.saveBannerText}>Save conversation to continue later</Text>
          <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
        </TouchableOpacity>
      )}

      {isAuthenticated && (
        <View style={styles.authenticatedBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          <Text style={styles.authenticatedText}>Conversation saved locally</Text>
        </View>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <FontAwesome5 name="info-circle" size={14} color="#64748b" />
        <Text style={styles.disclaimerText}>
          {characterInfo.name} is an AI and cannot provide advice or replace human support.
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
              message.sender === 'user' ? styles.userBubble : styles.buddyBubble,
            ]}
          >
            {message.sender === 'buddy' && (
              <View style={styles.buddyLabel}>
                {characterInfo.avatar ? (
                  <Image source={{ uri: characterInfo.avatar }} style={styles.buddyLabelAvatar} />
                ) : null}
                <Text style={styles.buddyLabelText}>{characterInfo.name} (AI Battle Buddy)</Text>
              </View>
            )}
            <Text
              style={[
                styles.messageText,
                message.sender === 'user' ? styles.userText : styles.buddyText,
              ]}
            >
              {message.text}
            </Text>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.buddyBubble]}>
            <View style={styles.buddyLabel}>
              {characterInfo.avatar ? (
                <Image source={{ uri: characterInfo.avatar }} style={styles.buddyLabelAvatar} />
              ) : null}
              <Text style={styles.buddyLabelText}>{characterInfo.name} (AI Battle Buddy)</Text>
            </View>
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.typingText}>{characterInfo.name} is typing...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Talk to Real Person Buttons */}
      <View style={styles.realPersonButtons}>
        <TouchableOpacity
          style={styles.realPersonButton}
          onPress={() => router.push('/peer-support')}
        >
          <FontAwesome5 name="users" size={16} color="#16a34a" />
          <Text style={styles.realPersonButtonText}>Talk to a peer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.realPersonButton, styles.counsellorButton]}
          onPress={() => router.push('/crisis-support')}
        >
          <FontAwesome5 name="user-md" size={16} color="#2563eb" />
          <Text style={[styles.realPersonButtonText, styles.counsellorButtonText]}>
            Talk to a counsellor
          </Text>
        </TouchableOpacity>
      </View>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isLoading}
        >
          <FontAwesome5 name="paper-plane" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

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
                  
                  {/* Option C: Connect to Live Person */}
                  <View style={styles.liveConnectSection}>
                    <Text style={styles.liveConnectLabel}>Connect Now</Text>
                    {isCheckingAvailability ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <>
                        {availableStaff.counsellors.length > 0 && (
                          <TouchableOpacity
                            style={[styles.safeguardingOption, styles.liveOption]}
                            onPress={() => handleLiveConnect('counsellor', availableStaff.counsellors[0])}
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
                            onPress={() => handleLiveConnect('peer', availableStaff.peers[0])}
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
                  <Text style={styles.inputLabel}>Your Name (optional)</Text>
                  <TextInput
                    style={styles.callbackInput}
                    placeholder="Your name"
                    placeholderTextColor="#94a3b8"
                    value={callbackName}
                    onChangeText={setCallbackName}
                  />
                  
                  <Text style={styles.inputLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.callbackInput}
                    placeholder="Your phone number"
                    placeholderTextColor="#94a3b8"
                    value={callbackPhone}
                    onChangeText={setCallbackPhone}
                    keyboardType="phone-pad"
                  />
                  
                  <Text style={styles.inputLabel}>Email (optional)</Text>
                  <TextInput
                    style={styles.callbackInput}
                    placeholder="your.email@example.com"
                    placeholderTextColor="#94a3b8"
                    value={callbackEmail}
                    onChangeText={setCallbackEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  
                  <Text style={styles.inputLabel}>Anything you'd like us to know? (optional)</Text>
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

      {/* Email Setup Modal */}
      <Modal
        visible={showEmailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.emailModalOverlay}>
          <View style={styles.emailModalContent}>
            <TouchableOpacity 
              style={styles.emailModalClose}
              onPress={() => setShowEmailModal(false)}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
            
            <Ionicons name="bookmark" size={48} color="#3b82f6" />
            <Text style={styles.emailModalTitle}>Save Your Conversation</Text>
            <Text style={styles.emailModalDescription}>
              Enter your email and create a 4-digit PIN to save this conversation. 
              You can continue where you left off next time.
            </Text>

            <View style={styles.privacyNotice}>
              <Ionicons name="shield-checkmark" size={20} color="#22c55e" />
              <Text style={styles.privacyText}>
                Your conversation is stored only on your device, not in any database. 
                Your privacy is protected.
              </Text>
            </View>

            <Text style={styles.emailInputLabel}>Email</Text>
            <TextInput
              style={styles.emailModalInput}
              value={saveEmail}
              onChangeText={setSaveEmail}
              placeholder="your@email.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.emailInputLabel}>4-Digit PIN</Text>
            <TextInput
              style={styles.emailModalInput}
              value={savePin}
              onChangeText={(text) => setSavePin(text.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="1234"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />

            <TouchableOpacity
              style={[
                styles.emailModalButton,
                (!saveEmail || savePin.length !== 4) && styles.emailModalButtonDisabled
              ]}
              onPress={handleSetupEmail}
              disabled={!saveEmail || savePin.length !== 4}
            >
              <Text style={styles.emailModalButtonText}>Save Conversation</Text>
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
        <View style={styles.emailModalOverlay}>
          <View style={styles.emailModalContent}>
            <Ionicons name="person-circle" size={48} color="#3b82f6" />
            <Text style={styles.emailModalTitle}>Welcome Back</Text>
            <Text style={styles.emailModalDescription}>
              We found a saved conversation. Please verify your identity to continue where you left off.
            </Text>

            {verifyError ? (
              <View style={styles.verifyErrorContainer}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <Text style={styles.verifyErrorText}>{verifyError}</Text>
              </View>
            ) : null}

            <Text style={styles.emailInputLabel}>Email</Text>
            <TextInput
              style={styles.emailModalInput}
              value={verifyEmail}
              onChangeText={setVerifyEmail}
              placeholder="your@email.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              data-testid="verify-email-input"
            />

            <Text style={styles.emailInputLabel}>4-Digit PIN</Text>
            <TextInput
              style={styles.emailModalInput}
              value={verifyPin}
              onChangeText={(text) => setVerifyPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="1234"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              data-testid="verify-pin-input"
            />

            <TouchableOpacity
              style={[
                styles.emailModalButton,
                (!verifyEmail || verifyPin.length !== 4) && styles.emailModalButtonDisabled
              ]}
              onPress={handleVerifyIdentity}
              disabled={!verifyEmail || verifyPin.length !== 4}
              data-testid="verify-continue-btn"
            >
              <Text style={styles.emailModalButtonText}>Continue Conversation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.startFreshButton}
              onPress={handleStartFresh}
              data-testid="start-fresh-btn"
            >
              <Text style={styles.startFreshText}>Start a New Conversation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2634',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  switchButton: {
    padding: 10,
    backgroundColor: '#2d3a4d',
    borderRadius: 8,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
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
  buddyBubble: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  buddyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  buddyLabelAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  buddyLabelText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  buddyText: {
    color: '#1e293b',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  realPersonButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  realPersonButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  counsellorButton: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
  realPersonButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  counsellorButtonText: {
    color: '#2563eb',
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
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  // Safeguarding Modal Styles
  safeguardingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  safeguardingModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  safeguardingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  safeguardingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
    textAlign: 'center',
  },
  safeguardingText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  safeguardingScroll: {
    maxHeight: 300,
  },
  safeguardingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    gap: 12,
  },
  safeguardingOptionContent: {
    flex: 1,
  },
  safeguardingOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  safeguardingOptionDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  liveConnectSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  liveConnectLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  liveOption: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  availableDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16a34a',
    position: 'absolute',
    top: 16,
    left: 16,
  },
  noOneAvailable: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  emergencyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  emergencyNoteText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
  },
  safeguardingContinue: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  safeguardingContinueText: {
    fontSize: 14,
    color: '#64748b',
    textDecorationLine: 'underline',
  },
  // Callback Form Styles
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
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  callbackInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  submitCallbackButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitCallbackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  callbackMessageInput: {
    height: 80,
    paddingTop: 12,
  },
  // Success View Styles
  successView: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  successSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  successCloseButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  successCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Connecting View Styles
  connectingView: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  connectingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 20,
  },
  connectingText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  // Legal Disclaimer Modal Styles
  disclaimerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  disclaimerModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  disclaimerModalHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  disclaimerModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
  },
  disclaimerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  disclaimerModalScroll: {
    maxHeight: 320,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  disclaimerModalSection: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 14,
    marginBottom: 6,
  },
  disclaimerModalText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  disclaimerModalList: {
    marginLeft: 8,
    gap: 4,
  },
  disclaimerModalListItem: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  disclaimerCrisisBox: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  disclaimerCrisisTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  disclaimerCrisisText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  disclaimerModalButtons: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  disclaimerFooter: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  disclaimerDeclineButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disclaimerDeclineText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  disclaimerAcceptButton: {
    flex: 2,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disclaimerAcceptText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Save Conversation Banner Styles
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  saveBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#2563eb',
  },
  authenticatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  authenticatedText: {
    fontSize: 12,
    color: '#16a34a',
  },
  // Email Modal Styles
  emailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emailModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  emailModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  emailModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emailModalDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: '#16a34a',
    lineHeight: 18,
  },
  emailInputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  emailModalInput: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emailModalButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  emailModalButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  emailModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  verifyErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  verifyErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  startFreshButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  startFreshText: {
    fontSize: 14,
    color: '#64748b',
    textDecorationLine: 'underline',
  },
});
