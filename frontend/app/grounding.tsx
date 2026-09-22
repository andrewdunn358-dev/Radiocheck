import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet,
  Vibration
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { goBack } from '../src/utils/navigation';

// Grounding techniques data
const GROUNDING_TECHNIQUES = [
  {
    id: '5-4-3-2-1',
    name: '5-4-3-2-1 Technique',
    desc: 'Use your senses to ground yourself in the present moment',
    icon: 'hand-left',
    color: '#3b82f6',
    steps: [
      { sense: 'SEE', count: 5, instruction: 'Name 5 things you can see around you', icon: 'eye' },
      { sense: 'TOUCH', count: 4, instruction: 'Name 4 things you can physically feel', icon: 'hand-left' },
      { sense: 'HEAR', count: 3, instruction: 'Name 3 things you can hear right now', icon: 'ear' },
      { sense: 'SMELL', count: 2, instruction: 'Name 2 things you can smell', icon: 'flower' },
      { sense: 'TASTE', count: 1, instruction: 'Name 1 thing you can taste', icon: 'restaurant' },
    ]
  },
  {
    id: 'box-breathing',
    name: 'Box Breathing',
    desc: 'Used by Navy SEALs and special forces to stay calm under pressure',
    icon: 'square-outline',
    color: '#10b981',
    duration: 4,
    phases: ['Breathe In', 'Hold', 'Breathe Out', 'Hold']
  },
  {
    id: 'cold-water',
    name: 'Cold Water Reset',
    desc: 'Splash cold water on your face to activate your dive reflex and calm your nervous system',
    icon: 'water',
    color: '#06b6d4',
    steps: [
      'Go to a sink or get a cold drink',
      'Splash cold water on your face',
      'Hold a cold object (ice, cold can) in your hands',
      'Focus on the cold sensation'
    ]
  },
  {
    id: 'body-scan',
    name: 'Quick Body Scan',
    desc: 'Check in with your body from head to toe',
    icon: 'body',
    color: '#8b5cf6',
    areas: ['Head & Face', 'Neck & Shoulders', 'Arms & Hands', 'Chest & Back', 'Stomach', 'Legs & Feet']
  },
  {
    id: 'grounding-statement',
    name: 'Grounding Statements',
    desc: 'Remind yourself where you are and that you are safe',
    icon: 'chatbubble',
    color: '#f59e0b',
    statements: [
      'My name is [your name]',
      'I am [your age] years old',
      'I am in [location]',
      'Today is [day/date]',
      'I am safe right now',
      'This feeling will pass'
    ]
  }
];

