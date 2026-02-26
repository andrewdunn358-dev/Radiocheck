import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Linking, ActivityIndicator, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { API_URL } from '../src/config/api';

// Hugo's avatar URL
const HUGO_AVATAR = '/images/hugo.png';

interface Organization {
  id: string;
  name: string;
  description: string;
  phone: string;
  sms?: string;
  whatsapp?: string;
}

export default function Organizations() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/organizations`);
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      } else {
        setError('Unable to load organizations');
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError('Unable to connect. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const handleSMS = (number: string) => {
    Linking.openURL(`sms:${number}`);
  };

  const handleWhatsApp = (number: string) => {
    const whatsappUrl = `https://wa.me/${number}`;
    Linking.openURL(whatsappUrl);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>Support Organisations</Text>
        </View>

        {/* Emergency Banner - Display only, no call functionality */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#cc0000', paddingVertical: 12, paddingHorizontal: 24, marginHorizontal: 24, borderRadius: 8, gap: 12 }}>
          <Ionicons name="warning" size={24} color="#ffffff" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>Emergency? Dial 999</Text>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 24, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Description */}
          <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              UK organisations providing support to veterans. All services are confidential.
            </Text>
          </View>

          {/* Hugo AI Buddy Card */}
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: colors.card, 
              borderRadius: 16, 
              padding: 16, 
              marginBottom: 20, 
              borderWidth: 2, 
              borderColor: '#10b981' 
            }}
            onPress={() => router.push('/chat/hugo')}
            activeOpacity={0.8}
          >
            <Image 
              source={{ uri: HUGO_AVATAR }} 
              style={{ width: 56, height: 56, borderRadius: 28, marginRight: 14 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Chat with Hugo</Text>
              <Text style={{ fontSize: 13, color: '#10b981', fontWeight: '600', marginTop: 2 }}>Self-Help & Wellness Guide</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                Daily habits, grounding techniques, finding your routine
              </Text>
            </View>
            <View style={{ backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
            </View>
          </TouchableOpacity>

          {/* Loading State */}
          {isLoading ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary }}>Loading organizations...</Text>
            </View>
          ) : error ? (
            <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
              <Ionicons name="alert-circle" size={32} color="#ef4444" />
              <Text style={{ fontSize: 14, color: '#ef4444', textAlign: 'center' }}>{error}</Text>
              <TouchableOpacity style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }} onPress={fetchOrganizations}>
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : organizations.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
              <Ionicons name="business" size={48} color={colors.textSecondary} />
              <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600', textAlign: 'center' }}>No organizations available</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>Please contact support for assistance</Text>
            </View>
          ) : (
            organizations.map((org) => (
              <View key={org.id} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="shield-checkmark" size={24} color={colors.textSecondary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{org.name}</Text>
                  </View>
                </View>
                
                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 }}>{org.description}</Text>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52 }}
                    onPress={() => handleCall(org.phone)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={20} color="#ffffff" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>Call</Text>
                  </TouchableOpacity>

                  {org.sms && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, minHeight: 52 }}
                      onPress={() => handleSMS(org.sms!)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubble" size={20} color={colors.textSecondary} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Text</Text>
                    </TouchableOpacity>
                  )}

                  {org.whatsapp && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, minHeight: 52 }}
                      onPress={() => handleWhatsApp(org.whatsapp!)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={20} color={colors.textSecondary} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}

          {/* Footer Note */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', flex: 1 }}>
              All organisations are free to contact. Help is available 24/7.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
