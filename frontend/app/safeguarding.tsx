import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

export default function SafeguardingPolicy() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const callEmergency = () => {
    Linking.openURL('tel:999');
  };

  const callSamaritans = () => {
    Linking.openURL('tel:116123');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safeguarding Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Emergency Banner */}
        <TouchableOpacity style={styles.emergencyBanner} onPress={callEmergency}>
          <Ionicons name="warning" size={24} color="#fff" />
          <View style={styles.emergencyText}>
            <Text style={styles.emergencyTitle}>In Immediate Danger?</Text>
            <Text style={styles.emergencySubtitle}>Tap here to call 999</Text>
          </View>
          <Ionicons name="call" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Introduction */}
        <Text style={styles.sectionTitle}>Our Commitment</Text>
        <Text style={styles.paragraph}>
          Radio Check is committed to safeguarding all users. We follow best practices 
          aligned with BACP (British Association for Counselling and Psychotherapy) 
          ethical guidelines and UK safeguarding legislation.
        </Text>

        {/* What is Safeguarding */}
        <Text style={styles.sectionTitle}>What is Safeguarding?</Text>
        <Text style={styles.paragraph}>
          Safeguarding means protecting people's health, wellbeing and human rights, 
          enabling them to live free from harm, abuse and neglect. In the context of 
          Radio Check, this includes:
        </Text>

        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
            <Text style={styles.bulletText}>Protecting users from harm or exploitation</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
            <Text style={styles.bulletText}>Identifying signs of distress or risk</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
            <Text style={styles.bulletText}>Responding appropriately to safeguarding concerns</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
            <Text style={styles.bulletText}>Signposting to professional services when needed</Text>
          </View>
        </View>

        {/* AI Limitations */}
        <Text style={styles.sectionTitle}>AI Support Limitations</Text>
        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={24} color="#f59e0b" />
          <Text style={styles.warningText}>
            Our AI companions (Sentry, Bob, Margie, Hugo, etc.) are NOT trained counsellors 
            or mental health professionals. They provide peer-style support and information 
            but cannot replace professional mental health services.
          </Text>
        </View>

        {/* When We Take Action */}
        <Text style={styles.sectionTitle}>When We Take Action</Text>
        <Text style={styles.paragraph}>
          If our system detects any of the following, we may escalate to a human volunteer 
          or recommend professional support:
        </Text>

        <View style={styles.riskCard}>
          <Text style={styles.riskTitle}>Immediate Risk Indicators</Text>
          <Text style={styles.riskItem}>• Suicidal thoughts or plans</Text>
          <Text style={styles.riskItem}>• Self-harm intentions</Text>
          <Text style={styles.riskItem}>• Harm to others</Text>
          <Text style={styles.riskItem}>• Abuse disclosure (self or others)</Text>
          <Text style={styles.riskItem}>• Safeguarding concerns involving children</Text>
        </View>

        {/* Confidentiality */}
        <Text style={styles.sectionTitle}>Confidentiality & Its Limits</Text>
        <Text style={styles.paragraph}>
          We respect your privacy and maintain confidentiality, however there are legal 
          exceptions where we may need to share information:
        </Text>

        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.bulletText}>Risk of serious harm to you or others</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.bulletText}>Disclosure of abuse involving children</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.bulletText}>Court orders or legal requirements</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.bulletText}>Prevention of terrorism (UK law)</Text>
          </View>
        </View>

        {/* Our Staff */}
        <Text style={styles.sectionTitle}>Our Volunteers & Staff</Text>
        <Text style={styles.paragraph}>
          All Radio Check volunteers and staff who provide peer support are:
        </Text>

        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={styles.bulletText}>DBS checked (Enhanced)</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={styles.bulletText}>Trained in safeguarding awareness</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={styles.bulletText}>Supervised by qualified professionals</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={styles.bulletText}>Bound by confidentiality agreements</Text>
          </View>
        </View>

        {/* Getting Help */}
        <Text style={styles.sectionTitle}>Getting Help Now</Text>

        <TouchableOpacity style={styles.helpCard} onPress={callSamaritans}>
          <View style={styles.helpIcon}>
            <Ionicons name="call" size={24} color="#22c55e" />
          </View>
          <View style={styles.helpInfo}>
            <Text style={styles.helpTitle}>Samaritans</Text>
            <Text style={styles.helpNumber}>116 123</Text>
            <Text style={styles.helpDescription}>Free, 24/7, confidential support</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.helpCard} 
          onPress={() => Linking.openURL('tel:08001111111')}
        >
          <View style={styles.helpIcon}>
            <Ionicons name="medkit" size={24} color="#3b82f6" />
          </View>
          <View style={styles.helpInfo}>
            <Text style={styles.helpTitle}>Combat Stress</Text>
            <Text style={styles.helpNumber}>0800 138 1619</Text>
            <Text style={styles.helpDescription}>Veterans mental health helpline</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.helpCard} 
          onPress={() => Linking.openURL('tel:08088021212')}
        >
          <View style={styles.helpIcon}>
            <Ionicons name="people" size={24} color="#8b5cf6" />
          </View>
          <View style={styles.helpInfo}>
            <Text style={styles.helpTitle}>Veterans Gateway</Text>
            <Text style={styles.helpNumber}>0808 802 1212</Text>
            <Text style={styles.helpDescription}>First point of contact for veterans</Text>
          </View>
        </TouchableOpacity>

        {/* Report a Concern */}
        <View style={styles.reportCard}>
          <Ionicons name="flag" size={24} color={colors.primary} />
          <Text style={styles.reportTitle}>Report a Safeguarding Concern</Text>
          <Text style={styles.reportText}>
            If you have concerns about your own safety or another user's safety, 
            please contact us immediately at:
          </Text>
          <Text style={styles.reportEmail}>safeguarding@radiocheck.me</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This policy was last updated in February 2026 and is reviewed annually.
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
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  emergencyText: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  emergencySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    marginTop: 16,
  },
  paragraph: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 12,
  },
  bulletList: {
    marginBottom: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 19,
  },
  riskCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 10,
  },
  riskItem: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 22,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  helpInfo: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  helpNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    marginVertical: 2,
  },
  helpDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  reportText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
  },
  reportEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  footer: {
    paddingVertical: 20,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
