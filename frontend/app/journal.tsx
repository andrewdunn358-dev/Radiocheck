import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { goBack } from '../src/utils/navigation';

interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  mood?: string;
}

const JOURNAL_STORAGE_KEY = '@veterans_journal_entries';

export default function Journal() {
  const router = useRouter();
  const { colors } = useTheme();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const moods = [
    { emoji: '😊', label: 'Great' },
    { emoji: '🙂', label: 'Good' },
    { emoji: '😐', label: 'Okay' },
    { emoji: '😔', label: 'Low' },
    { emoji: '😢', label: 'Struggling' },
  ];

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const stored = await AsyncStorage.getItem(JOURNAL_STORAGE_KEY);
      if (stored) {
        setEntries(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading journal entries:', error);
    }
  };

  const saveEntries = async (newEntries: JournalEntry[]) => {
    try {
      await AsyncStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(newEntries));
      setEntries(newEntries);
    } catch (error) {
      console.error('Error saving journal entries:', error);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Entry', 'Please write something before saving.');
      return;
    }

    const now = new Date().toISOString();
    
    if (editingEntry) {
      // Update existing entry
      const updatedEntries = entries.map(entry =>
        entry.id === editingEntry.id
          ? { ...entry, content: content.trim(), updatedAt: now, mood: selectedMood }
          : entry
      );
      await saveEntries(updatedEntries);
    } else {
      // Create new entry
      const newEntry: JournalEntry = {
        id: Date.now().toString(),
        content: content.trim(),
        createdAt: now,
        updatedAt: now,
        mood: selectedMood,
      };
      await saveEntries([newEntry, ...entries]);
    }

    setContent('');
    setSelectedMood(undefined);
    setEditingEntry(null);
    setIsWriting(false);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setContent(entry.content);
    setSelectedMood(entry.mood);
    setIsWriting(true);
  };

  const handleDelete = (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this journal entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedEntries = entries.filter(entry => entry.id !== entryId);
            await saveEntries(updatedEntries);
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredEntries = searchQuery
    ? entries.filter(entry =>
        entry.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  const styles = createStyles(colors);

  if (isWriting) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle={colors.background === '#1a2332' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => {
                setIsWriting(false);
                setEditingEntry(null);
                setContent('');
                setSelectedMood(undefined);
              }} style={styles.backButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{editingEntry ? 'Edit Entry' : 'New Entry'}</Text>
              <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* Mood Selector */}
            <View style={styles.moodSelector}>
              <Text style={styles.moodLabel}>How are you feeling?</Text>
              <View style={styles.moodOptions}>
                {moods.map((mood) => (
                  <TouchableOpacity
                    key={mood.emoji}
                    style={[
                      styles.moodButton,
                      selectedMood === mood.emoji && styles.moodButtonSelected,
                    ]}
                    onPress={() => setSelectedMood(selectedMood === mood.emoji ? undefined : mood.emoji)}
                  >
                    <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                    <Text style={[
                      styles.moodText,
                      selectedMood === mood.emoji && styles.moodTextSelected,
                    ]}>{mood.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              placeholder="Write your thoughts here..."
              placeholderTextColor={colors.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={colors.background === '#1a2332' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBack(router)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Journal</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Your journal is private and stored only on this device. No one else can see it.
          </Text>
        </View>

        {/* New Entry Button */}
        <TouchableOpacity
          style={styles.newEntryButton}
          onPress={() => setIsWriting(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={24} color={colors.primaryText} />
          <Text style={styles.newEntryButtonText}>Write New Entry</Text>
        </TouchableOpacity>

        {/* Search */}
        {entries.length > 0 && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search entries..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching entries' : 'Your journal is empty'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'Start writing to capture your thoughts'}
            </Text>
          </View>
        ) : (
          filteredEntries.map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View style={styles.entryMeta}>
                  {entry.mood && <Text style={styles.entryMood}>{entry.mood}</Text>}
                  <Text style={styles.entryDate}>{formatDate(entry.createdAt)}</Text>
                </View>
                <View style={styles.entryActions}>
                  <TouchableOpacity onPress={() => handleEdit(entry)} style={styles.actionButton}>
                    <Ionicons name="pencil" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(entry.id)} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.entryContent} numberOfLines={6}>
                {entry.content}
              </Text>
              {entry.updatedAt !== entry.createdAt && (
                <Text style={styles.editedLabel}>Edited</Text>
              )}
            </View>
          ))
        )}

        {/* Entry Count */}
        {entries.length > 0 && (
          <Text style={styles.entryCount}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} total
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  newEntryButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  newEntryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryText,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryMood: {
    fontSize: 20,
  },
  entryDate: {
    fontSize: 13,
    color: colors.textMuted,
  },
  entryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
  },
  entryContent: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  editedLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  entryCount: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  moodSelector: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  moodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  moodOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodButton: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 60,
  },
  moodButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceHover,
  },
  moodEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  moodText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  moodTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  textInput: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
