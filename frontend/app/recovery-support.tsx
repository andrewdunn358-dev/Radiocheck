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
  category: 'rehabilitation' | 'prosthetics' | 'pain' | 'support' | 'mental-health';
}

const RESOURCES: Resource[] = [
  {
    title: "Blesma - The Limbless Veterans",
    description: "Support for veterans who have lost limbs or the use of limbs",
    fullDescription: "Blesma supports serving and ex-serving men and women who have lost limbs, or the use of limbs or eyes, in military service. They provide grants, rehabilitation support, prosthetic advice, activity programmes, and a community who understand what you're going through.",
    url: "https://blesma.org",
    icon: "accessibility",
    category: "prosthetics"
  },
  {
    title: "Help for Heroes Recovery Centre",
    description: "Residential recovery programmes for wounded veterans",
    fullDescription: "Help for Heroes provides recovery programmes including physiotherapy, occupational therapy, psychological support, and adaptive sports. Their centres offer both residential and outpatient rehabilitation designed around the specific needs of wounded veterans.",
    url: "https://www.helpforheroes.org.uk/get-support/recovery/",
    icon: "home",
    category: "rehabilitation"
  },
  {
    title: "Defence Medical Rehabilitation Centre (DMRC) Headley Court / Stanford Hall",
    description: "World-class military rehabilitation",
    fullDescription: "The DMRC at Stanford Hall provides world-class rehabilitation for serving personnel and veterans with complex injuries. From prosthetic fitting to intensive physiotherapy, they specialise in getting you back to the best possible function.",
    url: "https://www.mod.uk/dmrc",
    icon: "medkit",
    category: "rehabilitation"
  },
  {
    title: "The Royal British Legion",
    description: "Recovery and rehabilitation grants",
    fullDescription: "The Royal British Legion provides financial support for recovery needs — from adapting your home to specialist equipment, mobility aids, and ongoing medical costs. They can help fund what the NHS doesn't cover.",
    url: "https://www.britishlegion.org.uk",
    icon: "star",
    category: "support"
  },
  {
    title: "Blind Veterans UK",
    description: "Support for veterans with sight loss",
    fullDescription: "Blind Veterans UK supports ex-service men and women living with sight loss, whether from service or later in life. They provide rehabilitation, training, emotional support, and community — helping you live independently and with confidence.",
    url: "https://www.blindveterans.org.uk",
    icon: "eye-off",
    category: "rehabilitation"
  },
  {
    title: "Combat Stress",
    description: "Mental health support alongside physical recovery",
    fullDescription: "Physical injuries often come with invisible wounds. Combat Stress provides specialist mental health treatment for PTSD, anxiety, depression, and adjustment difficulties that can accompany physical injury and recovery.",
    url: "https://combatstress.org.uk",
    icon: "shield-checkmark",
    category: "mental-health"
  },
  {
    title: "NHS Veteran-Aware Hospitals",
    description: "Priority NHS treatment for service-related conditions",
    fullDescription: "Veterans are entitled to priority NHS treatment for service-related conditions. Over 100 NHS trusts are now 'Veteran Aware' and committed to understanding military injuries. Make sure your GP knows about your service history.",
    url: "https://veteranaware.nhs.uk",
    icon: "medical",
    category: "support"
  },
  {
    title: "SSAFA",
    description: "Practical and financial support during recovery",
    fullDescription: "SSAFA can provide practical support during your recovery — help with travel to hospital appointments, grants for specialist equipment, home adaptations, and emotional support for you and your family.",
    url: "https://www.ssafa.org.uk",
    icon: "people",
    category: "support"
  },
  {
    title: "British Pain Society",
    description: "Understanding and managing chronic pain",
    fullDescription: "Chronic pain from service injuries can dominate your life. The British Pain Society provides patient resources to understand and manage pain — including pain management programmes, specialist referrals, and self-help strategies.",
    url: "https://www.britishpainsociety.org",
    icon: "pulse",
    category: "pain"
  },
  {
    title: "Invictus Games Foundation",
    description: "Recovery through sport",
    fullDescription: "The Invictus Games Foundation uses adaptive sport to support the recovery and rehabilitation of wounded, injured, and sick service personnel and veterans. Sport provides physical rehab, confidence, and community.",
    url: "https://invictusgamesfoundation.org",
    icon: "trophy",
    category: "rehabilitation"
  },
];

