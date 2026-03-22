import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

interface Resource {
  title: string;
  description: string;
  fullDescription?: string;
  url?: string;
  icon: string;
  category: 'support' | 'history' | 'community' | 'health' | 'legal' | 'memorial';
}

const RESOURCES: Resource[] = [
  // Support Organisations
  {
    title: "Fighting With Pride",
    description: "Supporting LGBTQ+ veterans",
    fullDescription: "Fighting With Pride is the UK's leading charity supporting LGBTQ+ veterans who were affected by the ban on homosexuality in the Armed Forces. They provide welfare support, advocacy, and help veterans access the recognition and support they deserve. They successfully campaigned for the restoration of medals and continue to fight for justice.",
    url: "https://www.fightingwithpride.org.uk",
    icon: "ribbon",
    category: "support"
  },
  {
    title: "Galop",
    description: "LGBT+ anti-violence charity",
    fullDescription: "Galop is the UK's LGBT+ anti-abuse charity. They provide advice, support, and advocacy for LGBT+ people who have experienced hate crime, domestic abuse, or sexual violence. They understand the unique challenges facing LGBT+ veterans.",
    url: "https://galop.org.uk",
    icon: "shield-checkmark",
    category: "support"
  },
  {
    title: "Stonewall",
    description: "Campaigning for LGBTQ+ equality",
    fullDescription: "Stonewall campaigns for the equality of lesbian, gay, bi, trans, queer, questioning and ace (LGBTQ+) people across Britain. They provide resources, support information, and work to create inclusive environments in all sectors, including support for veterans.",
    url: "https://www.stonewall.org.uk",
    icon: "megaphone",
    category: "community"
  },
  {
    title: "LGBT Foundation",
    description: "Advice, support and information",
    fullDescription: "LGBT Foundation provides a wide range of services including helplines, counselling, and support groups. They offer specialist support for older LGBT+ people, including veterans, and can help with mental health, coming out, and navigating services.",
    url: "https://lgbt.foundation",
    icon: "call",
    category: "support"
  },
  // History
  {
    title: "The Ban: A Dark Chapter",
    description: "Understanding the historical injustice",
    fullDescription: "From 1967 to 2000, being gay in the British Armed Forces was a criminal offence. Service personnel were dismissed, imprisoned, and stripped of their medals simply for being who they were. Many faced invasive investigations and had their careers and lives destroyed. In 2021, the Government formally apologised and began restoring medals and offering financial redress.",
    icon: "time",
    category: "history"
  },
  {
    title: "The LGBT Veterans Review",
    description: "Government recognition and redress",
    fullDescription: "In 2022, Lord Etherton led an independent review into the treatment of LGBT veterans. The review confirmed the immense suffering caused by the ban and made recommendations for financial redress, the restoration of medals, and pardons. The Government accepted the recommendations, marking a significant step towards justice.",
    url: "https://www.gov.uk/government/publications/lgbt-veterans-independent-review",
    icon: "document-text",
    category: "legal"
  },
  {
    title: "Medal Restoration",
    description: "Reclaiming what was taken",
    fullDescription: "Veterans who had medals withheld or were stripped of them due to their sexuality can now apply to have them restored. Fighting With Pride can help you through this process. These medals represent service to your country - they were always yours.",
    url: "https://www.fightingwithpride.org.uk/medals",
    icon: "medal",
    category: "legal"
  },
  {
    title: "Financial Redress Scheme",
    description: "Compensation for those affected",
    fullDescription: "A financial redress scheme is available for those dismissed or discharged due to the ban. Payments range from £1,000 to £50,000 depending on the impact. Fighting With Pride and the Royal British Legion can help with applications.",
    url: "https://www.gov.uk/guidance/lgbt-veterans-apply-for-compensation",
    icon: "cash",
    category: "legal"
  },
  // Health & Wellbeing
  {
    title: "Mental Health Support",
    description: "Specialist LGBT+ mental health services",
    fullDescription: "Many LGBT+ veterans carry trauma from their time in service - not just operational stress, but the stress of hiding who they were, the fear of discovery, and for some, the trauma of investigation and dismissal. Specialist support is available through Fighting With Pride, Combat Stress, and the LGBT Foundation.",
    icon: "heart",
    category: "health"
  },
  {
    title: "Switchboard",
    description: "LGBT+ helpline",
    fullDescription: "Switchboard is the national LGBT+ helpline providing support, information and referrals. Call 0300 330 0630 (10am-10pm daily). They provide a safe space to talk about anything, including issues relating to your service.",
    url: "https://switchboard.lgbt",
    icon: "call",
    category: "health"
  },
  // Community
  {
    title: "Pride in Veterans",
    description: "Community events and support",
    fullDescription: "Pride in Veterans brings together LGBT+ veterans at Pride events and other gatherings across the UK. Marching with other veterans who understand your experience can be powerful. Check Fighting With Pride for upcoming events.",
    icon: "people",
    category: "community"
  },
  {
    title: "Serving with Pride Today",
    description: "How far we've come",
    fullDescription: "Since 2000, LGBT+ personnel can serve openly. Today, the Armed Forces actively support LGBT+ inclusion with networks, pride events, and diversity initiatives. While there's still work to do, the change has been remarkable. Your service helped make this possible.",
    icon: "flag",
    category: "community"
  },
  // Memorial
  {
    title: "Remembering Those We Lost",
    description: "Honouring all who served",
    fullDescription: "We remember all LGBT+ service personnel - those who served in silence, those who were dismissed, those who took their own lives, and those who continue to carry the scars. Your service mattered. You mattered. You still do.",
    icon: "flower",
    category: "memorial"
  },
  {
    title: "Sharing Your Story",
    description: "Your experiences matter",
    fullDescription: "If you feel ready, sharing your story can help others and preserve this important history. Fighting With Pride collects testimonies from LGBT+ veterans. You can choose to remain anonymous. Your story could help another veteran feel less alone.",
    url: "https://www.fightingwithpride.org.uk/your-stories",
    icon: "book",
    category: "memorial"
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'support', label: 'Support', icon: 'heart' },
  { id: 'history', label: 'History', icon: 'time' },
  { id: 'legal', label: 'Recognition', icon: 'document-text' },
  { id: 'health', label: 'Health', icon: 'medical' },
  { id: 'community', label: 'Community', icon: 'people' },
  { id: 'memorial', label: 'Remember', icon: 'flower' },
];