export default function GroundingPage() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [activeTechnique, setActiveTechnique] = useState<string | null>(null);
  const [breathingPhase, setBreathingPhase] = useState(0);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingCount, setBreathingCount] = useState(4);
  const [senseStep, setSenseStep] = useState(0);
  
  const styles = createStyles(colors, theme);

  // Box Breathing Timer
  const startBoxBreathing = () => {
    setBreathingActive(true);
    setBreathingPhase(0);
    setBreathingCount(4);
    
    const interval = setInterval(() => {
      setBreathingCount(prev => {
        if (prev <= 1) {
          setBreathingPhase(phase => {
            const nextPhase = (phase + 1) % 4;
            if (nextPhase === 0) {
              Vibration.vibrate(100);
            }
            return nextPhase;
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    // Store interval ID for cleanup
    return () => clearInterval(interval);
  };

  const stopBoxBreathing = () => {
    setBreathingActive(false);
    setBreathingPhase(0);
    setBreathingCount(4);
  };

  const renderTechniqueDetail = (technique: typeof GROUNDING_TECHNIQUES[0]) => {
    switch (technique.id) {
      case '5-4-3-2-1':
        return (
          <View style={styles.techniqueContent}>
            <Text style={styles.techniqueIntro}>
              Work through each sense, naming what you notice. Take your time.
            </Text>
            {technique.steps?.map((step, index) => (
              <TouchableOpacity 
                key={step.sense}
                style={[
                  styles.senseCard,
                  senseStep === index && styles.senseCardActive,
                  senseStep > index && styles.senseCardCompleted
                ]}
                onPress={() => setSenseStep(index)}
              >
                <View style={[styles.senseNumber, { backgroundColor: technique.color }]}>
                  <Text style={styles.senseNumberText}>{step.count}</Text>
                </View>
                <View style={styles.senseContent}>
                  <Text style={styles.senseName}>{step.sense}</Text>
                  <Text style={styles.senseInstruction}>{step.instruction}</Text>
                </View>
                {senseStep > index && (
                  <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.progressRow}>
              {technique.steps?.map((_, index) => (
                <View 
                  key={index}
                  style={[
                    styles.progressDot,
                    senseStep >= index && { backgroundColor: technique.color }
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity 
              style={styles.nextButton}
              onPress={() => setSenseStep(prev => Math.min(prev + 1, 4))}
            >
              <Text style={styles.nextButtonText}>
                {senseStep >= 4 ? 'Complete!' : 'Next Sense'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'box-breathing':
        const phases = technique.phases || [];
        return (
          <View style={styles.techniqueContent}>
            <Text style={styles.techniqueIntro}>
              Breathe in a square pattern: 4 seconds each phase. Used by elite military units worldwide.
            </Text>
            <View style={styles.breathingContainer}>
              <View style={[styles.breathingBox, { borderColor: technique.color }]}>
                <Text style={styles.breathingPhaseText}>
                  {phases[breathingPhase]}
                </Text>
                <Text style={styles.breathingCountText}>{breathingCount}</Text>
              </View>
              <View style={styles.breathingPhases}>
                {phases.map((phase, index) => (
                  <View 
                    key={phase}
                    style={[
                      styles.phaseIndicator,
                      breathingPhase === index && { backgroundColor: technique.color }
                    ]}
                  >
                    <Text style={[
                      styles.phaseText,
                      breathingPhase === index && styles.phaseTextActive
                    ]}>
                      {phase}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.startButton, { backgroundColor: breathingActive ? '#ef4444' : technique.color }]}
              onPress={breathingActive ? stopBoxBreathing : startBoxBreathing}
            >
              <Ionicons name={breathingActive ? 'stop' : 'play'} size={24} color="#fff" />
              <Text style={styles.startButtonText}>
                {breathingActive ? 'Stop' : 'Start Breathing'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'cold-water':
        return (
          <View style={styles.techniqueContent}>
            <Text style={styles.techniqueIntro}>
              Cold activates your vagus nerve and triggers the dive reflex, naturally calming your body.
            </Text>
            {technique.steps?.map((step, index) => (
              <View key={index} style={styles.stepCard}>
                <View style={[styles.stepNumber, { backgroundColor: technique.color }]}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        );

      case 'body-scan':
        return (
          <View style={styles.techniqueContent}>
            <Text style={styles.techniqueIntro}>
              Notice each area without judgment. Just observe what you feel.
            </Text>
            {technique.areas?.map((area, index) => (
              <View key={area} style={styles.areaCard}>
                <Ionicons name="ellipse" size={12} color={technique.color} />
                <Text style={styles.areaText}>{area}</Text>
                <Text style={styles.areaPrompt}>Notice any tension or sensation</Text>
              </View>
            ))}
          </View>
        );

      case 'grounding-statement':
        return (
          <View style={styles.techniqueContent}>
            <Text style={styles.techniqueIntro}>
              Say these out loud or in your head. Fill in your own details.
            </Text>
            {technique.statements?.map((statement, index) => (
              <View key={index} style={styles.statementCard}>
                <Text style={styles.statementText}>{statement}</Text>
              </View>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => activeTechnique ? setActiveTechnique(null) : goBack(router)} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeTechnique 
            ? GROUNDING_TECHNIQUES.find(t => t.id === activeTechnique)?.name 
            : 'Grounding Techniques'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!activeTechnique ? (
          <>
            {/* Introduction */}
            <View style={styles.introCard}>
              <Ionicons name="shield-checkmark" size={40} color="#3b82f6" />
              <Text style={styles.introTitle}>Ground Yourself</Text>
              <Text style={styles.introText}>
                When anxiety, flashbacks, or panic hit, these techniques can help bring you back to the present moment. 
                They&apos;re used by military personnel worldwide.
              </Text>
            </View>

            {/* Technique Cards */}
            {GROUNDING_TECHNIQUES.map((technique) => (
              <TouchableOpacity 
                key={technique.id}
                style={styles.techniqueCard}
                onPress={() => {
                  setActiveTechnique(technique.id);
                  setSenseStep(0);
                  setBreathingActive(false);
                }}
              >
                <View style={[styles.techniqueIcon, { backgroundColor: technique.color + '20' }]}>
                  <Ionicons name={technique.icon as any} size={28} color={technique.color} />
                </View>
                <View style={styles.techniqueInfo}>
                  <Text style={styles.techniqueName}>{technique.name}</Text>
                  <Text style={styles.techniqueDesc}>{technique.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </TouchableOpacity>
            ))}

            {/* Emergency Note */}
            <View style={styles.emergencyNote}>
              <Ionicons name="information-circle" size={20} color="#64748b" />
              <Text style={styles.emergencyNoteText}>
                If you&apos;re in crisis, call Samaritans on 116 123 or Combat Stress on 0800 138 1619
              </Text>
            </View>
          </>
        ) : (
          renderTechniqueDetail(GROUNDING_TECHNIQUES.find(t => t.id === activeTechnique)!)
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, theme: string) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Intro Card
  introCard: {
    backgroundColor: theme === 'dark' ? '#1e3a5f' : '#eff6ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  introText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Technique Cards
  techniqueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  techniqueIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  techniqueInfo: {
    flex: 1,
    marginLeft: 12,
  },
  techniqueName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  techniqueDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Technique Content
  techniqueContent: {
    paddingTop: 8,
  },
  techniqueIntro: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },

  // 5-4-3-2-1 Styles
  senseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  senseCardActive: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  senseCardCompleted: {
    opacity: 0.7,
  },
  senseNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  senseNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  senseContent: {
    flex: 1,
    marginLeft: 12,
  },
  senseName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  senseInstruction: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  nextButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Box Breathing Styles
  breathingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  breathingBox: {
    width: 200,
    height: 200,
    borderWidth: 4,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  breathingPhaseText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  breathingCountText: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
  },
  breathingPhases: {
    flexDirection: 'row',
    gap: 8,
  },
  phaseIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  phaseText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  phaseTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Cold Water Styles
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },

  // Body Scan Styles
  areaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  areaText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  areaPrompt: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Grounding Statement Styles
  statementCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statementText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },

  // Emergency Note
  emergencyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    gap: 10,
  },
  emergencyNoteText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
