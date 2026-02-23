import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { API_URL } from '../src/config/api';

export default function YourDataRights() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState<string | null>(null);
  const styles = createStyles(colors);

  const handleExportData = async () => {
    setLoading('export');
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        Alert.alert('Sign In Required', 'Please sign in to export your data.');
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/my-data/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          'Data Export Ready',
          `Your data export contains ${Object.keys(data.data_categories || {}).length} categories of data. In a production app, this would be downloaded as a file.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to export data. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setLoading('delete');
            try {
              const token = await AsyncStorage.getItem('@auth_token');
              if (!token) {
                Alert.alert('Sign In Required', 'Please sign in to delete your account.');
                return;
              }

              const response = await fetch(`${API_URL}/api/auth/me`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (response.ok) {
                await AsyncStorage.multiRemove(['@auth_token', '@user_data']);
                Alert.alert(
                  'Account Deleted',
                  'Your account and personal data have been deleted.',
                  [{ text: 'OK', onPress: () => router.replace('/') }]
                );
              } else {
                Alert.alert('Error', 'Failed to delete account. Please contact support.');
              }
            } catch (error) {
              Alert.alert('Error', 'Could not connect to server.');
            } finally {
              setLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleClearLocalData = async () => {
    Alert.alert(
      'Clear Local Data',
      'This will delete all data stored on this device including journal entries, mood history, and saved preferences.\n\nThis does not affect your account on our servers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
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
              Alert.alert('Success', 'Local data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Data Rights</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* GDPR Info */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={32} color="#22c55e" />
          <Text style={styles.infoTitle}>GDPR Protected</Text>
          <Text style={styles.infoText}>
            Under the UK General Data Protection Regulation (UK GDPR), you have rights 
            over your personal data. Radio Check is committed to protecting your privacy.
          </Text>
        </View>

        {/* Your Rights */}
        <Text style={styles.sectionTitle}>Your Rights Under GDPR</Text>

        <View style={styles.rightCard}>
          <View style={styles.rightHeader}>
            <Ionicons name="eye-outline" size={24} color={colors.primary} />
            <Text style={styles.rightTitle}>Right to Access</Text>
          </View>
          <Text style={styles.rightDescription}>
            You can request a copy of all personal data we hold about you. This includes 
            your account information, chat history, and any other data associated with your account.
          </Text>
        </View>

        <View style={styles.rightCard}>
          <View style={styles.rightHeader}>
            <Ionicons name="download-outline" size={24} color={colors.primary} />
            <Text style={styles.rightTitle}>Right to Data Portability</Text>
          </View>
          <Text style={styles.rightDescription}>
            You can export your data in a machine-readable format to transfer to another service.
          </Text>
        </View>

        <View style={styles.rightCard}>
          <View style={styles.rightHeader}>
            <Ionicons name="create-outline" size={24} color={colors.primary} />
            <Text style={styles.rightTitle}>Right to Rectification</Text>
          </View>
          <Text style={styles.rightDescription}>
            You can update or correct any inaccurate personal data we hold about you through 
            your account settings.
          </Text>
        </View>

        <View style={styles.rightCard}>
          <View style={styles.rightHeader}>
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
            <Text style={styles.rightTitle}>Right to Erasure</Text>
          </View>
          <Text style={styles.rightDescription}>
            You can request deletion of your personal data. Note: Some data may be retained 
            for safeguarding or legal compliance purposes.
          </Text>
        </View>

        {/* Actions */}
        <Text style={styles.sectionTitle}>Manage Your Data</Text>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleExportData}
          disabled={loading === 'export'}
        >
          {loading === 'export' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Export My Data</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButtonSecondary}
          onPress={handleClearLocalData}
        >
          <Ionicons name="phone-portrait-outline" size={20} color={colors.text} />
          <Text style={styles.actionButtonTextSecondary}>Clear Local Device Data</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButtonDanger}
          onPress={handleDeleteAccount}
          disabled={loading === 'delete'}
        >
          {loading === 'delete' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="warning-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Delete My Account</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Data Retention */}
        <Text style={styles.sectionTitle}>Data Retention</Text>
        <View style={styles.retentionCard}>
          <Text style={styles.retentionItem}>
            <Text style={styles.bold}>Account Data:</Text> Retained until you delete your account
          </Text>
          <Text style={styles.retentionItem}>
            <Text style={styles.bold}>Chat History:</Text> AI chats retained for 90 days, then anonymised
          </Text>
          <Text style={styles.retentionItem}>
            <Text style={styles.bold}>Safeguarding Records:</Text> Retained for 7 years (legal requirement)
          </Text>
          <Text style={styles.retentionItem}>
            <Text style={styles.bold}>Local Data:</Text> Stored only on your device until you clear it
          </Text>
        </View>

        {/* Contact */}
        <View style={styles.contactCard}>
          <Ionicons name="mail-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.contactText}>
            For data protection enquiries, contact our Data Protection Officer at{' '}
            <Text style={styles.email}>dpo@radiocheck.me</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  rightCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rightDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  actionButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 24,
  },
  retentionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retentionItem: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '600',
    color: colors.text,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  email: {
    color: colors.primary,
    fontWeight: '500',
  },
});
