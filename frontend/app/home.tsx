import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Image, Modal, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { useCMSContent, getSection, CMSCard } from '../src/hooks/useCMSContent';
import BetaSurvey from '../src/components/BetaSurvey';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NEW_LOGO_URL = require('../assets/images/logo.png');

// AI Team member type
interface AITeamMember {
  name: string;
  avatar: string;
  description: string;
  bio: string;
  route: string;
}

// Menu item type
interface MenuItem {
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  route: string;
  isPrimary?: boolean;
  isCallback?: boolean;
}

// Fallback Menu Items (used when CMS is empty or unavailable)
const FALLBACK_MENU_ITEMS: MenuItem[] = [
  { title: "Need to Talk?", description: "Connect with support now", icon: "heart", color: "#3b82f6", bgColor: "#dbeafe", route: "/crisis-support", isPrimary: true },
  { title: "Talk to a Veteran", description: "Peer support from those who understand", icon: "people", color: "#22c55e", bgColor: "#dcfce7", route: "/peer-support" },
  { title: "Warfare on Lawfare", description: "Support for historical investigations", icon: "shield", color: "#6366f1", bgColor: "#e0e7ff", route: "/historical-investigations" },
  { title: "Support Organisations", description: "Directory of veteran services", icon: "list", color: "#f59e0b", bgColor: "#fef3c7", route: "/organizations" },
  { title: "Self-Care Tools", description: "Journal, grounding, breathing & more", icon: "fitness", color: "#ec4899", bgColor: "#fce7f3", route: "/self-care" },
  { title: "Friends & Family", description: "Worried about a veteran?", icon: "heart-circle", color: "#7c3aed", bgColor: "#ede9fe", route: "/family-friends" },
  { title: "Addictions", description: "Alcohol, drugs, gambling & more", icon: "heart-dislike", color: "#d97706", bgColor: "#fef3c7", route: "/substance-support" },
  { title: "Criminal Justice Support", description: "Help for veterans in or leaving prison", icon: "shield-checkmark", color: "#4f46e5", bgColor: "#e0e7ff", route: "/criminal-justice" },
  { title: "The Gym", description: "Frankie's 12-week fitness programme", icon: "barbell", color: "#22c55e", bgColor: "#dcfce7", route: "/gym" },
  { title: "Recommended Podcasts", description: "Veteran stories & mental health support", icon: "headset", color: "#db2777", bgColor: "#fce7f3", route: "/podcasts" },
  { title: "Request a Callback", description: "We'll call you back", icon: "call", color: "#22c55e", bgColor: "#dcfce7", route: "/callback", isCallback: true },
];

// Fallback AI Team (used when CMS is empty or unavailable)
const FALLBACK_AI_TEAM: AITeamMember[] = [
  { name: 'Frankie', avatar: '/images/frankie.png', description: 'Your PTI - Physical Training', bio: 'Frankie is your PTI (Physical Training Instructor). A former British Army PTI who brings proper military fitness discipline with motivating banter. He offers a 12-week progressive programme to build strength, resilience and mental toughness.', route: '/chat/frankie' },
  { name: 'Tommy', avatar: '/images/tommy.png', description: 'Your battle buddy', bio: 'Tommy is your straightforward battle buddy. A no-nonsense mate who tells it like it is, but always has your back. He understands military life inside out and provides honest, direct support.', route: '/chat/tommy' },
  { name: 'Rachel', avatar: '/images/doris.png', description: 'Warm support', bio: 'Rachel is a nurturing, compassionate presence who creates a safe space to talk. She offers warmth and understanding, like a caring friend who listens without judgement.', route: '/chat/doris' },
  { name: 'Bob', avatar: '/images/bob.png', description: 'Ex-Para peer support', bio: 'Bob is a down-to-earth ex-Para who keeps things real. He\'s been there, done that, and offers honest peer support from someone who truly understands the military experience.', route: '/chat/bob' },
  { name: 'Finch', avatar: '/images/finch.png', description: 'Military law & legal support', bio: 'Finch is a knowledgeable companion with expertise in UK military law, including the Armed Forces Act, Manual of Military Law, and service discipline. He helps veterans understand their legal rights and navigate military justice matters.', route: '/chat/sentry' },
  { name: 'Margie', avatar: '/images/margie.png', description: 'Addiction support', bio: 'Margie is a wise, understanding presence with warmth and years of experience. She specialises in supporting those dealing with all types of addiction - alcohol, drugs, gambling and more - offering non-judgemental guidance.', route: '/chat/margie' },
  { name: 'Hugo', avatar: '/images/hugo.png', description: 'Veteran services navigator', bio: 'Hugo is your guide to UK veteran support systems. He helps you find the right organisations, charities, and services for housing, jobs, benefits, legal help and more. His focus is on clear signposting and practical next steps.', route: '/chat/hugo' },
  { name: 'Rita', avatar: '/images/rita.png', description: 'Family support', bio: 'Rita is a warm, grounded family-support companion for partners, spouses, parents and loved ones of military personnel. She\'s been around the military for a long time and understands what families go through.', route: '/chat/rita' },
  { name: 'Catherine', avatar: '/images/catherine.png', description: 'Calm & intelligent support', bio: 'Catherine is composed, articulate, and grounded. She helps you think clearly when emotions run high and approach problems with calm intelligence. She guides you toward realistic next steps, not abstract solutions.', route: '/chat/catherine' },
];

