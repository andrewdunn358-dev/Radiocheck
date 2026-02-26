import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, TextInput, Alert, KeyboardAvoidingView, Platform, Linking, ActivityIndicator, Modal, Image, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWebRTCCall, formatCallDuration } from '../hooks/useWebRTCCallWeb';
import { useTheme } from '../src/context/ThemeContext';
import { API_URL } from '../src/config/api';

interface PeerVeteran {
  id: string;
  firstName: string;
  area: string;
  background: string;
  yearsServed: string;
  status: 'available' | 'limited' | 'unavailable';
  phone: string;
  sms?: string;
  whatsapp?: string;
  user_id?: string;
}

export default function PeerSupport() {
  const router = useRouter();
  const params = useLocalSearchParams<{ alertId?: string; preferredType?: string; sessionId?: string }>();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showVeteransList, setShowVeteransList] = useState(false);
  const [peerSupporters, setPeerSupporters] = useState<PeerVeteran[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Safeguarding call waiting state
  const [isWaitingForSupport, setIsWaitingForSupport] = useState(false);
  const [waitingMessage, setWaitingMessage] = useState('Connecting you to support...');
  const pulseAnim = useState(new Animated.Value(1))[0];
  
  // Staff busy fallback state
  const [showStaffBusyModal, setShowStaffBusyModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  
  // WebRTC calling - include register and acceptCall for incoming calls
  const { callState, callInfo, callDuration, debugInfo, initiateCall, endCall, register, acceptCall, rejectCall } = useWebRTCCall();
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [callingPeerName, setCallingPeerName] = useState('');
  const showCallModal = callState !== 'idle' || isInitiatingCall;
  
  // Generate unique user ID for this session
  const [userId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  // Mark component as mounted (for client-side only logic)
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Handle safeguarding call flow - auto-register and show waiting screen
  useEffect(() => {
    if (!isMounted) return;
    
    // For web, check window.location.search directly since useLocalSearchParams may not be ready
    let preferredType: string | undefined | null = params.preferredType;
    let alertIdParam: string | undefined | null = params.alertId;
    let sessionIdParam: string | undefined | null = params.sessionId;
    
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (!preferredType) preferredType = urlParams.get('preferredType');
      if (!alertIdParam) alertIdParam = urlParams.get('alertId');
      if (!sessionIdParam) sessionIdParam = urlParams.get('sessionId');
    }
    
    console.log('Peer support - checking for call mode:', { preferredType, alertIdParam, sessionIdParam });
    
    if (preferredType === 'call' && alertIdParam) {
      console.log('Safeguarding call flow - registering for incoming calls');
      setIsWaitingForSupport(true);
      setWaitingMessage('Connecting you to a supporter...');
      
      // Register with WebRTC so staff can call us
      // Use the sessionId from params if available, otherwise use generated userId
      const registrationId = sessionIdParam || userId;
      register(registrationId, 'user', 'Veteran in need');
      
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
      
      // Update waiting message after a few seconds
      setTimeout(() => {
        setWaitingMessage('A supporter will call you shortly...');
      }, 3000);
      
      setTimeout(() => {
        setWaitingMessage('Please stay on this screen to receive your call');
      }, 8000);
    }
  }, [isMounted]); // Run after mount and isMounted becomes true
  
  // Handle incoming call - auto-show when we receive one
  useEffect(() => {
    if (callState === 'ringing' && callInfo?.isIncoming) {
      console.log('Incoming call detected!', callInfo);
      setIsWaitingForSupport(false);
      // The call modal will show automatically since showCallModal depends on callState
    }
  }, [callState, callInfo]);

  // Fetch peer supporters from API
  const fetchPeerSupporters = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use /available endpoint - returns only public-safe data
      const response = await fetch(`${API_URL}/api/peer-supporters/available`);
      if (response.ok) {
        const data = await response.json();
        setPeerSupporters(data);
      } else {
        setError('Unable to load peer supporters');
      }
    } catch (err) {
      console.error('Error fetching peer supporters:', err);
      setError('Unable to connect. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showVeteransList) {
      fetchPeerSupporters();
    }
  }, [showVeteransList]);

  // Get available count for display
  const availableCount = peerSupporters.filter(p => p.status === 'available' || p.status === 'limited').length;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/peer-support/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (response.ok) {
        Alert.alert(
          'Thank You',
          'Your interest has been registered. We will contact you soon with more information about the peer support programme.',
          [
            {
              text: 'OK',
              onPress: () => {
                setEmail('');
                setShowForm(false);
              },
            },
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to register. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Unable to connect. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Log call intent to backend
  const logCallIntent = async (contactType: string, contactId: string | null, contactName: string, contactPhone: string, callMethod: string) => {
    try {
      await fetch(`${API_URL}/api/call-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_type: contactType,
          contact_id: contactId,
          contact_name: contactName,
          contact_phone: contactPhone,
          call_method: callMethod,
        }),
      });
    } catch (err) {
      // Silent fail - don't block the user from making the call
      console.log('Failed to log call intent:', err);
    }
  };

  const handleCallVeteran = async (phone: string, name: string = 'Peer Supporter', id: string | null = null, userId: string | null = null) => {
    // Only log call intent if we have a phone number
    if (phone) {
      logCallIntent('peer', id, name, phone, 'phone');
    }
    
    // Use WebRTC for in-app calling if on web platform AND user_id is available
    if (Platform.OS === 'web' && userId) {
      console.log('WebRTC: Initiating call to', name, 'user_id:', userId);
      // Show calling modal immediately
      setCallingPeerName(name);
      setIsInitiatingCall(true);
      
      try {
        await initiateCall(userId, name);
      } catch (error) {
        console.error('WebRTC call failed:', error);
        setIsInitiatingCall(false);
        // Use window.alert for web since RN Alert.alert doesn't work on web
        if (typeof window !== 'undefined') {
          window.alert('Call Failed: Unable to connect. Please try again.');
        } else {
          Alert.alert('Call Failed', 'Unable to connect. Please try again.');
        }
      }
    } else if (Platform.OS === 'web' && !userId) {
      // Staff member doesn't have WebRTC set up, show message using window.confirm for web
      if (typeof window !== 'undefined') {
        const userWantsToCall = window.confirm(
          'In-App Calling Not Available\n\n' +
          'This peer supporter hasn\'t set up in-app calling yet. Would you like to call their phone instead?'
        );
        if (userWantsToCall && phone) {
          Linking.openURL(`tel:${phone}`);
        }
      } else {
        Alert.alert(
          'In-App Calling Not Available',
          'This peer supporter hasn\'t set up in-app calling yet. Would you like to call their phone instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call Phone', onPress: () => Linking.openURL(`tel:${phone}`) }
          ]
        );
      }
    } else {
      // Native app - use phone dialer directly
      Linking.openURL(`tel:${phone}`);
    }
  };
  
  // Handle call end
  const handleEndCall = () => {
    endCall();
    setIsInitiatingCall(false);
    setCallingPeerName('');
  };
  
  // Update initiating state when call state changes
  useEffect(() => {
    if (callState !== 'idle' && isInitiatingCall) {
      setIsInitiatingCall(false);
    }
  }, [callState]);

  const handleSMS = (number: string, name: string = 'Peer Supporter', id: string | null = null) => {
    logCallIntent('peer', id, name, number, 'sms');
    Linking.openURL(`sms:${number}`);
  };

  const handleWhatsApp = (number: string, name: string = 'Peer Supporter', id: string | null = null) => {
    logCallIntent('peer', id, name, number, 'whatsapp');
    const whatsappUrl = `https://wa.me/${number}`;
    Linking.openURL(whatsappUrl);
  };

  if (showVeteransList) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
        <ScrollView 
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowVeteransList(false)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Peer Supporters</Text>
          </View>

          {/* Info */}
          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="information-circle" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Connect with fellow veterans who volunteer their time to support others. All conversations are confidential.
            </Text>
          </View>

          {/* Loading/Error/Empty States */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading peer supporters...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchPeerSupporters}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : peerSupporters.filter(v => v.status !== 'unavailable').length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="time" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No peer supporters available</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Please check back later or register to become a supporter</Text>
            </View>
          ) : (
            /* Veterans List */
            peerSupporters.filter(v => v.status !== 'unavailable').map((veteran, index) => (
            <View key={veteran.id || index} style={[styles.veteranCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.veteranHeader}>
                <Ionicons name="person-circle" size={40} color={colors.textSecondary} />
                <View style={styles.veteranMainInfo}>
                  <View style={styles.veteranNameRow}>
                    <Text style={[styles.veteranName, { color: colors.text }]}>{veteran.firstName}</Text>
                    <View style={[
                      styles.availabilityBadge,
                      veteran.status === 'available' ? styles.badgeAvailable : styles.badgeLimited
                    ]}>
                      <Text style={[
                        styles.availabilityText,
                        veteran.status === 'available' ? styles.textAvailable : styles.textLimited
                      ]}>
                        {veteran.status === 'available' ? 'Available' : 'Limited'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.veteranLocationRow}>
                    <Ionicons name="location" size={14} color="#7c9cbf" />
                    <Text style={styles.veteranArea}>{veteran.area}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.veteranDetails}>
                <Text style={styles.veteranBackground}>{veteran.background}</Text>
                <Text style={styles.veteranYears}>Served: {veteran.yearsServed}</Text>
              </View>

              {veteran.status === 'available' && (
                <View style={styles.veteranContactButtons}>
                  <TouchableOpacity
                    style={styles.veteranCallButton}
                    onPress={() => handleCallVeteran(veteran.phone, veteran.firstName, veteran.id, veteran.user_id || null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={18} color="#ffffff" />
                    <Text style={styles.veteranCallButtonText}>Call</Text>
                  </TouchableOpacity>
                  
                  {veteran.sms && (
                    <TouchableOpacity
                      style={styles.veteranSecondaryButton}
                      onPress={() => handleSMS(veteran.sms!, veteran.firstName, veteran.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubble" size={18} color="#7c9cbf" />
                      <Text style={styles.veteranSecondaryButtonText}>Text</Text>
                    </TouchableOpacity>
                  )}

                  {veteran.whatsapp && (
                    <TouchableOpacity
                      style={styles.veteranSecondaryButton}
                      onPress={() => handleWhatsApp(veteran.whatsapp!, veteran.firstName, veteran.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#7c9cbf" />
                      <Text style={styles.veteranSecondaryButtonText}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              {veteran.status === 'limited' && (
                <View style={styles.limitedNotice}>
                  <Ionicons name="time" size={16} color="#9ca3af" />
                  <Text style={styles.limitedText}>Limited availability - check back later</Text>
                </View>
              )}
            </View>
          ))
          )}

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="shield-checkmark" size={16} color="#b0c4de" />
            <Text style={styles.disclaimerText}>
              All peer supporters are verified veterans who have completed training. This is not professional counselling or emergency support.
            </Text>
          </View>
        </ScrollView>
        
        {/* WebRTC Call Modal */}
        <Modal visible={showCallModal} transparent animationType="fade">
          <View style={styles.callModalOverlay}>
            <View style={styles.callModalContent}>
              <View style={styles.callModalHeader}>
                {/* Animated icon based on call state */}
                <View style={styles.callIconContainer}>
                  <Ionicons 
                    name={callState === 'connected' ? 'call' : 'call-outline'} 
                    size={48} 
                    color={callState === 'connected' ? '#22c55e' : callInfo?.isIncoming ? '#16a34a' : '#3b82f6'} 
                  />
                </View>
                
                <Text style={styles.callModalTitle}>
                  {callInfo?.isIncoming && callState === 'ringing' ? 'Incoming Call' :
                   isInitiatingCall ? 'Connecting...' :
                   callState === 'connecting' ? 'Connecting...' : 
                   callState === 'ringing' ? 'Ringing...' : 
                   callState === 'connected' ? 'Connected' : 'Calling...'}
                </Text>
                
                <Text style={styles.callModalPeerName}>
                  {callInfo?.peerName || callingPeerName || 'Peer Supporter'}
                </Text>
                
                {callState === 'connected' && (
                  <Text style={styles.callModalDuration}>{formatCallDuration(callDuration)}</Text>
                )}
                
                {/* Debug Info - visible on screen */}
                {callState === 'connected' && (
                  <View style={styles.debugInfo}>
                    <Text style={styles.debugText}>Track: {debugInfo.remoteTrackReceived ? '✓' : '✗'}</Text>
                    <Text style={styles.debugText}>Audio: {debugInfo.audioPlaying ? '✓' : '✗'}</Text>
                    <Text style={styles.debugText}>ICE: {debugInfo.iceState}</Text>
                  </View>
                )}
                
                {!callInfo?.isIncoming && (isInitiatingCall || callState === 'connecting' || callState === 'ringing') && (
                  <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 16 }} />
                )}
              </View>
              
              {/* Incoming call - show Accept/Reject buttons */}
              {callInfo?.isIncoming && callState === 'ringing' ? (
                <View style={styles.incomingCallButtons}>
                  <TouchableOpacity 
                    style={[styles.callButton, styles.rejectButton]} 
                    onPress={() => {
                      console.log('Rejecting incoming call');
                      rejectCall();
                    }}
                  >
                    <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                    <Text style={styles.callButtonText}>Decline</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.callButton, styles.acceptButton]} 
                    onPress={() => {
                      console.log('Accepting incoming call');
                      acceptCall();
                    }}
                  >
                    <Ionicons name="call" size={28} color="#fff" />
                    <Text style={styles.callButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.callEndButton} onPress={handleEndCall}>
                  <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.callEndButtonText}>
                    {callState === 'connected' ? 'End Call' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      
      {/* Waiting for Support Screen - shown when user clicked "Call a Supporter" from safeguarding */}
      {isWaitingForSupport && !showCallModal && (
        <View style={[styles.waitingContainer, { backgroundColor: colors.background }]}>
          <View style={styles.waitingContent}>
            {/* Pulsing phone icon */}
            <Animated.View style={[styles.waitingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.waitingIconOuter}>
                <Ionicons name="call" size={48} color="#16a34a" />
              </View>
            </Animated.View>
            
            <Text style={[styles.waitingTitle, { color: colors.text }]}>
              Waiting for Support
            </Text>
            
            <Text style={[styles.waitingMessage, { color: colors.textSecondary }]}>
              {waitingMessage}
            </Text>
            
            <View style={styles.waitingSteps}>
              <View style={styles.waitingStep}>
                <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                <Text style={[styles.waitingStepText, { color: colors.textSecondary }]}>Request received</Text>
              </View>
              <View style={styles.waitingStep}>
                <ActivityIndicator size="small" color="#16a34a" />
                <Text style={[styles.waitingStepText, { color: colors.textSecondary }]}>Finding available supporter</Text>
              </View>
              <View style={styles.waitingStep}>
                <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.waitingStepText, { color: colors.textSecondary }]}>You'll receive a call shortly</Text>
              </View>
            </View>
            
            <Text style={[styles.waitingHint, { color: colors.textSecondary }]}>
              Please keep this screen open to receive your call.{'\n'}
              A supporter will call you as soon as one is available.
            </Text>
            
            {/* Cancel button */}
            <TouchableOpacity
              style={styles.waitingCancelButton}
              onPress={() => {
                setIsWaitingForSupport(false);
                router.back();
              }}
            >
              <Text style={styles.waitingCancelText}>Cancel & Go Back</Text>
            </TouchableOpacity>
            
            {/* Switch to chat option */}
            <TouchableOpacity
              style={styles.waitingSwitchButton}
              onPress={() => {
                setIsWaitingForSupport(false);
                router.push({
                  pathname: '/live-chat',
                  params: { 
                    alertId: params.alertId,
                    sessionId: params.sessionId,
                    preferredType: 'chat'
                  }
                });
              }}
            >
              <Ionicons name="chatbubbles" size={18} color="#2563eb" />
              <Text style={styles.waitingSwitchText}>Switch to Text Chat Instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Regular content - hidden when waiting for support */}
      {!isWaitingForSupport && (
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Peer Support</Text>
          </View>

          {/* Main Content */}
          <View style={styles.content}>
            {/* View Available Veterans Button - at the top */}
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => setShowVeteransList(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="people" size={24} color="#ffffff" />
              <Text style={styles.primaryButtonText}>View Available Volunteers</Text>
              <Text style={styles.primaryButtonSubtext}>Tap to see peer supporters</Text>
            </TouchableOpacity>

            {/* Chat with Bob - AI Peer Support (underneath volunteers) */}
            <TouchableOpacity 
              style={[styles.bobCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/chat/bob')}
              activeOpacity={0.9}
            >
              <Image 
                source={{ uri: '/images/bob.png' }}
                style={styles.bobAvatar}
              />
              <View style={styles.bobTextContainer}>
                <Text style={[styles.bobTitle, { color: colors.text }]}>Chat with Bob</Text>
                <Text style={[styles.bobSubtitle, { color: colors.textSecondary }]}>Ex-Para AI peer support, 24/7</Text>
              </View>
              <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>24/7</Text>
              </View>
            </TouchableOpacity>

            {/* What is it */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle" size={24} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>What is peer support?</Text>
              </View>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                Connect with fellow veterans who understand what you're going through. Share experiences, offer mutual support, and know you're not alone.
              </Text>
            </View>

            {/* What it's not */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle" size={24} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>What it's not</Text>
              </View>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                • Not professional therapy or counselling{"\n"}
                • Not an emergency service{"\n"}
                • Not a replacement for medical care
              </Text>
            </View>

            {/* Benefits */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="heart" size={24} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>How it helps</Text>
              </View>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                Speaking with someone who's walked a similar path can make a real difference. Peer supporters are trained volunteers who've served and understand the challenges.
              </Text>
            </View>

            {/* Register to Give Support */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            
            <Text style={[styles.giveSupportTitle, { color: colors.text }]}>Want to Support Others?</Text>
            <Text style={[styles.giveSupportSubtitle, { color: colors.textSecondary }]}>Become a peer supporter and help fellow veterans</Text>

            {!showForm ? (
              <TouchableOpacity 
                style={[styles.secondaryButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowForm(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={20} color={colors.textSecondary} />
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Register to Give Support</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.formContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.formTitle, { color: colors.text }]}>Register to Give Peer Support</Text>
                <Text style={[styles.formDescription, { color: colors.textSecondary }]}>
                  If you're a veteran interested in supporting others, please share your email. We'll contact you with more details about the programme.
                </Text>
                
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="Your email address"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />

                <TouchableOpacity 
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  onPress={handleRegister}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <Text style={styles.submitButtonText}>Submitting...</Text>
                  ) : (
                    <Text style={styles.submitButtonText}>Submit</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowForm(false);
                    setEmail('');
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="shield-checkmark" size={16} color="#b0c4de" />
            <Text style={styles.disclaimerText}>
              Your information will be kept confidential and only used to contact you about the peer support programme.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
      
      {/* WebRTC Call Modal - rendered outside conditionals so it shows during any state */}
      <Modal visible={showCallModal} transparent animationType="fade">
        <View style={styles.callModalOverlay}>
          <View style={styles.callModalContent}>
            <View style={styles.callModalHeader}>
              {/* Animated icon based on call state */}
              <View style={styles.callIconContainer}>
                <Ionicons 
                  name={callState === 'connected' ? 'call' : 'call-outline'} 
                  size={48} 
                  color={callState === 'connected' ? '#22c55e' : callInfo?.isIncoming ? '#16a34a' : '#3b82f6'} 
                />
              </View>
              
              <Text style={styles.callModalTitle}>
                {callInfo?.isIncoming && callState === 'ringing' ? 'Incoming Call' :
                 isInitiatingCall ? 'Connecting...' :
                 callState === 'connecting' ? 'Connecting...' : 
                 callState === 'ringing' ? 'Ringing...' : 
                 callState === 'connected' ? 'Connected' : 'Calling...'}
              </Text>
              
              <Text style={styles.callModalPeerName}>
                {callInfo?.peerName || callingPeerName || 'Peer Supporter'}
              </Text>
              
              {callState === 'connected' && (
                <Text style={styles.callModalDuration}>{formatCallDuration(callDuration)}</Text>
              )}
              
              {/* Debug Info - visible on screen */}
              {callState === 'connected' && (
                <View style={styles.debugInfo}>
                  <Text style={styles.debugText}>Track: {debugInfo.remoteTrackReceived ? '✓' : '✗'}</Text>
                  <Text style={styles.debugText}>Audio: {debugInfo.audioPlaying ? '✓' : '✗'}</Text>
                  <Text style={styles.debugText}>ICE: {debugInfo.iceState}</Text>
                </View>
              )}
              
              {!callInfo?.isIncoming && (isInitiatingCall || callState === 'connecting' || callState === 'ringing') && (
                <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 16 }} />
              )}
            </View>
            
            {/* Incoming call - show Accept/Reject buttons */}
            {callInfo?.isIncoming && callState === 'ringing' ? (
              <View style={styles.incomingCallButtons}>
                <TouchableOpacity 
                  style={[styles.callButton, styles.rejectButton]} 
                  onPress={() => {
                    console.log('Rejecting incoming call');
                    rejectCall();
                  }}
                >
                  <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.callButtonText}>Decline</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.callButton, styles.acceptButton]} 
                  onPress={() => {
                    console.log('Accepting incoming call');
                    acceptCall();
                  }}
                >
                  <Ionicons name="call" size={28} color="#fff" />
                  <Text style={styles.callButtonText}>Accept</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.callEndButton} onPress={handleEndCall}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.callEndButtonText}>
                  {callState === 'connected' ? 'End Call' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a2332',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a2332',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  content: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#b0c4de',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
  },
  primaryButtonSubtext: {
    fontSize: 13,
    color: '#bfdbfe',
    marginTop: 4,
  },
  bobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d3748',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  bobAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
  },
  bobTextContainer: {
    flex: 1,
  },
  bobTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  bobSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4a5568',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionText: {
    fontSize: 15,
    color: '#b0c4de',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#4a5568',
    marginVertical: 24,
  },
  giveSupportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  giveSupportSubtitle: {
    fontSize: 14,
    color: '#b0c4de',
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#4a5568',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c9cbf',
  },
  formContainer: {
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#4a5568',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  formDescription: {
    fontSize: 14,
    color: '#b0c4de',
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1a2332',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#4a5568',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#7c9cbf',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#2d3748',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#b0c4de',
    lineHeight: 20,
  },
  veteranCard: {
    backgroundColor: '#2d3748',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4a5568',
  },
  veteranHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  veteranMainInfo: {
    flex: 1,
  },
  veteranNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  veteranName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  availabilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeAvailable: {
    backgroundColor: '#2d4a3e',
  },
  badgeLimited: {
    backgroundColor: '#4a3a2d',
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textAvailable: {
    color: '#a8e6cf',
  },
  textLimited: {
    color: '#fde68a',
  },
  veteranLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  veteranArea: {
    fontSize: 14,
    color: '#7c9cbf',
  },
  veteranDetails: {
    marginBottom: 12,
  },
  veteranBackground: {
    fontSize: 14,
    color: '#b0c4de',
    lineHeight: 20,
    marginBottom: 6,
  },
  veteranYears: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  connectButton: {
    flexDirection: 'row',
    backgroundColor: '#4a90e2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  veteranContactButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  veteranCallButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#4a90e2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  veteranCallButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  veteranSecondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#4a5568',
    minWidth: 85,
  },
  veteranSecondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7c9cbf',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#2d3748',
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#b0c4de',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#2d3748',
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#2d3748',
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#b0c4de',
    textAlign: 'center',
  },
  limitedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#1a2332',
    borderRadius: 8,
    gap: 8,
  },
  limitedText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2d3748',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#b0c4de',
    lineHeight: 18,
  },
  // Call Modal Styles
  callModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callModalContent: {
    backgroundColor: '#1a2332',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  callModalHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  callIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callModalTitle: {
    fontSize: 18,
    color: '#94a3b8',
    marginTop: 16,
  },
  callModalPeerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
  },
  callModalDuration: {
    fontSize: 32,
    fontWeight: '300',
    color: '#22c55e',
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugInfo: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
    gap: 16,
  },
  debugText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  callEndButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 10,
  },
  callEndButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Waiting for Support styles
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  waitingContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  waitingIconContainer: {
    marginBottom: 32,
  },
  waitingIconOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#16a34a',
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  waitingMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  waitingSteps: {
    gap: 16,
    marginBottom: 32,
    width: '100%',
  },
  waitingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  waitingStepText: {
    fontSize: 14,
  },
  waitingHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    fontStyle: 'italic',
  },
  waitingCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#94a3b8',
    marginBottom: 16,
  },
  waitingCancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  waitingSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  waitingSwitchText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  // Incoming call styles
  incomingCallButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 24,
  },
  callButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  acceptButton: {
    backgroundColor: '#22c55e',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});