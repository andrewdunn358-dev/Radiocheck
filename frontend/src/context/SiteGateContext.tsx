import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// Get the site password from environment variable
const SITE_PASSWORD = process.env.EXPO_PUBLIC_SITE_PASSWORD || 'radiocheck2025';

interface SiteGateContextType {
  isUnlocked: boolean;
  isLoading: boolean;
}

const SiteGateContext = createContext<SiteGateContextType>({
  isUnlocked: false,
  isLoading: true,
});

export const useSiteGate = () => useContext(SiteGateContext);

interface SiteGateProviderProps {
  children: ReactNode;
}

export function SiteGateProvider({ children }: SiteGateProviderProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkUnlockStatus();
  }, []);

  const checkUnlockStatus = async () => {
    try {
      const unlocked = await AsyncStorage.getItem('site_unlocked');
      if (unlocked === 'true') {
        setIsUnlocked(true);
      }
    } catch (err) {
      console.log('Error checking site gate status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (password === SITE_PASSWORD) {
      try {
        await AsyncStorage.setItem('site_unlocked', 'true');
        setIsUnlocked(true);
        setError('');
      } catch (err) {
        console.error('Error saving unlock status:', err);
      }
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleKeyPress = (e: any) => {
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter') {
      handleUnlock();
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Show password gate if not unlocked
  if (!isUnlocked) {
    return (
      <View style={styles.container}>
        <View style={styles.gateCard}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={64} color="#0d9488" />
          </View>

          <Text style={styles.title}>Radio Check</Text>
          <Text style={styles.subtitle}>Protected Access</Text>

          <Text style={styles.description}>
            This app is currently in testing. Please enter the access password to continue.
          </Text>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              autoCapitalize="none"
              autoCorrect={false}
              data-testid="site-gate-password-input"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#64748b" 
              />
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Unlock Button */}
          <TouchableOpacity 
            style={styles.unlockButton} 
            onPress={handleUnlock}
            activeOpacity={0.8}
            data-testid="site-gate-unlock-btn"
          >
            <Ionicons name="enter" size={20} color="#ffffff" />
            <Text style={styles.unlockButtonText}>Access App</Text>
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footer}>
            Contact admin@radiocheck.me for access
          </Text>
        </View>
      </View>
    );
  }

  // App is unlocked - render children
  return (
    <SiteGateContext.Provider value={{ isUnlocked, isLoading }}>
      {children}
    </SiteGateContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2e44',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
  },
  gateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0fdfa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    marginBottom: 12,
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  eyeButton: {
    padding: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d9488',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 20,
    textAlign: 'center',
  },
});
