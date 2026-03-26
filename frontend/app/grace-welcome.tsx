import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ScrollView, Platform, Animated, Easing, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const LOGO = require('../assets/images/logo.png');
const GRACE_AVATAR = require('../assets/images/grace.png');

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'grace';
  timestamp: Date;
  actions?: { label: string; route: string }[];
}

export default function GraceWelcome() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(`grace-${Date.now()}`);
  const scrollRef = useRef<ScrollView>(null);
  const breatheAnim = useRef(new Animated.Value(1)).current;

  // Breathing animation for logo
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.06,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Auto-fire Grace's opening line
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages([{
        id: 'welcome-1',
        text: "Hello. I'm Grace. Welcome to Radio Check.\nTake a breath \u2014 you've found the right place.\nWhat's brought you here today?",
        sender: 'grace',
        timestamp: new Date(),
      }]);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const resp = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          character: 'grace',
          sessionId,
        }),
      });
      const data = await resp.json();
      const reply = data.reply || "I'm here. Take your time.";

      // Parse navigation actions from Grace's response
      const actions = parseNavigationActions(reply);

      setMessages(prev => [...prev, {
        id: `grace-${Date.now()}`,
        text: reply,
        sender: 'grace',
        timestamp: new Date(),
        actions,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `grace-err-${Date.now()}`,
        text: "Sorry, I'm having a bit of trouble right now. Try again in a moment.",
        sender: 'grace',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Parse navigation cues from Grace's response
  const parseNavigationActions = (text: string): { label: string; route: string }[] => {
    const actions: { label: string; route: string }[] = [];
    const lower = text.toLowerCase();
    const personaMap: Record<string, string> = {
      tommy: '/chat/tommy', dave: '/chat/dave', helen: '/chat/helen',
      bob: '/chat/bob', mo: '/chat/mo', reg: '/chat/reg',
      finch: '/chat/finch', doris: '/chat/doris', frankie: '/chat/frankie',
      rachel: '/chat/rachel', margie: '/chat/margie', megan: '/chat/megan',
      penny: '/chat/penny', jack: '/chat/jack', kofi: '/chat/kofi',
      catherine: '/chat/catherine', sam: '/chat/sam', rita: '/chat/rita',
      james: '/chat/james', baz: '/chat/baz', alex: '/chat/alex',
    };

    // Check for persona mentions with navigation cues
    if (lower.includes('take you') || lower.includes('want me to')) {
      for (const [name, route] of Object.entries(personaMap)) {
        if (lower.includes(name)) {
          actions.push({ label: `Yes, take me to ${name.charAt(0).toUpperCase() + name.slice(1)}`, route });
          break;
        }
      }
      if (lower.includes('peer support')) {
        actions.push({ label: 'Yes, take me to Peer Support', route: '/peer-support' });
      }
      if (lower.includes('counsellor')) {
        actions.push({ label: 'Yes, take me to Counsellors', route: '/counsellors' });
      }
      if (lower.includes('live support')) {
        actions.push({ label: 'Yes, connect me to Live Support', route: '/live-support' });
      }
      if (actions.length > 0) {
        actions.push({ label: 'Not yet, keep chatting', route: '' });
      }
    }
    return actions;
  };

  const handleAction = (route: string) => {
    if (route) {
      router.push(route as any);
    }
    // Empty route = "keep chatting", do nothing
  };

  const handleSkip = () => {
    router.replace('/home');
  };

  // Enter key handler for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: any) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [inputText, isLoading]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Skip button - top right */}
        <View style={styles.skipRow}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            data-testid="grace-skip-btn"
          >
            <Text style={styles.skipText}>Go straight in</Text>
            <Ionicons name="arrow-forward" size={14} color="#8ba4c4" />
          </TouchableOpacity>
        </View>

        {/* Breathing logo - centered, prominent */}
        <View style={styles.logoArea}>
          <Animated.View style={{ transform: [{ scale: breatheAnim }] }}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </Animated.View>
          <Text style={styles.appName}>Radio Check</Text>
        </View>

        {/* Chat card - compact, below logo */}
        <View style={styles.chatCard}>
          {/* Grace identity bar */}
          <View style={styles.graceHeader}>
            <Image source={GRACE_AVATAR} style={styles.graceAvatar} />
            <View>
              <Text style={styles.graceName}>Grace</Text>
              <Text style={styles.graceRole}>Welcome & Signposting</Text>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map(msg => (
              <View key={msg.id}>
                <View style={[
                  styles.bubble,
                  msg.sender === 'user' ? styles.userBubble : styles.graceBubble,
                ]}>
                  <Text style={[
                    styles.bubbleText,
                    msg.sender === 'user' ? styles.userText : styles.graceText,
                  ]}>
                    {msg.text}
                  </Text>
                </View>
                {msg.actions && msg.actions.length > 0 && (
                  <View style={styles.actionsContainer}>
                    {msg.actions.map((action, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.actionBtn,
                          action.route ? styles.actionBtnPrimary : styles.actionBtnSecondary,
                        ]}
                        onPress={() => handleAction(action.route)}
                        data-testid={`grace-action-${i}`}
                      >
                        {action.route ? (
                          <Ionicons name="arrow-forward-circle" size={14} color="#fff" />
                        ) : null}
                        <Text style={[
                          styles.actionText,
                          action.route ? styles.actionTextPrimary : styles.actionTextSecondary,
                        ]}>
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            {isLoading && (
              <View style={[styles.bubble, styles.graceBubble]}>
                <ActivityIndicator size="small" color="#10b981" />
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Talk to Grace..."
              placeholderTextColor="#64748b"
              multiline
              maxLength={1000}
              data-testid="grace-message-input"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              data-testid="grace-send-btn"
            >
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1b2d' },
  container: { flex: 1 },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skipText: { fontSize: 12, color: '#8ba4c4', fontWeight: '500' },
  logoArea: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  logo: { width: 80, height: 80 },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e2e8f0',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  chatCard: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#1a2e44',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  graceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  graceAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#10b981' },
  graceName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  graceRole: { fontSize: 11, color: '#8ba4c4' },
  chatArea: { flex: 1 },
  chatContent: { padding: 12, paddingBottom: 4 },
  bubble: {
    maxWidth: '82%',
    padding: 10,
    borderRadius: 14,
    marginBottom: 6,
  },
  graceBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#243447',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0d9488',
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  graceText: { color: '#e2e8f0' },
  userText: { color: '#fff' },
  actionsContainer: {
    gap: 5,
    marginBottom: 8,
    marginLeft: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignSelf: 'flex-start',
  },
  actionBtnPrimary: { backgroundColor: '#10b981' },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionText: { fontSize: 12, fontWeight: '600' },
  actionTextPrimary: { color: '#fff' },
  actionTextSecondary: { color: '#8ba4c4' },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    backgroundColor: '#243447',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#e2e8f0',
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
