import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutPage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Radio Check</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* What Is Radio Check */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="radio" size={24} color="#3b82f6" />
            </View>
            <Text style={styles.sectionTitle}>What Is Radio Check?</Text>
          </View>
          <Text style={styles.sectionText}>
            Radio Check combines peer support and AI conversation to give veterans a place to talk when it matters.
          </Text>
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>
              {`Sometimes a real person isn't available straight away.`}{'\n'}
              {`When that happens, the chat is there — so you're not carrying things alone.`}
            </Text>
          </View>
          <Text style={styles.emphasisText}>
            Talking helps.{'\n'}Even talking here.
          </Text>
        </View>

        {/* What the AI Is For */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            </View>
            <Text style={styles.sectionTitle}>What the AI Is For</Text>
          </View>
          <Text style={styles.sectionSubtext}>The AI is here to:</Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#22c55e" />
              <Text style={styles.bulletText}>Listen without judgement</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#22c55e" />
              <Text style={styles.bulletText}>Help you slow things down</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#22c55e" />
              <Text style={styles.bulletText}>Let you get things off your chest</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#22c55e" />
              <Text style={styles.bulletText}>Encourage healthy coping and real-world support</Text>
            </View>
          </View>
          <Text style={styles.noteText}>{"You're always in control of the conversation."}</Text>
        </View>

        {/* What the AI Is Not For */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="close-circle" size={24} color="#dc2626" />
            </View>
            <Text style={styles.sectionTitle}>What the AI Is Not For</Text>
          </View>
          <Text style={styles.sectionSubtext}>The AI does not:</Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Ionicons name="close" size={18} color="#dc2626" />
              <Text style={styles.bulletText}>Give medical or legal advice</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="close" size={18} color="#dc2626" />
              <Text style={styles.bulletText}>Diagnose or treat conditions</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="close" size={18} color="#dc2626" />
              <Text style={styles.bulletText}>Replace professionals</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="close" size={18} color="#dc2626" />
              <Text style={styles.bulletText}>Handle emergencies on its own</Text>
            </View>
          </View>
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color="#f59e0b" />
            <Text style={styles.warningText}>
              {"If you're in immediate danger, human help matters most — and we'll always encourage that."}
            </Text>
          </View>
        </View>

        {/* Is This Right for Me */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="help-circle" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.sectionTitle}>Is This Right for Me?</Text>
          </View>
          <Text style={styles.sectionSubtext}>Radio Check may help if you:</Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Ionicons name="ellipse" size={8} color="#94a3b8" />
              <Text style={styles.bulletText}>Feel low, stressed, angry, or stuck</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="ellipse" size={8} color="#94a3b8" />
              <Text style={styles.bulletText}>Find it easier to talk in writing</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="ellipse" size={8} color="#94a3b8" />
              <Text style={styles.bulletText}>{"Don't want to feel like a burden"}</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="ellipse" size={8} color="#94a3b8" />
              <Text style={styles.bulletText}>Just need somewhere safe to talk</Text>
            </View>
          </View>
          <Text style={styles.emphasisText}>{"You don't need to be in crisis to use this."}</Text>
        </View>

        {/* Safety & Trust */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#ede9fe' }]}>
              <Ionicons name="shield-checkmark" size={24} color="#7c3aed" />
            </View>
            <Text style={styles.sectionTitle}>Safety & Trust</Text>
          </View>
          <View style={styles.trustGrid}>
            <View style={styles.trustItem}>
              <Ionicons name="shield" size={20} color="#7c3aed" />
              <Text style={styles.trustText}>Safeguarding comes first</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="heart" size={20} color="#7c3aed" />
              <Text style={styles.trustText}>Conversations handled with care</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="hand-left" size={20} color="#7c3aed" />
              <Text style={styles.trustText}>No judgement. No pressure.</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="lock-closed" size={20} color="#7c3aed" />
              <Text style={styles.trustText}>Your privacy matters</Text>
            </View>
          </View>
          <Text style={styles.noteText}>
            {"We're upfront about what this is — and what it isn't."}
          </Text>
        </View>

        {/* The Bottom Line */}
        <View style={styles.bottomLineSection}>
          <Text style={styles.bottomLineTitle}>The Bottom Line</Text>
          <Text style={styles.bottomLineText}>
            {"If Radio Check helps you feel even a little less alone, it's doing its job."}
          </Text>
          <View style={styles.signOffContainer}>
            <Ionicons name="radio" size={24} color="#22c55e" />
            <Text style={styles.signOffText}>Someone is on the net.</Text>
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity 
          style={styles.startButton}
          onPress={() => router.push('/home')}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Enter Radio Check</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 32,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  sectionText: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 24,
    marginBottom: 12,
  },
  sectionSubtext: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 12,
  },
  highlightBox: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  highlightText: {
    fontSize: 15,
    color: '#93c5fd',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  emphasisText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#22c55e',
    textAlign: 'center',
    marginTop: 8,
  },
  bulletList: {
    gap: 10,
    marginBottom: 12,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 4,
  },
  bulletText: {
    fontSize: 15,
    color: '#e2e8f0',
    flex: 1,
  },
  noteText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#451a03',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#fcd34d',
    flex: 1,
    lineHeight: 20,
  },
  trustGrid: {
    gap: 12,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
  },
  trustText: {
    fontSize: 15,
    color: '#e2e8f0',
  },
  bottomLineSection: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  bottomLineTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  bottomLineText: {
    fontSize: 16,
    color: '#93c5fd',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  signOffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  signOffText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d9488',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
