import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Linking, Platform, ActivityIndicator, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWebRTCCall, formatCallDuration } from '../hooks/useWebRTCCallWeb';
import { useTheme } from '../src/context/ThemeContext';
import { API_URL } from '../src/config/api';

interface Counsellor {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'off';
  specialization: string;
  next_available?: string;
  phone: string;
  sms?: string;
  whatsapp?: string;
  user_id?: string;
}

export default function Counsellors() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebRTC calling
  const { callState, callInfo, callDuration, initiateCall, endCall } = useWebRTCCall();
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [callingCounsellorName, setCallingCounsellorName] = useState('');
  const showCallModal = callState !== 'idle' || isInitiatingCall;

  const fetchCounsellors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/counsellors/available`);
      if (response.ok) {
        const data = await response.json();
        setCounsellors(data);
      } else {
        setError('Unable to load counsellors');
      }
    } catch (err) {
      console.error('Error fetching counsellors:', err);
      setError('Unable to connect. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCounsellors();
  }, []);

  const logCallIntent = async (contactType: string, contactId: string | null, contactName: string, contactNumber: string, method: string) => {
    try {
      await fetch(`${API_URL}/api/call-intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_type: contactType,
          contact_id: contactId,
          contact_name: contactName,
          contact_number: contactNumber,
          method: method,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.error('Failed to log call intent:', err);
    }
  };

  const handleCall = async (phone: string, name: string, id: string | null, userId: string | null) => {
    if (phone) {
      logCallIntent('counsellor', id, name, phone, 'phone');
    }
    
    if (Platform.OS === 'web' && userId) {
      setCallingCounsellorName(name);
      setIsInitiatingCall(true);
      try {
        await initiateCall(userId, name);
      } catch (error) {
        console.error('WebRTC call failed:', error);
        setIsInitiatingCall(false);
        if (typeof window !== 'undefined') {
          window.alert('Call Failed: Unable to connect. Please try again.');
        }
      }
    } else if (Platform.OS === 'web' && !userId) {
      if (typeof window !== 'undefined') {
        const userWantsToCall = window.confirm(
          'In-App Calling Not Available\n\nThis counsellor hasn\'t set up in-app calling yet. Would you like to call their phone instead?'
        );
        if (userWantsToCall && phone) {
          Linking.openURL(`tel:${phone}`);
        }
      }
    } else {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleEndCall = () => {
    endCall();
    setIsInitiatingCall(false);
    setCallingCounsellorName('');
  };

  useEffect(() => {
    if (callState !== 'idle' && isInitiatingCall) {
      setIsInitiatingCall(false);
    }
  }, [callState]);

  const handleSMS = (number: string, name: string, id: string | null) => {
    logCallIntent('counsellor', id, name, number, 'sms');
    Linking.openURL(`sms:${number}`);
  };

  const handleWhatsApp = (number: string, name: string, id: string | null) => {
    logCallIntent('counsellor', id, name, number, 'whatsapp');
    Linking.openURL(`https://wa.me/${number}`);
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
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>On-Duty Counsellors</Text>
        </View>

        {/* Info Box */}
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="information-circle" size={20} color={colors.textSecondary} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              Professional counsellors available now to speak with you. All conversations are confidential.
            </Text>
          </View>
        </View>

        {/* Loading/Error/Empty States */}
        {isLoading ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary }}>Loading counsellors...</Text>
          </View>
        ) : error ? (
          <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
            <Ionicons name="alert-circle" size={32} color="#ef4444" />
            <Text style={{ fontSize: 14, color: '#ef4444', textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity 
              style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }} 
              onPress={fetchCounsellors}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : counsellors.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
            <Ionicons name="time" size={48} color={colors.textSecondary} />
            <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600', textAlign: 'center' }}>No counsellors on duty</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>Please try the crisis helplines or check back later</Text>
            <TouchableOpacity 
              style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }} 
              onPress={() => router.back()}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Back to Crisis Support</Text>
            </TouchableOpacity>
          </View>
        ) : (
          counsellors.map((counsellor, index) => (
            <View key={counsellor.id || index} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                <Ionicons name="person-circle" size={40} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{counsellor.name}</Text>
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: counsellor.status === 'available' ? '#166534' : '#854d0e',
                      paddingHorizontal: 8, 
                      paddingVertical: 4, 
                      borderRadius: 12,
                      gap: 4
                    }}>
                      <View style={{ 
                        width: 6, 
                        height: 6, 
                        borderRadius: 3, 
                        backgroundColor: counsellor.status === 'available' ? '#4ade80' : '#fbbf24' 
                      }} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: counsellor.status === 'available' ? '#4ade80' : '#fbbf24' }}>
                        {counsellor.status === 'available' ? 'Available' : 'Busy'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>{counsellor.specialization}</Text>
                  {counsellor.next_available && (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Next available in {counsellor.next_available}</Text>
                  )}
                </View>
              </View>
              
              {counsellor.status === 'available' && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onPress={() => handleCall(counsellor.phone, counsellor.name, counsellor.id, counsellor.user_id || null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={20} color="#ffffff" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>Call</Text>
                  </TouchableOpacity>

                  {counsellor.sms && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
                      onPress={() => handleSMS(counsellor.sms!, counsellor.name, counsellor.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubble" size={18} color={colors.textSecondary} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Text</Text>
                    </TouchableOpacity>
                  )}

                  {counsellor.whatsapp && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', backgroundColor: colors.surfaceHover, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
                      onPress={() => handleWhatsApp(counsellor.whatsapp!, counsellor.name, counsellor.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color={colors.textSecondary} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))
        )}

        {/* Footer Note */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <Ionicons name="shield-checkmark" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', flex: 1 }}>
            All counsellors are trained professionals. Conversations are confidential.
          </Text>
        </View>
      </ScrollView>

      {/* WebRTC Call Modal */}
      <Modal visible={showCallModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#1a2332', borderRadius: 24, padding: 32, width: '100%', maxWidth: 320, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
            
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 8 }}>
              {callingCounsellorName || callInfo?.peerName || 'Counsellor'}
            </Text>
            <Text style={{ fontSize: 16, color: '#9ca3af', marginBottom: 16 }}>
              {isInitiatingCall ? 'Initiating call...' :
               callState === 'connecting' ? 'Connecting...' :
               callState === 'ringing' ? 'Ringing...' :
               callState === 'connected' ? 'Connected' :
               callState === 'ended' ? 'Call ended' : 'Calling...'}
            </Text>
            
            {callState === 'connected' && (
              <Text style={{ fontSize: 24, fontWeight: '600', color: '#3b82f6', marginBottom: 16 }}>{formatCallDuration(callDuration)}</Text>
            )}
            
            {(isInitiatingCall || callState === 'connecting' || callState === 'ringing') && (
              <ActivityIndicator size="small" color="#3b82f6" style={{ marginBottom: 16 }} />
            )}
            
            <TouchableOpacity 
              style={{ backgroundColor: '#ef4444', borderRadius: 40, paddingVertical: 16, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 8 }} 
              onPress={handleEndCall}
            >
              <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>
                {callState === 'connected' ? 'End Call' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
