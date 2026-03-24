/**
 * Dynamic AI Chat Route
 * 
 * Routes like /chat/hugo, /chat/bob, /chat/margie, etc.
 * Will automatically load the correct character from the config.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Linking,
  StatusBar,
  ImageSourcePropType,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/context/ThemeContext';
import { API_URL } from '../../src/config/api';

// Avatar image mapping for React Native local images
const AVATAR_IMAGES: Record<string, ImageSourcePropType> = {
  '/images/tommy.png': require('../../assets/images/tommy.png'),
  '/images/rachel.png': require('../../assets/images/rachel.png'),
  '/images/finch.png': require('../../assets/images/finch.png'),
  '/images/bob.png': require('../../assets/images/bob.png'),
  '/images/margie.png': require('../../assets/images/margie.png'),
  '/images/jack.png': require('../../assets/images/jack.png'),
  '/images/rita.png': require('../../assets/images/rita.png'),
  '/images/catherine.png': require('../../assets/images/catherine.png'),
  '/images/frankie.png': require('../../assets/images/frankie.png'),
  '/images/baz.png': require('../../assets/images/baz.png'),
  '/images/megan.png': require('../../assets/images/megan.png'),
  '/images/penny.png': require('../../assets/images/penny.png'),
  '/images/doris.png': require('../../assets/images/doris.png'),
  '/images/alex.png': require('../../assets/images/alex.png'),
  '/images/sam.png': require('../../assets/images/sam.png'),
  '/images/kofi.png': require('../../assets/images/kofi.png'),
  '/images/james.png': require('../../assets/images/james.png'),
  '/images/dave.png': require('../../assets/images/dave.png'),
  '/images/mo.png': require('../../assets/images/mo.png'),
  '/images/helen.png': require('../../assets/images/helen.png'),
  '/images/reg.png': require('../../assets/images/reg.png'),
};

// Helper function to get avatar source (handles both local and remote images)
const getAvatarSource = (avatar: string): ImageSourcePropType => {
  if (AVATAR_IMAGES[avatar]) {
    return AVATAR_IMAGES[avatar];
  }
  // For CMS/remote images, use URI
  return { uri: avatar };
};
import { getCharacter, AICharacter } from '../../src/config/ai-characters';
import AIConsentModal from '../../src/components/AIConsentModal';
import { useAgeGateContext } from '../../src/context/AgeGateContext';
import { useLocationPermission } from '../../src/context/LocationPermissionContext';
import SafeguardingCallModal from '../../src/components/SafeguardingCallModal';

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

export default function DynamicAIChat() {
  const router = useRouter();
  const { characterId = 'hugo' } = useLocalSearchParams<{ characterId: string }>();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Age gate context - for enhanced safeguarding
  const { isUnder18 } = useAgeGateContext();
  
  // Location permission context - for safeguarding GPS
  const { requestLocation, locationCoords, hasLocationPermission } = useLocationPermission();
  
  // Get character config
  const character = useMemo(() => getCharacter(characterId), [characterId]);
  
  // Create dynamic styles - use fallback color if character not found
  const styles = useMemo(() => createStyles(colors, isDark, character?.accentColor || '#3b82f6'), [colors, isDark, character?.accentColor]);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `${character.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // Track loading state for Enter key check
  const isLoadingRef = useRef(isLoading);
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);
  
  // Track inputText for Enter key check
  const inputTextRef = useRef(inputText);
  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);
  
  // Track if Enter was just pressed (for text change detection)
  const enterPressedRef = useRef(false);
  
  // Auth state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  
  // Consent state - now app-wide, not per-chat
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [hasAcceptedConsent, setHasAcceptedConsent] = useState(false);
  
  // Global consent key - same for all AI chats
  const GLOBAL_AI_CONSENT_KEY = 'radiocheck_ai_consent_accepted';
  
  // Safeguarding state
  const [showSafeguardingModal, setShowSafeguardingModal] = useState(false);
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [safeguardingView, setSafeguardingView] = useState<'main' | 'callback' | 'connecting' | 'callback_success'>('main');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackName, setCallbackName] = useState('');
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff>({ counsellors: [], peers: [] });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number; lon: number; accuracy: number} | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  
  // In-page call modal state (no redirect to peer-support)
  const [showInPageCallModal, setShowInPageCallModal] = useState(false);
  const [staffAvailable, setStaffAvailable] = useState(false);

  // ===== DEVICE-SIDE CONVERSATION MEMORY =====
  // Stores conversation history locally on the device - NO REGISTRATION REQUIRED
  // AI characters will remember previous conversations with the user
  const CONVERSATION_STORAGE_KEY = `radiocheck_chat_history_${character.id}`;
  const MAX_STORED_MESSAGES = 50; // Keep last 50 messages per character
  const [previousConversations, setPreviousConversations] = useState<Message[]>([]);
  const [hasLoadedLocalHistory, setHasLoadedLocalHistory] = useState(false);

  // Load previous conversations from device storage on mount
  useEffect(() => {
    const loadLocalConversationHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(CONVERSATION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert stored timestamps back to Date objects
          const messagesWithDates = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setPreviousConversations(messagesWithDates);
          console.log(`Loaded ${messagesWithDates.length} previous messages with ${character.name}`);
        }
      } catch (error) {
        console.error('Error loading conversation history:', error);
      } finally {
        setHasLoadedLocalHistory(true);
      }
    };
    
    loadLocalConversationHistory();
  }, [character.id]);

  // Save conversation to device storage whenever NEW messages are added
  // We need to track which messages are new (not from previousConversations)
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  
  useEffect(() => {
    const saveConversationToDevice = async () => {
      // Only save if there are actual new messages (beyond welcome message)
      const currentNewMessages = messages.filter(m => 
        !m.id.startsWith('welcome') && 
        !previousConversations.some(p => p.id === m.id)
      );
      
      if (currentNewMessages.length === 0) return;
      if (currentNewMessages.length === newMessagesCount) return; // No new messages
      
      setNewMessagesCount(currentNewMessages.length);
      
      try {
        // Combine previous + only truly new messages, keep only the last MAX_STORED_MESSAGES
        const allMessages = [...previousConversations, ...currentNewMessages];
        const toStore = allMessages.slice(-MAX_STORED_MESSAGES);
        await AsyncStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(toStore));
        console.log(`[ConversationMemory] Saved ${toStore.length} messages with ${character.name}`);
      } catch (error) {
        console.error('Error saving conversation history:', error);
      }
    };
    
    if (hasLoadedLocalHistory) {
      saveConversationToDevice();
    }
  }, [messages, hasLoadedLocalHistory, previousConversations, newMessagesCount]);

  // Build conversation context for AI (summary of previous conversations)
  const buildConversationContext = () => {
    if (previousConversations.length === 0) return '';
    
    // Get the last 15 messages from previous conversations for better context
    const recentPrevious = previousConversations.slice(-15);
    
    // Format as a conversation transcript for the AI
    const transcript = recentPrevious.map(msg => 
      `${msg.sender === 'user' ? 'User' : character.name}: ${msg.text}`
    ).join('\n');
    
    return `\n\n[RETURNING MATE - You've chatted with this person before. Here's what you talked about last time:

${transcript}

Talk to them like an old mate you're catching up with. Be natural - maybe ask "how'd that thing go?" or "you still dealing with that?" based on what they told you. No formal "welcome back" rubbish - just pick up like mates do. If they mentioned something was bothering them, check in on it. Keep it relaxed and genuine.]`;
  };

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
    // Close the safeguarding modal first, then navigate to live chat with session context
    setShowSafeguardingModal(false);
    setSafeguardingView('main');
    router.push({
      pathname: '/live-chat',
      params: { 
        alertId: currentAlertId || '',
        sessionId: sessionId,
        preferredType: 'chat'
      }
    });
  };

  // Check consent on mount - uses global key now
  useEffect(() => {
    checkAIConsent();
  }, []);

  const checkAIConsent = async () => {
    try {
      // App-wide consent is already handled at app startup (cookie_consent)
      // So we auto-accept here to avoid duplicate consent modals
      const cookieConsent = await AsyncStorage.getItem('cookie_consent');
      const aiConsent = await AsyncStorage.getItem(GLOBAL_AI_CONSENT_KEY);
      
      if (cookieConsent === 'accepted' || aiConsent === 'true') {
        // User has already consented at app level or previously in chat
        setHasAcceptedConsent(true);
        setHasLoadedSession(true);
        // Also save the AI consent if only cookie consent exists
        if (!aiConsent) {
          await AsyncStorage.setItem(GLOBAL_AI_CONSENT_KEY, 'true');
        }
      } else {
        setShowAIConsent(true);
      }
    } catch (error) {
      // On error, still allow access since app-level consent was likely given
      setHasAcceptedConsent(true);
      setHasLoadedSession(true);
    }
  };

  const handleAcceptConsent = async () => {
    try {
      // Save global consent, not per-character
      await AsyncStorage.setItem(GLOBAL_AI_CONSENT_KEY, 'true');
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

  // Natural returning user greetings - like two mates catching up
  const getReturningUserGreeting = (charId: string): string => {
    const greetings: Record<string, string[]> = {
      tommy: [
        "Ey up mate, good to see you again. How's things?",
        "Alright mucker, you're back. What's occurring?",
        "Hey mate, was just thinking about you. How you getting on?",
      ],
      doris: [
        "Hello love, nice to see you again. Kettle's on. What's on your mind?",
        "Hiya pet, good to have you back. How've you been?",
        "Hello again love. Come on in, let's have a chat.",
      ],
      bob: [
        "Alright mate, you're back. Brew's on. What's the score?",
        "Ey up mucker, good to see you. How's it going?",
        "Back again are we? Good lad. What's happening?",
      ],
      jack: [
        "Ahoy shipmate, you're back! Need help with compensation claims?",
        "Yo ho ho! Good to see you again. What can I help navigate today?",
        "Ahoy there! Jack at your service. Compensation questions?",
      ],
      margie: [
        "Hello love, nice to see you again. How have you been getting on?",
        "Hiya, good to have you back. No judgement here, just a friendly ear.",
        "Hello again sweetheart. How are things?",
      ],
      rita: [
        "Hello love, lovely to see you again. How are you doing?",
        "Hiya, you're back. How's everything at home?",
        "Hello again. Come and have a chat, I'm here for you.",
      ],
      catherine: [
        "Hello, good to see you again. What's on your mind today?",
        "Hello again. Let's pick up where we left off, or start fresh - your call.",
        "Good to see you. What would you like to talk through today?",
      ],
      sentry: [
        "Hello again. What legal matters can I help clarify today?",
        "Good to see you. What questions do you have?",
        "Hello. I'm here to help with any legal information you need.",
      ],
      frankie: [
        "Alright soldier, you're back! Ready to put in some work?",
        "Ey up, good to see you again. Time to crack on?",
        "Back for more are we? Good attitude. Let's go!",
      ],
      baz: [
        "Alright mucker, you're back! Need help finding something?",
        "Ey up fella, good to see you. Housing, support, transition stuff - what do you need?",
        "Back again! What can I help you navigate today?",
      ],
    };
    
    const charGreetings = greetings[charId] || greetings['tommy'];
    return charGreetings[Math.floor(Math.random() * charGreetings.length)];
  };

  // Add welcome message when session loads - with conversation memory awareness
  useEffect(() => {
    if (hasLoadedSession && hasLoadedLocalHistory && messages.length === 0) {
      // Check if this is a returning user with conversation history
      if (previousConversations.length > 0) {
        // Show previous messages first, then add a natural "welcome back" message
        const welcomeBackMessage: Message = {
          id: 'welcome-back',
          text: getReturningUserGreeting(character.id),
          sender: 'buddy',
          timestamp: new Date(),
        };
        // Show previous messages + welcome back
        setMessages([...previousConversations, welcomeBackMessage]);
      } else {
        // First-time user - show normal welcome
        const welcomeMessage: Message = {
          id: 'welcome',
          text: character.welcomeMessage,
          sender: 'buddy',
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      }
    }
  }, [hasLoadedSession, hasLoadedLocalHistory, character.welcomeMessage, previousConversations]);

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
      // Build conversation context from device-stored history
      const conversationContext = buildConversationContext();
      
      const response = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          character: character.id,
          sessionId: sessionId,
          is_under_18: isUnder18,
          // Include previous conversation context for AI memory
          conversation_context: conversationContext,
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

  // Web-specific: Attach native DOM keydown listener for Enter key to send
  // Uses capture phase to intercept before React Native Web handles it
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if Enter is pressed without Shift (Shift+Enter = new line)
      if (e.key === 'Enter' && !e.shiftKey) {
        // Check if the active element is our text input
        const activeElement = document.activeElement;
        const isOurInput = activeElement?.getAttribute('data-testid') === 'message-input' ||
                          activeElement?.tagName.toLowerCase() === 'textarea';
        
        if (isOurInput && inputTextRef.current.trim() && !isLoadingRef.current) {
          // Mark that Enter was pressed - handleTextChange will pick this up
          enterPressedRef.current = true;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          // Use setTimeout to ensure the event is fully cancelled before we send
          setTimeout(() => {
            handleSendMessage();
            enterPressedRef.current = false;
          }, 0);
          return false;
        }
      }
    };
    
    // Attach to document with capture: true to intercept before bubbling
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleSendMessage]);

  // Custom text change handler that strips trailing newlines added by Enter key
  const handleTextChange = useCallback((text: string) => {
    // If Enter was pressed and text has a trailing newline, it slipped through
    // Don't update state with the newline - the keydown handler will send the message
    if (Platform.OS === 'web' && enterPressedRef.current && text.endsWith('\n')) {
      return; // Ignore this change - message is being sent
    }
    
    // Also detect Enter key by comparing with ref (backup detection)
    if (Platform.OS === 'web' && text.endsWith('\n') && !inputTextRef.current.endsWith('\n')) {
      const textWithoutNewline = text.slice(0, -1);
      if (textWithoutNewline.trim() && !isLoadingRef.current) {
        handleSendMessage();
        return;
      }
    }
    setInputText(text);
  }, [handleSendMessage]);

  const clearConversation = async () => {
    // Clear both current messages and device-stored history
    const welcomeMessage: Message = {
      id: 'welcome',
      text: character.welcomeMessage,
      sender: 'buddy',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    
    // Also clear the stored conversation history from device
    try {
      await AsyncStorage.removeItem(CONVERSATION_STORAGE_KEY);
      setPreviousConversations([]);
      setNewMessagesCount(0);
      console.log(`[ConversationMemory] Cleared conversation history with ${character.name}`);
    } catch (error) {
      console.error('Error clearing conversation history:', error);
    }
  };

  const handleGoBack = () => {
    // Check if there's history to go back to
    // If not (e.g., after page refresh), navigate to home
    if (typeof window !== 'undefined' && window.history.length <= 1) {
      router.replace('/home');
    } else {
      router.back();
    }
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
        <Pressable onPress={handleGoBack} style={styles.backButton} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Image source={getAvatarSource(character.avatar)} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{character.name}</Text>
          <Text style={styles.headerSubtitle}>{character.role}</Text>
        </View>
        <Pressable onPress={clearConversation} style={styles.refreshButton} data-testid="clear-chat-btn">
          <Ionicons name="refresh" size={22} color={colors.text} />
        </Pressable>
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
          <Image source={getAvatarSource(character.avatar)} style={styles.aiProfileAvatar} />
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
        {/* Show "Previous conversation" header if there's history */}
        {previousConversations.length > 0 && (
          <View style={styles.conversationDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Previous conversation</Text>
            <View style={styles.dividerLine} />
          </View>
        )}
        
        {messages.map((message, index) => {
          // Check if this message marks the start of the new session
          const isFirstNewMessage = previousConversations.length > 0 && 
            message.id === 'welcome-back';
          
          return (
            <React.Fragment key={message.id}>
              {/* Show "Today" divider before the welcome back message */}
              {isFirstNewMessage && (
                <View style={styles.conversationDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Today</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}
              
              <View 
                style={[
                  styles.messageBubble,
                  message.sender === 'user' ? styles.userBubble : styles.buddyBubble
                ]}
              >
                {message.sender === 'buddy' && (
                  <View style={styles.buddyLabel}>
                    <Image source={getAvatarSource(character.avatar)} style={styles.buddyLabelAvatar} />
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
            </React.Fragment>
          );
        })}
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
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline={Platform.OS !== 'web'}
            maxLength={1000}
            data-testid="message-input"
            blurOnSubmit={Platform.OS === 'web'}
            returnKeyType="send"
            onSubmitEditing={() => {
              // Send on keyboard submit (Enter on web, Return on mobile)
              if (inputText.trim() && !isLoading) {
                handleSendMessage();
              }
            }}
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
                  Would you like to speak with a real person right now?
                </Text>
                
                <View style={{ gap: 12, marginVertical: 16 }}>
                  {/* Call a Supporter Button */}
                  <TouchableOpacity
                    style={[styles.safeguardingOption, { backgroundColor: '#dcfce7', borderColor: '#16a34a', borderWidth: 2 }]}
                    onPress={async () => {
                      // Request GPS location before opening call modal
                      if (currentAlertId) {
                        console.log('Requesting GPS location before call...');
                        try {
                          const coords = await requestLocation();
                          if (coords) {
                            setUserLocation(coords);
                            // Send the GPS coordinates to update the safeguarding alert
                            await fetch(`${API_URL}/api/safeguarding-alerts/${currentAlertId}/location`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                gps_lat: coords.lat,
                                gps_lon: coords.lon,
                                gps_accuracy: coords.accuracy,
                                location_source: 'gps'
                              }),
                            });
                          } else if (locationCoords) {
                            // Use cached location
                            setUserLocation(locationCoords);
                            await fetch(`${API_URL}/api/safeguarding-alerts/${currentAlertId}/location`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                gps_lat: locationCoords.lat,
                                gps_lon: locationCoords.lon,
                                gps_accuracy: locationCoords.accuracy,
                                location_source: 'gps_cached'
                              }),
                            });
                          }
                        } catch (err) {
                          console.error('Failed to get/send location:', err);
                        }
                      }
                      // Open in-page call modal instead of navigating to peer-support
                      setShowSafeguardingModal(false);
                      setShowInPageCallModal(true);
                    }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' }}>
                      <FontAwesome5 name="phone-alt" size={20} color="#ffffff" />
                    </View>
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={[styles.safeguardingOptionTitle, { color: '#16a34a', fontSize: 17 }]}>Call a Supporter</Text>
                      <Text style={styles.safeguardingOptionDesc}>
                        {isCheckingAvailability 
                          ? 'Checking availability...'
                          : staffAvailable
                            ? 'Speak to someone now'
                            : 'Voice call when available'}
                      </Text>
                    </View>
                    {staffAvailable && (
                      <View style={{ backgroundColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>LIVE</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Chat with a Supporter Button */}
                  <TouchableOpacity
                    style={[styles.safeguardingOption, { backgroundColor: '#dbeafe', borderColor: '#2563eb', borderWidth: 2 }]}
                    onPress={handleConnectToStaff}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' }}>
                      <FontAwesome5 name="comments" size={20} color="#ffffff" />
                    </View>
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={[styles.safeguardingOptionTitle, { color: '#2563eb', fontSize: 17 }]}>Chat with a Supporter</Text>
                      <Text style={styles.safeguardingOptionDesc}>
                        {isCheckingAvailability 
                          ? 'Checking availability...'
                          : staffAvailable
                            ? 'Text chat - usually faster'
                            : 'Text chat if you prefer'}
                      </Text>
                    </View>
                    {staffAvailable && (
                      <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>LIVE</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Request Callback - smaller, secondary option */}
                  <TouchableOpacity
                    style={[styles.safeguardingOption, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                    onPress={() => setSafeguardingView('callback')}
                  >
                    <FontAwesome5 name="phone-volume" size={20} color="#64748b" />
                    <View style={styles.safeguardingOptionContent}>
                      <Text style={[styles.safeguardingOptionTitle, { color: '#64748b', fontSize: 15 }]}>Request a Callback</Text>
                      <Text style={[styles.safeguardingOptionDesc, { fontSize: 12 }]}>We'll call you back later</Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={14} color="#64748b" />
                  </TouchableOpacity>
                </View>

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

      {/* In-page Safeguarding Call Modal */}
      <SafeguardingCallModal
        visible={showInPageCallModal}
        alertId={currentAlertId}
        sessionId={sessionId}
        onClose={() => {
          setShowInPageCallModal(false);
          setLocationRequested(false); // Reset for next call
        }}
        onCallEnded={() => {
          setShowInPageCallModal(false);
          setLocationRequested(false);
        }}
      />
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
  // Conversation history divider styles
  conversationDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
