import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Linking,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

const MARGIE_AVATAR = 'https://static.prod-images.emergentagent.com/jobs/fba61e42-5a99-4622-a43b-84a14c5bcf87/images/313a20c933febb69cc523b6b3647ba814a5b9123a3ea7f674f7a87695a8a4789.png';

// UK Armed Forces-Specific Resources
const VETERAN_RESOURCES = [
  { 
    name: 'Tom Harrison House', 
    desc: 'UK\'s only residential rehab for veterans, serving personnel and emergency services', 
    phone: '0151 526 2109', 
    url: 'https://www.tomharrisonhouse.org.uk',
    highlight: true
  },
  { 
    name: 'Combat Stress', 
    desc: 'Armed forces mental health charity - addiction support available', 
    phone: '0800 138 1619', 
    url: 'https://combatstress.org.uk' 
  },
  { 
    name: 'Op Courage', 
    desc: 'NHS specialist service for serving personnel and veterans - includes addiction support', 
    phone: '0300 323 0137', 
    url: 'https://www.nhs.uk/nhs-services/armed-forces-community/mental-health/veterans-reservists/' 
  },
  { 
    name: 'Veterans\' Gateway', 
    desc: 'First point of contact - can connect you with addiction services', 
    phone: '0808 802 1212', 
    url: 'https://www.veteransgateway.org.uk' 
  },
];

const ALCOHOL_DRUG_RESOURCES = [
  { 
    name: 'Alcoholics Anonymous UK', 
    desc: '24-hour helpline for anyone with a drinking problem', 
    phone: '0800 917 7650', 
    url: 'https://www.alcoholics-anonymous.org.uk' 
  },
  { 
    name: 'Drinkline', 
    desc: 'National alcohol helpline - free and confidential', 
    phone: '0300 123 1110', 
    url: 'https://www.nhs.uk/live-well/alcohol-advice/alcohol-support/' 
  },
  { 
    name: 'FRANK', 
    desc: 'Friendly, confidential drugs advice', 
    phone: '0300 123 6600', 
    url: 'https://www.talktofrank.com' 
  },
  { 
    name: 'Narcotics Anonymous UK', 
    desc: 'Support for drug addiction recovery', 
    phone: '0300 999 1212', 
    url: 'https://ukna.org' 
  },
  { 
    name: 'Change Grow Live', 
    desc: 'Free drug and alcohol support across the UK', 
    phone: '0808 802 9000', 
    url: 'https://www.changegrowlive.org' 
  },
  { 
    name: 'We Are With You', 
    desc: 'Free, confidential support for drugs and alcohol', 
    url: 'https://www.wearewithyou.org.uk' 
  },
];

const GAMBLING_RESOURCES = [
  { 
    name: 'GamCare', 
    desc: 'Free support, advice and counselling for gambling problems', 
    phone: '0808 802 0133', 
    url: 'https://www.gamcare.org.uk',
    highlight: true
  },
  { 
    name: 'GamStop', 
    desc: 'Free self-exclusion from all UK licensed gambling sites', 
    url: 'https://www.gamstop.co.uk' 
  },
  { 
    name: 'Gamblers Anonymous UK', 
    desc: 'Peer support groups for gambling addiction', 
    url: 'https://www.gamblersanonymous.org.uk' 
  },
  { 
    name: 'BeGambleAware', 
    desc: 'Information and support for safer gambling', 
    phone: '0808 802 0133', 
    url: 'https://www.begambleaware.org' 
  },
  { 
    name: 'Armed Forces Gambling Support', 
    desc: 'GamCare specialist support for military community', 
    phone: '0808 802 0133', 
    url: 'https://www.gamcare.org.uk/get-support/who-does-gamcare-help/armed-forces/' 
  },
];

