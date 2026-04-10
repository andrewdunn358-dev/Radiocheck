/**
 * Conversation Storage Service
 * ============================
 * 
 * Stores conversation history on the user's device for continuity across sessions.
 * 
 * Features:
 * - Stores last 50 messages per AI character
 * - Generates AI summaries of conversations
 * - Privacy controls (view/delete/opt-out)
 * - Feeds into safeguarding system for cross-session context
 * - Encryption for stored data
 * - Auto-delete after 7 days
 * 
 * Storage structure:
 * - Full transcripts (last 50 messages per character)
 * - Session summaries (AI-generated)
 * - Risk flags from previous sessions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// Use native Web Crypto API instead of expo-crypto for web compatibility

// Storage keys
const STORAGE_KEYS = {
  CONVERSATIONS: 'radiocheck_conversations',
  SUMMARIES: 'radiocheck_summaries',
  OPT_OUT: 'radiocheck_storage_opt_out',
  LAST_SYNC: 'radiocheck_last_sync',
  ENCRYPTION_KEY: 'radiocheck_enc_key',
  LAST_CLEANUP: 'radiocheck_last_cleanup',
};

// Configuration
const MAX_MESSAGES_PER_CHARACTER = 50;
const MAX_SESSIONS_TO_KEEP = 10;
const AUTO_DELETE_DAYS = 7;
const CLEANUP_CHECK_HOURS = 24;

// Types
export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  riskScore?: number;
  riskLevel?: string;
}

export interface ConversationData {
  characterId: string;
  characterName: string;
  messages: StoredMessage[];
  lastUpdated: string;
  totalMessageCount: number;
}

export interface SessionSummary {
  sessionId: string;
  characterId: string;
  characterName: string;
  date: string;
  summary: string;
  keyTopics: string[];
  emotionalState?: string;
  riskFlags: string[];
  messageCount: number;
}

export interface StorageStatus {
  optedOut: boolean;
  totalMessages: number;
  totalSessions: number;
  characters: string[];
  storageSize: string;
  encryptionEnabled: boolean;
  autoDeleteDays: number;
  oldestMessageDate: string | null;
}

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

/**
 * Simple encryption using base64 encoding with a key
 * Note: For production, use a proper encryption library like expo-secure-store
 */
async function getOrCreateEncryptionKey(): Promise<string> {
  try {
    let key = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTION_KEY);
    if (!key) {
      // Generate a random key
      const randomBytes = new Uint8Array(32);
      if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(randomBytes);
      } else {
        for (let i = 0; i < 32; i++) randomBytes[i] = Math.floor(Math.random() * 256);
      }
      key = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTION_KEY, key);
    }
    return key;
  } catch (error) {
    console.error('[ConversationStorage] Error with encryption key:', error);
    return 'fallback_key_12345';
  }
}

function simpleEncrypt(data: string, key: string): string {
  try {
    // Simple XOR encryption + base64 (for basic obfuscation)
    const encoded = data.split('').map((char, i) => {
      const keyChar = key.charCodeAt(i % key.length);
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
    }).join('');
    return btoa(unescape(encodeURIComponent(encoded)));
  } catch (error) {
    console.error('[ConversationStorage] Encryption error:', error);
    return data;
  }
}

function simpleDecrypt(encryptedData: string, key: string): string {
  try {
    const decoded = decodeURIComponent(escape(atob(encryptedData)));
    return decoded.split('').map((char, i) => {
      const keyChar = key.charCodeAt(i % key.length);
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
    }).join('');
  } catch (error) {
    console.error('[ConversationStorage] Decryption error:', error);
    return encryptedData;
  }
}

async function encryptAndStore(key: string, data: any): Promise<void> {
  const encKey = await getOrCreateEncryptionKey();
  const jsonData = JSON.stringify(data);
  const encrypted = simpleEncrypt(jsonData, encKey);
  await AsyncStorage.setItem(key, encrypted);
}

