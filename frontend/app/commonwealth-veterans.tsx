import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Linking } from 'react-native';
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
  category: 'rights' | 'support' | 'travel' | 'health' | 'community' | 'legal';
}

const RESOURCES: Resource[] = [
  // Settlement Rights
  {
    title: "Right to Remain in UK",
    description: "Your settlement rights after service",
    fullDescription: "Commonwealth veterans who have served for at least 4 years (or been medically discharged) are entitled to Indefinite Leave to Remain (ILR) in the UK. Since 2022, this is FREE - there are no longer immigration fees for you or your immediate family. This is your right, not a favour.",
    url: "https://www.gov.uk/settle-in-the-uk/y/you-re-a-commonwealth-citizen-with-a-uk-armed-forces-discharge-or-veterans-hm-armed-forces-id-card",
    icon: "home",
    category: "rights"
  },
  {
    title: "Family Settlement Rights",
    description: "Bringing your family to the UK",
    fullDescription: "Your spouse/partner and children under 18 can also apply for settlement. As of 2022, there are no fees for these applications either. Your family served alongside you - through deployments, worry, and sacrifice - they deserve to stay too.",
    url: "https://www.gov.uk/government/publications/unduly-lenient-settlement-criteria",
    icon: "people",
    category: "rights"
  },
  {
    title: "British Citizenship",
    description: "Becoming a British citizen",
    fullDescription: "After holding ILR for 12 months, you can apply for British Citizenship. For Commonwealth veterans, the 'good character' requirement acknowledges your military service. Citizenship gives you full voting rights, a British passport, and removes any uncertainty about your status.",
    url: "https://www.gov.uk/apply-citizenship-indefinite-leave-to-remain",
    icon: "flag",
    category: "rights"
  },
  {
    title: "The Turing Scheme",
    description: "Fee waiver for immigration",
    fullDescription: "Named in honour of Alan Turing, this scheme waives immigration health surcharges and application fees for Commonwealth veterans and their families. This acknowledgement was long overdue - many veterans faced bills of thousands of pounds just to stay in the country they served.",
    icon: "checkmark-circle",
    category: "rights"
  },
  // Travel & Home
  {
    title: "Visiting Home",
    description: "Travel schemes and support",
    fullDescription: "Several charities help Commonwealth veterans visit their home countries. The Royal British Legion and SSAFA have benevolent funds that can assist with emergency travel. Some airlines offer military discounts. Being far from home is hard - maintaining family connections matters.",
    url: "https://www.britishlegion.org.uk/get-support/financial-and-employment-support/finance/grants",
    icon: "airplane",
    category: "travel"
  },
  {
    title: "Armed Forces Covenant",
    description: "Local authority support",
    fullDescription: "The Armed Forces Covenant means local authorities must consider your service when providing housing, healthcare, and education for your children. This applies to ALL veterans including Commonwealth citizens. Make sure local services know about your veteran status.",
    url: "https://www.armedforcescovenant.gov.uk",
    icon: "document-text",
    category: "rights"
  },
  // Support Organisations
  {
    title: "CFFVC",
    description: "Commonwealth Forces Families & Veterans Council",
    fullDescription: "The CFFVC specifically represents and supports Commonwealth veterans and their families in the UK. They understand the unique challenges you face - immigration, being far from extended family, cultural differences in accessing support. They can advocate on your behalf.",
    url: "https://cffvc.org.uk",
    icon: "people",
    category: "support"
  },
  {
    title: "Royal British Legion",
    description: "Support for all who served",
    fullDescription: "The Royal British Legion supports ALL veterans, regardless of nationality. Their welfare services, financial support, and advocacy are available to you. Don't assume you're not eligible - you served in the British Armed Forces, you qualify.",
    url: "https://www.britishlegion.org.uk",
    icon: "flower",
    category: "support"
  },
  {
    title: "SSAFA",
    description: "Armed Forces charity",
    fullDescription: "SSAFA has been helping the Armed Forces community for over 135 years. They provide practical, emotional, and financial support. Their caseworkers can help navigate UK systems and ensure you're getting everything you're entitled to.",
    url: "https://www.ssafa.org.uk",
    icon: "heart",
    category: "support"
  },
  {
    title: "Veterans UK",
    description: "Government support services",
    fullDescription: "Veterans UK provides pensions, compensation, and welfare support to all veterans. As a Commonwealth veteran, you're entitled to the same Armed Forces Pension, War Pension, and AFCS compensation as any other veteran. Contact: 0808 1914 218",
    url: "https://www.gov.uk/government/organisations/veterans-uk",
    icon: "shield",
    category: "support"
  },
  // Health & Wellbeing
  {
    title: "NHS Entitlement",
    description: "Your healthcare rights",
    fullDescription: "You are entitled to FREE NHS healthcare. Register with a GP and make sure they know you're a veteran. You also have priority treatment for service-related conditions. The NHS should never ask for payment or immigration documents.",
    url: "https://www.nhs.uk/nhs-services/armed-forces-community",
    icon: "medical",
    category: "health"
  },
  {
    title: "Op COURAGE",
    description: "Mental health support",
    fullDescription: "Op COURAGE is the NHS veterans' mental health service, available across England. It provides specialist treatment for conditions like PTSD, depression, and anxiety. You don't need a referral from your GP - you can self-refer directly.",
    url: "https://www.nhs.uk/nhs-services/armed-forces-community/mental-health/veterans-reservists",
    icon: "heart",
    category: "health"
  },
  {
    title: "Combat Stress",
    description: "Veterans' mental health charity",
    fullDescription: "Combat Stress provides specialist mental health treatment for veterans with trauma-related conditions. They understand military culture and can help whether your service was recent or decades ago. Helpline: 0800 138 1619 (24/7)",
    url: "https://combatstress.org.uk",
    icon: "shield-checkmark",
    category: "health"
  },
  // Community
  {
    title: "Regimental Associations",
    description: "Connect with those who served with you",
    fullDescription: "Many regiments and units have associations that welcome Commonwealth veterans. These provide community, friendship, and support from people who truly understand your service. Your regiment is still your family.",
    url: "https://www.army.mod.uk/who-we-are/regimental-associations",
    icon: "people-circle",
    category: "community"
  },
  {
    title: "Veterans' Breakfast Clubs",
    description: "Peer support and camaraderie",
    fullDescription: "Veterans' Breakfast Clubs meet across the UK - no membership, no fees, just veterans meeting for breakfast and conversation. It's a great way to connect with others who understand service life, including other Commonwealth veterans.",
    url: "https://www.veteransbreakfastclubs.co.uk",
    icon: "cafe",
    category: "community"
  },
  {
    title: "Commonwealth War Graves",
    description: "Honouring all who fell",
    fullDescription: "The Commonwealth War Graves Commission maintains the graves of 1.7 million Commonwealth service members. Many were from Fiji, Jamaica, Nepal, Ghana, Nigeria, and dozens of other nations. Their sacrifice is remembered equally alongside British-born soldiers.",
    url: "https://www.cwgc.org",
    icon: "flower",
    category: "community"
  },
  // Legal Help
  {
    title: "Immigration Advice",
    description: "Getting expert help",
    fullDescription: "If you're having difficulties with immigration applications, get help from an OISC-registered adviser or immigration lawyer. Forces charities like SSAFA can often fund legal advice. Don't struggle alone or rely on unqualified advice.",
    url: "https://www.gov.uk/find-an-immigration-adviser",
    icon: "document-text",
    category: "legal"
  },
  {
    title: "Historical Immigration Issues",
    description: "Correcting past wrongs",
    fullDescription: "If you left service before the recent fee waivers and paid immigration fees, or were wrongly denied settlement, there may be ways to seek redress. Contact Forces charities who can advocate on your behalf. The rules have changed significantly in your favour.",
    icon: "time",
    category: "legal"
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'rights', label: 'Your Rights', icon: 'shield' },
  { id: 'support', label: 'Support', icon: 'heart' },
  { id: 'travel', label: 'Travel', icon: 'airplane' },
  { id: 'health', label: 'Health', icon: 'medical' },
  { id: 'community', label: 'Community', icon: 'people' },
  { id: 'legal', label: 'Legal', icon: 'document-text' },
];

