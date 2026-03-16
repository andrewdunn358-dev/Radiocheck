import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Image, Modal, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { useCMSContent, getSection, CMSCard } from '../src/hooks/useCMSContent';
import { useAgeGateContext } from '../src/context/AgeGateContext';
import AgeGateModal from '../src/components/AgeGateModal';
import BetaSurvey from '../src/components/BetaSurvey';
import EventsSection from '../src/components/EventsSection';

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

// Founder type
interface Founder {
  name: string;
  role: string;
  avatar: string;
  bio: string;
}

// Founders data
const FOUNDERS: Founder[] = [
  {
    name: "Andrew \"Frankie\" Dunn",
    role: "Founder",
    avatar: "https://customer-assets.emergentagent.com/job_e4b45c7f-469e-4d50-8310-96df1bd9d53a/artifacts/4zwz619g_image.png",
    bio: "Andrew Dunn served 27 years in the British Army before creating Frankie's Pod: Uncorking the Unforgettable. Through podcasting and projects like Radio Check, he works to build communities where veterans and others can connect, share their experiences, and support each other through open conversation."
  },
  {
    name: "Rachel Webster",
    role: "Founder",
    avatar: "https://customer-assets.emergentagent.com/job_e4b45c7f-469e-4d50-8310-96df1bd9d53a/artifacts/kec981d4_Rachel.avif",
    bio: "Rachel Webster brings compassion and clinical expertise to Radio Check. With a background in mental health support, Rachel has dedicated her career to helping those who have served.\n\nRachel's approach combines professional knowledge with genuine warmth. She understands that sometimes people just need someone to listen without judgement, and she has helped shape Radio Check's peer support model to reflect this understanding.\n\nHer work on the platform focuses on ensuring that every interaction - whether with AI companions or human supporters - feels safe, welcoming, and truly helpful. Rachel believes that asking for help is a sign of strength, not weakness."
  },
  {
    name: "Anthony Donnelly",
    role: "Founder",
    avatar: "https://customer-assets.emergentagent.com/job_e4b45c7f-469e-4d50-8310-96df1bd9d53a/artifacts/jz9ku914_image.png",
    bio: "Anthony James Donnelly is the founder of Zentrafuge (Labs) Limited, an AI safety and research initiative focused on building continuity-based AI systems for high-trust environments.\n\nHis interest in computing began in the early 1980s and has remained consistent across a career spanning technology sales, international marketing, construction partnerships in the United States, and sales leadership. The common thread has been systems thinking — how tools shape behaviour, trust, and decision-making.\n\nAnthony now focuses on AI safety architecture and structured testing. His open research repositories — including ZP-1, The Symbiosis Manifesto, and the AI Doorman Architecture — examine continuity design, boundary-setting, and trust-first deployment models for AI systems operating in psychologically sensitive contexts.\n\nZentrafuge's safety modules are integrated into the Radio Check platform. The work is research-led and mission-driven, centred on building AI that earns trust rather than assumes it."
  }
];

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
  { title: "Talk to Peer Support", description: "Connect with those who understand", icon: "people", color: "#22c55e", bgColor: "#dcfce7", route: "/peer-support" },
  { title: "Warfare on Lawfare", description: "Support for historical investigations", icon: "shield", color: "#6366f1", bgColor: "#e0e7ff", route: "/historical-investigations" },
  { title: "Support Organisations", description: "Directory of veteran services", icon: "list", color: "#f59e0b", bgColor: "#fef3c7", route: "/organizations" },
  { title: "Self-Care Tools", description: "Journal, grounding, breathing & more", icon: "fitness", color: "#ec4899", bgColor: "#fce7f3", route: "/self-care" },
  { title: "Friends & Family", description: "Worried about a veteran?", icon: "heart-circle", color: "#7c3aed", bgColor: "#ede9fe", route: "/family-friends" },
  { title: "Addictions", description: "Alcohol, drugs, gambling & more", icon: "heart-dislike", color: "#d97706", bgColor: "#fef3c7", route: "/substance-support" },
  { title: "The Gym", description: "Frankie's 12-week fitness programme", icon: "barbell", color: "#22c55e", bgColor: "#dcfce7", route: "/gym" },
  { title: "Criminal Justice Support", description: "Help for veterans in or leaving prison", icon: "shield-checkmark", color: "#4f46e5", bgColor: "#e0e7ff", route: "/criminal-justice" },
  { title: "Compensation Schemes", description: "War pensions, AFCS & hearing loss claims", icon: "cash", color: "#059669", bgColor: "#d1fae5", route: "/compensation-schemes" },
  { title: "Recommended Podcasts", description: "Veteran stories & mental health support", icon: "headset", color: "#db2777", bgColor: "#fce7f3", route: "/podcasts" },
  { title: "Request a Callback", description: "We'll call you back", icon: "call", color: "#22c55e", bgColor: "#dcfce7", route: "/callback", isCallback: true },
];

