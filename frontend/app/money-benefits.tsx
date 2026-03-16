import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

interface Benefit {
  title: string;
  description: string;
  fullDescription?: string;
  keyFacts?: string[];
  url?: string;
  icon: string;
  category: 'benefits' | 'discounts' | 'debt' | 'help';
}

const BENEFITS: Benefit[] = [
  // Main Benefits
  {
    title: "Universal Credit",
    description: "Main benefit for working-age people",
    fullDescription: "Universal Credit is the main benefit for people of working age who are on a low income or out of work. You can claim whether you're working or not. Veterans may be entitled to additional elements.",
    keyFacts: [
      "Single under 25: £311.68/month",
      "Single 25+: £393.45/month",
      "Couples (both 25+): £617.60/month",
      "Housing element covers rent",
      "Limited Capability for Work element if you can't work due to health"
    ],
    url: "https://www.gov.uk/universal-credit",
    icon: "card",
    category: "benefits"
  },
  {
    title: "Personal Independence Payment (PIP)",
    description: "Extra help if you have a health condition",
    fullDescription: "PIP helps with extra living costs if you have a long-term physical or mental health condition or disability. It's NOT means-tested — you can work and still get it. Many veterans with service-related conditions are entitled.",
    keyFacts: [
      "Daily Living: £72.65 (standard) to £108.55 (enhanced) per week",
      "Mobility: £28.70 (standard) to £75.75 (enhanced) per week",
      "NOT means-tested — doesn't matter what savings you have",
      "You CAN work and still claim PIP",
      "Covers physical AND mental health conditions"
    ],
    url: "https://www.gov.uk/pip",
    icon: "accessibility",
    category: "benefits"
  },
  {
    title: "Council Tax Discounts",
    description: "You may pay less than you think",
    fullDescription: "There are several Council Tax discounts and exemptions available. Single person discount is 25% off. Some councils now offer specific veteran discounts. If you're on certain benefits, you might get even more off.",
    keyFacts: [
      "25% single person discount — automatic if you live alone",
      "Some councils offer veteran-specific discounts",
      "Deployed personnel get full relief on UK property",
      "Disabled band reduction if your home is adapted",
      "Contact your local council to check all discounts"
    ],
    url: "https://www.gov.uk/council-tax",
    icon: "home",
    category: "benefits"
  },
  {
    title: "War Pension / AFCS",
    description: "Compensation for service-related conditions",
    fullDescription: "If you have injuries or illnesses caused by service, you may be entitled to War Pension (pre-2005 service) or Armed Forces Compensation Scheme (post-2005). Talk to Jack in the app for specialist help with these claims.",
    keyFacts: [
      "Tax-free payments for service-related conditions",
      "War Pension: pre-6 April 2005 service",
      "AFCS: post-6 April 2005 service",
      "Lump sums and ongoing payments available",
      "Chat with Jack for detailed claims help"
    ],
    url: "https://www.gov.uk/guidance/armed-forces-compensation-scheme-afcs",
    icon: "medal",
    category: "benefits"
  },
  {
    title: "Pension Credit",
    description: "Extra money if you're over State Pension age",
    fullDescription: "Pension Credit tops up your weekly income if you're over State Pension age and on a low income. Even a small amount of Pension Credit can unlock other benefits like free TV licence, help with NHS costs, and Council Tax Reduction.",
    keyFacts: [
      "Tops up your income to £218.15/week (single) or £332.95 (couple)",
      "Unlocks other benefits like free TV licence",
      "Help with NHS costs (dental, glasses, prescriptions)",
      "May qualify for Council Tax Reduction",
      "Many people miss out — check if you're eligible"
    ],
    url: "https://www.gov.uk/pension-credit",
    icon: "cash",
    category: "benefits"
  },
  // Discounts
  {
    title: "Veterans Railcard",
    description: "1/3 off rail travel",
    fullDescription: "The Veterans Railcard gives you 1/3 off most rail fares across the UK. It costs £30 for one year or £70 for three years. You can also get discounts for people travelling with you.",
    keyFacts: [
      "1/3 off most rail fares",
      "£30 for 1 year or £70 for 3 years",
      "Discounts for people travelling with you",
      "Available to all veterans",
      "Apply online at railcard.co.uk"
    ],
    url: "https://www.railcard.co.uk/railcards/veterans-railcard/",
    icon: "train",
    category: "discounts"
  },
  {
    title: "Defence Discount Service",
    description: "Discounts at hundreds of retailers",
    fullDescription: "The Defence Discount Service offers discounts at hundreds of retailers, restaurants, and services. Free to join for veterans. Also look at Blue Light Card for additional discounts.",
    keyFacts: [
      "Free to join for veterans",
      "Discounts at hundreds of retailers",
      "Online and in-store savings",
      "Also check Blue Light Card",
      "Shows and events discounts too"
    ],
    url: "https://www.defencediscountservice.co.uk",
    icon: "pricetag",
    category: "discounts"
  },
  {
    title: "Armed Forces Covenant",
    description: "Your rights as a veteran",
    fullDescription: "The Armed Forces Covenant is a promise from the nation that veterans and their families should face no disadvantage. Councils and public bodies have a legal duty to consider your needs. Know your rights.",
    keyFacts: [
      "Legal duty on councils to consider veteran needs",
      "Priority for social housing in some areas",
      "NHS priority treatment for service-related conditions",
      "Support for children's education",
      "Over 12,000 organisations signed up"
    ],
    url: "https://www.armedforcescovenant.gov.uk",
    icon: "shield-checkmark",
    category: "benefits"
  },
  // Debt Help
  {
    title: "StepChange Debt Charity",
    description: "Free, expert debt advice",
    fullDescription: "StepChange provides free, impartial debt advice. They can help you understand your options, deal with creditors, and find a way forward. No judgment, just practical help.",
    keyFacts: [
      "Completely free advice",
      "Help with all types of debt",
      "Can negotiate with creditors for you",
      "Debt Management Plans available",
      "Call 0800 138 1111"
    ],
    url: "https://www.stepchange.org",
    icon: "help-buoy",
    category: "debt"
  },
  {
    title: "Citizens Advice",
    description: "Free advice on benefits and debt",
    fullDescription: "Citizens Advice can help with benefits claims, debt, housing, employment, and more. They have specialist knowledge of veteran issues and can help you navigate the system.",
    keyFacts: [
      "Free, confidential advice",
      "Help with benefits applications",
      "Debt advice and support",
      "Can help write letters and fill forms",
      "Online, phone, or face-to-face"
    ],
    url: "https://www.citizensadvice.org.uk",
    icon: "chatbubbles",
    category: "help"
  },
  {
    title: "Turn2Us Benefits Calculator",
    description: "Check what you're entitled to",
    fullDescription: "Turn2Us has a free benefits calculator that shows you what you might be entitled to. Takes about 10 minutes and could reveal benefits you didn't know about.",
    keyFacts: [
      "Free online benefits calculator",
      "Takes about 10 minutes",
      "Shows all benefits you might be entitled to",
      "Also shows grants available",
      "Completely confidential"
    ],
    url: "https://benefits-calculator.turn2us.org.uk",
    icon: "calculator",
    category: "help"
  },
  // Emergency Help
  {
    title: "SSAFA Emergency Grants",
    description: "Urgent financial help",
    fullDescription: "SSAFA can provide emergency financial assistance to veterans in crisis. If you're struggling to pay bills, buy food, or facing homelessness, they may be able to help quickly.",
    keyFacts: [
      "Emergency grants for veterans in crisis",
      "Help with bills, food, essential items",
      "Quick response in urgent situations",
      "Also longer-term support available",
      "Call 0800 260 6767"
    ],
    url: "https://www.ssafa.org.uk",
    icon: "flash",
    category: "help"
  },
  {
    title: "Royal British Legion",
    description: "Financial assistance and advice",
    fullDescription: "The Royal British Legion can help with financial assistance, benefits advice, and support. They have trained advisers who understand veteran issues and can help you claim what you're entitled to.",
    keyFacts: [
      "Free benefits advice",
      "Financial grants available",
      "Help with debt and budgeting",
      "Trained advisers who understand veterans",
      "Call 0808 802 8080"
    ],
    url: "https://www.britishlegion.org.uk",
    icon: "flower",
    category: "help"
  }
];