const SELF_HELP_TIPS = [
  {
    id: 'track',
    icon: 'calendar-outline',
    title: 'Track Your Behaviour',
    desc: 'Keep a diary of when you drink, use, or gamble. Seeing patterns helps you understand triggers.'
  },
  {
    id: 'triggers',
    icon: 'flash-outline',
    title: 'Identify Your Triggers',
    desc: 'What situations, emotions, or times make you reach for a drink, a bet, or a hit? Understanding triggers is the first step.'
  },
  {
    id: 'talk',
    icon: 'chatbubbles-outline',
    title: 'Talk to Someone',
    desc: 'You don\'t have to do this alone. A mate, family member, or helpline can make a real difference.'
  },
  {
    id: 'routine',
    icon: 'time-outline',
    title: 'Build New Routines',
    desc: 'Replace addictive behaviour with something else - gym, walking, gaming, or any hobby that keeps your hands and mind busy.'
  },
  {
    id: 'goals',
    icon: 'trophy-outline',
    title: 'Set Small Goals',
    desc: 'Don\'t try to change everything at once. Start with small wins, then build up gradually.'
  },
  {
    id: 'avoid',
    icon: 'close-circle-outline',
    title: 'Avoid Temptation Early On',
    desc: 'If pubs, betting shops, or certain mates are triggers, it\'s okay to take a break while you build strength.'
  },
  {
    id: 'selfexclude',
    icon: 'ban-outline',
    title: 'Use Self-Exclusion',
    desc: 'For gambling: sign up to GamStop to block yourself from UK betting sites. It works and it\'s free.'
  },
];

const WARNING_SIGNS = [
  'Drinking, using, or gambling more than you intended, more often than planned',
  'Using substances or gambling to cope with memories, sleep, or emotions',
  'Feeling defensive or irritable when someone mentions your behaviour',
  'Needing more to get the same effect (tolerance) or chasing losses',
  'Experiencing withdrawal symptoms (shaking, sweating, anxiety, restlessness)',
  'Neglecting responsibilities - work, family, finances',
  'Relationships suffering because of your addiction',
  'Hiding how much you drink, use, or gamble',
  'Borrowing money or getting into debt to fund your habit',
  'Failed attempts to cut down or stop',
];

