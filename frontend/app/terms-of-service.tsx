import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { useCMSBlocks } from '../src/hooks/useCMSBlocks';
import { CMSBlockRenderer } from '../src/components/CMSBlockRenderer';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { blocks, isLoading } = useCMSBlocks('terms-of-service');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <CMSBlockRenderer blocks={blocks} isLoading={isLoading} />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 600, alignSelf: 'center', width: '100%' },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
});
