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
  category: 'carer-support' | 'respite' | 'financial' | 'mental-health' | 'practical';
}

const RESOURCES: Resource[] = [
  {
    title: "Carers UK",
    description: "The national charity for carers",
    fullDescription: "Carers UK provides expert advice, information, and support for carers. Their helpline (0808 808 7777) covers everything from benefits to employment rights to emotional support. They also campaign for carers' rights.",
    url: "https://www.carersuk.org",
    icon: "people",
    category: "carer-support"
  },
  {
    title: "SSAFA Carers Support",
    description: "Support for those caring for Armed Forces personnel",
    fullDescription: "SSAFA understands the unique challenges of caring for someone with military-related injuries or conditions. They provide mentoring, grants, respite funding, and connect you with other military carers who understand.",
    url: "https://www.ssafa.org.uk/get-help/carers",
    icon: "star",
    category: "carer-support"
  },
  {
    title: "Help for Heroes Family Support",
    description: "Supporting the families of wounded veterans",
    fullDescription: "Help for Heroes doesn't just support veterans — they support the families too. Their family recovery programmes include counselling, peer support, social activities, and grants for carers who need a break.",
    url: "https://www.helpforheroes.org.uk/get-support/family/",
    icon: "heart",
    category: "carer-support"
  },
  {
    title: "Carer's Allowance",
    description: "Financial support for full-time carers",
    fullDescription: "If you spend at least 35 hours a week caring for someone, you may be entitled to Carer's Allowance (currently £76.75/week). It's not much, but it's your right. You can also get National Insurance credits towards your State Pension.",
    url: "https://www.gov.uk/carers-allowance",
    icon: "cash",
    category: "financial"
  },
  {
    title: "Carers Trust",
    description: "Local carer services across the UK",
    fullDescription: "Carers Trust works with a network of local partners to provide breaks, information, advice, and support for carers. They can connect you with services in your area and help you access the support you're entitled to.",
    url: "https://carers.org",
    icon: "compass",
    category: "practical"
  },
  {
    title: "Combat Stress Family Support",
    description: "Support for families living with PTSD",
    fullDescription: "Living with someone with PTSD, anxiety, or depression from military service is exhausting. Combat Stress provides family support including information days, online resources, and signposting to help you cope while supporting your loved one.",
    url: "https://combatstress.org.uk/get-help/family-and-carers",
    icon: "shield-checkmark",
    category: "mental-health"
  },
  {
    title: "Mind - Supporting Someone Else",
    description: "How to support someone with mental health problems",
    fullDescription: "Mind provides practical guidance on supporting someone with mental health issues — how to start conversations, what to say, how to look after yourself while caring for them, and when to encourage professional help.",
    url: "https://www.mind.org.uk/information-support/helping-someone-else/",
    icon: "bulb",
    category: "mental-health"
  },
  {
    title: "Respite Care Grants",
    description: "Funding for carer breaks",
    fullDescription: "Several military charities provide grants for respite care — giving you a break while ensuring your loved one is looked after. The Royal British Legion, SSAFA, and Help for Heroes all offer respite funding. You need breaks to keep going.",
    url: "https://www.britishlegion.org.uk",
    icon: "sunny",
    category: "respite"
  },
  {
    title: "Veterans Gateway",
    description: "First point of contact for all veteran family support",
    fullDescription: "Veterans Gateway isn't just for veterans — it's for their families too. Call 0808 802 1212 (24/7) and they'll connect you with the right support for carers, whether that's financial help, respite, or emotional support.",
    url: "https://www.veteransgateway.org.uk",
    icon: "call",
    category: "carer-support"
  },
];

const TOPICS = [
  {
    title: "You Matter Too",
    description: "Caring for a veteran can consume your entire life. Your needs, your health, and your wellbeing matter just as much. You can't pour from an empty cup.",
    icon: "heart",
    color: "#ec4899"
  },
  {
    title: "Living with PTSD",
    description: "When your loved one has PTSD, the whole household feels it — the nightmares, the hypervigilance, the anger, the withdrawal. Understanding what's happening is the first step to coping.",
    icon: "shield",
    color: "#8b5cf6"
  },
  {
    title: "Compassion Fatigue",
    description: "Caring for someone long-term can lead to emotional exhaustion, numbness, and resentment. These are normal responses to an abnormal situation. Recognising it is the first step.",
    icon: "battery-dead",
    color: "#ef4444"
  },
  {
    title: "Taking a Break",
    description: "Respite isn't selfish — it's essential. Whether it's an afternoon off, a weekend away, or a funded respite programme, regular breaks keep you going.",
    icon: "sunny",
    color: "#f59e0b"
  },
  {
    title: "Financial Support",
    description: "Caring often means reduced working hours or giving up work entirely. Carer's Allowance, charity grants, and council support can help bridge the gap.",
    icon: "cash",
    color: "#059669"
  },
  {
    title: "Finding Your Community",
    description: "Connecting with other military carers who truly understand can make all the difference. You're not alone in this — even when it feels like it.",
    icon: "people",
    color: "#3b82f6"
  },
];