export default function SubstanceSupport() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [activeSection, setActiveSection] = useState<'overview' | 'resources' | 'selfhelp' | 'warning'>('overview');
  const styles = createStyles(colors, theme);

  const renderOverview = () => (
    <>
      {/* Chat with Margie Card */}
      <TouchableOpacity 
        style={styles.margieCard}
        onPress={() => router.push('/margie-chat')}
        data-testid="chat-margie-btn"
      >
        <Image source={{ uri: MARGIE_AVATAR }} style={styles.margieAvatar} />
        <View style={styles.margieContent}>
          <Text style={styles.margieTitle}>Chat with Margie</Text>
          <Text style={styles.margieDesc}>
            Non-judgemental AI support for all addictions - alcohol, drugs, gambling, and more. Available 24/7.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#fcd34d" />
      </TouchableOpacity>

      {/* Hero Section */}
      <View style={styles.heroCard}>
        <Ionicons name="heart" size={48} color="#f59e0b" />
        <Text style={styles.heroTitle}>You're Not Alone</Text>
        <Text style={styles.heroText}>
          Many serving personnel and veterans struggle with addiction - whether it's alcohol, drugs, gambling, or other compulsive behaviours. 
          It often starts as a way to cope, to feel something, or to escape. 
          Recognising the problem is the hardest part. You've already shown courage.
        </Text>
      </View>

      {/* Quick Help */}
      <View style={styles.quickHelpCard}>
        <Text style={styles.quickHelpTitle}>Need to Talk Now?</Text>
        <View style={styles.quickHelpButtons}>
          <TouchableOpacity 
            style={styles.quickHelpBtn}
            onPress={() => Linking.openURL('tel:08001381619')}
            data-testid="combat-stress-call-btn"
          >
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.quickHelpBtnText}>Combat Stress{'\n'}0800 138 1619</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickHelpBtn, styles.quickHelpBtnSecondary]}
            onPress={() => Linking.openURL('tel:08089177650')}
            data-testid="aa-call-btn"
          >
            <Ionicons name="call" size={20} color="#f59e0b" />
            <Text style={[styles.quickHelpBtnText, styles.quickHelpBtnTextSecondary]}>AA Helpline{'\n'}0800 917 7650</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Veterans & Addiction */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Why the Armed Forces Are at Higher Risk</Text>
        <Text style={styles.infoText}>
          Serving personnel and veterans are significantly more likely to develop problems with alcohol and substances than civilians. This isn't weakness - it's often the result of:
        </Text>
        <View style={styles.reasonsList}>
          <View style={styles.reasonItem}>
            <Ionicons name="flash" size={18} color="#f59e0b" />
            <Text style={styles.reasonText}>Combat trauma and PTSD</Text>
          </View>
          <View style={styles.reasonItem}>
            <Ionicons name="bed" size={18} color="#f59e0b" />
            <Text style={styles.reasonText}>Sleep problems and nightmares</Text>
          </View>
          <View style={styles.reasonItem}>
            <Ionicons name="people" size={18} color="#f59e0b" />
            <Text style={styles.reasonText}>Drinking culture in the forces</Text>
          </View>
          <View style={styles.reasonItem}>
            <Ionicons name="shuffle" size={18} color="#f59e0b" />
            <Text style={styles.reasonText}>Difficulty adjusting to civilian life</Text>
          </View>
          <View style={styles.reasonItem}>
            <Ionicons name="body" size={18} color="#f59e0b" />
            <Text style={styles.reasonText}>Physical pain from injuries</Text>
          </View>
          <View style={styles.reasonItem}>
            <Ionicons name="person-remove" size={18} color="#f59e0b" />
            <Text style={styles.reasonText}>Loss of identity and purpose</Text>
          </View>
        </View>
      </View>

      {/* Featured Resource */}
      <TouchableOpacity 
        style={styles.featuredCard}
        onPress={() => Linking.openURL('https://www.tomharrisonhouse.org.uk')}
        data-testid="tom-harrison-featured-btn"
      >
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredBadgeText}>ARMED FORCES SPECIFIC</Text>
        </View>
        <Text style={styles.featuredTitle}>Tom Harrison House</Text>
        <Text style={styles.featuredDesc}>
          The UK's only residential rehabilitation centre exclusively for veterans, serving personnel and emergency services. 
          They understand military culture and the unique challenges you face.
        </Text>
        <View style={styles.featuredPhone}>
          <Ionicons name="call" size={16} color="#fff" />
          <Text style={styles.featuredPhoneText}>0151 526 2109</Text>
        </View>
      </TouchableOpacity>

      {/* Navigation Cards */}
      <View style={styles.navSection}>
        <TouchableOpacity 
          style={styles.navCard}
          onPress={() => setActiveSection('resources')}
          data-testid="nav-resources-btn"
        >
          <View style={[styles.navIconBg, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="list" size={24} color="#16a34a" />
          </View>
          <Text style={styles.navTitle}>Helplines & Resources</Text>
          <Text style={styles.navDesc}>Full list of UK support services</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navCard}
          onPress={() => setActiveSection('selfhelp')}
          data-testid="nav-selfhelp-btn"
        >
          <View style={[styles.navIconBg, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="fitness" size={24} color="#2563eb" />
          </View>
          <Text style={styles.navTitle}>Self-Help Guide</Text>
          <Text style={styles.navDesc}>Practical tips to take control</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navCard}
          onPress={() => setActiveSection('warning')}
          data-testid="nav-warning-btn"
        >
          <View style={[styles.navIconBg, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="warning" size={24} color="#dc2626" />
          </View>
          <Text style={styles.navTitle}>Warning Signs</Text>
          <Text style={styles.navDesc}>Recognise if you need help</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderResources = () => (
    <>
      <Text style={styles.pageTitle}>Helplines & Resources</Text>
      <Text style={styles.pageSubtitle}>All calls are confidential. You don't need to give your name.</Text>

      <Text style={styles.resourceGroupTitle}>Armed Forces Services</Text>
      {VETERAN_RESOURCES.map((resource, index) => (
        <TouchableOpacity 
          key={index}
          style={[styles.resourceCard, resource.highlight && styles.resourceCardHighlight]}
          onPress={() => resource.url && Linking.openURL(resource.url)}
          data-testid={`resource-${resource.name.toLowerCase().replace(/\s/g, '-')}`}
        >
          <View style={styles.resourceContent}>
            <Text style={styles.resourceName}>{resource.name}</Text>
            <Text style={styles.resourceDesc}>{resource.desc}</Text>
            {resource.phone && (
              <TouchableOpacity 
                style={styles.resourcePhone}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(`tel:${resource.phone.replace(/\s/g, '')}`);
                }}
              >
                <Ionicons name="call" size={14} color="#16a34a" />
                <Text style={styles.resourcePhoneText}>{resource.phone}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      ))}

      <Text style={[styles.resourceGroupTitle, { marginTop: 24 }]}>General UK Support</Text>
      {GENERAL_RESOURCES.map((resource, index) => (
        <TouchableOpacity 
          key={index}
          style={styles.resourceCard}
          onPress={() => resource.url && Linking.openURL(resource.url)}
        >
          <View style={styles.resourceContent}>
            <Text style={styles.resourceName}>{resource.name}</Text>
            <Text style={styles.resourceDesc}>{resource.desc}</Text>
            {resource.phone && (
              <TouchableOpacity 
                style={styles.resourcePhone}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(`tel:${resource.phone.replace(/\s/g, '')}`);
                }}
              >
                <Ionicons name="call" size={14} color="#16a34a" />
                <Text style={styles.resourcePhoneText}>{resource.phone}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      ))}

      <View style={styles.emergencyCard}>
        <Ionicons name="warning" size={20} color="#dc2626" />
        <Text style={styles.emergencyText}>
          If you or someone else is in immediate danger, call 999
        </Text>
      </View>
    </>
  );

  const renderSelfHelp = () => (
    <>
      <Text style={styles.pageTitle}>Self-Help Guide</Text>
      <Text style={styles.pageSubtitle}>Practical steps you can take today. Recovery is a journey, not a single step.</Text>

      {SELF_HELP_TIPS.map((tip, index) => (
        <View key={tip.id} style={styles.tipCard}>
          <View style={styles.tipNumber}>
            <Text style={styles.tipNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.tipContent}>
            <View style={styles.tipHeader}>
              <Ionicons name={tip.icon as any} size={20} color="#f59e0b" />
              <Text style={styles.tipTitle}>{tip.title}</Text>
            </View>
            <Text style={styles.tipDesc}>{tip.desc}</Text>
          </View>
        </View>
      ))}

      <View style={styles.motivationCard}>
        <Text style={styles.motivationTitle}>Remember</Text>
        <Text style={styles.motivationText}>
          "Asking for help is not a sign of weakness. In the forces, we had each other's backs. 
          Let someone have yours now."
        </Text>
        <Text style={styles.motivationAttrib}>- Former Royal Marine, 12 years sober</Text>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#2563eb" />
        <Text style={styles.infoCardText}>
          SMART Recovery and AA both have online meetings if you're not ready for face-to-face. 
          You can listen without speaking.
        </Text>
      </View>
    </>
  );

  const renderWarning = () => (
    <>
      <Text style={styles.pageTitle}>Warning Signs</Text>
      <Text style={styles.pageSubtitle}>Recognising a problem is the first step to solving it. Be honest with yourself.</Text>

      <View style={styles.warningIntro}>
        <Ionicons name="help-circle" size={24} color="#f59e0b" />
        <Text style={styles.warningIntroText}>
          Do any of these sound familiar? Ticking even one or two might mean it's time to talk to someone.
        </Text>
      </View>

      {WARNING_SIGNS.map((sign, index) => (
        <View key={index} style={styles.warningItem}>
          <View style={styles.warningCheckbox}>
            <Ionicons name="square-outline" size={20} color="#94a3b8" />
          </View>
          <Text style={styles.warningText}>{sign}</Text>
        </View>
      ))}

      <View style={styles.takeActionCard}>
        <Text style={styles.takeActionTitle}>Ready to Take Action?</Text>
        <Text style={styles.takeActionText}>
          You don't have to hit rock bottom to get help. The earlier you reach out, the easier the path back.
        </Text>
        <TouchableOpacity 
          style={styles.takeActionBtn}
          onPress={() => Linking.openURL('tel:08081234567')}
          data-testid="take-action-btn"
        >
          <Ionicons name="call" size={20} color="#fff" />
          <Text style={styles.takeActionBtnText}>Call Veterans' Gateway: 0808 802 1212</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.samaritansCard}>
        <Text style={styles.samaritansTitle}>Feeling Low?</Text>
        <Text style={styles.samaritansText}>
          Samaritans are available 24/7 if things are getting too much.
        </Text>
        <TouchableOpacity 
          style={styles.samaritansBtn}
          onPress={() => Linking.openURL('tel:116123')}
        >
          <Text style={styles.samaritansBtnText}>Call 116 123 (free)</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => activeSection === 'overview' ? router.back() : setActiveSection('overview')} 
          style={styles.backButton}
          data-testid="back-btn"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeSection === 'overview' ? 'Substance Support' : 
           activeSection === 'resources' ? 'Resources' :
           activeSection === 'selfhelp' ? 'Self-Help' : 'Warning Signs'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'resources' && renderResources()}
        {activeSection === 'selfhelp' && renderSelfHelp()}
        {activeSection === 'warning' && renderWarning()}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, theme: string) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Margie Card
  margieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme === 'dark' ? '#451a03' : '#fffbeb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  margieAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#f59e0b',
    marginRight: 14,
  },
  margieContent: {
    flex: 1,
  },
  margieTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 4,
  },
  margieDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Hero Section
  heroCard: {
    backgroundColor: theme === 'dark' ? '#422006' : '#fffbeb',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme === 'dark' ? '#854d0e' : '#fde68a',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  heroText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },

  // Quick Help
  quickHelpCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickHelpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  quickHelpButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickHelpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  quickHelpBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  quickHelpBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  quickHelpBtnTextSecondary: {
    color: '#f59e0b',
  },

  // Info Section
  infoSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  reasonsList: {
    gap: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reasonText: {
    fontSize: 14,
    color: colors.text,
  },

  // Featured Card
  featuredCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  featuredBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e3a5f',
    letterSpacing: 1,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  featuredDesc: {
    fontSize: 14,
    color: '#b0c4de',
    lineHeight: 20,
    marginBottom: 12,
  },
  featuredPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featuredPhoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Navigation Cards
  navSection: {
    gap: 12,
  },
  navCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  navIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 12,
  },
  navDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 12,
    marginTop: 2,
    flex: 1,
  },

  // Page Title
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },

  // Resources
  resourceGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resourceCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resourceCardHighlight: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  resourceContent: {
    flex: 1,
  },
  resourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  resourceDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resourcePhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  resourcePhoneText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
  },

  // Emergency Card
  emergencyCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  emergencyText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },

  // Self-Help Tips
  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  tipContent: {
    flex: 1,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tipDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Motivation Card
  motivationCard: {
    backgroundColor: theme === 'dark' ? '#1e3a5f' : '#eff6ff',
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  motivationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 8,
  },
  motivationText: {
    fontSize: 15,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  motivationAttrib: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },

  // Info Card
  infoCard: {
    backgroundColor: theme === 'dark' ? '#1e293b' : '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: theme === 'dark' ? '#334155' : '#bae6fd',
  },
  infoCardText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },

  // Warning Signs
  warningIntro: {
    flexDirection: 'row',
    backgroundColor: theme === 'dark' ? '#422006' : '#fffbeb',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme === 'dark' ? '#854d0e' : '#fde68a',
  },
  warningIntroText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },

  // Take Action Card
  takeActionCard: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  takeActionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  takeActionText: {
    fontSize: 14,
    color: '#dcfce7',
    lineHeight: 20,
    marginBottom: 12,
  },
  takeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  takeActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },

  // Samaritans Card
  samaritansCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  samaritansTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  samaritansText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  samaritansBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  samaritansBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
});