export default function CommonwealthVeterans() {
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
          <Text style={styles.headerTitle}>Commonwealth Comrades</Text>
          <Text style={styles.headerSubtitle}>Supporting Veterans from Across the World</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroGradient}>
            <Ionicons name="globe" size={48} color="#ffffff" />
            <Text style={styles.heroTitle}>You Served Britain</Text>
            <Text style={styles.heroText}>
              From Fiji to Jamaica, Nepal to Ghana - Commonwealth citizens have served 
              with distinction in the British Armed Forces. This page is for you.
            </Text>
          </View>
        </View>

        {/* Key Rights Box */}
        <View style={styles.rightsBox}>
          <Ionicons name="checkmark-done-circle" size={28} color="#14b8a6" />
          <View style={styles.rightsContent}>
            <Text style={styles.rightsTitle}>Key Rights - Know Your Entitlements</Text>
            <Text style={styles.rightsItem}>FREE settlement (ILR) after 4+ years service</Text>
            <Text style={styles.rightsItem}>FREE settlement for your spouse & children</Text>
            <Text style={styles.rightsItem}>Same pension & compensation as UK veterans</Text>
            <Text style={styles.rightsItem}>Full NHS healthcare entitlement</Text>
            <Text style={styles.rightsItem}>Armed Forces Covenant protections</Text>
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
                      <Ionicons name="open-outline" size={16} color="#14b8a6" />
                      <Text style={styles.resourceLinkText}>Visit Website</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Helpline Section */}
        <View style={styles.helplineSection}>
          <Text style={styles.helplineTitle}>Need Help?</Text>
          <Text style={styles.helplineText}>
            CFFVC (Commonwealth Forces Families & Veterans Council) specifically supports 
            Commonwealth veterans and understands the unique challenges you face.
          </Text>
          <TouchableOpacity 
            style={styles.helplineButton}
            onPress={() => openUrl('https://cffvc.org.uk')}
          >
            <Ionicons name="globe" size={20} color="#ffffff" />
            <Text style={styles.helplineButtonText}>Visit CFFVC</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    rights: '#14b8a6',
    support: '#ec4899',
    travel: '#3b82f6',
    health: '#10b981',
    community: '#8b5cf6',
    legal: '#f59e0b',
  };
  return colors[category] || '#14b8a6';
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#14b8a6',
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
    backgroundColor: '#14b8a6',
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
  rightsBox: {
    flexDirection: 'row',
    backgroundColor: '#f0fdfa',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#14b8a6',
    marginBottom: 16,
  },
  rightsContent: {
    flex: 1,
    marginLeft: 12,
  },
  rightsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f766e',
    marginBottom: 8,
  },
  rightsItem: {
    fontSize: 14,
    color: '#0f766e',
    lineHeight: 22,
  },
  categoryScroll: {
    paddingHorizontal: 16,
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
    backgroundColor: '#14b8a6',
    borderColor: '#14b8a6',
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
    color: '#14b8a6',
    marginLeft: 6,
    fontWeight: '500',
  },
  helplineSection: {
    margin: 16,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  helplineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  helplineText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  helplineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14b8a6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  helplineButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