export default function Index() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const styles = createStyles(colors);
  const [showAITeam, setShowAITeam] = useState(false);
  const [selectedMember, setSelectedMember] = useState<AITeamMember | null>(null);
  const [userId, setUserId] = useState<string>('');
  
  // Generate or retrieve anonymous user ID for survey tracking
  useEffect(() => {
    const getOrCreateUserId = async () => {
      try {
        let id = await AsyncStorage.getItem('anonymous_user_id');
        if (!id) {
          id = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
          await AsyncStorage.setItem('anonymous_user_id', id);
        }
        setUserId(id);
        
        // Track app visit for analytics
        trackAppVisit(id);
      } catch (e) {
        setUserId('fallback_' + Date.now());
      }
    };
    getOrCreateUserId();
  }, []);
  
  // Track app visit for analytics
  const trackAppVisit = async (sessionId: string) => {
    try {
      const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://mental-health-hub-81.preview.emergentagent.com';
      const region = await AsyncStorage.getItem('user_region'); // Get stored region if available
      
      // Get screen dimensions for device type detection
      const { Dimensions } = require('react-native');
      const { width: screenWidth } = Dimensions.get('window');
      
      // Get full user agent string for better device/browser detection
      // On web, we can access navigator.userAgent, on native use Platform info
      let userAgent = Platform.OS;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        userAgent = navigator.userAgent;
      } else {
        // For native apps, construct a helpful identifier
        userAgent = `RadioCheck-${Platform.OS}/${Platform.Version || 'unknown'}`;
      }
      
      await fetch(`${API_URL}/api/analytics/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_agent: userAgent,
          region: region,
          referrer: null,
          screen_width: screenWidth
        })
      });
      
      // Set up heartbeat to track active users (every 5 minutes)
      const heartbeatInterval = setInterval(async () => {
        try {
          await fetch(`${API_URL}/api/analytics/heartbeat?session_id=${sessionId}`, {
            method: 'POST'
          });
        } catch (e) {
          // Silent fail for heartbeat
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      // Cleanup on unmount
      return () => clearInterval(heartbeatInterval);
    } catch (e) {
      // Silent fail - analytics shouldn't break the app
      console.log('Analytics tracking error:', e);
    }
  };
  
  // Fetch CMS content for the home page
  const { sections, isLoading } = useCMSContent('home');
  
  // Get menu section from CMS
  const menuSection = getSection(sections, 'menu');
  const cmsMenuCards = menuSection?.cards || [];
  
  // Get AI team section from CMS
  const aiTeamSection = getSection(sections, 'ai_team');
  const cmsAICards = aiTeamSection?.cards || [];
  
  // Use CMS menu items if available, otherwise fall back to hardcoded
  const menuItems: MenuItem[] = cmsMenuCards.length > 0
    ? cmsMenuCards.map((card: CMSCard) => ({
        title: card.title,
        description: card.description || '',
        icon: card.icon || 'apps',
        color: card.color || '#3b82f6',
        bgColor: card.bg_color || '#dbeafe',
        route: card.route || card.external_url || '/',
        isPrimary: card.is_primary || false,
        isCallback: card.is_callback || false,
      })).sort((a: MenuItem, b: MenuItem) => (a as any).order - (b as any).order)
    : FALLBACK_MENU_ITEMS;
  
  // Use CMS AI team data if available, otherwise fall back to hardcoded
  
  // Use CMS data if available, otherwise fall back to hardcoded
  const aiTeam: AITeamMember[] = cmsAICards.length > 0 
    ? cmsAICards.filter(c => c.is_visible).sort((a, b) => a.order - b.order).map(c => ({
        name: c.title,
        avatar: c.image_url || '',
        description: c.description || '',
        bio: c.description || '',
        route: c.route || ''
      }))
    : FALLBACK_AI_TEAM;

  const toggleAITeam = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAITeam(!showAITeam);
  };

  const handleMemberPress = (member: AITeamMember) => {
    setSelectedMember(member);
  };

  const handleChatWithMember = () => {
    if (selectedMember) {
      router.push(selectedMember.route as any);
      setSelectedMember(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Beta Survey - Only shows when enabled in admin */}
      {userId && <BetaSurvey userId={userId} />}
      
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings Icon */}
        <TouchableOpacity 
          style={styles.settingsIcon}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Header with logo */}
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image 
              source={NEW_LOGO_URL}
              style={styles.badgeImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.headerTitle}>Radio Check</Text>
          <Text style={styles.taglineEnglish}>"Radio Check" fuses real-time peer support with smart AI insight, creating more than just an app — it's a digital hand on your shoulder when it matters most.</Text>
        </View>

        {/* Main Menu Cards - CMS Powered */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index}
              style={[
                item.isPrimary ? styles.primaryCard : styles.menuCard,
                item.isCallback && styles.callbackCard
              ]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.9}
              data-testid={`menu-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <View style={[styles.cardIconContainer, { backgroundColor: item.bgColor }]}>
                <Ionicons name={item.icon as any} size={item.isPrimary ? 32 : 28} color={item.color} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={item.isPrimary || item.isCallback ? item.color : colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Meet the AI Team Section */}
        <View style={styles.aiTeamSection}>
          <TouchableOpacity 
            style={styles.aiTeamHeader}
            onPress={toggleAITeam}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.aiTeamTitle}>Meet the AI Team</Text>
              <Text style={styles.aiTeamSubtitle}>Available 24/7 to chat</Text>
            </View>
            <View style={styles.aiTeamToggle}>
              <Text style={styles.aiTeamToggleText}>{showAITeam ? 'Hide' : 'Show'}</Text>
              <Ionicons 
                name={showAITeam ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={colors.primary} 
              />
            </View>
          </TouchableOpacity>
          
          {showAITeam && (
            <View style={styles.aiTeamGrid}>
              {aiTeam.map((member) => (
                <TouchableOpacity 
                  key={member.name}
                  style={styles.aiTeamMember}
                  onPress={() => handleMemberPress(member)}
                  activeOpacity={0.8}
                  data-testid={`ai-team-${member.name.toLowerCase()}`}
                >
                  <Image source={{ uri: member.avatar }} style={styles.aiTeamAvatar} />
                  <Text style={styles.aiTeamName}>{member.name}</Text>
                  <Text style={styles.aiTeamDesc}>{member.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* AI Team Member Bio Modal */}
        <Modal
          visible={selectedMember !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedMember(null)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedMember(null)}
          >
            <View style={styles.modalContent}>
              {selectedMember && (
                <>
                  <Image source={{ uri: selectedMember.avatar }} style={styles.modalAvatar} />
                  <Text style={styles.modalName}>{selectedMember.name}</Text>
                  <Text style={styles.modalDescription}>{selectedMember.description}</Text>
                  <View style={styles.modalDivider} />
                  <Text style={styles.modalBio}>{selectedMember.bio}</Text>
                  <TouchableOpacity 
                    style={styles.chatButton}
                    onPress={handleChatWithMember}
                    data-testid="chat-with-member-btn"
                  >
                    <Ionicons name="chatbubbles" size={20} color="#fff" />
                    <Text style={styles.chatButtonText}>Chat with {selectedMember.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setSelectedMember(null)}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This app is not an emergency service. For immediate danger, always call 999.
          </Text>
        </View>

        {/* Staff Login */}
        <TouchableOpacity 
          style={styles.staffLogin}
          onPress={() => router.push('/login')}
          activeOpacity={0.7}
        >
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <Text style={styles.staffLoginText}>Staff Portal Login</Text>
        </TouchableOpacity>
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  settingsIcon: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeImage: {
    width: 80,
    height: 80,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  taglineEnglish: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  menuContainer: {
    gap: 12,
    marginBottom: 32,
  },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  callbackCard: {
    borderColor: '#22c55e',
    borderWidth: 2,
  },
  cardIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  aiTeamSection: {
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiTeamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiTeamTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  aiTeamSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  aiTeamToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 4,
  },
  aiTeamToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  aiTeamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  aiTeamMember: {
    width: '47%',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiTeamAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
  },
  aiTeamName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  aiTeamDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  modalName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginVertical: 12,
  },
  modalBio: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  chatButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 12,
    padding: 10,
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  disclaimer: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  staffLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  staffLoginText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
