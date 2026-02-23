import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { useCMSContent, getSection, CMSCard } from '../src/hooks/useCMSContent';

// Fallback hardcoded tools (used when CMS is empty or unavailable)
const FALLBACK_TOOLS = [
  { id: 'screening', title: 'Mental Health Check', description: 'PHQ-9 & GAD-7 assessments', icon: 'clipboard', color: '#3b82f6', bgColor: '#dbeafe', route: '/mental-health-screening' },
  { id: 'journal', title: 'My Journal', description: 'Write down your thoughts', icon: 'book', color: '#3b82f6', bgColor: '#dbeafe', route: '/journal' },
  { id: 'mood', title: 'Daily Check-in', description: "Track how you're feeling", icon: 'happy', color: '#f59e0b', bgColor: '#fef3c7', route: '/mood' },
  { id: 'grounding', title: 'Grounding Tools', description: '5-4-3-2-1 and more techniques', icon: 'hand-left', color: '#22c55e', bgColor: '#dcfce7', route: '/grounding' },
  { id: 'breathing', title: 'Breathing Exercises', description: 'Box breathing & relaxation', icon: 'cloud', color: '#06b6d4', bgColor: '#cffafe', route: '/breathing-game' },
  { id: 'buddy-finder', title: 'Buddy Finder', description: 'Connect with serving personnel and veterans near you', icon: 'people', color: '#10b981', bgColor: '#d1fae5', route: '/buddy-finder' },
  { id: 'regimental', title: 'Regimental Associations', description: 'Find your regiment network', icon: 'flag', color: '#ef4444', bgColor: '#fee2e2', route: '/regimental-associations' },
  { id: 'local-services', title: 'Find Local Support', description: 'Services near you', icon: 'location', color: '#8b5cf6', bgColor: '#ede9fe', route: '/local-services' },
  { id: 'resources', title: 'Resources Library', description: 'Helpful information', icon: 'library', color: '#ec4899', bgColor: '#fce7f3', route: '/resources' },
];

// Helper to get background color for a card
function getBackgroundColor(color: string | null): string {
  if (!color) return '#e2e8f0';
  // Create a lighter version of the color
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Lighten the color
  const lighten = (c: number) => Math.round(c + (255 - c) * 0.8);
  return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
}

export default function SelfCarePage() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { sections, isLoading, error } = useCMSContent('self-care');

  // Get CMS cards or fall back to hardcoded
  const cardsSection = getSection(sections, 'cards');
  const cmsCards = cardsSection?.cards || [];
  
  // Use CMS cards if available, otherwise fallback
  const tools = cmsCards.length > 0 
    ? cmsCards.filter(c => c.is_visible).sort((a, b) => a.order - b.order)
    : FALLBACK_TOOLS;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Self-Care Tools</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro Card */}
        <View style={[styles.introCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.introIconContainer}>
            <Ionicons name="heart" size={28} color="#ec4899" />
          </View>
          <Text style={[styles.introTitle, { color: colors.text }]}>Take Care of Yourself</Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Small steps every day make a big difference. These tools are here to help you 
            manage stress, track your wellbeing, and find support when you need it.
          </Text>
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {/* Tools Grid - CMS-driven or fallback */}
        <View style={styles.toolsGrid}>
          {tools.map((tool: any) => {
            // Handle both CMS format and fallback format
            const isCMS = 'section_id' in tool;
            const toolIcon = isCMS ? tool.icon : tool.icon;
            const toolColor = isCMS ? (tool.color || '#3b82f6') : tool.color;
            const toolBgColor = isCMS ? getBackgroundColor(tool.color) : tool.bgColor;
            const toolRoute = isCMS ? tool.route : tool.route;
            const toolId = isCMS ? tool.id : tool.id;
            
            return (
              <TouchableOpacity
                key={toolId}
                style={[styles.toolCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => toolRoute && router.push(toolRoute as any)}
                activeOpacity={0.8}
                data-testid={`tool-card-${toolId}`}
              >
                <View style={[styles.toolIconContainer, { backgroundColor: toolBgColor }]}>
                  <Ionicons name={(toolIcon || 'apps') as any} size={28} color={toolColor} />
                </View>
                <Text style={[styles.toolTitle, { color: colors.text }]}>{tool.title}</Text>
                <Text style={[styles.toolDescription, { color: colors.textSecondary }]}>{tool.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Note */}
        <View style={styles.bottomNote}>
          <Ionicons name="information-circle" size={18} color={colors.textSecondary} />
          <Text style={[styles.bottomNoteText, { color: colors.textSecondary }]}>
            {"If you're in crisis, call Samaritans on 116 123 or Combat Stress on 0800 138 1619"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 32,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  introCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  introIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fce7f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  introText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolCard: {
    width: '48%',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  toolIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  toolDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  bottomNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  bottomNoteText: {
    fontSize: 13,
    textAlign: 'center',
    flex: 1,
  },
});
