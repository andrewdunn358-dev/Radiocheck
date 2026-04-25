import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { AgeGateProvider } from '../src/context/AgeGateContext';
import { SiteGateProvider } from '../src/context/SiteGateContext';
import { LocationPermissionProvider } from '../src/context/LocationPermissionContext';
import ResponsiveWrapper from '../src/components/ResponsiveWrapper';
import InstallPwaPrompt from '../src/components/InstallPwaPrompt';

function AppContent() {
  const { theme, colors } = useTheme();
  
  return (
    <ResponsiveWrapper>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="home" />
        <Stack.Screen name="crisis-support" />
        <Stack.Screen name="organizations" />
        <Stack.Screen name="peer-support" />
        <Stack.Screen name="historical-investigations" />
        <Stack.Screen name="login" />
        <Stack.Screen name="portal" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="counsellor-portal" />
        <Stack.Screen name="peer-portal" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="journal" />
        <Stack.Screen name="mood" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="resources" />
        <Stack.Screen name="grace-welcome" />
      </Stack>
      <InstallPwaPrompt />
    </ResponsiveWrapper>
  );
}

export default function RootLayout() {
  return (
    <SiteGateProvider>
      <ThemeProvider>
        <LocationPermissionProvider>
          <AgeGateProvider>
            <FavoritesProvider>
              <AuthProvider>
                <AppContent />
              </AuthProvider>
            </FavoritesProvider>
          </AgeGateProvider>
        </LocationPermissionProvider>
      </ThemeProvider>
    </SiteGateProvider>
  );
}