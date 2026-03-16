import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

interface Resource {
  title: string;
  description: string;
  fullDescription?: string;
  url: string;
  icon: string;
  category: 'support' | 'mental-health' | 'mst' | 'health' | 'community';
}

const RESOURCES: Resource[] = [
  // Support Organisations
  {
    title: "Forward Assist",
    description: "Dedicated charity for women veterans",
    fullDescription: "Forward Assist is a charity founded by and for women who have served in the British Armed Forces. They provide peer support, advocacy, and help women veterans access the services they need. They understand the unique challenges women face.",
    url: "https://forward-assist.com",
    icon: "people",
    category: "support"
  },
  {
    title: "Sisters in Service",
    description: "Network for female veterans in healthcare",
    fullDescription: "Sisters in Service provides a network specifically for female veterans working in healthcare. They offer emotional support, career development, and peer mentorship programmes that pair service leavers with mentors who've made similar transitions.",
    url: "https://sistersinservice.org.uk",
    icon: "medkit",
    category: "support"
  },
  {
    title: "Women Veterans Network",
    description: "Community and support network",
    fullDescription: "A network connecting women veterans across the UK, providing community, peer support, and advocacy. They work to ensure women veterans' voices are heard and their unique needs are met.",
    url: "https://www.cobseo.org.uk/members/women-veterans-network/",
    icon: "globe",
    category: "community"
  },
  {
    title: "Female Veterans Transformation Programme",
    description: "Government initiative for better support",
    fullDescription: "A government-backed programme working to transform services for female veterans. They consult directly with women veterans to understand their needs and improve support across housing, employment, and health.",
    url: "https://www.fvtp.org.uk",
    icon: "trending-up",
    category: "support"
  },
  // Mental Health
  {
    title: "WithYou Rebuild Project",
    description: "Trauma-focused therapy for women veterans",
    fullDescription: "The Rebuild Project provides specialist trauma-focused psychological therapy for women veterans experiencing substance use related to previous trauma. They understand the links between military trauma and coping mechanisms.",
    url: "https://www.wearewithyou.org.uk/what-we-do/rebuild/",
    icon: "heart",
    category: "mental-health"
  },
  {
    title: "Combat Stress",
    description: "Mental health support for veterans",
    fullDescription: "Combat Stress provides specialist mental health treatment for veterans. They have specific understanding of women veterans' experiences and can support with PTSD, anxiety, depression, and trauma from service.",
    url: "https://combatstress.org.uk",
    icon: "shield-checkmark",
    category: "mental-health"
  },
  // MST Support
  {
    title: "Salute Her UK",
    description: "Trauma-informed therapy for women veterans",
    fullDescription: "Salute Her UK offers trauma-informed therapy specifically for women veterans with lived experience of sexual assault. They believe survivors and provide specialist support in a safe, understanding environment.",
    url: "https://www.salute-her.co.uk",
    icon: "hand-left",
    category: "mst"
  },
  {
    title: "Rape Crisis",
    description: "24/7 support for sexual violence survivors",
    fullDescription: "Rape Crisis provides free, confidential support for anyone affected by sexual violence at any time in their lives. Freephone 0808 500 2222 (24/7). They support survivors regardless of when the assault happened.",
    url: "https://rapecrisis.org.uk",
    icon: "call",
    category: "mst"
  },
  {
    title: "The Survivors Trust",
    description: "UK-wide network of specialist support",
    fullDescription: "The Survivors Trust is an umbrella agency for over 120 specialist organisations providing support to survivors of rape, sexual violence, and childhood sexual abuse. They can help find local specialist support.",
    url: "https://www.thesurvivorstrust.org",
    icon: "people-circle",
    category: "mst"
  },
  // Health
  {
    title: "Veterans NHS Priority Treatment",
    description: "Understanding your healthcare rights",
    fullDescription: "Veterans are entitled to priority NHS treatment for service-related conditions. Make sure your GP knows you're a veteran - ask about veteran-friendly GP accreditation. You shouldn't have to fight for healthcare.",
    url: "https://www.nhs.uk/nhs-services/armed-forces-community/veterans-service-leavers-reservists/",
    icon: "medical",
    category: "health"
  },
  // General
  {
    title: "Veterans Gateway",
    description: "First point of contact for veteran support",
    fullDescription: "Veterans Gateway is the first point of contact for veterans seeking support. Call 0808 802 1212 (24/7). They can help connect you with the right services, including women-specific support.",
    url: "https://www.veteransgateway.org.uk",
    icon: "compass",
    category: "support"
  }
];

const STATISTICS = [
  { stat: "13%", label: "of UK veterans are women" },
  { stat: "11%", label: "of serving personnel are women" },
  { stat: "5.7%", label: "of OpCourage mental health service users are women" },
];

const CHALLENGES = [
  {
    title: "Invisible Veterans",
    description: "Women often aren't recognised as veterans by civilian services or even other veterans. You served. Your service counts."
  },
  {
    title: "Military Sexual Trauma",
    description: "22.5% of women report sexual harassment during service. If this happened to you, it wasn't your fault. Support is available."
  },
  {
    title: "Equipment & Health",
    description: "Military equipment was designed for men. Women veterans report higher rates of musculoskeletal injuries. Your health matters."
  },
  {
    title: "Finding Support",
    description: "Many veteran services don't understand women's experiences. You deserve support that gets it."
  }
];

