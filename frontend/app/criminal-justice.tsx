import React from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Linking,
  StatusBar,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

// Rachel avatar for criminal justice support
const RACHEL_AVATAR = '/images/rachel.png';

const PRISON_RESOURCES = [
  { name: 'NACRO', desc: 'Support for people with criminal records', phone: '0300 123 1999', url: 'https://www.nacro.org.uk' },
  { name: 'Forces in Mind Trust', desc: 'Research on veterans in justice system', url: 'https://www.fim-trust.org' },
  { name: 'Walking With The Wounded', desc: 'Employment & justice support for the armed forces', url: 'https://walkingwiththewounded.org.uk' },
  { name: 'Project Nova', desc: 'Armed forces personnel in the criminal justice system', phone: '0800 917 7299', url: 'https://www.rfea.org.uk/our-programmes/project-nova/' },
  { name: 'Probation Services', desc: 'Support after prison release', phone: '0800 464 0708', url: 'https://www.gov.uk/guidance/probation-services' },
  { name: "Veterans' Gateway", desc: 'First point of contact for veterans', phone: '0808 802 1212', url: 'https://www.veteransgateway.org.uk' },
];

export default function CriminalJustice() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, lineHeight: 28 }}>Criminal Justice Support</Text>
          </View>
        </View>

        {/* Rachel AI Chat Card - Featured at top (like Warfare on Lawfare) */}
        <TouchableOpacity 
          style={{ backgroundColor: isDark ? '#243447' : colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#3b5068' : colors.border }}
          onPress={() => router.push('/chat/doris')}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Image source={{ uri: RACHEL_AVATAR }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Talk to Rachel</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>AI Support Companion</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
          </View>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 20 }}>
            Confidential AI support for veterans in or leaving the criminal justice system. 
            Rachel offers warm, non-judgemental guidance 24/7.
          </Text>
        </TouchableOpacity>

        {/* Understanding Section */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 }}>
            <FontAwesome5 name="balance-scale" size={24} color="#4f46e5" />
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>We understand</Text>
          </View>
          <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 12 }}>
            Serving personnel and veterans can face unique challenges with the law, often linked to untreated PTSD, substance misuse, 
            or difficulty adjusting to civilian life.
          </Text>
          <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>
            Whether you're currently in prison, recently released, or facing charges - specialist support is available. You're not alone.
          </Text>
        </View>

        {/* Info Notice */}
        <View style={{ backgroundColor: isDark ? '#2d4a3e' : '#dcfce7', borderRadius: 8, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#4a7c64' : '#86efac' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FontAwesome5 name="info-circle" size={18} color={isDark ? '#a8e6cf' : '#16a34a'} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#a8e6cf' : '#16a34a' }}>This section provides emotional support</Text>
          </View>
          <Text style={{ fontSize: 14, color: isDark ? '#c8f0dc' : '#166534', lineHeight: 20 }}>
            For legal advice, please consult a qualified legal professional. We offer wellbeing support and signposting to specialist services.
          </Text>
        </View>

        {/* Support Organizations Title */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Support Organisations</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Specialist services for veterans in the justice system</Text>
        </View>

        {/* Resources */}
        {PRISON_RESOURCES.map((resource, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.resourceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => resource.url && Linking.openURL(resource.url)}
          >
            <View style={styles.resourceContent}>
              <Text style={[styles.resourceName, { color: colors.text }]}>{resource.name}</Text>
              <Text style={[styles.resourceDesc, { color: colors.textSecondary }]}>{resource.desc}</Text>
              {resource.phone && (
                <TouchableOpacity 
                  style={styles.resourcePhone}
                  onPress={() => Linking.openURL(`tel:${resource.phone.replace(/\s/g, '')}`)}
                >
                  <FontAwesome5 name="phone-alt" size={14} color="#16a34a" />
                  <Text style={styles.resourcePhoneText}>{resource.phone}</Text>
                </TouchableOpacity>
              )}
            </View>
            <FontAwesome5 name="external-link-alt" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Tip Card */}
        <View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome5 name="lightbulb" size={20} color="#f59e0b" />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            <Text style={styles.tipBold}>Project Nova </Text>
            works specifically with veterans at every stage of the criminal justice system - from arrest to release.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  introCard: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  introText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  resourceContent: {
    flex: 1,
  },
  resourceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resourceDesc: {
    fontSize: 14,
    marginBottom: 8,
  },
  resourcePhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resourcePhoneText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
  },
  tipCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  tipBold: {
    fontWeight: '600',
    color: '#f59e0b',
  },
});
