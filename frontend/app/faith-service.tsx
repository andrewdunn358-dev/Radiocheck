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
  category: 'chaplaincy' | 'christian' | 'muslim' | 'jewish' | 'sikh' | 'hindu' | 'buddhist' | 'support' | 'general';
}

const RESOURCES: Resource[] = [
  // Armed Forces Chaplaincy
  {
    title: "Royal Army Chaplains' Department",
    description: "Spiritual support for soldiers",
    fullDescription: "The Royal Army Chaplains' Department (RAChD) provides pastoral care and spiritual support to soldiers of all faiths and none. Padres deploy alongside troops, share the dangers, and are there in the hardest moments. They provide a confidential ear and spiritual guidance without judgement.",
    url: "https://www.army.mod.uk/who-we-are/corps-regiments-and-units/royal-army-chaplains-department",
    icon: "shield",
    category: "chaplaincy"
  },
  {
    title: "Naval Chaplaincy Service",
    description: "Spiritual care at sea and shore",
    fullDescription: "Naval Chaplains serve across the Royal Navy and Royal Marines, providing pastoral support on ships, submarines, and shore establishments. They support sailors and marines of all faiths through deployments, bereavements, and the unique challenges of life at sea.",
    url: "https://www.royalnavy.mod.uk/our-organisation/the-fighting-arms/naval-chaplaincy-service",
    icon: "boat",
    category: "chaplaincy"
  },
  {
    title: "RAF Chaplains Branch",
    description: "Spiritual support in the RAF",
    fullDescription: "RAF Chaplains provide pastoral and spiritual support across all RAF stations worldwide. They support personnel through operational deployments, family separations, and the moral challenges of military service. Available 24/7, they offer a confidential space to talk.",
    url: "https://www.raf.mod.uk/our-organisation/raf-chaplains-branch",
    icon: "airplane",
    category: "chaplaincy"
  },
  // Christian
  {
    title: "Armed Forces Christian Union",
    description: "Christian fellowship in the forces",
    fullDescription: "AFCU supports Christians serving in the Armed Forces and veterans. They provide fellowship, prayer support, events, and resources for Christians navigating military life. They understand the unique spiritual challenges of service.",
    url: "https://afcu.org.uk",
    icon: "book",
    category: "christian"
  },
  {
    title: "Forces Chaplaincy (Veterans)",
    description: "Continued spiritual support",
    fullDescription: "Many veterans miss the spiritual support they had in service. Church veteran groups and chaplaincy outreach programmes can help you reconnect. The Royal British Legion can also signpost to veteran-friendly churches.",
    icon: "heart",
    category: "christian"
  },
  {
    title: "Salvation Army",
    description: "Practical and spiritual support",
    fullDescription: "The Salvation Army has a long history of supporting the Armed Forces, dating back to the World Wars. They provide both practical support (housing, food, debt advice) and spiritual care. Many Salvationists have military backgrounds and understand service life.",
    url: "https://www.salvationarmy.org.uk",
    icon: "heart",
    category: "christian"
  },
  // Muslim
  {
    title: "Armed Forces Muslim Association",
    description: "Supporting Muslim personnel & veterans",
    fullDescription: "AFMA represents and supports Muslims serving in the British Armed Forces. They work to ensure Muslim personnel can practice their faith, have access to halal food, prayer facilities, and Islamic chaplaincy support. They also support Muslim veterans.",
    url: "https://www.afma.org.uk",
    icon: "moon",
    category: "muslim"
  },
  {
    title: "Muslim Chaplains",
    description: "Imams in the Armed Forces",
    fullDescription: "The Armed Forces now have Muslim chaplains (Imams) who provide Islamic spiritual care. They can advise on prayer times during operations, fasting during Ramadan on deployment, and help with any faith-related concerns. Your faith is respected.",
    icon: "person",
    category: "muslim"
  },
  {
    title: "Muslim Veteran Support",
    description: "Community and faith after service",
    fullDescription: "Leaving service can be challenging for Muslim veterans - finding a mosque community, reconnecting with faith practices. Local mosques often have veterans' outreach. AFMA can help connect you with supportive communities.",
    icon: "people",
    category: "muslim"
  },
  // Jewish
  {
    title: "Jewish Military Chaplaincy",
    description: "Jewish spiritual care in the forces",
    fullDescription: "The Armed Forces have Jewish chaplains who provide spiritual support, ensure kosher food availability where possible, and help Jewish personnel observe Shabbat and holidays. Jewish personnel have served with distinction throughout British military history.",
    icon: "star",
    category: "jewish"
  },
  {
    title: "AJEX - Jewish Military Association",
    description: "Association of Jewish Ex-Servicemen",
    fullDescription: "AJEX represents Jewish veterans in the UK. They maintain the tradition of remembrance, support welfare causes, and ensure the contribution of Jewish personnel to British defence is remembered. They hold annual commemoration services and provide community.",
    url: "https://www.ajex.org.uk",
    icon: "people",
    category: "jewish"
  },
  // Sikh
  {
    title: "Armed Forces Sikh Association",
    description: "Supporting Sikh personnel & veterans",
    fullDescription: "AFSA represents Sikhs in the British Armed Forces, ensuring the Articles of Faith (5 Ks) can be worn, turbans are accommodated, and Sikh personnel can practice their faith. They honour the long and distinguished history of Sikh service to Britain.",
    url: "https://www.afsa.org.uk",
    icon: "shield-checkmark",
    category: "sikh"
  },
  {
    title: "Sikh Military Heritage",
    description: "A proud tradition of service",
    fullDescription: "Sikhs have served in the British Armed Forces since the Anglo-Sikh Wars, with over 83,000 Sikh soldiers dying in WWI and WWII alone. The Sikh Regiment was among the most decorated. This heritage of courage and sacrifice continues today.",
    icon: "ribbon",
    category: "sikh"
  },
  // Hindu
  {
    title: "Armed Forces Hindu Network",
    description: "Supporting Hindu personnel",
    fullDescription: "The Hindu Network supports Hindu personnel in the Armed Forces, ensuring access to vegetarian food, celebration of festivals like Diwali, and Hindu chaplaincy support. They work to make the forces inclusive for all faiths.",
    url: "https://www.afhin.org.uk",
    icon: "flame",
    category: "hindu"
  },
  {
    title: "Hindu Chaplaincy",
    description: "Spiritual guidance and support",
    fullDescription: "Hindu chaplains (Pandits) are available in the Armed Forces to provide spiritual guidance, perform ceremonies, and support personnel through the challenges of military life. They can help with puja, festivals, and life events.",
    icon: "person",
    category: "hindu"
  },
  // Buddhist
  {
    title: "Buddhist Chaplaincy",
    description: "Mindfulness and spiritual support",
    fullDescription: "Buddhist chaplains serve in the Armed Forces, offering meditation guidance, mindfulness practice, and Buddhist spiritual care. Many personnel, regardless of background, find Buddhist practices helpful for dealing with stress and moral injury.",
    icon: "leaf",
    category: "buddhist"
  },
  {
    title: "Armed Forces Buddhist Society",
    description: "Buddhist fellowship in service",
    fullDescription: "The Buddhist Society supports Buddhist personnel and those interested in Buddhist practice. Meditation and mindfulness techniques can be particularly valuable for dealing with operational stress and finding peace after service.",
    url: "https://afbs.uk",
    icon: "flower",
    category: "buddhist"
  },
  // General Support
  {
    title: "No Faith? That's OK Too",
    description: "Chaplains support everyone",
    fullDescription: "Military chaplains support ALL personnel - including those with no religious faith. They offer confidential conversations, practical support, and a non-judgemental ear. You don't need to be religious to talk to a chaplain about your struggles.",
    icon: "chatbubbles",
    category: "general"
  },
  {
    title: "Moral Injury Support",
    description: "When service challenges your beliefs",
    fullDescription: "Moral injury - the deep distress from actions that violate your moral code - affects many veterans. This might relate to things you did, saw, or failed to prevent. Chaplains and specialist therapists understand this isn't the same as PTSD and can help.",
    icon: "heart-dislike",
    category: "support"
  },
  {
    title: "Forces Connect",
    description: "Spiritual resources online",
    fullDescription: "Can't get to a chaplain or place of worship? Online resources are available. Many faith communities offer virtual services, online prayer, and digital connection. You can maintain your spiritual practice anywhere.",
    icon: "globe",
    category: "support"
  },
  {
    title: "Combat Stress - Spiritual Care",
    description: "Faith-sensitive mental health",
    fullDescription: "Combat Stress understands that faith can be both a source of strength and a source of struggle for veterans. Their treatment programmes respect your beliefs and can incorporate spiritual care alongside clinical treatment.",
    url: "https://combatstress.org.uk",
    icon: "shield-checkmark",
    category: "support"
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'chaplaincy', label: 'Chaplaincy', icon: 'shield' },
  { id: 'christian', label: 'Christian', icon: 'book' },
  { id: 'muslim', label: 'Muslim', icon: 'moon' },
  { id: 'jewish', label: 'Jewish', icon: 'star' },
  { id: 'sikh', label: 'Sikh', icon: 'shield-checkmark' },
  { id: 'hindu', label: 'Hindu', icon: 'flame' },
  { id: 'buddhist', label: 'Buddhist', icon: 'leaf' },
  { id: 'support', label: 'Support', icon: 'heart' },
];

