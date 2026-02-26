import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

const FINCH_AVATAR = '/images/finch.png';

export default function HistoricalInvestigations() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const supportServices = [
    {
      name: 'Combat Stress',
      description: 'Specialist support for veterans dealing with investigation-related stress and anxiety',
      phone: '01912704378',
      icon: 'shield' as const,
    },
    {
      name: 'Veterans UK Welfare Service',
      description: 'Confidential welfare support and guidance for veterans facing investigations',
      phone: '01912704378',
      icon: 'information-circle' as const,
    },
    {
      name: 'SSAFA',
      description: 'Practical and emotional support for veterans and families during difficult times',
      phone: '01912704378',
      icon: 'heart' as const,
    },
  ];

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <ScrollView 
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, lineHeight: 28 }}>Warfare on Lawfare</Text>
          </View>
        </View>

        {/* Finch AI Chat Card - Featured at top */}
        <TouchableOpacity 
          style={{ backgroundColor: isDark ? '#243447' : colors.card, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#3b5068' : colors.border }}
          onPress={() => router.push('/sentry-chat')}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Image source={{ uri: FINCH_AVATAR }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Talk to Finch</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>AI Legal Support Companion</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
          </View>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 20 }}>
            Confidential AI support for veterans facing historical investigations. 
            Get information, emotional support, and guidance 24/7.
          </Text>
        </TouchableOpacity>

        {/* Understanding Section */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 }}>
            <Ionicons name="heart" size={24} color={colors.textSecondary} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>We understand</Text>
          </View>
          <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 12 }}>
            Being part of a historical investigation - whether related to Northern Ireland, Iraq, Afghanistan, or other legacy cases - can bring intense stress, anxiety, and emotional strain.
          </Text>
          <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>
            You may be experiencing difficult emotions years after your service. This is a normal response to an abnormal situation. You deserve support.
          </Text>
        </View>

        {/* Important Notice */}
        <View style={{ backgroundColor: isDark ? '#2d4a3e' : '#dcfce7', borderRadius: 8, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#4a7c64' : '#86efac' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="information-circle" size={20} color={isDark ? '#a8e6cf' : '#16a34a'} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#a8e6cf' : '#16a34a' }}>This section provides emotional support</Text>
          </View>
          <Text style={{ fontSize: 14, color: isDark ? '#c8f0dc' : '#166534', lineHeight: 20 }}>
            We offer wellbeing and mental health support, not legal advice. For legal matters, please consult a qualified legal professional.
          </Text>
        </View>

        {/* Support Options Title */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Support Options</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Confidential support from those who understand</Text>
        </View>

        {/* Talk to Counsellor */}
        <TouchableOpacity 
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
          onPress={() => router.push('/crisis-support')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', marginBottom: 12, gap: 16 }}>
            <Ionicons name="chatbubbles" size={32} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Talk to a Counsellor</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
                Speak with professionals who understand service-related investigations
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>View available counsellors</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Peer Support */}
        <TouchableOpacity 
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
          onPress={() => router.push('/peer-support')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', marginBottom: 12, gap: 16 }}>
            <Ionicons name="people" size={32} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Speak to Veteran Peer Support</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
                Connect with fellow veterans who can offer understanding and support
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>Find peer supporters</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Support Organizations */}
        <View style={{ marginTop: 8, marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 }}>Veteran Welfare Organisations</Text>
          
          {supportServices.map((service, index) => (
            <View key={index} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                <Ionicons name={service.icon} size={24} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{service.name}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 }}>{service.description}</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onPress={() => handleCall(service.phone)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={20} color="#ffffff" />
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>Call Now</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Reassurance */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 24, gap: 16, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="shield-checkmark" size={24} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Non-judgemental support</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              All support services listed here provide confidential, non-judgemental help. We make no assumptions and offer support regardless of circumstances.
            </Text>
          </View>
        </View>

        {/* Bottom Disclaimer */}
        <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }}>
            If you feel at immediate risk of harming yourself or others, call 999 or use the 'I NEED HELP NOW' button at the top of this page.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