export default function WomenVeterans() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'support': return '#3b82f6';
      case 'mental-health': return '#8b5cf6';
      case 'mst': return '#ec4899';
      case 'health': return '#10b981';
      case 'community': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'support': return '#dbeafe';
      case 'mental-health': return '#ede9fe';
      case 'mst': return '#fce7f3';
      case 'health': return '#d1fae5';
      case 'community': return '#fef3c7';
      default: return '#f3f4f6';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Women Veterans</Text>
        </View>

        {/* Megan AI Chat Card - TOP OF PAGE */}
        <TouchableOpacity 
          style={[styles.aiCard, { backgroundColor: isDark ? '#4a1d6a' : '#fdf4ff', borderColor: '#a855f7' }]}
          onPress={() => router.push('/chat/megan')}
          activeOpacity={0.9}
        >
          <Image 
            source={{ uri: '/images/megan.png' }}
            style={styles.aiAvatar}
          />
          <View style={styles.aiTextContainer}>
            <Text style={[styles.aiTitle, { color: colors.text }]}>Chat with Megan</Text>
            <Text style={[styles.aiSubtitle, { color: colors.textSecondary }]}>Ex-RAF MERT medic, women's support specialist</Text>
          </View>
          <View style={{ backgroundColor: '#a855f7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
          </View>
        </TouchableOpacity>

        {/* Intro */}
        <View style={[styles.introCard, { backgroundColor: isDark ? '#2d1f3d' : '#faf5ff', borderColor: '#c084fc' }]}>
          <Text style={[styles.introTitle, { color: colors.text }]}>You Served. You Matter.</Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Women veterans are often overlooked and underserved. Whether you're struggling with the transition, dealing with trauma, or just want to connect with others who understand — you're in the right place.
          </Text>
        </View>

        {/* Statistics */}
        <View style={styles.statsRow}>
          {STATISTICS.map((item, index) => (
            <View key={index} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statNumber, { color: '#a855f7' }]}>{item.stat}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Challenges Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>We Understand</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          The challenges women veterans face are real and valid
        </Text>
        
        {CHALLENGES.map((challenge, index) => (
          <View key={index} style={[styles.challengeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.challengeTitle, { color: colors.text }]}>{challenge.title}</Text>
            <Text style={[styles.challengeDescription, { color: colors.textSecondary }]}>{challenge.description}</Text>
          </View>
        ))}

        {/* MST Support Section */}
        <View style={[styles.mstSection, { backgroundColor: isDark ? '#3d1f2d' : '#fff1f2', borderColor: '#fda4af' }]}>
          <Ionicons name="heart" size={24} color="#e11d48" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.mstTitle, { color: colors.text }]}>Military Sexual Trauma Support</Text>
            <Text style={[styles.mstText, { color: colors.textSecondary }]}>
              If you experienced sexual assault or harassment during your service, help is available. You will be believed. It wasn't your fault.
            </Text>
            <Text style={[styles.mstHotline, { color: '#e11d48' }]}>Rape Crisis 24/7: 0808 500 2222</Text>
          </View>
        </View>

        {/* Support Organisations */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Women-Specific Support</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          These organisations understand what women go through
        </Text>

        {RESOURCES.filter(r => r.category === 'support' || r.category === 'community').map((resource, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.resourceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openLink(resource.url)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(resource.category) }]}>
              <Ionicons name={resource.icon as any} size={24} color={getCategoryColor(resource.category)} />
            </View>
            <View style={styles.resourceContent}>
              <Text style={[styles.resourceTitle, { color: colors.text }]}>{resource.title}</Text>
              <Text style={[styles.resourceDescription, { color: colors.textSecondary }]}>
                {resource.fullDescription || resource.description}
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Mental Health & MST Support */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Mental Health & Trauma Support</Text>
        
        {RESOURCES.filter(r => r.category === 'mental-health' || r.category === 'mst').map((resource, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.resourceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openLink(resource.url)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(resource.category) }]}>
              <Ionicons name={resource.icon as any} size={24} color={getCategoryColor(resource.category)} />
            </View>
            <View style={styles.resourceContent}>
              <Text style={[styles.resourceTitle, { color: colors.text }]}>{resource.title}</Text>
              <Text style={[styles.resourceDescription, { color: colors.textSecondary }]}>
                {resource.fullDescription || resource.description}
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* General Support */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>General Veteran Support</Text>
        
        {RESOURCES.filter(r => r.category === 'health').map((resource, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.resourceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openLink(resource.url)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(resource.category) }]}>
              <Ionicons name={resource.icon as any} size={24} color={getCategoryColor(resource.category)} />
            </View>
            <View style={styles.resourceContent}>
              <Text style={[styles.resourceTitle, { color: colors.text }]}>{resource.title}</Text>
              <Text style={[styles.resourceDescription, { color: colors.textSecondary }]}>
                {resource.fullDescription || resource.description}
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Veterans Gateway */}
        <View style={[styles.gatewayCard, { backgroundColor: colors.card, borderColor: '#3b82f6' }]}>
          <Ionicons name="call" size={32} color="#3b82f6" />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.gatewayTitle, { color: colors.text }]}>Veterans Gateway</Text>
            <Text style={[styles.gatewayText, { color: colors.textSecondary }]}>
              Not sure where to start? Call the Veterans Gateway — they can connect you with the right support.
            </Text>
            <Text style={[styles.gatewayNumber, { color: '#3b82f6' }]}>0808 802 1212 (24/7)</Text>
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 16,
  },
  aiAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  aiTextContainer: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  aiSubtitle: {
    fontSize: 13,
  },
  introCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  introText: {
    fontSize: 15,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  challengeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  challengeDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
  mstSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  mstTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  mstText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  mstHotline: {
    fontSize: 16,
    fontWeight: '700',
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceContent: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resourceDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
  gatewayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginTop: 24,
  },
  gatewayTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  gatewayText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  gatewayNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
});