export default function FaithService() {
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
          <Text style={styles.headerTitle}>Faith & Service</Text>
          <Text style={styles.headerSubtitle}>Spiritual Support for All Faiths</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* James AI Chat Card - TOP OF PAGE */}
        <TouchableOpacity 
          style={styles.aiCard}
          onPress={() => router.push('/chat/james')}
          activeOpacity={0.9}
        >
          <Image 
            source={require('../assets/images/james.png')}
            style={styles.aiAvatar}
          />
          <View style={styles.aiTextContainer}>
            <Text style={styles.aiTitle}>Chat with James</Text>
            <Text style={styles.aiSubtitle}>20 years Army Chaplain — for all faiths and none</Text>
          </View>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>24/7</Text>
          </View>
        </TouchableOpacity>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroGradient}>
            <Ionicons name="leaf" size={48} color="#ffffff" />
            <Text style={styles.heroTitle}>Faith in Uniform</Text>
            <Text style={styles.heroText}>
              Whatever your faith - or none - spiritual support is available. 
              Chaplains serve all personnel, and faith communities welcome veterans.
            </Text>
          </View>
        </View>

        {/* Multi-faith message */}
        <View style={styles.multifaithBox}>
          <Text style={styles.multifaithTitle}>One Team, Many Faiths</Text>
          <Text style={styles.multifaithText}>
            The British Armed Forces respect and accommodate all faiths. Christians, Muslims, Sikhs, 
            Hindus, Jews, Buddhists, and those of no faith serve side by side. Your beliefs are valued.
          </Text>
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
                      <Ionicons name="open-outline" size={16} color="#8b5cf6" />
                      <Text style={styles.resourceLinkText}>Visit Website</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Quote Section */}
        <View style={styles.quoteSection}>
          <Ionicons name="chatbubble-ellipses" size={32} color="#8b5cf6" />
          <Text style={styles.quoteText}>
            "The Padre was the one person I could talk to honestly. He didn't judge, 
            didn't report it up the chain. He just listened. Sometimes that's all you need."
          </Text>
          <Text style={styles.quoteAttribution}>- Anonymous Veteran</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    chaplaincy: '#4f46e5',
    christian: '#3b82f6',
    muslim: '#059669',
    jewish: '#f59e0b',
    sikh: '#ea580c',
    hindu: '#dc2626',
    buddhist: '#8b5cf6',
    support: '#ec4899',
    general: '#6b7280',
  };
  return colors[category] || '#8b5cf6';
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#8b5cf6',
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
    backgroundColor: '#8b5cf6',
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
  multifaithBox: {
    backgroundColor: '#f5f3ff',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#8b5cf6',
    marginBottom: 16,
  },
  multifaithTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5b21b6',
    marginBottom: 4,
  },
  multifaithText: {
    fontSize: 14,
    color: '#5b21b6',
    lineHeight: 20,
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
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
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
    color: '#8b5cf6',
    marginLeft: 6,
    fontWeight: '500',
  },
  quoteSection: {
    margin: 16,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quoteText: {
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 12,
  },
  quoteAttribution: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
  // AI Chat Card styles
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  aiAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ddd6fe',
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
    backgroundColor: '#8b5cf6',
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