export default function MoneyBenefits() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'benefits': return '#059669';
      case 'discounts': return '#3b82f6';
      case 'debt': return '#dc2626';
      case 'help': return '#7c3aed';
      default: return '#6b7280';
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'benefits': return '#d1fae5';
      case 'discounts': return '#dbeafe';
      case 'debt': return '#fee2e2';
      case 'help': return '#ede9fe';
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Money & Benefits</Text>
        </View>

        {/* Penny AI Chat Card - TOP OF PAGE */}
        <TouchableOpacity 
          style={[styles.aiCard, { backgroundColor: isDark ? '#1a3a2a' : '#f0fdf4', borderColor: '#22c55e' }]}
          onPress={() => router.push('/chat/penny')}
          activeOpacity={0.9}
        >
          <Image 
            source={{ uri: '/images/penny.png' }}
            style={styles.aiAvatar}
          />
          <View style={styles.aiTextContainer}>
            <Text style={[styles.aiTitle, { color: colors.text }]}>Chat with Penny</Text>
            <Text style={[styles.aiSubtitle, { color: colors.textSecondary }]}>Ex-Navy, benefits & money specialist</Text>
          </View>
          <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
          </View>
        </TouchableOpacity>

        {/* Intro */}
        <View style={[styles.introCard, { backgroundColor: isDark ? '#1a2e1a' : '#f0fdf4', borderColor: '#86efac' }]}>
          <Ionicons name="information-circle" size={24} color="#22c55e" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.introText, { color: colors.textSecondary }]}>
              Many veterans miss out on benefits and discounts they're entitled to. Let's make sure you're getting everything you deserve.
            </Text>
          </View>
        </View>

        {/* Main Benefits */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Benefits</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          These are the main benefits you might be entitled to
        </Text>

        {BENEFITS.filter(b => b.category === 'benefits').map((benefit, index) => (
          <View key={index} style={[styles.benefitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.benefitHeader}>
              <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(benefit.category) }]}>
                <Ionicons name={benefit.icon as any} size={24} color={getCategoryColor(benefit.category)} />
              </View>
              <Text style={[styles.benefitTitle, { color: colors.text }]}>{benefit.title}</Text>
            </View>
            
            {benefit.fullDescription && (
              <Text style={[styles.fullDescription, { color: colors.textSecondary }]}>
                {benefit.fullDescription}
              </Text>
            )}
            
            {benefit.keyFacts && benefit.keyFacts.length > 0 && (
              <View style={styles.keyFactsContainer}>
                {benefit.keyFacts.map((fact, factIndex) => (
                  <View key={factIndex} style={styles.keyFactRow}>
                    <Text style={[styles.bulletPoint, { color: getCategoryColor(benefit.category) }]}>•</Text>
                    <Text style={[styles.keyFactText, { color: colors.textSecondary }]}>{fact}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {benefit.url && (
              <TouchableOpacity 
                style={[styles.linkButton, { backgroundColor: getCategoryColor(benefit.category) }]}
                onPress={() => openLink(benefit.url!)}
                activeOpacity={0.8}
              >
                <Text style={styles.linkButtonText}>Learn More</Text>
                <Ionicons name="open-outline" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Discounts */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Veteran Discounts</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Save money with these veteran-specific discounts
        </Text>

        {BENEFITS.filter(b => b.category === 'discounts').map((benefit, index) => (
          <View key={index} style={[styles.benefitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.benefitHeader}>
              <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(benefit.category) }]}>
                <Ionicons name={benefit.icon as any} size={24} color={getCategoryColor(benefit.category)} />
              </View>
              <Text style={[styles.benefitTitle, { color: colors.text }]}>{benefit.title}</Text>
            </View>
            
            {benefit.fullDescription && (
              <Text style={[styles.fullDescription, { color: colors.textSecondary }]}>
                {benefit.fullDescription}
              </Text>
            )}
            
            {benefit.keyFacts && benefit.keyFacts.length > 0 && (
              <View style={styles.keyFactsContainer}>
                {benefit.keyFacts.map((fact, factIndex) => (
                  <View key={factIndex} style={styles.keyFactRow}>
                    <Text style={[styles.bulletPoint, { color: getCategoryColor(benefit.category) }]}>•</Text>
                    <Text style={[styles.keyFactText, { color: colors.textSecondary }]}>{fact}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {benefit.url && (
              <TouchableOpacity 
                style={[styles.linkButton, { backgroundColor: getCategoryColor(benefit.category) }]}
                onPress={() => openLink(benefit.url!)}
                activeOpacity={0.8}
              >
                <Text style={styles.linkButtonText}>Visit Website</Text>
                <Ionicons name="open-outline" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Debt Warning */}
        <View style={[styles.debtWarning, { backgroundColor: isDark ? '#3d1f1f' : '#fef2f2', borderColor: '#fca5a5' }]}>
          <Ionicons name="warning" size={24} color="#dc2626" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.debtWarningTitle, { color: colors.text }]}>Struggling with Debt?</Text>
            <Text style={[styles.debtWarningText, { color: colors.textSecondary }]}>
              Don't suffer alone. Free, confidential help is available. Debt charities can negotiate with creditors and help you find a way forward.
            </Text>
          </View>
        </View>

        {/* Debt Help */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Debt Help</Text>

        {BENEFITS.filter(b => b.category === 'debt').map((benefit, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.helpCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => benefit.url && openLink(benefit.url)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(benefit.category) }]}>
              <Ionicons name={benefit.icon as any} size={24} color={getCategoryColor(benefit.category)} />
            </View>
            <View style={styles.helpContent}>
              <Text style={[styles.helpTitle, { color: colors.text }]}>{benefit.title}</Text>
              <Text style={[styles.helpDescription, { color: colors.textSecondary }]}>{benefit.fullDescription}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Help & Advice */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Help & Advice</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Free support to help you claim what you're entitled to
        </Text>

        {BENEFITS.filter(b => b.category === 'help').map((benefit, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.helpCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => benefit.url && openLink(benefit.url)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(benefit.category) }]}>
              <Ionicons name={benefit.icon as any} size={24} color={getCategoryColor(benefit.category)} />
            </View>
            <View style={styles.helpContent}>
              <Text style={[styles.helpTitle, { color: colors.text }]}>{benefit.title}</Text>
              <Text style={[styles.helpDescription, { color: colors.textSecondary }]}>{benefit.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Veterans UK */}
        <View style={[styles.veteransUKCard, { backgroundColor: colors.card, borderColor: '#3b82f6' }]}>
          <Ionicons name="call" size={32} color="#3b82f6" />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.veteransUKTitle, { color: colors.text }]}>Veterans UK Helpline</Text>
            <Text style={[styles.veteransUKText, { color: colors.textSecondary }]}>
              Official government helpline for veteran welfare, benefits, and support services.
            </Text>
            <Text style={[styles.veteransUKNumber, { color: '#3b82f6' }]}>0808 1914 218</Text>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  introText: {
    fontSize: 14,
    lineHeight: 22,
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
  benefitCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  fullDescription: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  keyFactsContainer: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  keyFactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletPoint: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
    marginTop: 1,
  },
  keyFactText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  debtWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
  },
  debtWarningTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  debtWarningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  helpDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  veteransUKCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginTop: 24,
  },
  veteransUKTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  veteransUKText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  veteransUKNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
});
