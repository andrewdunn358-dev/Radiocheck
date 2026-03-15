import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

const TOMMY_AVATAR = '/images/tommy.png';

export default function CrisisSupport() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const handleSMS = (number: string) => {
    Linking.openURL(`sms:${number}`);
  };

  const handleWebsite = (url: string) => {
    Linking.openURL(url);
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.replace('/home')} style={{ padding: 8, marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>Crisis Support</Text>
        </View>

        {/* Tommy AI Chat - TOP OF PAGE */}
        <TouchableOpacity 
          style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 2, borderColor: colors.primary }}
          onPress={() => router.push('/chat/tommy')}
          activeOpacity={0.9}
          data-testid="tommy-chat-btn"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image 
              source={{ uri: TOMMY_AVATAR }}
              style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: colors.primary, marginRight: 16 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Talk to Tommy</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>Your battle buddy - straightforward support from someone who understands military life</Text>
            </View>
            <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Crisis Information Header */}
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Ionicons name="heart" size={24} color="#dc2626" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 }}>You're Not Alone</Text>
          </View>
          <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 12 }}>
            If you're struggling right now, help is available 24/7. Whether you need someone to talk to, 
            professional support, or emergency help - we've got your back.
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
            <Text style={{ fontWeight: '600', color: colors.text }}>Remember:</Text> Reaching out is a sign of strength, not weakness. 
            Every service listed here is free, confidential, and staffed by people who understand.
          </Text>
        </View>

        {/* On-Duty Counsellors Card */}
        <TouchableOpacity 
          style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 20, marginBottom: 20 }}
          onPress={() => router.push('/counsellors')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
              <Ionicons name="people-circle" size={32} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 4 }}>On-Duty Counsellors</Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>Professional support available now</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ffffff" />
          </View>
        </TouchableOpacity>

        {/* Section Title - Crisis Helplines */}
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginBottom: 16 }}>
          24/7 Crisis Helplines
        </Text>

        {/* NHS 111 Option 2 - Primary/Most Prominent */}
        <View style={{ backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: '#3b82f6' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="medical" size={28} color="#fff" />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: isDark ? '#93c5fd' : '#1d4ed8', marginBottom: 4 }}>NHS Mental Health</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>Free 24/7 urgent mental health support. Call 111, then press Option 2 to speak to trained mental health professionals.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', backgroundColor: '#3b82f6', borderRadius: 10, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 10 }}
            onPress={() => handleCall('111')}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={26} color="#ffffff" />
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#ffffff' }}>111 (Option 2)</Text>
          </TouchableOpacity>
        </View>

        {/* Samaritans */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <Ionicons name="heart" size={28} color="#16a34a" />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Samaritans</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>24/7 emotional support for anyone in distress. Free to call, always confidential.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', backgroundColor: '#16a34a', borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onPress={() => handleCall('116123')}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={24} color="#ffffff" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>116 123</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
              onPress={() => handleWebsite('https://www.samaritans.org')}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Website</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Combat Stress */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <Ionicons name="shield" size={28} color="#dc2626" />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Combat Stress</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>Veterans' mental health charity. Specialist support from people who understand military life.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onPress={() => handleCall('08001381619')}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={20} color="#ffffff" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>0800 138 1619</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
              onPress={() => handleSMS('61212')}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble" size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Text</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
            onPress={() => handleWebsite('https://combatstress.org.uk')}
            activeOpacity={0.8}
          >
            <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Visit Website</Text>
          </TouchableOpacity>
        </View>

        {/* Veterans Gateway */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <Ionicons name="flag" size={28} color="#2563eb" />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Veterans Gateway</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>First point of contact for veterans seeking support. Connects you to the right services.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', backgroundColor: '#2563eb', borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onPress={() => handleCall('08088021212')}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={24} color="#ffffff" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>0808 802 1212</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
              onPress={() => handleWebsite('https://www.veteransgateway.org.uk')}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Website</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SSAFA */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <Ionicons name="people" size={28} color="#7c3aed" />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>SSAFA</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>Armed Forces charity supporting serving personnel, veterans and their families since 1885.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', backgroundColor: '#7c3aed', borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onPress={() => handleCall('08007314880')}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={24} color="#ffffff" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>0800 731 4880</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
              onPress={() => handleWebsite('https://www.ssafa.org.uk')}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Website</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* East Durham Veterans Trust */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <Ionicons name="home" size={28} color="#0891b2" />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>East Durham Veterans Trust</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>Local North East support with counselling, peer groups, housing and benefits help. Mon-Fri 9am-4pm.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0891b2', borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onPress={() => handleCall('01915815677')}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={24} color="#ffffff" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>0191 581 5677</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
              onPress={() => handleWebsite('https://www.eastdurhamveteranstrust.org.uk')}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Website</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* More Options Link */}
        <TouchableOpacity 
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          onPress={() => router.push('/organizations')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="business" size={24} color={colors.textSecondary} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>View all support organisations</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Disclaimer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', flex: 1 }}>
            All services listed are free and confidential
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
