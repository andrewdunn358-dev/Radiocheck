import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform, Image, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ResponsiveWrapperProps {
  children: React.ReactNode;
  showDesktopShell?: boolean;
}

const MOBILE_BREAKPOINT = 900;
const MAX_MOBILE_WIDTH = 430; // iPhone 14 Pro Max width

export default function ResponsiveWrapper({ children, showDesktopShell = true }: ResponsiveWrapperProps) {
  const { colors, theme } = useTheme();
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setIsDesktop(false);
      return;
    }

    const updateLayout = () => {
      const width = Dimensions.get('window').width;
      setWindowWidth(width);
      setIsDesktop(width > MOBILE_BREAKPOINT);
    };

    updateLayout();
    
    const subscription = Dimensions.addEventListener('change', updateLayout);
    return () => subscription?.remove();
  }, []);

  // On mobile or non-web, just render children directly
  if (!isDesktop || Platform.OS !== 'web') {
    return <>{children}</>;
  }

  // On desktop, show a centered mobile container with branding
  return (
    <View style={[styles.desktopContainer, { backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9' }]}>
      {/* Left branding section */}
      <View style={styles.brandingSection}>
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={styles.desktopLogo}
          resizeMode="contain"
        />
        <Text style={[styles.brandTitle, { color: theme === 'dark' ? '#f8fafc' : '#1e293b' }]}>
          Radio Check
        </Text>
        <Text style={[styles.brandTagline, { color: theme === 'dark' ? '#94a3b8' : '#64748b' }]}>
          Mental Health & Peer Support{'\n'}for Veterans
        </Text>
        <View style={styles.featureList}>
          <FeatureItem icon="🎖️" text="Veterans & Serving Personnel" theme={theme} />
          <FeatureItem icon="💬" text="24/7 AI Support Buddies" theme={theme} />
          <FeatureItem icon="📞" text="Connect with Counsellors" theme={theme} />
          <FeatureItem icon="👥" text="Peer Support Network" theme={theme} />
        </View>
      </View>

      {/* Mobile app container */}
      <View style={styles.mobileContainerWrapper}>
        <View style={[styles.phoneFrame, { 
          backgroundColor: colors.background,
          borderColor: theme === 'dark' ? '#334155' : '#cbd5e1'
        }]}>
          {/* App content */}
          <View style={styles.appContent}>
            {children}
          </View>
        </View>
      </View>

      {/* Right section - emergency numbers */}
      <View style={styles.rightSection}>
        <Text style={[styles.helpTitle, { color: theme === 'dark' ? '#f8fafc' : '#1e293b' }]}>
          Need Help Now?
        </Text>
        <EmergencyNumber label="Samaritans" number="116 123" theme={theme} />
        <EmergencyNumber label="Combat Stress" number="0800 138 1619" theme={theme} />
        <EmergencyNumber label="Veterans Gateway" number="0808 802 1212" theme={theme} />
        <Text style={[styles.desktopHint, { color: theme === 'dark' ? '#64748b' : '#94a3b8', marginTop: 30 }]}>
          Optimised for mobile.{'\n'}Use your phone for the best experience.
        </Text>
      </View>
    </View>
  );
}

function FeatureItem({ icon, text, theme }: { icon: string; text: string; theme: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={[styles.featureText, { color: theme === 'dark' ? '#cbd5e1' : '#475569' }]}>
        {text}
      </Text>
    </View>
  );
}

function EmergencyNumber({ label, number, theme }: { label: string; number: string; theme: string }) {
  return (
    <View style={styles.emergencyItem}>
      <Text style={[styles.emergencyLabel, { color: theme === 'dark' ? '#94a3b8' : '#64748b' }]}>
        {label}
      </Text>
      <Text style={[styles.emergencyNumber, { color: theme === 'dark' ? '#f8fafc' : '#1e293b' }]}>
        {number}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh' as any,
    gap: 60,
    padding: 40,
  },
  brandingSection: {
    width: 280,
    alignItems: 'flex-start',
  },
  desktopLogo: {
    width: 70,
    height: 70,
    marginBottom: 16,
    borderRadius: 14,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  brandTagline: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  featureList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  featureText: {
    fontSize: 13,
  },
  desktopHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  mobileContainerWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneFrame: {
    width: MAX_MOBILE_WIDTH,
    height: 850,
    borderRadius: 40,
    borderWidth: 6,
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' as any,
  },
  appContent: {
    flex: 1,
    overflow: 'hidden',
  },
  rightSection: {
    width: 220,
    alignItems: 'flex-start',
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  emergencyItem: {
    marginBottom: 14,
  },
  emergencyLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  emergencyNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
});
