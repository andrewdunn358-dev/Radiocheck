import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet,
  Animated,
  Vibration,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { goBack } from '../src/utils/navigation';

// Breathing patterns with unlock requirements
const BREATHING_PATTERNS = [
  {
    id: 'relaxing',
    name: 'Relaxing Breath',
    desc: 'Simple 4-4 pattern for beginners',
    inhale: 4,
    hold1: 0,
    exhale: 4,
    hold2: 0,
    color: '#3b82f6',
    unlockAt: 0,
    icon: 'leaf'
  },
  {
    id: 'box',
    name: 'Box Breathing',
    desc: 'Used by Navy SEALs - 4-4-4-4',
    inhale: 4,
    hold1: 4,
    exhale: 4,
    hold2: 4,
    color: '#10b981',
    unlockAt: 3,
    icon: 'square-outline'
  },
  {
    id: '478',
    name: '4-7-8 Sleep Breath',
    desc: 'Dr. Weil&apos;s relaxation technique',
    inhale: 4,
    hold1: 7,
    exhale: 8,
    hold2: 0,
    color: '#8b5cf6',
    unlockAt: 7,
    icon: 'moon'
  },
  {
    id: 'energizing',
    name: 'Energizing Breath',
    desc: 'Quick 2-2 pattern to wake up',
    inhale: 2,
    hold1: 1,
    exhale: 2,
    hold2: 1,
    color: '#f59e0b',
    unlockAt: 14,
    icon: 'sunny'
  },
  {
    id: 'calming',
    name: 'Deep Calm',
    desc: 'Extended exhale for deep relaxation',
    inhale: 4,
    hold1: 2,
    exhale: 8,
    hold2: 2,
    color: '#06b6d4',
    unlockAt: 21,
    icon: 'water'
  },
  {
    id: 'master',
    name: 'Master Breath',
    desc: 'Advanced 5-5-5-5 pattern',
    inhale: 5,
    hold1: 5,
    exhale: 5,
    hold2: 5,
    color: '#ec4899',
    unlockAt: 30,
    icon: 'diamond'
  }
];

const ACHIEVEMENTS = [
  { id: 'first', name: 'First Breath', desc: 'Complete your first session', requirement: 1, icon: 'ribbon' },
  { id: 'week', name: 'Week Warrior', desc: '7 day streak', requirement: 7, icon: 'flame' },
  { id: 'fortnight', name: 'Fortnight Fighter', desc: '14 day streak', requirement: 14, icon: 'trophy' },
  { id: 'month', name: 'Month Master', desc: '30 day streak', requirement: 30, icon: 'medal' },
  { id: 'sessions10', name: 'Dedicated', desc: 'Complete 10 sessions', requirement: 10, icon: 'star', type: 'sessions' },
  { id: 'sessions50', name: 'Committed', desc: 'Complete 50 sessions', requirement: 50, icon: 'star-half', type: 'sessions' },
];

type Phase = 'idle' | 'inhale' | 'hold1' | 'exhale' | 'hold2';