const TOPICS = [
  {
    title: "Life After Injury",
    description: "Adapting to a new normal after a service injury is tough. Whether it's learning to walk again, adapting your home, or accepting help — recovery is a journey, not a destination.",
    icon: "walk",
    color: "#3b82f6"
  },
  {
    title: "Prosthetics & Mobility",
    description: "Modern prosthetics are incredible, but the adjustment is real. From phantom limb pain to learning new movements, specialist support exists to help you get the most from your prosthetic.",
    icon: "accessibility",
    color: "#10b981"
  },
  {
    title: "Chronic Pain Management",
    description: "Pain that doesn't go away changes everything — sleep, mood, relationships. Understanding pain science and having the right support plan can make a real difference.",
    icon: "pulse",
    color: "#ef4444"
  },
  {
    title: "Mental Health & Physical Injury",
    description: "Physical wounds often come with invisible ones. PTSD, depression, grief for your old self — these are normal responses to abnormal experiences. Don't ignore the mind while treating the body.",
    icon: "heart",
    color: "#8b5cf6"
  },
  {
    title: "Home Adaptations & Equipment",
    description: "Grants are available to adapt your home — wet rooms, ramps, stairlifts, specialist equipment. You shouldn't have to struggle with basic daily tasks. Help is there.",
    icon: "home",
    color: "#f59e0b"
  },
  {
    title: "Financial Support During Recovery",
    description: "War Pensions, AFCS, DLA/PIP, and charity grants can all help during recovery. You've earned these entitlements through your service. Don't be too proud to claim them.",
    icon: "cash",
    color: "#059669"
  },
];

export default function RecoverySupport() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'rehabilitation': return '#3b82f6';
      case 'prosthetics': return '#10b981';
      case 'pain': return '#ef4444';
      case 'support': return '#f59e0b';
      case 'mental-health': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'rehabilitation': return '#dbeafe';
      case 'prosthetics': return '#d1fae5';
      case 'pain': return '#fee2e2';
      case 'support': return '#fef3c7';
      case 'mental-health': return '#ede9fe';
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

        {/* AI Chat CTA - Top */}
        <TouchableOpacity 
          style={styles.chatBanner}
          onPress={() => router.push('/chat/mo')}
          activeOpacity={0.85}
          data-testid="chat-mo-banner"
        >
          <Image 
            source={{ uri: '/images/mo.png' }}
            style={styles.chatBannerAvatarImg}
          />
          <View style={styles.chatBannerText}>
            <Text style={styles.chatBannerTitle}>Talk to Mo</Text>
            <Text style={styles.chatBannerDesc}>Ex-Sapper, lost his leg in Afghan. He gets recovery.</Text>
          </View>
          <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="medkit" size={40} color="#dc2626" />
          </View>
          <Text style={styles.heroTitle}>Recovery Support</Text>
          <Text style={styles.heroSubtitle}>
            Injury doesn't end when you leave theatre. Recovery is ongoing — and you don't have to do it alone.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Recovery Topics</Text>
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
          <Text style={styles.ctaTitle}>Need someone to talk to?</Text>
          <Text style={styles.ctaText}>Mo knows the recovery journey inside out.</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/chat/mo')} data-testid="talk-to-mo-btn">
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Talk to Mo</Text>
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
  chatBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 2, borderColor: '#dc2626' },
  chatBannerAvatarImg: { width: 52, height: 52, borderRadius: 26, marginRight: 12, borderWidth: 2, borderColor: '#dc2626' },
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
  ctaButton: { flexDirection: 'row', backgroundColor: '#dc2626', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', gap: 8 },
  ctaButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
