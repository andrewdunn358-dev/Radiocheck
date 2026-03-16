import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

interface CompensationScheme {
  title: string;
  description: string;
  url: string;
  icon: string;
  isGov?: boolean;
}

const COMPENSATION_SCHEMES: CompensationScheme[] = [
  {
    title: "Armed Forces Compensation Scheme (AFCS)",
    description: "For injuries or illness caused by service on or after 6 April 2005. Lump sum payments and guaranteed income.",
    url: "https://www.gov.uk/guidance/armed-forces-compensation-scheme-afcs",
    icon: "shield-checkmark",
    isGov: true
  },
  {
    title: "War Pension Scheme",
    description: "For injuries or illness caused by service before 6 April 2005. Regular payments based on level of disability.",
    url: "https://www.gov.uk/war-pension",
    icon: "medal",
    isGov: true
  },
  {
    title: "Hearing Loss Claims",
    description: "Guidance on claiming for hearing loss or tinnitus caused by military service, including noise-induced hearing loss.",
    url: "https://www.gov.uk/guidance/afcs-claim-hearing-loss",
    icon: "ear",
    isGov: true
  },
  {
    title: "Veterans UK",
    description: "Official government service for all Armed Forces compensation enquiries. Call 0808 1914 2 18 (free).",
    url: "https://www.gov.uk/government/organisations/veterans-uk",
    icon: "call",
    isGov: true
  },
  {
    title: "Royal British Legion",
    description: "Free claims advice and support. They can help you navigate the compensation process and appeals.",
    url: "https://www.britishlegion.org.uk/get-support/financial-and-employment-support/compensation-claims",
    icon: "flower",
    isGov: false
  },
  {
    title: "Blesma - The Limbless Veterans",
    description: "Support for veterans who have lost limbs or use of limbs. Help with prosthetics, grants, and compensation claims.",
    url: "https://blesma.org/",
    icon: "accessibility",
    isGov: false
  },
  {
    title: "SSAFA",
    description: "Lifelong support for serving personnel and veterans. Can help with compensation claims and financial assistance.",
    url: "https://www.ssafa.org.uk/get-help/for-veterans",
    icon: "heart",
    isGov: false
  },
  {
    title: "Combat Stress",
    description: "Support for mental health conditions including PTSD. Can help document conditions for compensation claims.",
    url: "https://combatstress.org.uk/",
    icon: "fitness",
    isGov: false
  },
  {
    title: "Help for Heroes",
    description: "Recovery and compensation support for wounded veterans. Grants and financial guidance available.",
    url: "https://www.helpforheroes.org.uk/get-support/",
    icon: "ribbon",
    isGov: false
  }
];

export default function CompensationSchemes() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Compensation Schemes</Text>
        </View>

        {/* Hugo AI Chat Card - TOP OF PAGE */}
        <TouchableOpacity 
          style={[styles.hugoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/chat/hugo')}
          activeOpacity={0.9}
        >
          <Image 
            source={{ uri: '/images/hugo.png' }}
            style={styles.hugoAvatar}
          />
          <View style={styles.hugoTextContainer}>
            <Text style={[styles.hugoTitle, { color: colors.text }]}>Chat with Hugo</Text>
            <Text style={[styles.hugoSubtitle, { color: colors.textSecondary }]}>Compensation schemes expert, 24/7</Text>
          </View>
          <View style={{ backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
          </View>
        </TouchableOpacity>

        {/* Intro */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={24} color="#059669" />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            If you've been injured or become ill due to military service, you may be entitled to compensation. 
            Hugo can help you understand your options, or browse the resources below.
          </Text>
        </View>

        {/* Government Schemes */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Official Government Schemes</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          These are the official compensation schemes administered by Veterans UK
        </Text>
        
        {COMPENSATION_SCHEMES.filter(s => s.isGov).map((scheme, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.schemeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openLink(scheme.url)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name={scheme.icon as any} size={24} color="#059669" />
            </View>
            <View style={styles.schemeContent}>
              <View style={styles.schemeHeader}>
                <Text style={[styles.schemeTitle, { color: colors.text }]}>{scheme.title}</Text>
                <View style={styles.govBadge}>
                  <Text style={styles.govBadgeText}>GOV.UK</Text>
                </View>
              </View>
              <Text style={[styles.schemeDescription, { color: colors.textSecondary }]}>{scheme.description}</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Charities & Support */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Charities & Support Organisations</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          These organisations can help you with claims for free - no lawyers needed
        </Text>
        
        {COMPENSATION_SCHEMES.filter(s => !s.isGov).map((scheme, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.schemeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openLink(scheme.url)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#e0e7ff' }]}>
              <Ionicons name={scheme.icon as any} size={24} color="#4f46e5" />
            </View>
            <View style={styles.schemeContent}>
              <Text style={[styles.schemeTitle, { color: colors.text }]}>{scheme.title}</Text>
              <Text style={[styles.schemeDescription, { color: colors.textSecondary }]}>{scheme.description}</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* Warning */}
        <View style={[styles.warningCard, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
          <Ionicons name="warning" size={24} color="#d97706" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.warningTitle, { color: '#92400e' }]}>Beware of Claims Companies</Text>
            <Text style={[styles.warningText, { color: '#a16207' }]}>
              You don't need to pay a solicitor or claims company. The charities listed above offer free help with claims. 
              Claims companies often take 20-30% of your compensation.
            </Text>
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
  hugoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#059669',
    marginBottom: 16,
    backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
  },
  hugoAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  hugoTextContainer: {
    flex: 1,
  },
  hugoTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  hugoSubtitle: {
    fontSize: 13,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
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
  schemeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schemeContent: {
    flex: 1,
  },
  schemeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  schemeTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  govBadge: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  govBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  schemeDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
    gap: 12,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