export default function TheyServed() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const filteredResources = selectedCategory === 'all' 
    ? RESOURCES 
    : RESOURCES.filter(r => r.category === selectedCategory);

  const toggleCard = (title: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedCards(newExpanded);
  };

  const openUrl = (url?: string) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>They Served</Text>
          <Text style={styles.headerSubtitle}>LGBTQ+ Veterans - Proud Service, Proud Support</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Alex AI Chat Card - TOP OF PAGE */}
        <TouchableOpacity 
          style={styles.aiCard}
          onPress={() => router.push('/chat/alex')}
          activeOpacity={0.9}
        >
          <Image 
            source={require('../assets/images/alex.png')}
            style={styles.aiAvatar}
          />
          <View style={styles.aiTextContainer}>
            <Text style={styles.aiTitle}>Chat with Alex</Text>
            <Text style={styles.aiSubtitle}>Former RAF, served under the ban — they get it</Text>
          </View>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>24/7</Text>
          </View>
        </TouchableOpacity>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroGradient}>
            <Ionicons name="rainbow" size={48} color="#ffffff" />
            <Text style={styles.heroTitle}>You Served With Pride</Text>
            <Text style={styles.heroText}>
              Whether you served openly, in silence, or had your career ended by the ban - 
              your service counted. Your sacrifice mattered. This page is for you.
            </Text>
          </View>
        </View>

        {/* Important Notice */}
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle" size={24} color="#3b82f6" />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>Recognition & Redress Available</Text>
            <Text style={styles.noticeText}>
              If you were affected by the pre-2000 ban, you may be entitled to medal restoration, 
              financial compensation, and a formal apology. Support is available to help you apply.
            </Text>
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons 
                name={cat.icon as any} 
                size={16} 
                color={selectedCategory === cat.id ? '#ffffff' : colors.textSecondary} 
              />
              <Text style={[
                styles.categoryChipText,
                selectedCategory === cat.id && styles.categoryChipTextActive
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Resources */}
        <View style={styles.resourcesSection}>
          {filteredResources.map((resource, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.resourceCard}
              onPress={() => toggleCard(resource.title)}
              activeOpacity={0.8}
            >
              <View style={styles.resourceHeader}>
                <View style={[styles.resourceIcon, { backgroundColor: getCategoryColor(resource.category) + '20' }]}>
                  <Ionicons name={resource.icon as any} size={24} color={getCategoryColor(resource.category)} />
                </View>
                <View style={styles.resourceInfo}>
                  <Text style={styles.resourceTitle}>{resource.title}</Text>
                  <Text style={styles.resourceDescription}>{resource.description}</Text>
                </View>
                <Ionicons 
                  name={expandedCards.has(resource.title) ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={colors.textSecondary} 
                />
              </View>
              
              {expandedCards.has(resource.title) && (
                <View style={styles.resourceExpanded}>
                  <Text style={styles.resourceFullDescription}>{resource.fullDescription}</Text>
                  {resource.url && (
                    <TouchableOpacity 
                      style={styles.resourceLink}
                      onPress={() => openUrl(resource.url)}
                    >
                      <Ionicons name="open-outline" size={16} color="#3b82f6" />
                      <Text style={styles.resourceLinkText}>Visit Website</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Need Someone to Talk To?</Text>
          <Text style={styles.contactText}>
            Fighting With Pride has trained peer supporters who understand what you've been through. 
            You don't have to face this alone.
          </Text>
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={() => openUrl('https://www.fightingwithpride.org.uk/contact')}
          >
            <Ionicons name="chatbubbles" size={20} color="#ffffff" />
            <Text style={styles.contactButtonText}>Get Support</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    support: '#ec4899',
    history: '#f59e0b',
    legal: '#3b82f6',
    health: '#10b981',
    community: '#8b5cf6',
    memorial: '#6b7280',
  };
  return colors[category] || '#3b82f6';
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#ec4899',
    padding: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroGradient: {
    backgroundColor: '#ec4899',
    padding: 24,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 12,
    textAlign: 'center',
  },
  heroText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  noticeContent: {
    flex: 1,
    marginLeft: 12,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  categoryChipText: {
    fontSize: 14,
    marginLeft: 6,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  resourcesSection: {
    padding: 16,
    paddingTop: 8,
  },
  resourceCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  resourceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resourceExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resourceFullDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  resourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  resourceLinkText: {
    fontSize: 14,
    color: '#3b82f6',
    marginLeft: 6,
    fontWeight: '500',
  },
  contactSection: {
    margin: 16,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ec4899',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  contactButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // AI Chat Card styles
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ec4899',
  },
  aiAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3e8ff',
  },
  aiTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  aiTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  aiSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  aiBadge: {
    backgroundColor: '#ec4899',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
