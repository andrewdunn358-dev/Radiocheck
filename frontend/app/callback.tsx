import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { API_URL } from '../src/config/api';

export default function CallbackRequest() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const styles = createStyles(colors);

  const [requestType, setRequestType] = useState<'counsellor' | 'peer' | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!requestType) {
      Alert.alert('Please Select', 'Please choose who you would like to speak with.');
      return;
    }
    if (!formData.name.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Phone Required', 'Please enter your phone number so we can call you back.');
      return;
    }
    if (!formData.message.trim()) {
      Alert.alert('Message Required', 'Please let us know how we can help.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/callbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
          message: formData.message.trim(),
          request_type: requestType,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to submit request. Please try again.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
          </View>
          <Text style={styles.successTitle}>Request Submitted</Text>
          <Text style={styles.successText}>
            Thank you for reaching out. One of our {requestType === 'counsellor' ? 'counsellors' : 'peer supporters'} will 
            contact you as soon as possible.
          </Text>
          {formData.email && (
            <Text style={styles.successSubtext}>
              A confirmation has been sent to {formData.email}
            </Text>
          )}
          
          <View style={styles.crisisBox}>
            <Ionicons name="warning" size={20} color="#f59e0b" />
            <Text style={styles.crisisText}>
              If you need immediate help, please call:{'\n'}
              <Text style={styles.crisisNumber}>Samaritans: 116 123</Text>{'\n'}
              <Text style={styles.crisisNumber}>Emergency: 999</Text>
            </Text>
          </View>

          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/home')}>
            <Text style={styles.homeButtonText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Request a Callback</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Intro */}
          <View style={styles.introSection}>
            <Ionicons name="call" size={48} color={colors.primary} />
            <Text style={styles.introText}>
              Can't call right now? Leave your details and we'll call you back.
            </Text>
          </View>

          {/* Type Selection */}
          <Text style={styles.sectionLabel}>Who would you like to speak with?</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeOption,
                requestType === 'counsellor' && styles.typeOptionSelected,
              ]}
              onPress={() => setRequestType('counsellor')}
              data-testid="type-counsellor-btn"
            >
              <Ionicons 
                name="medkit" 
                size={28} 
                color={requestType === 'counsellor' ? '#ffffff' : colors.textSecondary} 
              />
              <Text style={[
                styles.typeOptionText,
                requestType === 'counsellor' && styles.typeOptionTextSelected
              ]}>
                Counsellor
              </Text>
              <Text style={[
                styles.typeOptionSubtext,
                requestType === 'counsellor' && styles.typeOptionSubtextSelected
              ]}>
                Professional support
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeOption,
                requestType === 'peer' && styles.typeOptionSelected,
              ]}
              onPress={() => setRequestType('peer')}
              data-testid="type-peer-btn"
            >
              <Ionicons 
                name="people" 
                size={28} 
                color={requestType === 'peer' ? '#ffffff' : colors.textSecondary} 
              />
              <Text style={[
                styles.typeOptionText,
                requestType === 'peer' && styles.typeOptionTextSelected
              ]}>
                Peer Supporter
              </Text>
              <Text style={[
                styles.typeOptionSubtext,
                requestType === 'peer' && styles.typeOptionSubtextSelected
              ]}>
                Fellow veteran
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.inputLabel}>Your Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={colors.textMuted}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              data-testid="callback-name-input"
            />

            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor={colors.textMuted}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
              data-testid="callback-phone-input"
            />

            <Text style={styles.inputLabel}>Email (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email for confirmation"
              placeholderTextColor={colors.textMuted}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              data-testid="callback-email-input"
            />

            <Text style={styles.inputLabel}>Message *</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              placeholder="How can we help you?"
              placeholderTextColor={colors.textMuted}
              value={formData.message}
              onChangeText={(text) => setFormData({ ...formData, message: text })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              data-testid="callback-message-input"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            data-testid="callback-submit-btn"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#ffffff" />
                <Text style={styles.submitButtonText}>Request Callback</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark" size={16} color={colors.textMuted} />
            <Text style={styles.privacyText}>
              Your information is confidential and will only be used to contact you.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
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
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  introSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  introText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeOption: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  typeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  typeOptionTextSelected: {
    color: '#ffffff',
  },
  typeOptionSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  typeOptionSubtextSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  form: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  messageInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  // Success screen styles
  successContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
  },
  crisisBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  crisisText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  crisisNumber: {
    fontWeight: '700',
    color: '#f59e0b',
  },
  homeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