export default function BreathingGame() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const styles = createStyles(colors, theme);
  
  // Game state
  const [selectedPattern, setSelectedPattern] = useState(BREATHING_PATTERNS[0]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [showPatterns, setShowPatterns] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  
  // Stats
  const [streak, setStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [unlockedPatterns, setUnlockedPatterns] = useState<string[]>(['relaxing']);
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  
  // Animation
  const breathAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved stats
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const savedStreak = await AsyncStorage.getItem('breathing_streak');
      const savedSessions = await AsyncStorage.getItem('breathing_sessions');
      const savedLastDate = await AsyncStorage.getItem('breathing_last_date');
      const savedUnlocked = await AsyncStorage.getItem('breathing_unlocked');
      const savedAchievements = await AsyncStorage.getItem('breathing_achievements');
      
      const today = new Date().toDateString();
      
      if (savedStreak) {
        const streakNum = parseInt(savedStreak);
        // Check if streak is still valid (completed yesterday or today)
        if (savedLastDate) {
          const lastDate = new Date(savedLastDate);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (lastDate.toDateString() === today) {
            setStreak(streakNum);
            setTodayCompleted(true);
          } else if (lastDate.toDateString() === yesterday.toDateString()) {
            setStreak(streakNum);
          } else {
            // Streak broken
            setStreak(0);
          }
        }
      }
      
      if (savedSessions) setTotalSessions(parseInt(savedSessions));
      if (savedUnlocked) setUnlockedPatterns(JSON.parse(savedUnlocked));
      if (savedAchievements) setEarnedAchievements(JSON.parse(savedAchievements));
      
    } catch (error) {
      console.log('Error loading breathing stats:', error);
    }
  };

  const saveStats = async (newStreak: number, newSessions: number, newUnlocked: string[], newAchievements: string[]) => {
    try {
      await AsyncStorage.setItem('breathing_streak', newStreak.toString());
      await AsyncStorage.setItem('breathing_sessions', newSessions.toString());
      await AsyncStorage.setItem('breathing_last_date', new Date().toDateString());
      await AsyncStorage.setItem('breathing_unlocked', JSON.stringify(newUnlocked));
      await AsyncStorage.setItem('breathing_achievements', JSON.stringify(newAchievements));
    } catch (error) {
      console.log('Error saving breathing stats:', error);
    }
  };

  const startBreathing = () => {
    setIsPlaying(true);
    setCyclesCompleted(0);
    runBreathingCycle();
  };

  const stopBreathing = () => {
    setIsPlaying(false);
    setPhase('idle');
    setCountdown(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    breathAnim.setValue(1);
    glowAnim.setValue(0);
  };

  const runBreathingCycle = () => {
    // Start with inhale
    runPhase('inhale', selectedPattern.inhale);
  };

  const runPhase = (newPhase: Phase, duration: number) => {
    if (duration === 0) {
      // Skip phases with 0 duration
      moveToNextPhase(newPhase);
      return;
    }
    
    setPhase(newPhase);
    setCountdown(duration);
    
    // Animate the breath circle
    if (newPhase === 'inhale') {
      Animated.timing(breathAnim, {
        toValue: 1.5,
        duration: duration * 1000,
        useNativeDriver: true,
      }).start();
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: duration * 1000,
        useNativeDriver: true,
      }).start();
    } else if (newPhase === 'exhale') {
      Animated.timing(breathAnim, {
        toValue: 1,
        duration: duration * 1000,
        useNativeDriver: true,
      }).start();
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: duration * 1000,
        useNativeDriver: true,
      }).start();
    }
    
    // Countdown timer
    let remaining = duration;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        moveToNextPhase(newPhase);
      }
    }, 1000);
  };

  const moveToNextPhase = (currentPhase: Phase) => {
    switch (currentPhase) {
      case 'inhale':
        runPhase('hold1', selectedPattern.hold1);
        break;
      case 'hold1':
        runPhase('exhale', selectedPattern.exhale);
        break;
      case 'exhale':
        runPhase('hold2', selectedPattern.hold2);
        break;
      case 'hold2':
        // Cycle complete
        const newCycles = cyclesCompleted + 1;
        setCyclesCompleted(newCycles);
        
        // Haptic feedback
        if (Platform.OS !== 'web') {
          Vibration.vibrate(100);
        }
        
        if (newCycles >= 5) {
          // Session complete after 5 cycles
          completeSession();
        } else {
          // Continue to next cycle
          runPhase('inhale', selectedPattern.inhale);
        }
        break;
    }
  };

  const completeSession = () => {
    stopBreathing();
    
    let newStreak = streak;
    let newSessions = totalSessions + 1;
    let newUnlocked = [...unlockedPatterns];
    let newAchievements = [...earnedAchievements];
    
    // Update streak if not already completed today
    if (!todayCompleted) {
      newStreak = streak + 1;
      setStreak(newStreak);
      setTodayCompleted(true);
    }
    
    setTotalSessions(newSessions);
    
    // Check for new pattern unlocks
    BREATHING_PATTERNS.forEach(pattern => {
      if (pattern.unlockAt <= newStreak && !newUnlocked.includes(pattern.id)) {
        newUnlocked.push(pattern.id);
      }
    });
    setUnlockedPatterns(newUnlocked);
    
    // Check for new achievements
    ACHIEVEMENTS.forEach(achievement => {
      if (!newAchievements.includes(achievement.id)) {
        if (achievement.type === 'sessions' && newSessions >= achievement.requirement) {
          newAchievements.push(achievement.id);
        } else if (!achievement.type && newStreak >= achievement.requirement) {
          newAchievements.push(achievement.id);
        }
      }
    });
    setEarnedAchievements(newAchievements);
    
    // Save stats
    saveStats(newStreak, newSessions, newUnlocked, newAchievements);
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'inhale': return 'Breathe In';
      case 'hold1': return 'Hold';
      case 'exhale': return 'Breathe Out';
      case 'hold2': return 'Hold';
      default: return 'Ready';
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'inhale': return '#3b82f6';
      case 'hold1': return '#f59e0b';
      case 'exhale': return '#10b981';
      case 'hold2': return '#f59e0b';
      default: return selectedPattern.color;
    }
  };

  const renderPatternSelector = () => (
    <View style={styles.patternsModal}>
      <View style={styles.patternsHeader}>
        <Text style={styles.patternsTitle}>Breathing Patterns</Text>
        <TouchableOpacity onPress={() => setShowPatterns(false)}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      
      {BREATHING_PATTERNS.map(pattern => {
        const isUnlocked = unlockedPatterns.includes(pattern.id);
        const isSelected = selectedPattern.id === pattern.id;
        
        return (
          <TouchableOpacity
            key={pattern.id}
            style={[
              styles.patternCard,
              isSelected && styles.patternCardSelected,
              !isUnlocked && styles.patternCardLocked
            ]}
            onPress={() => {
              if (isUnlocked) {
                setSelectedPattern(pattern);
                setShowPatterns(false);
              }
            }}
            disabled={!isUnlocked}
          >
            <View style={[styles.patternIcon, { backgroundColor: isUnlocked ? pattern.color + '20' : '#e2e8f0' }]}>
              {isUnlocked ? (
                <Ionicons name={pattern.icon as any} size={24} color={pattern.color} />
              ) : (
                <Ionicons name="lock-closed" size={24} color="#94a3b8" />
              )}
            </View>
            <View style={styles.patternInfo}>
              <Text style={[styles.patternName, !isUnlocked && styles.patternNameLocked]}>
                {pattern.name}
              </Text>
              <Text style={styles.patternDesc}>
                {isUnlocked ? pattern.desc : `Unlock at ${pattern.unlockAt} day streak`}
              </Text>
            </View>
            {isSelected && <Ionicons name="checkmark-circle" size={24} color={pattern.color} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderAchievements = () => (
    <View style={styles.achievementsModal}>
      <View style={styles.patternsHeader}>
        <Text style={styles.patternsTitle}>Achievements</Text>
        <TouchableOpacity onPress={() => setShowAchievements(false)}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      
      {ACHIEVEMENTS.map(achievement => {
        const isEarned = earnedAchievements.includes(achievement.id);
        
        return (
          <View
            key={achievement.id}
            style={[styles.achievementCard, isEarned && styles.achievementCardEarned]}
          >
            <View style={[styles.achievementIcon, isEarned && styles.achievementIconEarned]}>
              <Ionicons 
                name={achievement.icon as any} 
                size={24} 
                color={isEarned ? '#f59e0b' : '#94a3b8'} 
              />
            </View>
            <View style={styles.achievementInfo}>
              <Text style={[styles.achievementName, isEarned && styles.achievementNameEarned]}>
                {achievement.name}
              </Text>
              <Text style={styles.achievementDesc}>{achievement.desc}</Text>
            </View>
            {isEarned && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
          </View>
        );
      })}
    </View>
  );

  if (showPatterns) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderPatternSelector()}
      </SafeAreaView>
    );
  }

  if (showAchievements) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderAchievements()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Breathing Challenge</Text>
        <TouchableOpacity onPress={() => setShowAchievements(true)} style={styles.achievementButton}>
          <Ionicons name="trophy" size={24} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Ionicons name="flame" size={20} color="#ef4444" />
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={styles.statValue}>{totalSessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="lock-open" size={20} color="#8b5cf6" />
          <Text style={styles.statValue}>{unlockedPatterns.length}/{BREATHING_PATTERNS.length}</Text>
          <Text style={styles.statLabel}>Unlocked</Text>
        </View>
      </View>

      {/* Today's Status */}
      {todayCompleted && (
        <View style={styles.todayBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={styles.todayText}>Today&apos;s challenge complete! Come back tomorrow.</Text>
        </View>
      )}

      {/* Main Breathing Area */}
      <View style={styles.breathingArea}>
        {/* Pattern Selector */}
        <TouchableOpacity 
          style={styles.patternSelector}
          onPress={() => setShowPatterns(true)}
          disabled={isPlaying}
        >
          <View style={[styles.patternDot, { backgroundColor: selectedPattern.color }]} />
          <Text style={styles.patternSelectorText}>{selectedPattern.name}</Text>
          <Ionicons name="chevron-down" size={16} color="#64748b" />
        </TouchableOpacity>

        {/* Breathing Circle */}
        <View style={styles.circleContainer}>
          <Animated.View 
            style={[
              styles.breathCircle,
              { 
                backgroundColor: getPhaseColor(),
                transform: [{ scale: breathAnim }],
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1]
                })
              }
            ]}
          >
            <Text style={styles.phaseText}>{getPhaseText()}</Text>
            {isPlaying && <Text style={styles.countdownText}>{countdown}</Text>}
          </Animated.View>
          
          {/* Outer ring */}
          <View style={[styles.outerRing, { borderColor: selectedPattern.color }]} />
        </View>

        {/* Cycle Progress */}
        {isPlaying && (
          <View style={styles.cycleProgress}>
            <Text style={styles.cycleText}>Cycle {cyclesCompleted + 1} of 5</Text>
            <View style={styles.cycleDots}>
              {[0, 1, 2, 3, 4].map(i => (
                <View 
                  key={i}
                  style={[
                    styles.cycleDot,
                    i < cyclesCompleted && styles.cycleDotComplete,
                    i === cyclesCompleted && styles.cycleDotActive
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Start/Stop Button */}
        <TouchableOpacity
          style={[styles.actionButton, isPlaying && styles.stopButton]}
          onPress={isPlaying ? stopBreathing : startBreathing}
        >
          <Ionicons 
            name={isPlaying ? 'stop' : 'play'} 
            size={28} 
            color="#fff" 
          />
          <Text style={styles.actionButtonText}>
            {isPlaying ? 'Stop' : 'Start Breathing'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pattern Info */}
      {!isPlaying && (
        <View style={styles.patternInfo2}>
          <Text style={styles.patternInfoTitle}>Pattern: {selectedPattern.name}</Text>
          <View style={styles.patternTiming}>
            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>In</Text>
              <Text style={styles.timingValue}>{selectedPattern.inhale}s</Text>
            </View>
            {selectedPattern.hold1 > 0 && (
              <View style={styles.timingItem}>
                <Text style={styles.timingLabel}>Hold</Text>
                <Text style={styles.timingValue}>{selectedPattern.hold1}s</Text>
              </View>
            )}
            <View style={styles.timingItem}>
              <Text style={styles.timingLabel}>Out</Text>
              <Text style={styles.timingValue}>{selectedPattern.exhale}s</Text>
            </View>
            {selectedPattern.hold2 > 0 && (
              <View style={styles.timingItem}>
                <Text style={styles.timingLabel}>Hold</Text>
                <Text style={styles.timingValue}>{selectedPattern.hold2}s</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Tip */}
      <View style={styles.tipCard}>
        <Ionicons name="bulb" size={18} color="#f59e0b" />
        <Text style={styles.tipText}>
          Complete 5 breathing cycles daily to maintain your streak and unlock new patterns!
        </Text>
      </View>
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
  },
  achievementButton: {
    padding: 8,
  },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  // Today Banner
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 10,
    gap: 8,
  },
  todayText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },

  // Breathing Area
  breathingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  // Pattern Selector
  patternSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patternDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  patternSelectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },

  // Breathing Circle
  circleContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  breathCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    opacity: 0.3,
  },
  phaseText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  countdownText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },

  // Cycle Progress
  cycleProgress: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cycleText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cycleDots: {
    flexDirection: 'row',
    gap: 8,
  },
  cycleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  cycleDotComplete: {
    backgroundColor: '#10b981',
  },
  cycleDotActive: {
    backgroundColor: '#3b82f6',
  },

  // Action Button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 10,
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },

  // Pattern Info
  patternInfo2: {
    backgroundColor: colors.surface,
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patternInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  patternTiming: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  timingItem: {
    alignItems: 'center',
  },
  timingLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  timingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },

  // Tip Card
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme === 'dark' ? '#422006' : '#fffbeb',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },

  // Patterns Modal
  patternsModal: {
    flex: 1,
    padding: 16,
  },
  patternsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  patternsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  patternCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patternCardSelected: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  patternCardLocked: {
    opacity: 0.6,
  },
  patternIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternInfo: {
    flex: 1,
    marginLeft: 12,
  },
  patternName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  patternNameLocked: {
    color: colors.textSecondary,
  },
  patternDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Achievements Modal
  achievementsModal: {
    flex: 1,
    padding: 16,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.5,
  },
  achievementCardEarned: {
    opacity: 1,
    borderColor: '#f59e0b',
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementIconEarned: {
    backgroundColor: '#fef3c7',
  },
  achievementInfo: {
    flex: 1,
    marginLeft: 12,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  achievementNameEarned: {
    color: colors.text,
  },
  achievementDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
