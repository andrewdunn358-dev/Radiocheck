import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Linking } from 'react-native';
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
  category: 'cancer' | 'blood-cancer' | 'hospice' | 'support' | 'financial' | 'mental-health';
}

const RESOURCES: Resource[] = [
  {
    title: "Macmillan Cancer Support",
    description: "Information, support and a listening ear",
    fullDescription: "Macmillan provides expert information on all types of cancer, emotional support, financial guidance, and practical help. Their support line (0808 808 00 00) is free and available 7 days a week. They also have specialist benefits advisors.",
    url: "https://www.macmillan.org.uk",
    icon: "leaf",
    category: "cancer"
  },
  {
    title: "Cancer Research UK",
    description: "Research, information and support",
    fullDescription: "Cancer Research UK funds research and provides comprehensive, evidence-based information about all types of cancer — diagnosis, treatment options, living with cancer, and clinical trials. Their nurses can answer your questions on 0808 800 4040.",
    url: "https://www.cancerresearchuk.org",
    icon: "flask",
    category: "cancer"
  },
  {
    title: "Leukaemia Care",
    description: "Support for blood cancer patients and families",
    fullDescription: "Leukaemia Care provides support for anyone affected by blood cancer — leukaemia, lymphoma, myeloma, and MDS. Their CARE Line (08088 010 444) offers emotional support, practical information, and nurse-led advice.",
    url: "https://www.leukaemiacare.org.uk",
    icon: "water",
    category: "blood-cancer"
  },
  {
    title: "Blood Cancer UK",
    description: "Research and support for blood cancer",
    fullDescription: "Blood Cancer UK funds research and provides support for people living with blood cancer. They have patient information, peer support communities, and a support line staffed by specialist nurses.",
    url: "https://bloodcancer.org.uk",
    icon: "pulse",
    category: "blood-cancer"
  },
  {
    title: "Maggie's Centres",
    description: "Free cancer support centres across the UK",
    fullDescription: "Maggie's provides free practical, emotional, and social support to anyone with cancer and their families. Their centres are warm, welcoming spaces where you can talk to professionals, join support groups, or just have a cup of tea.",
    url: "https://www.maggies.org",
    icon: "home",
    category: "cancer"
  },
  {
    title: "Marie Curie",
    description: "Care and support for terminal illness",
    fullDescription: "Marie Curie provides care and support for people living with a terminal illness and their families. This includes nursing care, a free support line (0800 090 2309), online community, and bereavement support.",
    url: "https://www.mariecurie.org.uk",
    icon: "flower",
    category: "hospice"
  },
  {
    title: "Hospice UK",
    description: "Palliative and end-of-life care",
    fullDescription: "Hospice UK supports a network of over 200 hospices across the UK. Hospices provide specialist palliative care — pain management, emotional support, and quality of life — for people with life-limiting illnesses. Care is free.",
    url: "https://www.hospiceuk.org",
    icon: "bed",
    category: "hospice"
  },
  {
    title: "The Royal British Legion",
    description: "Financial and practical support for veterans with serious illness",
    fullDescription: "The Royal British Legion can provide financial grants for veterans facing serious illness — help with travel to hospital, specialist equipment, heating bills, and family support during treatment. Call 0808 802 8080.",
    url: "https://www.britishlegion.org.uk",
    icon: "star",
    category: "financial"
  },
  {
    title: "SSAFA",
    description: "Armed Forces charity support during illness",
    fullDescription: "SSAFA provides practical and emotional support for serving personnel, veterans, and families dealing with serious illness. From grants to mentoring to family support, they understand the military dimension of your situation.",
    url: "https://www.ssafa.org.uk",
    icon: "people",
    category: "support"
  },
  {
    title: "Combat Stress",
    description: "Mental health support alongside physical illness",
    fullDescription: "A serious illness diagnosis can trigger or worsen PTSD, anxiety, and depression. Combat Stress provides specialist mental health treatment for veterans that takes into account both your service history and your current medical situation.",
    url: "https://combatstress.org.uk",
    icon: "shield-checkmark",
    category: "mental-health"
  },
  {
    title: "Citizens Advice - Benefits When Ill",
    description: "Understanding your benefit entitlements",
    fullDescription: "If you're too ill to work, you may be entitled to Employment Support Allowance, Personal Independence Payment, Attendance Allowance, or Universal Credit. Citizens Advice can help you understand and apply for what you're owed.",
    url: "https://www.citizensadvice.org.uk/benefits/sick-or-disabled-people-and-carers/",
    icon: "cash",
    category: "financial"
  },
  {
    title: "NHS Veteran Priority Treatment",
    description: "Your right to priority NHS care",
    fullDescription: "Veterans are entitled to priority NHS treatment for service-related conditions. Ensure your GP is aware of your service history. Many hospitals now have veteran-aware accreditation and dedicated pathways.",
    url: "https://veteranaware.nhs.uk",
    icon: "medical",
    category: "support"
  },
];

