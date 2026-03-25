import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last Updated: February 2026</Text>

        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Radio Check ("we", "our", "us") is committed to protecting the privacy of UK veterans 
          and their families. This Privacy Policy explains how we collect, use, and safeguard 
          your personal information when you use our mobile application and services.
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        
        <Text style={styles.subTitle}>Account Information</Text>
        <Text style={styles.paragraph}>
          • Email address{'\n'}
          • Name (optional){'\n'}
          • Password (encrypted){'\n'}
          • Service branch and regiment (optional)
        </Text>

        <Text style={styles.subTitle}>Chat & Communication Data</Text>
        <Text style={styles.paragraph}>
          • Messages with AI companions{'\n'}
          • Messages with peer supporters (Buddy Finder){'\n'}
          • Callback requests{'\n'}
          • Call logs (metadata only, calls are peer-to-peer)
        </Text>

        <Text style={styles.subTitle}>Technical Data</Text>
        <Text style={styles.paragraph}>
          • Device type and operating system{'\n'}
          • IP address (for security purposes){'\n'}
          • App usage statistics
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use your information to:{'\n\n'}
          • Provide AI-powered support and companionship{'\n'}
          • Connect you with peer supporters{'\n'}
          • Detect and respond to crisis situations (safeguarding){'\n'}
          • Improve our services and AI responses{'\n'}
          • Send important service notifications{'\n'}
          • Comply with legal obligations
        </Text>

        <Text style={styles.sectionTitle}>4. AI Chat Processing</Text>
        <Text style={styles.paragraph}>
          When you chat with our AI companions, your messages are processed by OpenAI's 
          language models to generate supportive responses. We do not share your identity 
          with OpenAI. Chat data is also analyzed locally to detect potential crisis 
          situations and trigger our safeguarding protocols.
        </Text>

        <Text style={styles.sectionTitle}>5. Safeguarding</Text>
        <Text style={styles.paragraph}>
          Your safety is our priority. Our system automatically monitors conversations for 
          signs of crisis, including:{'\n\n'}
          • Expressions of suicidal ideation{'\n'}
          • Self-harm indicators{'\n'}
          • Severe distress signals{'\n\n'}
          If detected, our safeguarding team may be alerted and may reach out to offer 
          support. In extreme cases, we may contact emergency services if we believe 
          there is immediate risk to life.
        </Text>

        <Text style={styles.sectionTitle}>6. Data Security</Text>
        <Text style={styles.paragraph}>
          We implement robust security measures including:{'\n\n'}
          • AES-256 encryption for sensitive data{'\n'}
          • Secure password hashing (bcrypt){'\n'}
          • HTTPS for all data transmission{'\n'}
          • Regular security audits{'\n'}
          • Access controls and staff training
        </Text>

        <Text style={styles.sectionTitle}>7. Data Retention</Text>
        <Text style={styles.paragraph}>
          • Account data: Retained while your account is active, plus 7 years after deletion{'\n'}
          • Chat history: 7 years (for safeguarding audit purposes){'\n'}
          • Technical logs: 90 days{'\n\n'}
          You can request data deletion at any time through the app settings.
        </Text>

        <Text style={styles.sectionTitle}>8. Your Rights (GDPR)</Text>
        <Text style={styles.paragraph}>
          Under UK data protection law, you have the right to:{'\n\n'}
          • Access your personal data{'\n'}
          • Correct inaccurate data{'\n'}
          • Request deletion of your data{'\n'}
          • Export your data in a portable format{'\n'}
          • Object to certain processing{'\n'}
          • Withdraw consent{'\n\n'}
          To exercise these rights, go to Settings {'>'} Privacy in the app, or contact us 
          at privacy@radiocheck.me
        </Text>

        <Text style={styles.sectionTitle}>9. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          We use the following third-party services:{'\n\n'}
          • OpenAI: AI chat processing (USA, with Standard Contractual Clauses){'\n'}
          • MongoDB Atlas: Database hosting (UK/EU){'\n'}
          • Render: Application hosting (EU){'\n'}
          • Expo: Mobile app services
        </Text>

        <Text style={styles.sectionTitle}>10. Children's Privacy</Text>
        <Text style={styles.paragraph}>
          Radio Check is intended for adults (18+). We do not knowingly collect personal 
          information from children under 18. If you believe a child has provided us with 
          personal information, please contact us immediately.
        </Text>

        <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of 
          significant changes through the app or by email. Your continued use of the 
          app after changes constitutes acceptance of the updated policy.
        </Text>

        <Text style={styles.sectionTitle}>12. Contact Us</Text>
        <Text style={styles.paragraph}>
          For privacy-related queries:{'\n\n'}
          Email: privacy@radiocheck.me{'\n\n'}
          For complaints, you may also contact the Information Commissioner's Office (ICO):{'\n'}
          ico.org.uk
        </Text>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 24,
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  footer: {
    height: 40,
  },
});