// Fallback AI Team (used when CMS is empty or unavailable)
const FALLBACK_AI_TEAM: AITeamMember[] = [
  { name: 'Frankie', avatar: '/images/frankie.png', description: 'Your PTI - Physical Training', bio: 'Frankie is your PTI (Physical Training Instructor). A former British Army PTI who brings proper military fitness discipline with motivating banter. He offers a 12-week progressive programme to build strength, resilience and mental toughness.', route: '/chat/frankie' },
  { name: 'Tommy', avatar: '/images/tommy.png', description: 'Your battle buddy', bio: 'Tommy is your straightforward battle buddy. A no-nonsense mate who tells it like it is, but always has your back. He understands military life inside out and provides honest, direct support.', route: '/chat/tommy' },
  { name: 'Rachel', avatar: '/images/rachel.png', description: 'Warm support', bio: 'Rachel is a nurturing, compassionate presence who creates a safe space to talk. She offers warmth and understanding, like a caring friend who listens without judgement.', route: '/chat/doris' },
  { name: 'Bob', avatar: '/images/bob.png', description: 'Ex-Para peer support', bio: 'Bob is a down-to-earth ex-Para who keeps things real. He\'s been there, done that, and offers honest peer support from someone who truly understands the military experience.', route: '/chat/bob' },
  { name: 'Finch', avatar: '/images/finch.png', description: 'Military law & legal support', bio: 'Finch is a knowledgeable companion with expertise in UK military law, including the Armed Forces Act, Manual of Military Law, and service discipline. He helps veterans understand their legal rights and navigate military justice matters.', route: '/chat/sentry' },
  { name: 'Margie', avatar: '/images/margie.png', description: 'Addiction support', bio: 'Margie is a wise, understanding presence with warmth and years of experience. She specialises in supporting those dealing with all types of addiction - alcohol, drugs, gambling and more - offering non-judgemental guidance.', route: '/chat/margie' },
  { name: 'Hugo', avatar: '/images/hugo.png', description: 'Compensation schemes expert', bio: 'Hugo specialises in UK veteran compensation schemes. He can help you understand War Pensions, the Armed Forces Compensation Scheme (AFCS), hearing loss claims, and connect you with organisations like the Royal British Legion and Blesma who can assist with your claim.', route: '/chat/hugo' },
  { name: 'Baz', avatar: '/images/baz.png', description: 'Self-care & banter', bio: 'Baz is an ex-Rifles infantry soldier with years of experience. He\'s all about looking after yourself - mind and body. Expect plenty of banter, straight talk, and practical tips for taking care of number one.', route: '/chat/baz' },
  { name: 'Rita', avatar: '/images/rita.png', description: 'Family support', bio: 'Rita is a warm, grounded family-support companion for partners, spouses, parents and loved ones of military personnel. She\'s been around the military for a long time and understands what families go through.', route: '/chat/rita' },
  { name: 'Catherine', avatar: '/images/catherine.png', description: 'Calm & intelligent support', bio: 'Catherine is composed, articulate, and grounded. She helps you think clearly when emotions run high and approach problems with calm intelligence. She guides you toward realistic next steps, not abstract solutions.', route: '/chat/catherine' },
];