export default function ForCarers() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'carer-support': return '#3b82f6';
      case 'respite': return '#f59e0b';
      case 'financial': return '#059669';
      case 'mental-health': return '#8b5cf6';
      case 'practical': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'carer-support': return '#dbeafe';
      case 'respite': return '#fef3c7';
      case 'financial': return '#d1fae5';
      case 'mental-health': return '#ede9fe';
      case 'practical': return '#d1fae5';
      default: return '#f3f4f6';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: '#ccfbf1' }]}>
            <Ionicons name="hand-left" size={40} color="#0d9488" />
          </View>
          <Text style={styles.heroTitle}>For Carers</Text>
          <Text style={styles.heroSubtitle}>
            You look after them. But who looks after you?{'\n'}Support for the people behind the support.
          </Text>
        </View>

        {/* AI Chat CTA - Top */}
        <TouchableOpacity 
          style={styles.chatBanner}
          onPress={() => router.push('/chat/helen')}
          activeOpacity={0.85}
          data-testid="chat-helen-banner"
        >
          <Image 
            source={{ uri: '/images/helen.png' }}
            style={styles.chatBannerAvatarImg}
          />
          <View style={styles.chatBannerText}>
            <Text style={styles.chatBannerTitle}>Talk to Helen</Text>
            <Text style={styles.chatBannerDesc}>Army wife for 20 years, cared for her husband with PTSD.</Text>
          </View>
          <View style={{ backgroundColor: '#0d9488', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>What Carers Face</Text>
        <View style={styles.topicsGrid}>
          {TOPICS.map((topic, index) => (
            <View key={index} style={styles.topicCard}>
              <View style={[styles.topicIcon, { backgroundColor: topic.color + '20' }]}>
                <Ionicons name={topic.icon as any} size={22} color={topic.color} />
              </View>
              <Text style={styles.topicTitle}>{topic.title}</Text>
              <Text style={styles.topicDesc}>{topic.description}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Support & Resources</Text>
        {RESOURCES.map((resource, index) => (
          <TouchableOpacity 
            key={index} style={styles.resourceCard}
            onPress={() => openLink(resource.url)} activeOpacity={0.8}
            data-testid={`resource-${resource.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
          >
            <View style={[styles.resourceIcon, { backgroundColor: getCategoryBg(resource.category) }]}>
              <Ionicons name={resource.icon as any} size={24} color={getCategoryColor(resource.category)} />
            </View>
            <View style={styles.resourceContent}>
              <Text style={styles.resourceTitle}>{resource.title}</Text>
              <Text style={styles.resourceDesc}>{resource.fullDescription || resource.description}</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Need to talk?</Text>
          <Text style={styles.ctaText}>Helen understands what carers go through.</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/chat/helen')} data-testid="talk-to-helen-btn">
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Talk to Helen</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 600, alignSelf: 'center', width: '100%' },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  backText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  heroSection: { alignItems: 'center', marginBottom: 32, paddingTop: 8 },
  heroIcon: { width: 80, height: 80, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 12 },
  heroSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  chatBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 2, borderColor: '#0d9488' },
  chatBannerAvatarImg: { width: 52, height: 52, borderRadius: 26, marginRight: 12, borderWidth: 2, borderColor: '#0d9488' },
  chatBannerText: { flex: 1 },
  chatBannerTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  chatBannerDesc: { fontSize: 13, color: colors.textSecondary },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16, marginTop: 8 },
  topicsGrid: { gap: 12, marginBottom: 32 },
  topicCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  topicIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  topicTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  topicDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  resourceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  resourceIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  resourceContent: { flex: 1, marginRight: 8 },
  resourceTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  resourceDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  ctaSection: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: colors.border },
  ctaTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  ctaText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  ctaButton: { flexDirection: 'row', backgroundColor: '#0d9488', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', gap: 8 },
  ctaButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