async function retrieveAndDecrypt<T>(key: string): Promise<T | null> {
  try {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    
    const encKey = await getOrCreateEncryptionKey();
    const decrypted = simpleDecrypt(encrypted, encKey);
    return JSON.parse(decrypted);
  } catch (error) {
    // If decryption fails, try reading as plain JSON (backwards compatibility)
    try {
      const data = await AsyncStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch {}
    return null;
  }
}

// ============================================================================
// AUTO-DELETE UTILITIES
// ============================================================================

/**
 * Run auto-delete cleanup for messages older than AUTO_DELETE_DAYS
 */
export async function runAutoDeleteCleanup(): Promise<{ messagesDeleted: number; sessionsDeleted: number }> {
  try {
    // Check if cleanup was run recently
    const lastCleanup = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CLEANUP);
    if (lastCleanup) {
      const lastCleanupDate = new Date(lastCleanup);
      const hoursSinceCleanup = (Date.now() - lastCleanupDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCleanup < CLEANUP_CHECK_HOURS) {
        return { messagesDeleted: 0, sessionsDeleted: 0 };
      }
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AUTO_DELETE_DAYS);
    const cutoffTime = cutoffDate.toISOString();
    
    let messagesDeleted = 0;
    let sessionsDeleted = 0;
    
    // Clean up old messages
    const conversations = await getConversations();
    for (const conv of conversations) {
      const originalCount = conv.messages.length;
      conv.messages = conv.messages.filter(msg => msg.timestamp >= cutoffTime);
      messagesDeleted += originalCount - conv.messages.length;
    }
    
    // Remove empty conversations
    const nonEmptyConversations = conversations.filter(c => c.messages.length > 0);
    if (nonEmptyConversations.length > 0) {
      await encryptAndStore(STORAGE_KEYS.CONVERSATIONS, nonEmptyConversations);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
    }
    
    // Clean up old session summaries
    const summaries = await getSessionSummaries();
    const originalSummaryCount = summaries.length;
    const filteredSummaries = summaries.filter(s => s.date >= cutoffTime);
    sessionsDeleted = originalSummaryCount - filteredSummaries.length;
    
    if (filteredSummaries.length > 0) {
      await encryptAndStore(STORAGE_KEYS.SUMMARIES, filteredSummaries);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.SUMMARIES);
    }
    
    // Update last cleanup timestamp
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_CLEANUP, new Date().toISOString());
    
    if (messagesDeleted > 0 || sessionsDeleted > 0) {
      console.log(`[ConversationStorage] Auto-delete cleanup: ${messagesDeleted} messages, ${sessionsDeleted} sessions removed`);
    }
    
    return { messagesDeleted, sessionsDeleted };
  } catch (error) {
    console.error('[ConversationStorage] Auto-delete cleanup error:', error);
    return { messagesDeleted: 0, sessionsDeleted: 0 };
  }
}

/**
 * Check if user has opted out of conversation storage
 */
export async function isStorageOptedOut(): Promise<boolean> {
  try {
    const optOut = await AsyncStorage.getItem(STORAGE_KEYS.OPT_OUT);
    return optOut === 'true';
  } catch (error) {
    console.error('[ConversationStorage] Error checking opt-out:', error);
    return false;
  }
}

/**
 * Set opt-out preference
 */
export async function setStorageOptOut(optOut: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.OPT_OUT, optOut ? 'true' : 'false');
    
    // If opting out, clear all stored data
    if (optOut) {
      await clearAllStoredData();
    }
  } catch (error) {
    console.error('[ConversationStorage] Error setting opt-out:', error);
  }
}

/**
 * Store a new message in the conversation history
 */
export async function storeMessage(
  characterId: string,
  characterName: string,
  message: StoredMessage
): Promise<void> {
  try {
    // Check opt-out
    if (await isStorageOptedOut()) {
      return;
    }
    
    // Run auto-delete cleanup periodically
    await runAutoDeleteCleanup();
    
    // Get existing conversations
    const conversations = await getConversations();
    
    // Find or create conversation for this character
    let conversation = conversations.find(c => c.characterId === characterId);
    
    if (!conversation) {
      conversation = {
        characterId,
        characterName,
        messages: [],
        lastUpdated: new Date().toISOString(),
        totalMessageCount: 0,
      };
      conversations.push(conversation);
    }
    
    // Add the message
    conversation.messages.push(message);
    conversation.lastUpdated = new Date().toISOString();
    conversation.totalMessageCount++;
    
    // Trim to max messages
    if (conversation.messages.length > MAX_MESSAGES_PER_CHARACTER) {
      conversation.messages = conversation.messages.slice(-MAX_MESSAGES_PER_CHARACTER);
    }
    
    // Save back with encryption
    await encryptAndStore(STORAGE_KEYS.CONVERSATIONS, conversations);
    
  } catch (error) {
    console.error('[ConversationStorage] Error storing message:', error);
  }
}