export default function Index() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const styles = createStyles(colors);
  const [showAITeam, setShowAITeam] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [selectedMember, setSelectedMember] = useState<AITeamMember | null>(null);
  const [selectedFounder, setSelectedFounder] = useState<Founder | null>(null);
  const [userId, setUserId] = useState<string>('');
  
  // Age gate context - show modal if not verified
  const { isAgeVerified, isLoading: ageLoading, setDateOfBirth } = useAgeGateContext();
  const [showAgeGateModal, setShowAgeGateModal] = useState(false);
  
  // Show age gate on home page if not verified (fallback for direct navigation)
  // Age gate has highest priority - must be shown before survey or anything else
  useEffect(() => {
    if (!ageLoading && !isAgeVerified) {
      setShowAgeGateModal(true);
    } else {
      setShowAgeGateModal(false);
    }
  }, [ageLoading, isAgeVerified]);
  
  // Handle age gate submission
  const handleAgeSubmit = async (dob: Date) => {
    await setDateOfBirth(dob);
    setShowAgeGateModal(false);
  };
  
  // BetaSurvey should only show AFTER age is verified
  const canShowSurvey = isAgeVerified && !showAgeGateModal;
  
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
      const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://veterans-support-api.onrender.com';
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
      {userId && canShowSurvey && <BetaSurvey userId={userId} />}
      
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
          <Text style={styles.taglineEnglish}>24/7 Mental Health & Peer Support</Text>
        </View>

        {/* What is Radio Check - Collapsible Card */}
        <TouchableOpacity 
          style={styles.aboutCard}
          onPress={() => setShowAbout(!showAbout)}
          activeOpacity={0.8}
        >
          <View style={styles.aboutCardHeader}>
            <View style={styles.aboutCardLeft}>
              <Ionicons name="information-circle" size={24} color="#3b82f6" />
              <Text style={styles.aboutCardTitle}>What is Radio Check?</Text>
            </View>
            <Ionicons 
              name={showAbout ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={colors.textSecondary} 
            />
          </View>
          
          {showAbout && (
            <View style={styles.aboutCardContent}>
              <Text style={styles.aboutText}>
                Radio Check is a free, confidential mental health and peer support service built for the UK Armed Forces community. Whether you're currently serving, a veteran, or a family member — we're here for you, day or night.
              </Text>
              
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Ionicons name="chatbubbles" size={18} color="#22c55e" />
                  <Text style={styles.featureText}>Talk to real veterans and trained counsellors via live chat</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="shield-checkmark" size={18} color="#3b82f6" />
                  <Text style={styles.featureText}>100% confidential — no names, no records, no judgement</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="time" size={18} color="#8b5cf6" />
                  <Text style={styles.featureText}>AI Battle Buddies available 24/7 when humans aren't online</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="fitness" size={18} color="#f59e0b" />
                  <Text style={styles.featureText}>Self-care tools, fitness programmes & practical resources</Text>
                </View>
              </View>

              <Text style={styles.aboutQuote}>
                "Radio Check" — because sometimes you just need to know someone's listening.
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Main Menu Cards - 2-Column Grid Layout */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index}
              style={[
                styles.gridCard,
                item.isPrimary && styles.gridCardPrimary,
                item.isCallback && styles.gridCardCallback
              ]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.85}
              data-testid={`menu-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <View style={[styles.gridCardIconContainer, { backgroundColor: item.bgColor }]}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
              </View>
              <Text style={styles.gridCardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.gridCardDescription} numberOfLines={2}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Community Events Section */}
        <EventsSection />

        {/* Meet the Team Section */}
        <View style={styles.aiTeamSection}>
          <TouchableOpacity 
            style={styles.aiTeamHeader}
            onPress={toggleAITeam}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.aiTeamTitle}>Meet the Team</Text>
              <Text style={styles.aiTeamSubtitle}>Our founders & AI companions</Text>
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
            <View>
              {/* Founders Section */}
              <View style={styles.foundersSection}>
                <Text style={styles.foundersSectionTitle}>Our Founders</Text>
                <Text style={styles.foundersSubtitle}>Tap to learn more</Text>
                <View style={styles.foundersGrid}>
                  {FOUNDERS.map((founder) => (
                    <TouchableOpacity 
                      key={founder.name}
                      style={styles.founderCard}
                      onPress={() => setSelectedFounder(founder)}
                      activeOpacity={0.8}
                      data-testid={`founder-${founder.name.toLowerCase().replace(/[^a-z]/g, '-')}`}
                    >
                      <Image source={{ uri: founder.avatar }} style={styles.founderAvatar} />
                      <Text style={styles.founderName}>{founder.name}</Text>
                      <Text style={styles.founderRole}>{founder.role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* AI Team Section */}
              <Text style={styles.aiTeamSectionTitle}>AI Companions (Available 24/7)</Text>
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

        {/* Founder Bio Modal */}
        <Modal
          visible={selectedFounder !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedFounder(null)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedFounder(null)}
          >
            <View style={styles.founderModalContent}>
              {selectedFounder && (
                <>
                  <Image source={{ uri: selectedFounder.avatar }} style={styles.founderModalAvatar} />
                  <Text style={styles.founderModalName}>{selectedFounder.name}</Text>
                  <Text style={styles.founderModalRole}>{selectedFounder.role}</Text>
                  <View style={styles.modalDivider} />
                  <ScrollView style={styles.founderBioScroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.founderModalBio}>{selectedFounder.bio}</Text>
                  </ScrollView>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setSelectedFounder(null)}
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
      
      {/* Age Gate Modal - Shows if age not verified */}
      <AgeGateModal
        visible={showAgeGateModal}
        onSubmit={handleAgeSubmit}
        onSkip={() => setShowAgeGateModal(false)}
      />
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
    paddingTop: Platform.OS === 'web' ? 20 : 0, // Add top padding for web
    maxWidth: 600, // Limit width for desktop
    alignSelf: 'center',
    width: '100%',
  },
  settingsIcon: {
    position: 'absolute',
    right: 20,
    top: Platform.OS === 'web' ? 20 : 0,
    zIndex: 10,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  logoWrapper: {
    width: 90,
    height: 90,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeImage: {
    width: 90,
    height: 90,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  taglineEnglish: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aboutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  aboutCardContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  aboutText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  featureList: {
    gap: 10,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  aboutQuote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 32,
  },
  // 2-column grid card styles
  gridCard: {
    width: '48%',
    aspectRatio: 1, // Makes it square
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCardPrimary: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  gridCardCallback: {
    borderColor: '#22c55e',
    borderWidth: 2,
  },
  gridCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  gridCardDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Keep old styles for backwards compatibility / other use
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
  // Founders Section Styles
  foundersSection: {
    marginBottom: 24,
  },
  foundersSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  foundersSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
  },
  foundersGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  founderCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  founderAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  founderName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  founderRole: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  aiTeamSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
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
  // Founder Modal styles
  founderModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  founderModalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  founderModalName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  founderModalRole: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  founderBioScroll: {
    maxHeight: 300,
    width: '100%',
  },
  founderModalBio: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    textAlign: 'left',
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
