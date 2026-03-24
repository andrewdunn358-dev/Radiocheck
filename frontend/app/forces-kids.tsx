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
  category: 'charity' | 'youth' | 'education' | 'support' | 'bereaved' | 'cadets';
}

const RESOURCES: Resource[] = [
  // Charities for Service Children
  {
    title: "Scotty's Little Soldiers",
    description: "Supporting bereaved military children",
    fullDescription: "Scotty's Little Soldiers is a charity dedicated to supporting children and young people who have lost a parent serving in the British Armed Forces. Founded by war widow Nikki Scott, they provide emotional support, access to child bereavement services, gifts, events, and a community of children who understand. No child should feel alone in their grief.",
    url: "https://www.scottyslittlesoldiers.co.uk",
    icon: "heart",
    category: "bereaved"
  },
  {
    title: "Little Troopers",
    description: "Supporting all military children",
    fullDescription: "Little Troopers supports all children with parents serving in the British Armed Forces, whether that's dealing with deployments, relocations, or the everyday challenges of military family life. They provide resources, emotional support, and programmes designed to help children feel connected to their serving parent.",
    url: "https://littletroopers.net",
    icon: "happy",
    category: "charity"
  },
  {
    title: "RCET (Royal Caledonian Education Trust)",
    description: "Supporting Scottish forces families",
    fullDescription: "RCET supports the children and families of Scottish Armed Forces personnel past and present. They provide educational grants, advice on schooling, and help children cope with the unique challenges of military family life including frequent moves and parental absence.",
    url: "https://www.rcet.org.uk",
    icon: "school",
    category: "education"
  },
  {
    title: "Army Families Federation",
    description: "Voice of Army families",
    fullDescription: "The Army Families Federation (AFF) is the independent voice of Army families worldwide. They provide information, advice, and support on all aspects of Army family life, including education, childcare, housing, and the impact of service life on children.",
    url: "https://aff.org.uk",
    icon: "people",
    category: "support"
  },
  {
    title: "Naval Families Federation",
    description: "Supporting Royal Navy families",
    fullDescription: "The Naval Families Federation provides information, support and a voice for all Royal Navy and Royal Marines families. They help families navigate service life and ensure children's needs are understood and met.",
    url: "https://nff.org.uk",
    icon: "boat",
    category: "support"
  },
  {
    title: "RAF Families Federation",
    description: "Voice of RAF families",
    fullDescription: "The RAF Families Federation provides an independent voice for RAF families, ensuring their views are heard and acted upon. They provide information and support on education, childcare, housing, and helping children thrive in a military family.",
    url: "https://www.raf-ff.org.uk",
    icon: "airplane",
    category: "support"
  },
  // Cadets & Youth Organisations
  {
    title: "Army Cadet Force (ACF)",
    description: "Youth organisation sponsored by the Army",
    fullDescription: "The Army Cadet Force is one of the UK's largest youth organisations, with over 37,000 cadets aged 12-18. They offer adventure training, leadership development, first aid, shooting, fieldcraft, and the Duke of Edinburgh Award. It's about building character, confidence, and skills for life - not recruitment.",
    url: "https://armycadets.com",
    icon: "fitness",
    category: "cadets"
  },
  {
    title: "Air Training Corps (ATC)",
    description: "Youth organisation of the RAF",
    fullDescription: "The Air Training Corps (Air Cadets) is for young people aged 12-20 with an interest in aviation, adventure, and personal development. They offer flying, gliding, adventure training, leadership courses, and the chance to gain qualifications that last a lifetime.",
    url: "https://www.raf.mod.uk/aircadets",
    icon: "airplane",
    category: "cadets"
  },
  {
    title: "Sea Cadet Corps",
    description: "Nautical youth charity",
    fullDescription: "The Sea Cadets is a national youth charity for 10-18 year olds. They offer sailing, powerboating, kayaking, offshore sailing expeditions, and practical skills. Many units are based on rivers and inland waters, not just the coast. They build confidence, teamwork, and seamanship.",
    url: "https://www.sea-cadets.org",
    icon: "boat",
    category: "cadets"
  },
  {
    title: "Combined Cadet Force (CCF)",
    description: "School-based cadet units",
    fullDescription: "The Combined Cadet Force operates in schools and provides military-themed activities including adventure training, leadership development, and community service. Many independent and state schools have CCF units with Army, Navy, and RAF sections.",
    url: "https://combinedcadetforce.org.uk",
    icon: "school",
    category: "cadets"
  },
  // Education & Support
  {
    title: "Service Children's Education",
    description: "Understanding the challenges",
    fullDescription: "Service children face unique educational challenges: frequent school moves (average 6 during their education), parental deployment, and living overseas. Many schools now have Service Pupil Premium funding to provide additional support. Ask your school about their support for Service children.",
    icon: "book",
    category: "education"
  },
  {
    title: "CEAS (Children's Education Advisory Service)",
    description: "Expert education advice",
    fullDescription: "CEAS provides expert, impartial advice on all aspects of children's education for Service families. They can help with school admissions, special educational needs, boarding school options, exam timing around moves, and university applications.",
    url: "https://www.gov.uk/guidance/childrens-education-advisory-service",
    icon: "help-circle",
    category: "education"
  },
  {
    title: "Service Pupil Premium",
    description: "Additional school funding",
    fullDescription: "Schools receive additional funding (Service Pupil Premium) for each child with a parent in the Armed Forces. This money should be used to support military children with the challenges they face. Ask your child's school how they use this funding.",
    icon: "cash",
    category: "education"
  },
  // Support for Bereaved Children
  {
    title: "Winston's Wish",
    description: "Childhood bereavement charity",
    fullDescription: "Winston's Wish is the UK's childhood bereavement charity, providing support to bereaved children and their families. They understand the unique circumstances of military loss and work alongside Scotty's Little Soldiers to ensure children get the help they need.",
    url: "https://www.winstonswish.org",
    icon: "heart",
    category: "bereaved"
  },
  {
    title: "Child Bereavement UK",
    description: "Support when a parent dies",
    fullDescription: "Child Bereavement UK supports families when a child dies or when a child is bereaved of someone important. They offer counselling, support groups, and resources to help children understand and cope with their grief.",
    url: "https://www.childbereavementuk.org",
    icon: "flower",
    category: "bereaved"
  },
  // Youth Wellbeing
  {
    title: "Young Minds",
    description: "Children's mental health charity",
    fullDescription: "Young Minds fights for young people's mental health. They provide resources for children, parents, and professionals. Military children may face additional stress from deployments, moves, and worrying about their serving parent - it's okay to ask for help.",
    url: "https://www.youngminds.org.uk",
    icon: "medical",
    category: "support"
  },
  {
    title: "Childline",
    description: "Free confidential helpline",
    fullDescription: "Childline is a free, private and confidential service where children can talk about anything. Call 0800 1111 (free, won't show on phone bills). Available 24/7. Sometimes it helps to talk to someone outside the family.",
    url: "https://www.childline.org.uk",
    icon: "call",
    category: "support"
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'charity', label: 'Charities', icon: 'heart' },
  { id: 'cadets', label: 'Cadets', icon: 'flag' },
  { id: 'education', label: 'Education', icon: 'school' },
  { id: 'support', label: 'Support', icon: 'people' },
  { id: 'bereaved', label: 'Bereaved', icon: 'flower' },
];

