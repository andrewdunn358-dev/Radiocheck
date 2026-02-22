import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar, Linking, ScrollView, Dimensions, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';

// Local images
const NEW_LOGO = require('../assets/images/logo.png');
const FRANKIES_POD_LOGO = require('../assets/images/frankies-pod.png');
const STANDING_TALL_LOGO = require('../assets/images/standing-tall.png');

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_HEIGHT < 700;

export default function SplashScreen() {
  const router = useRouter();
  const [showCookieNotice, setShowCookieNotice] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const checkCookieConsent = async () => {
    try {
      const consent = await AsyncStorage.getItem('cookie_consent');
      if (!consent) {
        setShowCookieNotice(true);
      }
    } catch (error) {
      setShowCookieNotice(true);
    }
  };

  const checkPermissions = async () => {
    try {
      // Check if we've already asked for permissions
      const permissionAsked = await AsyncStorage.getItem('permission_asked');
      if (!permissionAsked) {
        // Show permission modal on first launch
        setShowPermissionModal(true);
      }
    } catch (error) {
      console.log('Error checking permissions:', error);
    }
  };
  
  useEffect(() => {
    checkCookieConsent();
    checkPermissions();
  }, []);

  const handleAllowPermissions = async () => {
    try {
      // Request microphone permission
      const { status } = await Audio.requestPermissionsAsync();
      console.log('Microphone permission:', status);
      
      // Save that we've asked for permissions
      await AsyncStorage.setItem('permission_asked', 'true');
      setShowPermissionModal(false);
    } catch (error) {
      console.error('Error requesting permissions:', error);
      await AsyncStorage.setItem('permission_asked', 'true');
      setShowPermissionModal(false);
    }
  };

  const handleSkipPermissions = async () => {
    try {
      await AsyncStorage.setItem('permission_asked', 'true');
      setShowPermissionModal(false);
    } catch (error) {
      setShowPermissionModal(false);
    }
  };

  const acceptCookies = async () => {
    try {
      await AsyncStorage.setItem('cookie_consent', 'accepted');
      setShowCookieNotice(false);
    } catch (error) {
      console.error('Error saving cookie consent:', error);
    }
  };

  const handleYes = () => {
    router.replace('/crisis-support');
  };

  const handleNo = () => {
    router.replace('/home');
  };

  const handleLearnMore = () => {
    router.push('/about');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#1a2e44" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.content}>
          {/* Logo - New transparent version */}
          <View style={styles.logoContainer}>
            <Image 
              source={NEW_LOGO}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>Radio Check</Text>
          <Text style={styles.subtitle}>Your Support Network</Text>

          {/* Mission Statement */}
          <View style={styles.missionContainer}>
            <Text style={styles.missionText}>
              {`"Radio Check" fuses real-time peer support with smart AI insight, creating more than just an app — it's a digital hand on your shoulder when it matters most.`}
            </Text>
          </View>

          {/* Learn More Button */}
          <TouchableOpacity 
            style={styles.learnMoreButton} 
            onPress={handleLearnMore}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={18} color="#93c5fd" />
            <Text style={styles.learnMoreText}>Learn more about Radio Check</Text>
          </TouchableOpacity>

          {/* Question */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>
              Do you need to speak with someone right now?
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {/* Yes - Primary action - Calming teal/green */}
            <TouchableOpacity 
              style={styles.yesButton} 
              onPress={handleYes} 
              data-testid="splash-yes-btn"
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles" size={22} color="#ffffff" />
              <Text style={styles.yesButtonText}>Yes, connect me now</Text>
            </TouchableOpacity>

            {/* No - Secondary action - Clear and visible */}
            <TouchableOpacity 
              style={styles.noButton} 
              onPress={handleNo} 
              data-testid="splash-no-btn"
              activeOpacity={0.8}
            >
              <Ionicons name="apps" size={20} color="#ffffff" />
              <Text style={styles.noButtonText}>{"I'm ok, take me to the app"}</Text>
            </TouchableOpacity>
          </View>

          {/* Emergency Notice */}
          <View style={styles.emergencyNotice}>
            <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
            <Text style={styles.emergencyText}>
              In an emergency, always call 999
            </Text>
          </View>

          {/* Supporter Logos */}
          <View style={styles.supportersSection}>
            <Text style={styles.supportersLabel}>Proudly supported by</Text>
            <View style={styles.supportersLogos}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://www.youtube.com/@FrankiesPod')}
                activeOpacity={0.8}
                style={styles.supporterLogoWrapper}
              >
                <Image 
                  source={FRANKIES_POD_LOGO}
                  style={styles.supporterLogo}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://www.standingtallfoundation.org.uk/')}
                activeOpacity={0.8}
                style={styles.supporterLogoWrapper}
              >
                <Image 
                  source={STANDING_TALL_LOGO}
                  style={styles.supporterLogoStandingTall}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Permission Request Modal */}
      <Modal
        visible={showPermissionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPermissionModal(false)}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionModal}>
            <View style={styles.permissionIconContainer}>
              <Ionicons name="mic" size={48} color="#3b82f6" />
            </View>
            <Text style={styles.permissionTitle}>Enable Microphone</Text>
            <Text style={styles.permissionDescription}>
              Radio Check needs microphone access for peer-to-peer voice calls with other veterans.
            </Text>
            <View style={styles.permissionFeatures}>
              <View style={styles.permissionFeature}>
                <Ionicons name="call" size={20} color="#22c55e" />
                <Text style={styles.permissionFeatureText}>Talk directly with peer supporters</Text>
              </View>
              <View style={styles.permissionFeature}>
                <Ionicons name="people" size={20} color="#22c55e" />
                <Text style={styles.permissionFeatureText}>Connect with fellow veterans</Text>
              </View>
              <View style={styles.permissionFeature}>
                <Ionicons name="shield-checkmark" size={20} color="#22c55e" />
                <Text style={styles.permissionFeatureText}>Your privacy is protected</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.permissionAllowButton}
              onPress={handleAllowPermissions}
            >
              <Ionicons name="mic" size={20} color="#fff" />
              <Text style={styles.permissionAllowText}>Allow Microphone</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.permissionSkipButton}
              onPress={handleSkipPermissions}
            >
              <Text style={styles.permissionSkipText}>Maybe Later</Text>
            </TouchableOpacity>
            <Text style={styles.permissionNote}>
              You can always enable this in Settings later.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Cookie Notice */}
      {showCookieNotice && (
        <View style={styles.cookieNotice}>
          <View style={styles.cookieContent}>
            <View style={styles.cookieIcon}>
              <Ionicons name="shield-checkmark" size={24} color="#3b82f6" />
            </View>
            <Text style={styles.cookieTitle}>Your Privacy</Text>
            <Text style={styles.cookieText}>
              We use local storage to save your preferences and journal entries on your device. 
              No personal data is sent to external servers without your consent.
            </Text>
            <TouchableOpacity style={styles.cookieAcceptButton} onPress={acceptCookies}>
              <Text style={styles.cookieAcceptText}>Accept & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a2e44',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#1a2e44',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: isSmallScreen ? 16 : 24,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 400,
    width: '100%',
  },
  logoContainer: {
    marginBottom: isSmallScreen ? 8 : 16,
  },
  logo: {
    width: isSmallScreen ? 80 : 100,
    height: isSmallScreen ? 80 : 100,
  },
  title: {
    fontSize: isSmallScreen ? 26 : 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#8ba4c4',
    marginBottom: isSmallScreen ? 10 : 16,
    textAlign: 'center',
  },
  missionContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 14,
    padding: isSmallScreen ? 12 : 16,
    marginBottom: isSmallScreen ? 8 : 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  missionText: {
    fontSize: isSmallScreen ? 12 : 14,
    fontStyle: 'italic',
    color: '#93c5fd',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 18 : 22,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isSmallScreen ? 6 : 10,
    paddingHorizontal: 16,
    marginBottom: isSmallScreen ? 16 : 24,
    gap: 6,
  },
  learnMoreText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: '#93c5fd',
    textDecorationLine: 'underline',
  },
  questionContainer: {
    alignItems: 'center',
    marginBottom: isSmallScreen ? 14 : 20,
  },
  questionText: {
    fontSize: isSmallScreen ? 17 : 20,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 24 : 28,
  },
  buttonContainer: {
    width: '100%',
    gap: isSmallScreen ? 10 : 14,
    marginBottom: isSmallScreen ? 18 : 28,
  },
  yesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d9488',
    paddingVertical: isSmallScreen ? 14 : 18,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  yesButtonText: {
    fontSize: isSmallScreen ? 15 : 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  noButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: isSmallScreen ? 12 : 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 8,
  },
  noButtonText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  emergencyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emergencyText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  supportersSection: {
    marginTop: isSmallScreen ? 18 : 28,
    alignItems: 'center',
  },
  supportersLabel: {
    fontSize: isSmallScreen ? 10 : 12,
    color: '#cbd5e1',
    marginBottom: isSmallScreen ? 8 : 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  supportersLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isSmallScreen ? 12 : 20,
  },
  supporterLogoWrapper: {
    padding: 4,
  },
  supporterLogo: {
    width: isSmallScreen ? 70 : 100,
    height: isSmallScreen ? 35 : 50,
  },
  supporterLogoStandingTall: {
    width: isSmallScreen ? 56 : 80,
    height: isSmallScreen ? 42 : 60,
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  cookieNotice: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: isSmallScreen ? 16 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  cookieContent: {
    alignItems: 'center',
  },
  cookieIcon: {
    width: isSmallScreen ? 40 : 48,
    height: isSmallScreen ? 40 : 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isSmallScreen ? 8 : 12,
  },
  cookieTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  cookieText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 18 : 20,
    marginBottom: isSmallScreen ? 14 : 20,
  },
  cookieAcceptButton: {
    backgroundColor: '#0d9488',
    paddingVertical: isSmallScreen ? 12 : 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  cookieAcceptText: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Permission Modal Styles
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionModal: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  permissionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  permissionFeatures: {
    width: '100%',
    marginBottom: 24,
  },
  permissionFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 10,
  },
  permissionFeatureText: {
    fontSize: 14,
    color: '#166534',
    flex: 1,
  },
  permissionAllowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    gap: 10,
    marginBottom: 12,
  },
  permissionAllowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  permissionSkipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  permissionSkipText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  permissionNote: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
});
