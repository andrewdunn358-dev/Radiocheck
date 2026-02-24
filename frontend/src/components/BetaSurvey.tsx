/**
 * Beta Survey Component
 * Shows pre-survey on first app open, post-survey after 7 days
 * Controlled by feature flag in admin portal
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';

interface BetaSurveyProps {
  userId: string;
}

type SurveyType = 'pre' | 'post' | null;

export default function BetaSurvey({ userId }: BetaSurveyProps) {
  const { colors, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [surveyType, setSurveyType] = useState<SurveyType>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  
  // Survey responses
  const [wellbeing, setWellbeing] = useState(5);
  const [anxiety, setAnxiety] = useState(0);
  const [mood, setMood] = useState(0);
  const [hopes, setHopes] = useState('');
  const [appHelped, setAppHelped] = useState(3);
  const [recommend, setRecommend] = useState(7);
  const [usefulFeature, setUsefulFeature] = useState('');
  const [improvements, setImprovements] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    checkSurveyStatus();
  }, [userId]);

  const checkSurveyStatus = async () => {
    try {
      // First check if beta testing is enabled
      const betaRes = await fetch(`${API_URL}/api/surveys/beta-enabled`);
      const betaData = await betaRes.json();
      
      if (!betaData.beta_enabled) {
        setLoading(false);
        return;
      }

      // Check user's survey status
      const statusRes = await fetch(`${API_URL}/api/surveys/status/${userId}`);
      const status = await statusRes.json();

      if (!status.pre_completed) {
        // Show pre-survey
        setSurveyType('pre');
        setVisible(true);
      } else if (status.show_post_survey) {
        // Show post-survey (7+ days since pre-survey)
        setSurveyType('post');
        setVisible(true);
      }
    } catch (error) {
      console.error('Error checking survey status:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitSurvey = async () => {
    setSubmitting(true);
    try {
      const endpoint = surveyType === 'pre' ? '/api/surveys/pre' : '/api/surveys/post';
      
      const body = surveyType === 'pre' 
        ? {
            user_id: userId,
            wellbeing_score: wellbeing,
            anxiety_level: anxiety,
            mood_level: mood,
            hopes: hopes,
          }
        : {
            user_id: userId,
            wellbeing_score: wellbeing,
            anxiety_level: anxiety,
            mood_level: mood,
            app_helped: appHelped,
            would_recommend: recommend,
            most_useful_feature: usefulFeature,
            improvements: improvements,
            additional_feedback: feedback,
          };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setVisible(false);
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const skipSurvey = async () => {
    // Allow skipping but remind later
    setVisible(false);
  };

  if (loading || !visible) return null;

  const styles = createStyles(colors, isDark);

  // Pre-survey content
  const renderPreSurvey = () => (
    <>
      <Text style={styles.title}>Welcome to Radio Check Beta</Text>
      <Text style={styles.subtitle}>
        Help us improve by answering a few quick questions. This takes about 1 minute.
      </Text>

      {step === 1 && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>How are you feeling today?</Text>
          <Text style={styles.hint}>1 = Very low, 10 = Great</Text>
          <View style={styles.scaleContainer}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <Pressable
                key={n}
                style={[styles.scaleButton, wellbeing === n && styles.scaleButtonActive]}
                onPress={() => setWellbeing(n)}
              >
                <Text style={[styles.scaleText, wellbeing === n && styles.scaleTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.nextButton} onPress={() => setStep(2)}>
            <Text style={styles.nextButtonText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>Over the last 2 weeks, how often have you felt nervous, anxious, or on edge?</Text>
          {[
            { value: 0, label: 'Not at all' },
            { value: 1, label: 'Several days' },
            { value: 2, label: 'More than half the days' },
            { value: 3, label: 'Nearly every day' },
          ].map(opt => (
            <Pressable
              key={opt.value}
              style={[styles.optionButton, anxiety === opt.value && styles.optionButtonActive]}
              onPress={() => setAnxiety(opt.value)}
            >
              <Text style={[styles.optionText, anxiety === opt.value && styles.optionTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
          <View style={styles.buttonRow}>
            <Pressable style={styles.backButton} onPress={() => setStep(1)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.nextButton} onPress={() => setStep(3)}>
              <Text style={styles.nextButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>Over the last 2 weeks, how often have you felt down, depressed, or hopeless?</Text>
          {[
            { value: 0, label: 'Not at all' },
            { value: 1, label: 'Several days' },
            { value: 2, label: 'More than half the days' },
            { value: 3, label: 'Nearly every day' },
          ].map(opt => (
            <Pressable
              key={opt.value}
              style={[styles.optionButton, mood === opt.value && styles.optionButtonActive]}
              onPress={() => setMood(opt.value)}
            >
              <Text style={[styles.optionText, mood === opt.value && styles.optionTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
          <View style={styles.buttonRow}>
            <Pressable style={styles.backButton} onPress={() => setStep(2)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.nextButton} onPress={() => setStep(4)}>
              <Text style={styles.nextButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 4 && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>What do you hope to get from this app? (Optional)</Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Tell us what support you're looking for..."
            placeholderTextColor={colors.textMuted}
            value={hopes}
            onChangeText={setHopes}
          />
          <View style={styles.buttonRow}>
            <Pressable style={styles.backButton} onPress={() => setStep(3)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submitSurvey} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </>
  );

  // Post-survey content
  const renderPostSurvey = () => (
    <>
      <Text style={styles.title}>How's it going?</Text>
      <Text style={styles.subtitle}>
        You've been using Radio Check for a week. We'd love your feedback!
      </Text>

      {step === 1 && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>How are you feeling now?</Text>
          <Text style={styles.hint}>1 = Very low, 10 = Great</Text>
          <View style={styles.scaleContainer}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <Pressable
                key={n}
                style={[styles.scaleButton, wellbeing === n && styles.scaleButtonActive]}
                onPress={() => setWellbeing(n)}
              >
                <Text style={[styles.scaleText, wellbeing === n && styles.scaleTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.nextButton} onPress={() => setStep(2)}>
            <Text style={styles.nextButtonText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>Has the app helped you?</Text>
          {[
            { value: 1, label: 'Not at all' },
            { value: 2, label: 'A little' },
            { value: 3, label: 'Somewhat' },
            { value: 4, label: 'Quite a bit' },
            { value: 5, label: 'Very much' },
          ].map(opt => (
            <Pressable
              key={opt.value}
              style={[styles.optionButton, appHelped === opt.value && styles.optionButtonActive]}
              onPress={() => setAppHelped(opt.value)}
            >
              <Text style={[styles.optionText, appHelped === opt.value && styles.optionTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
          <View style={styles.buttonRow}>
            <Pressable style={styles.backButton} onPress={() => setStep(1)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.nextButton} onPress={() => setStep(3)}>
              <Text style={styles.nextButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>How likely are you to recommend Radio Check to a friend?</Text>
          <Text style={styles.hint}>0 = Not likely, 10 = Very likely</Text>
          <View style={styles.scaleContainer}>
            {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
              <Pressable
                key={n}
                style={[styles.scaleButton, recommend === n && styles.scaleButtonActive, { minWidth: 28 }]}
                onPress={() => setRecommend(n)}
              >
                <Text style={[styles.scaleText, recommend === n && styles.scaleTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.backButton} onPress={() => setStep(2)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.nextButton} onPress={() => setStep(4)}>
              <Text style={styles.nextButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 4 && (
        <View style={styles.questionContainer}>
          <Text style={styles.question}>What feature did you find most useful?</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., AI chat, peer support, self-care tools..."
            placeholderTextColor={colors.textMuted}
            value={usefulFeature}
            onChangeText={setUsefulFeature}
          />
          <Text style={[styles.question, { marginTop: 16 }]}>What could we improve?</Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Any suggestions or feedback..."
            placeholderTextColor={colors.textMuted}
            value={improvements}
            onChangeText={setImprovements}
          />
          <View style={styles.buttonRow}>
            <Pressable style={styles.backButton} onPress={() => setStep(3)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submitSurvey} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={skipSurvey}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Pressable style={styles.closeButton} onPress={skipSurvey}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.iconContainer}>
              <Ionicons name="clipboard-outline" size={40} color={colors.primary} />
            </View>
            
            {surveyType === 'pre' ? renderPreSurvey() : renderPostSurvey()}
            
            <Pressable style={styles.skipButton} onPress={skipSurvey}>
              <Text style={styles.skipText}>Remind me later</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  questionContainer: {
    marginBottom: 16,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  scaleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  scaleButton: {
    minWidth: 32,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scaleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scaleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scaleTextActive: {
    color: '#fff',
  },
  optionButton: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  backButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
  skipButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  skipText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