export default function ForcesKids() {
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
          <Text style={styles.headerTitle}>Growing Up Military</Text>
          <Text style={styles.headerSubtitle}>Support for Service Children & Youth</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sam AI Chat Card - TOP OF PAGE */}
        <TouchableOpacity 
          style={styles.aiCard}
          onPress={() => router.push('/chat/sam')}
          activeOpacity={0.9}
        >
          <Image 
            source={require('../assets/images/sam.png')}
            style={styles.aiAvatar}
          />
          <View style={styles.aiTextContainer}>
            <Text style={styles.aiTitle}>Chat with Sam</Text>
            <Text style={styles.aiSubtitle}>Army wife 15 years — she understands forces kids</Text>
          </View>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>24/7</Text>
          </View>
        </TouchableOpacity>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroGradient}>
            <Ionicons name="happy" size={48} color="#ffffff" />
            <Text style={styles.heroTitle}>Growing Up in a Forces Family</Text>
            <Text style={styles.heroText}>
              Service children are resilient, adaptable, and part of a unique community. 
              Whether dealing with moves, deployments, or loss - support is here.
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>100k+</Text>
            <Text style={styles.statLabel}>Service Children in UK</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>6</Text>
            <Text style={styles.statLabel}>Average School Moves</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>130k</Text>
            <Text style={styles.statLabel}>Cadets Across UK</Text>
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
                      <Ionicons name="open-outline" size={16} color="#f97316" />
                      <Text style={styles.resourceLinkText}>Visit Website</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Cadets Section */}
        <View style={styles.cadetsSection}>
          <Text style={styles.cadetsTitle}>Join the Cadets!</Text>
          <Text style={styles.cadetsText}>
            The cadet forces offer amazing opportunities for young people aged 12-18: 
            adventure, qualifications, friendships, and skills for life. 
            It's not about joining the military - it's about personal development.
          </Text>
          <View style={styles.cadetsLogos}>
            <TouchableOpacity style={styles.cadetBadge} onPress={() => openUrl('https://armycadets.com')}>
              <Ionicons name="fitness" size={28} color="#4a5568" />
              <Text style={styles.cadetBadgeText}>ACF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cadetBadge} onPress={() => openUrl('https://www.raf.mod.uk/aircadets')}>
              <Ionicons name="airplane" size={28} color="#3b82f6" />
              <Text style={styles.cadetBadgeText}>ATC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cadetBadge} onPress={() => openUrl('https://www.sea-cadets.org')}>
              <Ionicons name="boat" size={28} color="#0891b2" />
              <Text style={styles.cadetBadgeText}>Sea</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    charity: '#f97316',
    cadets: '#22c55e',
    education: '#3b82f6',
    support: '#8b5cf6',
    bereaved: '#ec4899',
    youth: '#14b8a6',
  };
  return colors[category] || '#f97316';
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#f97316',
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
    backgroundColor: '#f97316',
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
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f97316',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
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
    backgroundColor: '#f97316',
    borderColor: '#f97316',
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
    color: '#f97316',
    marginLeft: 6,
    fontWeight: '500',
  },
  cadetsSection: {
    margin: 16,
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  cadetsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
    textAlign: 'center',
  },
  cadetsText: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  cadetsLogos: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cadetBadge: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  cadetBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    marginTop: 4,
  },
  // AI Chat Card styles
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#f97316',
  },
  aiAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fed7aa',
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
    backgroundColor: '#f97316',
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
