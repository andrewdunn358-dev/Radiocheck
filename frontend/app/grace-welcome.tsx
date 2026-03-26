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
        {/* Header with logo + skip */}
        <View style={styles.header}>
          <Animated.View style={{ transform: [{ scale: breatheAnim }] }}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </Animated.View>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            data-testid="grace-skip-btn"
          >
            <Text style={styles.skipText}>Go straight in</Text>
            <Ionicons name="arrow-forward" size={16} color="#8ba4c4" />
          </TouchableOpacity>
        </View>

        {/* Grace avatar + name */}
        <View style={styles.graceHeader}>
          <Image source={GRACE_AVATAR} style={styles.graceAvatar} />
          <View>
            <Text style={styles.graceName}>Grace</Text>
            <Text style={styles.graceRole}>Welcome & Signposting</Text>
          </View>
        </View>

        {/* Chat messages */}
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
              {/* Navigation action buttons */}
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
                        <Ionicons name="arrow-forward-circle" size={16} color="#fff" />
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

        {/* Input area */}
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
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a2e44' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logo: { width: 44, height: 44 },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skipText: { fontSize: 13, color: '#8ba4c4', fontWeight: '500' },
  graceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  graceAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#10b981' },
  graceName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  graceRole: { fontSize: 12, color: '#8ba4c4' },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  bubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
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
  bubbleText: { fontSize: 15, lineHeight: 22 },
  graceText: { color: '#e2e8f0' },
  userText: { color: '#fff' },
  actionsContainer: {
    gap: 6,
    marginBottom: 12,
    marginLeft: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  actionBtnPrimary: { backgroundColor: '#10b981' },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionText: { fontSize: 13, fontWeight: '600' },
  actionTextPrimary: { color: '#fff' },
  actionTextSecondary: { color: '#8ba4c4' },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'web' ? 16 : 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#1a2e44',
  },
  input: {
    flex: 1,
    backgroundColor: '#243447',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#e2e8f0',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
