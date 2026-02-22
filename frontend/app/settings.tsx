import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Switch, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';

export default function Settings() {
  const router = useRouter();
  const { theme, colors, toggleTheme } = useTheme();

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your local data including journal entries, mood history, and favorites. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                '@veterans_journal_entries',
                '@veterans_mood_entries',
                '@veterans_last_checkin',
                '@veterans_favorite_counsellors',
                '@veterans_favorite_peers',
              ]);
              Alert.alert('Data Cleared', 'All local data has been deleted.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleContact = () => {
    Linking.openURL('mailto:support@radiocheck.me?subject=App Feedback');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={colors.background === '#1a2332' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Appearance Section */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={22} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingDescription}>
                  {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
                </Text>
              </View>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Your Data Section */}
        <Text style={styles.sectionTitle}>Your Data</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/journal')}>
            <View style={styles.settingInfo}>
              <Ionicons name="book-outline" size={22} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>My Journal</Text>
                <Text style={styles.settingDescription}>View and manage your journal entries</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/mood')}>
            <View style={styles.settingInfo}>
              <Ionicons name="happy-outline" size={22} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Mood History</Text>
                <Text style={styles.settingDescription}>View your daily check-in history</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={[styles.settingRow, styles.dangerRow]} onPress={handleClearData}>
            <View style={styles.settingInfo}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
              <View>
                <Text style={[styles.settingLabel, styles.dangerText]}>Clear All Data</Text>
                <Text style={styles.settingDescription}>Delete all local data from this device</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Privacy Section */}
        <Text style={styles.sectionTitle}>Privacy & Security</Text>
        <View style={styles.settingsCard}>
          <View style={styles.privacyInfo}>
            <Ionicons name="shield-checkmark" size={24} color="#22c55e" />
            <Text style={styles.privacyText}>
              Your journal and mood data are stored only on this device. We never upload or share your personal information.
            </Text>
          </View>
        </View>

        {/* Legal & Your Rights Section */}
        <Text style={styles.sectionTitle}>Legal & Your Rights</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/privacy-policy')}>
            <View style={styles.settingInfo}>
              <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Privacy Policy</Text>
                <Text style={styles.settingDescription}>How we collect and use your data</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/terms-of-service')}>
            <View style={styles.settingInfo}>
              <Ionicons name="newspaper-outline" size={22} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Terms of Service</Text>
                <Text style={styles.settingDescription}>Terms and conditions of use</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/your-data-rights')}>
            <View style={styles.settingInfo}>
              <Ionicons name="finger-print-outline" size={22} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Your Data Rights (GDPR)</Text>
                <Text style={styles.settingDescription}>Access, export, or delete your data</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/safeguarding')}>
            <View style={styles.settingInfo}>
              <Ionicons name="heart-outline" size={22} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Safeguarding Policy</Text>
                <Text style={styles.settingDescription}>How we keep you safe</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow} onPress={handleContact}>
            <View style={styles.settingInfo}>
              <Ionicons name="mail-outline" size={22} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Contact Us</Text>
                <Text style={styles.settingDescription}>Send feedback or report issues</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Radio Check v1.0.0</Text>
          <Text style={styles.appTagline}>Supporting veterans, one connection at a time</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  dangerRow: {
    // No special styling needed, handled by dangerText
  },
  dangerText: {
    color: '#ef4444',
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  appVersion: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
