import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function PortalRouter() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
      } else {
        switch (user.role) {
          case 'admin':
            if (Platform.OS === 'web') {
              // On web, redirect to external admin portal with token
              window.location.href = `https://admin.radiocheck.me?token=${token}`;
            } else {
              // On mobile, use WebView
              router.replace('/admin-webview');
            }
            break;
          case 'counsellor':
          case 'peer':
            if (Platform.OS === 'web') {
              // On web, redirect to external staff portal with token
              window.location.href = `https://staff.radiocheck.me?token=${token}`;
            } else {
              // On mobile, use WebView
              router.replace('/staff-webview');
            }
            break;
          default:
            router.replace('/login');
        }
      }
    }
  }, [user, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4a90d9" />
      <Text style={styles.text}>Redirecting to portal...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
});
