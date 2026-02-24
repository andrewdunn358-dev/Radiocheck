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
  { title: "Recommended Podcasts", description: "Veteran stories & mental health support", icon: "headset", color: "#db2777", bgColor: "#fce7f3", route: "/podcasts" },
  { title: "Request a Callback", description: "We'll call you back", icon: "call", color: "#22c55e", bgColor: "#dcfce7", route: "/callback", isCallback: true },
];

// Fallback AI Team (used when CMS is empty or unavailable)
const FALLBACK_AI_TEAM: AITeamMember[] = [
  { name: 'Tommy', avatar: 'https://customer-assets.emergentagent.com/job_47488e3d-c9ce-4f22-ba89-b000b32c4954/artifacts/slx9i8gj_image.png', description: 'Your battle buddy', bio: 'Tommy is your straightforward battle buddy. A no-nonsense mate who tells it like it is, but always has your back. He understands military life inside out and provides honest, direct support.', route: '/chat/tommy' },
  { name: 'Doris', avatar: 'https://customer-assets.emergentagent.com/job_47488e3d-c9ce-4f22-ba89-b000b32c4954/artifacts/1cxzxfrj_image.png', description: 'Warm support', bio: 'Doris is a nurturing, compassionate presence who creates a safe space to talk. She offers warmth and understanding, like a caring grandmother figure who listens without judgement.', route: '/chat/doris' },
  { name: 'Bob', avatar: 'https://static.prod-images.emergentagent.com/jobs/e42bf70a-a287-4141-b70d-0728db3b1a3c/images/5ccb4f3dba33762dc691a5023cd5a26342d43ef9a7e95308f48f38301df65f8c.png', description: 'Ex-Para peer support', bio: 'Bob is a down-to-earth ex-Para who keeps things real. He\'s been there, done that, and offers honest peer support from someone who truly understands the military experience.', route: '/chat/bob' },
  { name: 'Finch', avatar: 'https://static.prod-images.emergentagent.com/jobs/26fef91b-7832-48ee-9b54-6cd204a344d5/images/f2058ae7a5d15ff3f002514d4ada7039eeddf405b897ae4fc1f0a68a1114e1d8.png', description: 'Military law & legal support', bio: 'Finch is a knowledgeable companion with expertise in UK military law, including the Armed Forces Act, Manual of Military Law, and service discipline. He helps veterans understand their legal rights and navigate military justice matters.', route: '/chat/sentry' },
  { name: 'Margie', avatar: 'https://static.prod-images.emergentagent.com/jobs/fba61e42-5a99-4622-a43b-84a14c5bcf87/images/313a20c933febb69cc523b6b3647ba814a5b9123a3ea7f674f7a87695a8a4789.png', description: 'Addiction support', bio: 'Margie is a wise, understanding presence with warmth and years of experience. She specialises in supporting those dealing with all types of addiction - alcohol, drugs, gambling and more - offering non-judgemental guidance.', route: '/chat/margie' },
  { name: 'Hugo', avatar: 'https://static.prod-images.emergentagent.com/jobs/56155002-fa62-4b53-8fda-4baf701ab83f/images/6be1ae886e76d7b380a66ef3eb98c183e26882fe8e9897aab7e8a8ad4320acb9.png', description: 'Self-help & wellness', bio: 'Hugo is a 35-year-old wellbeing coach focused on mental health, resilience and daily habits. He helps you build positive routines and manage stress through practical, actionable advice.', route: '/chat/hugo' },
  { name: 'Rita', avatar: 'https://static.prod-images.emergentagent.com/jobs/bf7a0a9a-b52d-4db3-b85e-aedfe9959d59/images/fd3c1add3b95c627676f7848bc963c3e1afe0b7c3e1187304df81ea307705318.png', description: 'Family support', bio: 'Rita is a warm, grounded family-support companion for partners, spouses, parents and loved ones of military personnel. She\'s been around the military for a long time and understands what families go through.', route: '/chat/margie' },
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
      } catch (e) {
        setUserId('fallback_' + Date.now());
      }
    };
    getOrCreateUserId();
  }, []);
  
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

        {/* Main Menu Cards */}
        <View style={styles.menuContainer}>
          {/* Need to Talk - Primary CTA */}
          <TouchableOpacity 
            style={styles.primaryCard}
            onPress={() => router.push('/crisis-support')}
            activeOpacity={0.9}
            data-testid="need-to-talk-btn"
          >
            <View style={styles.cardIconContainer}>
              <Ionicons name="heart" size={32} color="#3b82f6" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Need to Talk?</Text>
              <Text style={styles.cardDescription}>Connect with support now</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#3b82f6" />
          </TouchableOpacity>

          {/* Talk to a Veteran */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => router.push('/peer-support')}
            activeOpacity={0.9}
            data-testid="talk-to-veteran-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="people" size={28} color="#22c55e" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Talk to a Veteran</Text>
              <Text style={styles.cardDescription}>Peer support from those who understand</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Warfare on Lawfare */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => router.push('/historical-investigations')}
            activeOpacity={0.9}
            data-testid="warfare-lawfare-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#e0e7ff' }]}>
              <Ionicons name="shield" size={28} color="#6366f1" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Warfare on Lawfare</Text>
              <Text style={styles.cardDescription}>Support for historical investigations</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Support Organisations */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => router.push('/organizations')}
            activeOpacity={0.9}
            data-testid="support-orgs-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="list" size={28} color="#f59e0b" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Support Organisations</Text>
              <Text style={styles.cardDescription}>Directory of veteran services</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Self-Care Tools */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => router.push('/self-care')}
            activeOpacity={0.9}
            data-testid="self-care-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#fce7f3' }]}>
              <Ionicons name="fitness" size={28} color="#ec4899" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Self-Care Tools</Text>
              <Text style={styles.cardDescription}>Journal, grounding, breathing & more</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Friends & Family */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => router.push('/family-friends')}
            activeOpacity={0.9}
            data-testid="family-friends-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#ede9fe' }]}>
              <Ionicons name="heart-circle" size={28} color="#7c3aed" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Friends & Family</Text>
              <Text style={styles.cardDescription}>Worried about a veteran?</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Addictions Support */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => router.push('/substance-support')}
            activeOpacity={0.9}
            data-testid="addictions-support-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="heart-dislike" size={28} color="#d97706" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Addictions</Text>
              <Text style={styles.cardDescription}>Alcohol, drugs, gambling & more</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Criminal Justice Support */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => router.push('/criminal-justice')}
            activeOpacity={0.9}
            data-testid="criminal-justice-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#e0e7ff' }]}>
              <Ionicons name="shield-checkmark" size={28} color="#4f46e5" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Criminal Justice Support</Text>
              <Text style={styles.cardDescription}>Help for veterans in or leaving prison</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Recommended Podcasts */}
          <TouchableOpacity 
            style={styles.menuCard}
            onPress={() => router.push('/podcasts')}
            activeOpacity={0.9}
            data-testid="podcasts-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#fce7f3' }]}>
              <Ionicons name="headset" size={28} color="#db2777" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Recommended Podcasts</Text>
              <Text style={styles.cardDescription}>Veteran stories & mental health support</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Request a Callback - now below Friends & Family */}
          <TouchableOpacity 
            style={[styles.menuCard, styles.callbackCard]}
            onPress={() => router.push('/callback')}
            activeOpacity={0.9}
            data-testid="callback-btn"
          >
            <View style={[styles.cardIconContainer, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="call" size={28} color="#22c55e" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Request a Callback</Text>
              <Text style={styles.cardDescription}>{"We'll call you back"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#22c55e" />
          </TouchableOpacity>
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