const TOPICS = [
  {
    title: "Facing a Diagnosis",
    description: "Hearing 'you have cancer' or another serious diagnosis turns your world upside down. It's okay to be scared, angry, or numb. There's no wrong way to react.",
    icon: "alert-circle",
    color: "#ef4444"
  },
  {
    title: "Treatment & Side Effects",
    description: "Chemotherapy, radiotherapy, surgery, immunotherapy — treatment is tough. Understanding what to expect and having support through it makes a real difference.",
    icon: "medkit",
    color: "#3b82f6"
  },
  {
    title: "Service-Related Cancers",
    description: "Some cancers may be linked to service — exposure to depleted uranium, asbestos, burn pits, chemicals. If you believe your illness is service-related, you may be entitled to compensation.",
    icon: "shield",
    color: "#8b5cf6"
  },
  {
    title: "Financial Impact",
    description: "Serious illness often means loss of income, increased costs, and financial stress. Military charities and the benefits system can help — don't struggle alone.",
    icon: "cash",
    color: "#059669"
  },
  {
    title: "Mental Health & Illness",
    description: "A serious diagnosis can trigger or worsen PTSD, depression, and anxiety. Your mental health matters alongside your physical treatment. Support is available.",
    icon: "heart",
    color: "#ec4899"
  },
  {
    title: "Supporting Your Family",
    description: "Serious illness affects the whole family. Partners, children, and parents need support too. Several charities provide family-specific services alongside patient care.",
    icon: "people",
    color: "#f59e0b"
  },
];

export default function SeriousIllness() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cancer': return '#ef4444';
      case 'blood-cancer': return '#dc2626';
      case 'hospice': return '#8b5cf6';
      case 'support': return '#3b82f6';
      case 'financial': return '#059669';
      case 'mental-health': return '#ec4899';
      default: return '#6b7280';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'cancer': return '#fee2e2';
      case 'blood-cancer': return '#fee2e2';
      case 'hospice': return '#ede9fe';
      case 'support': return '#dbeafe';
      case 'financial': return '#d1fae5';
      case 'mental-health': return '#fce7f3';
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
          <View style={[styles.heroIcon, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="pulse" size={40} color="#9333ea" />
          </View>
          <Text style={styles.heroTitle}>Serious Illness Support</Text>
          <Text style={styles.heroSubtitle}>
            Cancer, leukaemia, and other serious conditions.{'\n'}You fought for your country. Now let others fight for you.
          </Text>
        </View>

        {/* AI Chat CTA - Top */}
        <TouchableOpacity 
          style={styles.chatBanner}
          onPress={() => router.push('/chat/reg')}
          activeOpacity={0.85}
          data-testid="chat-reg-banner"
        >
          <View style={styles.chatBannerLeft}>
            <View style={[styles.chatBannerAvatar, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="chatbubbles" size={24} color="#9333ea" />
            </View>
            <View style={styles.chatBannerText}>
              <Text style={styles.chatBannerTitle}>Talk to Reg</Text>
              <Text style={styles.chatBannerDesc}>Ex-Royal Navy, cancer survivor. He understands.</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9333ea" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>What You're Facing</Text>
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
          <Text style={styles.ctaText}>Reg has been through it. He understands.</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/chat/reg')} data-testid="talk-to-reg-btn">
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Talk to Reg</Text>
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
  chatBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 2, borderColor: '#9333ea' },
  chatBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  chatBannerAvatar: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
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
  ctaButton: { flexDirection: 'row', backgroundColor: '#9333ea', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', gap: 8 },
  ctaButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
