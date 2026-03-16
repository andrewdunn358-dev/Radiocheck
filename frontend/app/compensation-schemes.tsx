import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

interface CompensationScheme {
  title: string;
  description: string;
  fullDescription?: string;
  url: string;
  icon: string;
  isGov?: boolean;
  keyFacts?: string[];
}

const COMPENSATION_SCHEMES: CompensationScheme[] = [
  {
    title: "Armed Forces Compensation Scheme (AFCS)",
    description: "For injuries or illness caused by service on or after 6 April 2005.",
    fullDescription: "The AFCS is a no-fault scheme — you don't need to prove anyone was at fault. It provides tax-free compensation for injuries, illnesses, or deaths caused by service. You can claim if you're a current or former member of UK Armed Forces, a reservist, or a surviving family member.",
    keyFacts: [
      "Lump sum payments from £1,236 to £650,000 depending on severity",
      "Guaranteed Income Payment (GIP) — tax-free monthly payments for serious injuries",
      "Armed Forces Independence Payment of £172.75/week for those with 50%+ GIP",
      "Must claim within 7 years of the incident or discharge",
      "PTSD claims typically range from £1,200 to £570,000"
    ],
    url: "https://www.gov.uk/guidance/armed-forces-compensation-scheme-afcs",
    icon: "shield-checkmark",
    isGov: true
  },
  {
    title: "War Pension Scheme",
    description: "For injuries or illness caused by service before 6 April 2005.",
    fullDescription: "The War Pension Scheme provides tax-free compensation to veterans for injuries or illnesses caused by service before 6 April 2005. You must have left service to claim. Unlike AFCS, there is no time limit on claims, though claims made over 7 years after discharge require you to prove the service link.",
    keyFacts: [
      "Weekly pension payments based on your degree of disablement (20%+)",
      "Lump sum gratuity for disablement under 20%",
      "20% disablement = approx £47/week (£2,452/year)",
      "Additional allowances for age, mobility, and care needs",
      "No time limit on claims — you can apply many years after leaving",
      "War widows/widowers may also be eligible"
    ],
    url: "https://www.gov.uk/guidance/war-pension-scheme-wps",
    icon: "medal",
    isGov: true
  },
  {
    title: "Hearing Loss Claims (RBL)",
    description: "Royal British Legion guidance on military hearing loss claims.",
    fullDescription: "The Royal British Legion provides free expert guidance and tribunal representation for veterans claiming compensation for hearing loss caused by military service. They can help with both AFCS and War Pension claims, as well as appeals if your claim is rejected.",
    url: "https://www.britishlegion.org.uk/get-support/expert-guidance/tribunal-representation/military-hearing-loss-claims",
    icon: "ear",
    isGov: false
  },
  {
    title: "Matrix Agreement - Hearing Loss",
    description: "Extended deadline for hearing loss compensation claims.",
    fullDescription: "The Matrix Agreement is a High Court-approved settlement scheme for military hearing loss claims. The MoD has accepted duty of care, dropped time limits, and offers streamlined payouts that are often significantly higher than AFCS or War Pension awards. Recent settlements have ranged from £182,000 to £700,000+.",
    keyFacts: [
      "DEADLINE EXTENDED TO 31 JULY 2026",
      "Over 70,000 veterans may be eligible",
      "No time limits for claims registered before the deadline",
      "Awards often much higher than AFCS (which can be as low as £6,000)",
      "Prior AFCS/War Pension claims don't prevent you claiming",
      "Can include loss of earnings — unlike government schemes"
    ],
    url: "https://veteranswelfaregroup.co.uk/news/the-matrix-agreement-extending-the-hearing-loss-claims-deadline/",
    icon: "time",
    isGov: false
  },
  {
    title: "Tribunal Guide (PDF)",
    description: "Official guide to War Pensions and Armed Forces Compensation appeals.",
    fullDescription: "If your claim is rejected or you disagree with the award, you can appeal to an independent tribunal. This official guide explains the process, what to expect, and how to prepare your case. You don't need a lawyer — charities like RBL can represent you for free.",
    url: "https://www.judiciary.uk/wp-content/uploads/2024/10/War-Pensions-and-Armed-Forces-Compensation-Guide-for-Users.pdf",
    icon: "document-text",
    isGov: true
  },
  {
    title: "Royal British Legion",
    description: "Free claims advice and support for all veterans.",
    fullDescription: "The Royal British Legion offers free, expert help with compensation claims. Their advisers can help you understand which scheme applies to you, assist with filling out forms, gather medical evidence, and represent you at tribunal if needed. Completely free of charge.",
    url: "https://www.britishlegion.org.uk/get-support/expert-guidance/money-debt/war-pensions-scheme",
    icon: "flower",
    isGov: false
  },
  {
    title: "Blesma - The Limbless Veterans",
    description: "Support for veterans who have lost limbs or use of limbs.",
    fullDescription: "Blesma provides specialist support for veterans who have lost limbs or lost the use of limbs. They offer expert help with War Pension and AFCS claims specifically related to limb loss, plus ongoing welfare support, prosthetics advice, and a community of fellow veterans.",
    url: "https://blesma.org/war-pension-scheme/",
    icon: "accessibility",
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

        {/* Jack AI Chat Card - TOP OF PAGE */}
        <TouchableOpacity 
          style={[styles.jackCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/chat/jack')}
          activeOpacity={0.9}
        >
          <Image 
            source={{ uri: '/images/jack.png' }}
            style={styles.jackAvatar}
          />
          <View style={styles.jackTextContainer}>
            <Text style={[styles.jackTitle, { color: colors.text }]}>Chat with Jack</Text>
            <Text style={[styles.jackSubtitle, { color: colors.textSecondary }]}>Ex-Navy compensation expert, 24/7</Text>
          </View>
          <View style={{ backgroundColor: '#1e40af', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
          </View>
        </TouchableOpacity>

        {/* Intro */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={24} color="#059669" />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            If you've been injured or become ill due to military service, you may be entitled to compensation. 
            Jack can help you understand your options, or browse the resources below.
          </Text>
        </View>

        {/* Government Schemes */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Official Government Schemes</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          These are the official compensation schemes administered by Veterans UK
        </Text>
        
        {COMPENSATION_SCHEMES.filter(s => s.isGov).map((scheme, index) => (
          <View key={index} style={[styles.schemeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.schemeCardHeader}>
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
              </View>
            </View>
            
            {scheme.fullDescription && (
              <Text style={[styles.fullDescription, { color: colors.textSecondary }]}>
                {scheme.fullDescription}
              </Text>
            )}
            
            {scheme.keyFacts && scheme.keyFacts.length > 0 && (
              <View style={styles.keyFactsContainer}>
                <Text style={[styles.keyFactsTitle, { color: colors.text }]}>Key Facts:</Text>
                {scheme.keyFacts.map((fact, factIndex) => (
                  <View key={factIndex} style={styles.keyFactRow}>
                    <Text style={[styles.bulletPoint, { color: '#059669' }]}>•</Text>
                    <Text style={[styles.keyFactText, { color: colors.textSecondary }]}>{fact}</Text>
                  </View>
                ))}
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => openLink(scheme.url)}
              activeOpacity={0.8}
            >
              <Text style={styles.linkButtonText}>Visit Official Website</Text>
              <Ionicons name="open-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Charities & Support */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Charities & Support Organisations</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          These organisations can help you with claims for free - no lawyers needed
        </Text>
        
        {COMPENSATION_SCHEMES.filter(s => !s.isGov).map((scheme, index) => (
          <View key={index} style={[styles.schemeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.schemeCardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#e0e7ff' }]}>
                <Ionicons name={scheme.icon as any} size={24} color="#4f46e5" />
              </View>
              <View style={styles.schemeContent}>
                <Text style={[styles.schemeTitle, { color: colors.text }]}>{scheme.title}</Text>
              </View>
            </View>
            
            {scheme.fullDescription && (
              <Text style={[styles.fullDescription, { color: colors.textSecondary }]}>
                {scheme.fullDescription}
              </Text>
            )}
            
            {scheme.keyFacts && scheme.keyFacts.length > 0 && (
              <View style={styles.keyFactsContainer}>
                <Text style={[styles.keyFactsTitle, { color: colors.text }]}>Key Facts:</Text>
                {scheme.keyFacts.map((fact, factIndex) => (
                  <View key={factIndex} style={styles.keyFactRow}>
                    <Text style={[styles.bulletPoint, { color: '#4f46e5' }]}>•</Text>
                    <Text style={[styles.keyFactText, { color: colors.textSecondary }]}>{fact}</Text>
                  </View>
                ))}
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.linkButton, { backgroundColor: '#4f46e5' }]}
              onPress={() => openLink(scheme.url)}
              activeOpacity={0.8}
            >
              <Text style={styles.linkButtonText}>Learn More</Text>
              <Ionicons name="open-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
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
  jackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1e40af',
    marginBottom: 16,
    backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
  },
  jackAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  jackTextContainer: {
    flex: 1,
  },
  jackTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  jackSubtitle: {
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  schemeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
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
  },
  schemeTitle: {
    fontSize: 16,
    fontWeight: '700',
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
  keyFactsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
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
    backgroundColor: '#059669',
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
