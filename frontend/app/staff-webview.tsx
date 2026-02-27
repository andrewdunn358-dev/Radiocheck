import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';

// Staff portal URL - production
const STAFF_PORTAL_URL = 'https://staff.radiocheck.me';

export default function StaffWebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(STAFF_PORTAL_URL);
  const router = useRouter();
  const { user, token, logout } = useAuth();

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      });
      return () => backHandler.remove();
    }
  }, [canGoBack]);

  // Inject JavaScript to auto-login with token
  const injectedJavaScript = `
    (function() {
      // Store token for API calls
      localStorage.setItem('auth_token', '${token}');
      localStorage.setItem('auth_user', '${JSON.stringify(user)}');
      
      // If on login page, auto-fill and submit or redirect
      if (window.location.pathname === '/' || window.location.pathname.includes('login')) {
        // Check if already logged in
        const storedToken = localStorage.getItem('auth_token');
        if (storedToken) {
          // Token is set, redirect to home
          window.location.href = '/home.html';
        }
      }
      
      // Override logout to also logout from app
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
          if (args[0] && args[0].includes && args[0].includes('logout')) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'logout' }));
          }
          return response;
        });
      };
      
      true;
    })();
  `;

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'logout') {
        handleLogout();
      }
    } catch (e) {
      console.log('WebView message:', event.nativeEvent.data);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleRefresh = () => {
    webViewRef.current?.reload();
  };

  // Build URL with token for auto-login
  const portalUrl = `${STAFF_PORTAL_URL}/home.html`;

  if (Platform.OS === 'web') {
    // On web, just redirect to the staff portal
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webFallback}>
          <Ionicons name="desktop-outline" size={60} color="#4a90d9" />
          <Text style={styles.webFallbackTitle}>Staff Portal</Text>
          <Text style={styles.webFallbackText}>
            On web, please use the dedicated staff portal:
          </Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => window.open(STAFF_PORTAL_URL, '_blank')}
          >
            <Text style={styles.linkButtonText}>Open Staff Portal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.replace('/')}
        >
          <Ionicons name="home-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Staff Portal</Text>
        
        <View style={styles.headerRight}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => webViewRef.current?.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={24} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: portalUrl }}
        style={styles.webview}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
          setCurrentUrl(navState.url);
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Enable microphone for calls
        mediaCapturePermissionGrantType="grant"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4a90d9" />
          <Text style={styles.loadingText}>Loading Staff Portal...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2332',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#243447',
    borderBottomWidth: 1,
    borderBottomColor: '#3a4a5c',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: '#1a2332',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 35, 50, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  webFallbackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
  },
  webFallbackText: {
    fontSize: 16,
    color: '#8899a6',
    marginTop: 8,
    textAlign: 'center',
  },
  linkButton: {
    backgroundColor: '#4a90d9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  linkButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  logoutButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
  },
});
