import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../src/config/api';
import { goBack } from '../src/utils/navigation';

// PHQ-9 Questions (Depression Screening)
const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead or of hurting yourself in some way"
];

// GAD-7 Questions (Anxiety Screening)
const GAD7_QUESTIONS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it's hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen"
];

const ANSWER_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" }
];

type AssessmentType = 'phq9' | 'gad7' | null;

interface AssessmentResult {
  type: AssessmentType;
  score: number;
  date: string;
  answers: number[];
}

export default function MentalHealthScreening() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [activeAssessment, setActiveAssessment] = useState<AssessmentType>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [history, setHistory] = useState<AssessmentResult[]>([]);

  // API_URL is imported from config

  const questions = activeAssessment === 'phq9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS;

  const startAssessment = (type: AssessmentType) => {
    setActiveAssessment(type);
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
    setResult(null);
  };

  const selectAnswer = (value: number) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Assessment complete
      const score = newAnswers.reduce((sum, val) => sum + val, 0);
      const newResult: AssessmentResult = {
        type: activeAssessment,
        score,
        date: new Date().toISOString(),
        answers: newAnswers
      };
      setResult(newResult);
      setShowResults(true);
      saveResult(newResult);
    }
  };

  const saveResult = async (newResult: AssessmentResult) => {
    try {
      const key = `screening_history_${activeAssessment}`;
      const existing = await AsyncStorage.getItem(key);
      const history = existing ? JSON.parse(existing) : [];
      history.unshift(newResult);
      // Keep last 10 results
      await AsyncStorage.setItem(key, JSON.stringify(history.slice(0, 10)));
    } catch (error) {
      console.error('Error saving result:', error);
    }
  };

  const getScoreInterpretation = (type: AssessmentType, score: number) => {
    if (type === 'phq9') {
      if (score <= 4) return { level: 'Minimal', color: '#22c55e', description: 'Your symptoms suggest minimal depression. Continue with self-care practices.' };
      if (score <= 9) return { level: 'Mild', color: '#84cc16', description: 'Your symptoms suggest mild depression. Consider talking to someone you trust.' };
      if (score <= 14) return { level: 'Moderate', color: '#f59e0b', description: 'Your symptoms suggest moderate depression. We recommend speaking with a professional.' };
      if (score <= 19) return { level: 'Moderately Severe', color: '#f97316', description: 'Your symptoms suggest moderately severe depression. Please consider reaching out for support.' };
      return { level: 'Severe', color: '#ef4444', description: 'Your symptoms suggest severe depression. We strongly encourage you to speak with a professional.' };
    } else {
      if (score <= 4) return { level: 'Minimal', color: '#22c55e', description: 'Your symptoms suggest minimal anxiety. Continue with healthy coping strategies.' };
      if (score <= 9) return { level: 'Mild', color: '#84cc16', description: 'Your symptoms suggest mild anxiety. Consider relaxation techniques and self-care.' };
      if (score <= 14) return { level: 'Moderate', color: '#f59e0b', description: 'Your symptoms suggest moderate anxiety. Speaking with someone may help.' };
      return { level: 'Severe', color: '#ef4444', description: 'Your symptoms suggest severe anxiety. We encourage you to seek professional support.' };
    }
  };

  const shareWithCounsellor = async () => {
    if (!result) return;

    try {
      const userData = await AsyncStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;
      
      const interpretation = getScoreInterpretation(result.type, result.score);
      
      const response = await fetch(`${API_URL}/api/safeguarding/concern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id || 'anonymous',
          user_name: user?.name || 'App User',
          concern_type: 'mental_health_screening',
          severity: interpretation.level.toLowerCase().includes('severe') ? 'high' : 
                   interpretation.level.toLowerCase().includes('moderate') ? 'medium' : 'low',
          details: `${result.type?.toUpperCase()} Screening Result\n\nScore: ${result.score}/${result.type === 'phq9' ? 27 : 21}\nLevel: ${interpretation.level}\n\nUser Message: ${shareMessage || 'No additional message provided.'}\n\nDate: ${new Date(result.date).toLocaleString()}`,
          source: 'app_screening'
        })
      });

      if (response.ok) {
        Alert.alert(
          'Results Shared',
          'Your screening results have been shared with our support team. A counsellor will be in touch soon.',
          [{ text: 'OK', onPress: () => setShowShareModal(false) }]
        );
      } else {
        throw new Error('Failed to share');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to share results. Please try again or contact us directly.');
    }
  };

  const resetAssessment = () => {
    setActiveAssessment(null);
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
    setResult(null);
  };

  const styles = createStyles(colors);

  // Results Screen
  if (showResults && result) {
    const interpretation = getScoreInterpretation(result.type, result.score);
    const maxScore = result.type === 'phq9' ? 27 : 21;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={resetAssessment} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Your Results</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.container} contentContainerStyle={styles.resultsContent}>
          <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: interpretation.color }]}>
            <Text style={[styles.assessmentLabel, { color: colors.textSecondary }]}>
              {result.type === 'phq9' ? 'PHQ-9 Depression Screening' : 'GAD-7 Anxiety Screening'}
            </Text>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreNumber, { color: interpretation.color }]}>{result.score}</Text>
              <Text style={[styles.scoreMax, { color: colors.textSecondary }]}>/ {maxScore}</Text>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: interpretation.color + '20' }]}>
              <Text style={[styles.levelText, { color: interpretation.color }]}>{interpretation.level}</Text>
            </View>
            <Text style={[styles.interpretation, { color: colors.textSecondary }]}>
              {interpretation.description}
            </Text>
          </View>

          {/* Warning for high scores */}
          {(result.type === 'phq9' && result.score >= 15) || (result.type === 'gad7' && result.score >= 15) ? (
            <View style={styles.warningCard}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.warningText}>
                If you're having thoughts of self-harm or suicide, please call Samaritans now on 116 123 (free, 24/7) or text SHOUT to 85258.
              </Text>
            </View>
          ) : null}

          {/* PHQ-9 Question 9 Warning */}
          {result.type === 'phq9' && result.answers[8] > 0 && (
            <View style={styles.warningCard}>
              <Ionicons name="heart" size={24} color="#ef4444" />
              <Text style={styles.warningText}>
                You indicated thoughts of self-harm. Please reach out - Samaritans: 116 123, Combat Stress: 0800 138 1619
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: '#3b82f6' }]}
            onPress={() => setShowShareModal(true)}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            <Text style={styles.shareButtonText}>Share with a Counsellor</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={resetAssessment}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Take Another Assessment</Text>
          </TouchableOpacity>

          <View style={styles.resourcesSection}>
            <Text style={[styles.resourcesTitle, { color: colors.text }]}>Helpful Resources</Text>
            <TouchableOpacity style={[styles.resourceItem, { backgroundColor: colors.surface }]} onPress={() => router.push('/breathing-game')}>
              <Ionicons name="cloud" size={20} color="#06b6d4" />
              <Text style={[styles.resourceText, { color: colors.text }]}>Breathing Exercises</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resourceItem, { backgroundColor: colors.surface }]} onPress={() => router.push('/grounding')}>
              <Ionicons name="hand-left" size={20} color="#22c55e" />
              <Text style={[styles.resourceText, { color: colors.text }]}>Grounding Techniques</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resourceItem, { backgroundColor: colors.surface }]} onPress={() => router.push('/crisis-support')}>
              <Ionicons name="call" size={20} color="#ef4444" />
              <Text style={[styles.resourceText, { color: colors.text }]}>Crisis Support</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Share Modal */}
        <Modal visible={showShareModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Share with Counsellor</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Your {result.type?.toUpperCase()} score of {result.score} will be shared securely with our support team.
              </Text>
              <TextInput
                style={[styles.messageInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Add a message (optional)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                value={shareMessage}
                onChangeText={setShareMessage}
              />
              <TouchableOpacity style={[styles.shareButton, { backgroundColor: '#22c55e' }]} onPress={shareWithCounsellor}>
                <Text style={styles.shareButtonText}>Send to Counsellor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowShareModal(false)}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Assessment Questions Screen
  if (activeAssessment) {
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={resetAssessment} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {activeAssessment === 'phq9' ? 'PHQ-9' : 'GAD-7'}
          </Text>
          <Text style={[styles.questionCount, { color: colors.textSecondary }]}>
            {currentQuestion + 1}/{questions.length}
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <ScrollView style={styles.container} contentContainerStyle={styles.questionContent}>
          <Text style={[styles.questionPrompt, { color: colors.textSecondary }]}>
            Over the last 2 weeks, how often have you been bothered by:
          </Text>
          <Text style={[styles.questionText, { color: colors.text }]}>
            {questions[currentQuestion]}
          </Text>

          <View style={styles.optionsContainer}>
            {ANSWER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => selectAnswer(option.value)}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIndicator, { borderColor: colors.border }]}>
                  <Text style={[styles.optionValue, { color: colors.textSecondary }]}>{option.value}</Text>
                </View>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main Selection Screen
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mental Health Check</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.introSection}>
          <View style={[styles.introIcon, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="clipboard" size={40} color="#3b82f6" />
          </View>
          <Text style={[styles.introTitle, { color: colors.text }]}>
            Self-Assessment Tools
          </Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            These clinically validated questionnaires can help you understand how you've been feeling. 
            Your responses are private and can be shared with a counsellor if you choose.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.assessmentCard, { backgroundColor: colors.surface, borderColor: '#3b82f6' }]}
          onPress={() => startAssessment('phq9')}
          activeOpacity={0.8}
        >
          <View style={styles.assessmentHeader}>
            <View style={[styles.assessmentIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="sad" size={28} color="#3b82f6" />
            </View>
            <View style={styles.assessmentInfo}>
              <Text style={[styles.assessmentTitle, { color: colors.text }]}>PHQ-9</Text>
              <Text style={[styles.assessmentSubtitle, { color: colors.textSecondary }]}>Depression Screening</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </View>
          <Text style={[styles.assessmentDesc, { color: colors.textSecondary }]}>
            9 questions • Takes about 2 minutes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.assessmentCard, { backgroundColor: colors.surface, borderColor: '#8b5cf6' }]}
          onPress={() => startAssessment('gad7')}
          activeOpacity={0.8}
        >
          <View style={styles.assessmentHeader}>
            <View style={[styles.assessmentIcon, { backgroundColor: '#ede9fe' }]}>
              <Ionicons name="pulse" size={28} color="#8b5cf6" />
            </View>
            <View style={styles.assessmentInfo}>
              <Text style={[styles.assessmentTitle, { color: colors.text }]}>GAD-7</Text>
              <Text style={[styles.assessmentSubtitle, { color: colors.textSecondary }]}>Anxiety Screening</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </View>
          <Text style={[styles.assessmentDesc, { color: colors.textSecondary }]}>
            7 questions • Takes about 2 minutes
          </Text>
        </TouchableOpacity>

        <View style={[styles.disclaimerCard, { backgroundColor: colors.surface }]}>
          <Ionicons name="information-circle" size={20} color={colors.textSecondary} />
          <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            These tools are for self-assessment only and do not replace professional diagnosis. 
            If you're concerned about your mental health, please speak to a healthcare professional.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  questionCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  introSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  introText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  assessmentCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  assessmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  assessmentIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  assessmentInfo: {
    flex: 1,
  },
  assessmentTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  assessmentSubtitle: {
    fontSize: 14,
  },
  assessmentDesc: {
    fontSize: 13,
    marginLeft: 66,
  },
  disclaimerCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  questionContent: {
    padding: 24,
  },
  questionPrompt: {
    fontSize: 14,
    marginBottom: 16,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionLabel: {
    fontSize: 16,
    flex: 1,
  },
  resultsContent: {
    padding: 20,
  },
  scoreCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 20,
  },
  assessmentLabel: {
    fontSize: 14,
    marginBottom: 16,
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: '700',
  },
  scoreMax: {
    fontSize: 24,
    fontWeight: '600',
  },
  levelBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  interpretation: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  warningText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 14,
    lineHeight: 20,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resourcesSection: {
    marginTop: 8,
  },
  resourcesTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 8,
  },
  resourceText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
  },
});