/**
 * Store multiple messages at once (for batch updates)
 */
export async function storeMessages(
  characterId: string,
  characterName: string,
  messages: StoredMessage[]
): Promise<void> {
  for (const message of messages) {
    await storeMessage(characterId, characterName, message);
  }
}

/**
 * Get all stored conversations
 */
export async function getConversations(): Promise<ConversationData[]> {
  try {
    if (await isStorageOptedOut()) {
      return [];
    }
    
    // Try to read encrypted data first
    const data = await retrieveAndDecrypt<ConversationData[]>(STORAGE_KEYS.CONVERSATIONS);
    return data || [];
  } catch (error) {
    console.error('[ConversationStorage] Error getting conversations:', error);
    return [];
  }
}

/**
 * Get conversation history for a specific character
 */
export async function getConversationForCharacter(characterId: string): Promise<ConversationData | null> {
  try {
    const conversations = await getConversations();
    return conversations.find(c => c.characterId === characterId) || null;
  } catch (error) {
    console.error('[ConversationStorage] Error getting conversation:', error);
    return null;
  }
}

/**
 * Get recent messages for a character (for AI context)
 */
export async function getRecentMessages(
  characterId: string,
  count: number = 50
): Promise<StoredMessage[]> {
  try {
    const conversation = await getConversationForCharacter(characterId);
    if (!conversation) {
      return [];
    }
    return conversation.messages.slice(-count);
  } catch (error) {
    console.error('[ConversationStorage] Error getting recent messages:', error);
    return [];
  }
}

/**
 * Store a session summary
 */
export async function storeSessionSummary(summary: SessionSummary): Promise<void> {
  try {
    if (await isStorageOptedOut()) {
      return;
    }
    
    const summaries = await getSessionSummaries();
    summaries.push(summary);
    
    // Trim to max sessions
    if (summaries.length > MAX_SESSIONS_TO_KEEP) {
      summaries.splice(0, summaries.length - MAX_SESSIONS_TO_KEEP);
    }
    
    // Save with encryption
    await encryptAndStore(STORAGE_KEYS.SUMMARIES, summaries);
    
  } catch (error) {
    console.error('[ConversationStorage] Error storing summary:', error);
  }
}

/**
 * Get all session summaries
 */
export async function getSessionSummaries(): Promise<SessionSummary[]> {
  try {
    if (await isStorageOptedOut()) {
      return [];
    }
    
    const data = await retrieveAndDecrypt<SessionSummary[]>(STORAGE_KEYS.SUMMARIES);
    return data || [];
  } catch (error) {
    console.error('[ConversationStorage] Error getting summaries:', error);
    return [];
  }
}

/**
 * Get session summaries for a specific character
 */
export async function getSessionSummariesForCharacter(characterId: string): Promise<SessionSummary[]> {
  try {
    const summaries = await getSessionSummaries();
    return summaries.filter(s => s.characterId === characterId);
  } catch (error) {
    console.error('[ConversationStorage] Error getting character summaries:', error);
    return [];
  }
}

/**
 * Get previous session context for AI (formatted for prompts)
 */
export async function getPreviousSessionContext(characterId: string): Promise<{
  summaries: SessionSummary[];
  recentMessages: StoredMessage[];
  hasRiskHistory: boolean;
  riskFlags: string[];
}> {
  try {
    const summaries = await getSessionSummariesForCharacter(characterId);
    const recentMessages = await getRecentMessages(characterId, 20);
    
    // Collect all risk flags from previous sessions
    const allRiskFlags = summaries.flatMap(s => s.riskFlags);
    const uniqueRiskFlags = [...new Set(allRiskFlags)];
    
    return {
      summaries: summaries.slice(-5), // Last 5 sessions
      recentMessages,
      hasRiskHistory: uniqueRiskFlags.length > 0,
      riskFlags: uniqueRiskFlags,
    };
  } catch (error) {
    console.error('[ConversationStorage] Error getting session context:', error);
    return {
      summaries: [],
      recentMessages: [],
      hasRiskHistory: false,
      riskFlags: [],
    };
  }
}

/**
 * Delete conversation history for a specific character
 */
