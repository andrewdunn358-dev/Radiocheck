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
  category: 'mental-health' | 'mst' | 'physical' | 'support' | 'community';
}

const RESOURCES: Resource[] = [
  {
    title: "Andy's Man Club",
    description: "Free talking groups for men, every Monday at 7pm",
    fullDescription: "Andy's Man Club runs free peer support groups for men across the UK every Monday night at 7pm. No referral needed, no sign-up — just turn up. Founded after Andy Roberts took his own life, the club exists because #ItsOkayToTalk. They have groups nationwide and welcome all men, including veterans.",
    url: "https://andysmanclub.co.uk",
    icon: "people",
    category: "community"
  },
  {
    title: "Combat Stress",
    description: "Specialist mental health support for veterans",
    fullDescription: "Combat Stress is the UK's leading mental health charity for veterans. They provide specialist treatment for PTSD, anxiety, depression, and complex trauma. They understand the unique pressures of military service and offer residential treatment, community outpatient services, and a 24/7 helpline: 0800 138 1619.",
    url: "https://combatstress.org.uk",
    icon: "shield-checkmark",
    category: "mental-health"
  },
  {
    title: "CALM (Campaign Against Living Miserably)",
    description: "Dedicated to preventing male suicide",
    fullDescription: "CALM exists to prevent male suicide. They run a free helpline (0800 58 58 58, 5pm-midnight daily) and webchat for men who need to talk. They campaign to break the stigma around men's mental health and challenge the idea that men should 'man up'.",
    url: "https://www.thecalmzone.net",
    icon: "call",
    category: "mental-health"
  },
  {
    title: "Movember",
    description: "Men's health — mental health, suicide prevention, prostate & testicular cancer",
    fullDescription: "Movember funds programmes focused on mental health, suicide prevention, prostate cancer, and testicular cancer. Their resources include conversation guides, mental health toolkits, and information on men's physical health issues that often go unspoken.",
    url: "https://uk.movember.com",
    icon: "ribbon",
    category: "physical"
  },
  {
    title: "Prostate Cancer UK",
    description: "Support, information and research for prostate cancer",
    fullDescription: "Prostate cancer is the most common cancer in men. 1 in 8 men will get it. Prostate Cancer UK provides free support, information, and a specialist nurse helpline (0800 074 8383). Veterans may have additional risk factors from service-related exposures.",
    url: "https://prostatecanceruk.org",
    icon: "medkit",
    category: "physical"
  },
  {
    title: "Men's Health Forum",
    description: "Improving health for men and boys",
    fullDescription: "The Men's Health Forum works to improve men's health in England, Wales and Scotland. They provide practical health information covering everything from mental health to physical conditions, including issues men often find hard to talk about.",
    url: "https://www.menshealthforum.org.uk",
    icon: "fitness",
    category: "physical"
  },
  {
    title: "The Menopause (Andropause) in Men",
    description: "Understanding male hormone changes",
    fullDescription: "The 'male menopause' or andropause is real — testosterone levels drop with age, causing fatigue, mood changes, reduced libido, weight gain, and depression. Veterans who served in high-stress environments may experience this earlier. Your GP can check testosterone levels with a simple blood test. Don't suffer in silence.",
    url: "https://www.nhs.uk/conditions/male-menopause/",
    icon: "pulse",
    category: "physical"
  },
  {
    title: "Military Sexual Trauma Support",
    description: "Support for men who experienced MST",
    fullDescription: "Military Sexual Trauma (MST) affects men too — and it's far more common than reported. Male survivors often face additional stigma and shame. It was NOT your fault. Support is available and you will be believed. The Survivors Trust can connect you with specialist help: 0808 801 0818.",
    url: "https://www.thesurvivorstrust.org",
    icon: "hand-left",
    category: "mst"
  },
  {
    title: "SurvivorsUK",
    description: "For men who have experienced sexual violence",
    fullDescription: "SurvivorsUK provides support specifically for men and boys who have experienced sexual violence. They offer counselling, an online helpline, and Independent Sexual Violence Advisors (ISVAs). They understand that it takes courage to seek help.",
    url: "https://www.survivorsuk.org",
    icon: "heart",
    category: "mst"
  },
  {
    title: "Veterans Gateway",
    description: "First point of contact for veteran support",
    fullDescription: "Veterans Gateway is the first point of contact for veterans seeking support. Call 0808 802 1212 (24/7). They can connect you with the right services for your specific needs — mental health, physical health, financial, housing, or family issues.",
    url: "https://www.veteransgateway.org.uk",
    icon: "compass",
    category: "support"
  },
  {
    title: "SSAFA",
    description: "Lifelong support for Armed Forces and families",
    fullDescription: "SSAFA is the Armed Forces charity that provides lifelong support to serving men and women, veterans, and their families. They offer practical, emotional, and financial help — from grants to mentoring to specialist casework.",
    url: "https://www.ssafa.org.uk",
    icon: "star",
    category: "support"
  },
  {
    title: "Help for Heroes",
    description: "Recovery and support for wounded veterans",
    fullDescription: "Help for Heroes supports those with physical and mental injuries sustained during service. They provide recovery programmes, clinical support, welfare grants, and community connections.",
    url: "https://www.helpforheroes.org.uk",
    icon: "trophy",
    category: "support"
  },
];