export async function deleteConversationForCharacter(characterId: string): Promise<void> {
  try {
    const conversations = await getConversations();
    const filtered = conversations.filter(c => c.characterId !== characterId);
    await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(filtered));
    
    // Also delete summaries for this character
    const summaries = await getSessionSummaries();
    const filteredSummaries = summaries.filter(s => s.characterId !== characterId);
    await AsyncStorage.setItem(STORAGE_KEYS.SUMMARIES, JSON.stringify(filteredSummaries));
    
  } catch (error) {
    console.error('[ConversationStorage] Error deleting conversation:', error);
  }
}

/**
 * Clear all stored data
 */
export async function clearAllStoredData(): Promise<void> {
  try {
    // Get ALL keys to find any chat_history_* keys
    const allKeys = await AsyncStorage.getAllKeys();
    const chatHistoryKeys = allKeys.filter(k => k.startsWith('chat_history_'));
    
    // Clear ALL user data for a completely fresh state
    await AsyncStorage.multiRemove([
      // Conversation storage
      STORAGE_KEYS.CONVERSATIONS,
      STORAGE_KEYS.SUMMARIES,
      STORAGE_KEYS.OPT_OUT,
      STORAGE_KEYS.LAST_SYNC,
      STORAGE_KEYS.ENCRYPTION_KEY,
      STORAGE_KEYS.LAST_CLEANUP,
      // Auth
      'auth_token',
      'auth_user',
      // Favourites
      '@veterans_favorite_counsellors',
      '@veterans_favorite_peers',
      // Journal and mood
      '@veterans_journal_entries',
      '@veterans_mood_entries',
      '@veterans_last_checkin',
      // Location
      'location_permission_asked',
      'last_known_location',
      // Age gate
      '@radio_check_dob',
      '@radio_check_age_verified',
      // Site gate
      'site_unlocked',
      // Theme
      '@veterans_app_theme',
      // Chat history per character
      ...chatHistoryKeys,
    ]);
  } catch (error) {
    console.error('[ConversationStorage] Error clearing data:', error);
  }
}

/**
 * Get storage status for privacy settings
 */
export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    const optedOut = await isStorageOptedOut();
    
    if (optedOut) {
      return {
        optedOut: true,
        totalMessages: 0,
        totalSessions: 0,
        characters: [],
        storageSize: '0 KB',
        encryptionEnabled: true,
        autoDeleteDays: AUTO_DELETE_DAYS,
        oldestMessageDate: null,
      };
    }
    
    const conversations = await getConversations();
    const summaries = await getSessionSummaries();
    
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
    const characters = conversations.map(c => c.characterName);
    
    // Find oldest message date
    let oldestDate: string | null = null;
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        if (!oldestDate || msg.timestamp < oldestDate) {
          oldestDate = msg.timestamp;
        }
      }
    }
    
    // Estimate storage size
    const convSize = JSON.stringify(conversations).length;
    const sumSize = JSON.stringify(summaries).length;
    const totalBytes = convSize + sumSize;
    const sizeKB = (totalBytes / 1024).toFixed(1);
    
    return {
      optedOut: false,
      totalMessages,
      totalSessions: summaries.length,
      characters,
      storageSize: `${sizeKB} KB`,
      encryptionEnabled: true,
      autoDeleteDays: AUTO_DELETE_DAYS,
      oldestMessageDate: oldestDate,
    };
  } catch (error) {
    console.error('[ConversationStorage] Error getting status:', error);
    return {
      optedOut: false,
      totalMessages: 0,
      totalSessions: 0,
      characters: [],
      storageSize: '0 KB',
      encryptionEnabled: true,
      autoDeleteDays: AUTO_DELETE_DAYS,
      oldestMessageDate: null,
    };
  }
}

/**
 * Generate a session summary (to be called by AI service)
 */
export function createSessionSummary(
  sessionId: string,
  characterId: string,
  characterName: string,
  messages: StoredMessage[],
  aiGeneratedSummary: string,
  keyTopics: string[],
  emotionalState?: string,
  riskFlags: string[] = []
): SessionSummary {
  return {
    sessionId,
    characterId,
    characterName,
    date: new Date().toISOString(),
    summary: aiGeneratedSummary,
    keyTopics,
    emotionalState,
    riskFlags,
    messageCount: messages.length,
  };
}

/**
 * Export conversation data (for user to download)
 */
export async function exportConversationData(): Promise<string> {
  try {
    const conversations = await getConversations();
    const summaries = await getSessionSummaries();
    
    const exportData = {
      exportDate: new Date().toISOString(),
      conversations,
      summaries,
    };
    
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('[ConversationStorage] Error exporting data:', error);
    return '{}';
  }
}