const TOPICS = [
  {
    title: "It's Okay to Not Be Okay",
    description: "The military taught you to push through. But bottling it up doesn't make it go away. Talking isn't weakness — it's maintenance. You'd service your weapon. Service your head too.",
    icon: "chatbubbles",
    color: "#3b82f6"
  },
  {
    title: "The Andropause (Male Menopause)",
    description: "Testosterone drops with age — fatigue, irritability, low mood, reduced libido, weight gain. It's not 'getting old', it's a medical condition. Your GP can test and treat it. Ask the question.",
    icon: "pulse",
    color: "#f59e0b"
  },
  {
    title: "Military Sexual Trauma",
    description: "MST happens to men too. More than you think. It wasn't your fault and you're not alone. Specialist support exists that understands the military context. You deserve to be heard.",
    icon: "shield",
    color: "#ec4899"
  },
  {
    title: "Anger & Aggression",
    description: "Hyper-vigilance and aggression were survival tools in theatre. In civvy street, they destroy relationships and careers. Understanding the 'why' is the first step to managing it.",
    icon: "flash",
    color: "#ef4444"
  },
  {
    title: "Alcohol & Substance Use",
    description: "The drinking culture in the forces normalises heavy use. When it follows you into civilian life and starts causing problems, it's time to take stock. No judgement here.",
    icon: "beer",
    category: "mental-health",
    color: "#d97706"
  },
  {
    title: "Prostate & Testicular Health",
    description: "Check yourself regularly. Know the symptoms. Early detection saves lives. Don't be embarrassed — your GP has seen it all before. Book that appointment.",
    icon: "medkit",
    color: "#10b981"
  },
  {
    title: "Isolation & Loneliness",
    description: "Going from a tight-knit unit to civilian isolation hits hard. Finding your tribe again takes effort, but groups like Andy's Man Club prove there are men out there who get it.",
    icon: "person",
    color: "#8b5cf6"
  },
  {
    title: "Suicide Prevention",
    description: "If you're having thoughts about ending it — please reach out. Veterans are at higher risk. There's no shame in asking for help. Call CALM on 0800 58 58 58 or Samaritans on 116 123. Right now, if you need to.",
    icon: "heart",
    color: "#dc2626"
  }
];

export default function HeServed() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'mental-health': return '#8b5cf6';
      case 'mst': return '#ec4899';
      case 'physical': return '#10b981';
      case 'support': return '#3b82f6';
      case 'community': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'mental-health': return '#ede9fe';
      case 'mst': return '#fce7f3';
      case 'physical': return '#d1fae5';
      case 'support': return '#dbeafe';
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
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="man" size={40} color="#2563eb" />
          </View>
          <Text style={styles.heroTitle}>He Served</Text>
          <Text style={styles.heroSubtitle}>
            Your service shaped you. But it doesn't have to define how you suffer.{'\n'}It's time to talk about the stuff that doesn't get talked about.
          </Text>
        </View>

        {/* Topics Section */}
        <Text style={styles.sectionTitle}>What We Cover</Text>
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

        {/* Resources Section */}
        <Text style={styles.sectionTitle}>Support & Resources</Text>
        {RESOURCES.map((resource, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.resourceCard}
            onPress={() => openLink(resource.url)}
            activeOpacity={0.8}
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

        {/* Bottom CTA */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Need to talk right now?</Text>
          <Text style={styles.ctaText}>Our AI Battle Buddies are available 24/7. Dave gets it.</Text>
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => router.push('/chat/dave')}
            data-testid="talk-to-dave-btn"
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Talk to Dave</Text>
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
  ctaButton: { flexDirection: 'row', backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', gap: 8 },
  ctaButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
