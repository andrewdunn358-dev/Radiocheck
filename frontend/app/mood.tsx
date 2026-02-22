import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';

interface MoodEntry {
  id: string;
  mood: string;
  label: string;
  note?: string;
  timestamp: string;
}

const MOOD_STORAGE_KEY = '@veterans_mood_entries';
const LAST_CHECKIN_KEY = '@veterans_last_checkin';

const moods = [
  { emoji: '😊', label: 'Great', color: '#22c55e', value: 5 },
  { emoji: '🙂', label: 'Good', color: '#84cc16', value: 4 },
  { emoji: '😐', label: 'Okay', color: '#eab308', value: 3 },
  { emoji: '😔', label: 'Low', color: '#f97316', value: 2 },
  { emoji: '😢', label: 'Struggling', color: '#ef4444', value: 1 },
];

export default function MoodTracker() {
  const router = useRouter();
  const { colors } = useTheme();
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storedEntries, lastCheckin] = await Promise.all([
        AsyncStorage.getItem(MOOD_STORAGE_KEY),
        AsyncStorage.getItem(LAST_CHECKIN_KEY),
      ]);

      if (storedEntries) {
        setEntries(JSON.parse(storedEntries));
      }

      if (lastCheckin) {
        const lastDate = new Date(lastCheckin).toDateString();
        const today = new Date().toDateString();
        setHasCheckedInToday(lastDate === today);
      }
    } catch (error) {
      console.error('Error loading mood data:', error);
    }
  };

  const saveEntry = async (mood: typeof moods[0]) => {
    try {
      const now = new Date().toISOString();
      const newEntry: MoodEntry = {
        id: Date.now().toString(),
        mood: mood.emoji,
        label: mood.label,
        timestamp: now,
      };

      const updatedEntries = [newEntry, ...entries];
      await AsyncStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(updatedEntries));
      await AsyncStorage.setItem(LAST_CHECKIN_KEY, now);
      
      setEntries(updatedEntries);
      setHasCheckedInToday(true);
    } catch (error) {
      console.error('Error saving mood:', error);
    }
  };

  const getFilteredEntries = () => {
    const now = new Date();
    return entries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      if (selectedPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return entryDate >= weekAgo;
      } else if (selectedPeriod === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return entryDate >= monthAgo;
      }
      return true;
    });
  };

  const getAverageMood = () => {
    const filtered = getFilteredEntries();
    if (filtered.length === 0) return null;
    
    const total = filtered.reduce((sum, entry) => {
      const mood = moods.find(m => m.emoji === entry.mood);
      return sum + (mood?.value || 3);
    }, 0);
    
    return total / filtered.length;
  };

  const getMoodDistribution = () => {
    const filtered = getFilteredEntries();
    const distribution: { [key: string]: number } = {};
    
    moods.forEach(mood => {
      distribution[mood.emoji] = 0;
    });
    
    filtered.forEach(entry => {
      if (distribution[entry.mood] !== undefined) {
        distribution[entry.mood]++;
      }
    });
    
    return distribution;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStreakCount = () => {
    if (entries.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toDateString();
      
      const hasEntry = entries.some(entry => 
        new Date(entry.timestamp).toDateString() === dateStr
      );
      
      if (hasEntry) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    
    return streak;
  };

  const avgMood = getAverageMood();
  const distribution = getMoodDistribution();
  const filteredEntries = getFilteredEntries();
  const streak = getStreakCount();
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
          <Text style={styles.headerTitle}>Daily Check-in</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Streak Banner */}
        {streak > 0 && (
          <View style={styles.streakBanner}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streak} day streak!</Text>
          </View>
        )}

        {/* Check-in Section */}
        {!hasCheckedInToday ? (
          <View style={styles.checkinSection}>
            <Text style={styles.checkinTitle}>How are you feeling today?</Text>
            <Text style={styles.checkinSubtitle}>Tap to check in</Text>
            <View style={styles.moodGrid}>
              {moods.map((mood) => (
                <TouchableOpacity
                  key={mood.emoji}
                  style={[styles.moodCard, { borderColor: mood.color }]}
                  onPress={() => saveEntry(mood)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  <Text style={styles.moodLabel}>{mood.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.checkedInSection}>
            <View style={styles.checkedInIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            </View>
            <Text style={styles.checkedInTitle}>You've checked in today!</Text>
            <Text style={styles.checkedInSubtitle}>
              Come back tomorrow to continue your streak
            </Text>
            {entries[0] && (
              <View style={styles.todayMood}>
                <Text style={styles.todayMoodEmoji}>{entries[0].mood}</Text>
                <Text style={styles.todayMoodLabel}>Feeling {entries[0].label.toLowerCase()}</Text>
              </View>
            )}
          </View>
        )}

        {/* Stats Section */}
        {entries.length > 0 && (
          <>
            {/* Period Selector */}
            <View style={styles.periodSelector}>
              {(['week', 'month', 'all'] as const).map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period && styles.periodButtonActive,
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text style={[
                    styles.periodButtonText,
                    selectedPeriod === period && styles.periodButtonTextActive,
                  ]}>
                    {period === 'week' ? '7 Days' : period === 'month' ? '30 Days' : 'All Time'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{filteredEntries.length}</Text>
                <Text style={styles.statLabel}>Check-ins</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {avgMood ? moods.find(m => m.value === Math.round(avgMood))?.emoji || '😐' : '-'}
                </Text>
                <Text style={styles.statLabel}>Average</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{streak}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            </View>

            {/* Distribution */}
            <View style={styles.distributionSection}>
              <Text style={styles.sectionTitle}>Mood Distribution</Text>
              <View style={styles.distributionBars}>
                {moods.map((mood) => {
                  const count = distribution[mood.emoji];
                  const maxCount = Math.max(...Object.values(distribution), 1);
                  const percentage = (count / maxCount) * 100;
                  
                  return (
                    <View key={mood.emoji} style={styles.distributionItem}>
                      <Text style={styles.distributionEmoji}>{mood.emoji}</Text>
                      <View style={styles.barContainer}>
                        <View 
                          style={[
                            styles.bar, 
                            { width: `${percentage}%`, backgroundColor: mood.color }
                          ]} 
                        />
                      </View>
                      <Text style={styles.distributionCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Mood Timeline Graph */}
            <View style={styles.timelineSection}>
              <Text style={styles.sectionTitle}>Mood Over Time</Text>
              <View style={styles.graphContainer}>
                {/* Y-axis labels */}
                <View style={styles.yAxisLabels}>
                  {moods.map((mood) => (
                    <Text key={mood.value} style={styles.yAxisLabel}>{mood.emoji}</Text>
                  ))}
                </View>
                
                {/* Graph area */}
                <View style={styles.graphArea}>
                  {/* Grid lines */}
                  <View style={styles.gridLines}>
                    {[1, 2, 3, 4, 5].map((line) => (
                      <View key={line} style={styles.gridLine} />
                    ))}
                  </View>
                  
                  {/* Data points */}
                  <View style={styles.dataPoints}>
                    {(() => {
                      // Get last 7 entries for the graph
                      const recentEntries = [...filteredEntries].slice(0, 7).reverse();
                      const graphHeight = 120; // pixels
                      
                      return recentEntries.map((entry, index) => {
                        const mood = moods.find(m => m.emoji === entry.mood);
                        const value = mood?.value || 3;
                        // Calculate position (1-5 scale, 5 is top)
                        const bottomPosition = ((value - 1) / 4) * graphHeight;
                        
                        return (
                          <View 
                            key={entry.id} 
                            style={[
                              styles.dataPoint,
                              { 
                                bottom: bottomPosition,
                                left: `${(index / Math.max(recentEntries.length - 1, 1)) * 100}%`,
                                backgroundColor: mood?.color || '#64748b'
                              }
                            ]}
                          >
                            <Text style={styles.dataPointEmoji}>{entry.mood}</Text>
                          </View>
                        );
                      });
                    })()}
                    
                    {/* Connecting line */}
                    {filteredEntries.length >= 2 && (
                      <View style={styles.trendIndicator}>
                        {(() => {
                          const recent = filteredEntries.slice(0, 3);
                          const avgRecent = recent.reduce((sum, e) => {
                            const m = moods.find(mood => mood.emoji === e.mood);
                            return sum + (m?.value || 3);
                          }, 0) / recent.length;
                          
                          const older = filteredEntries.slice(3, 7);
                          if (older.length === 0) return null;
                          
                          const avgOlder = older.reduce((sum, e) => {
                            const m = moods.find(mood => mood.emoji === e.mood);
                            return sum + (m?.value || 3);
                          }, 0) / older.length;
                          
                          const trend = avgRecent - avgOlder;
                          const trendIcon = trend > 0.3 ? '📈' : trend < -0.3 ? '📉' : '➡️';
                          const trendText = trend > 0.3 ? 'Improving' : trend < -0.3 ? 'Declining' : 'Stable';
                          const trendColor = trend > 0.3 ? '#22c55e' : trend < -0.3 ? '#ef4444' : '#64748b';
                          
                          return (
                            <View style={styles.trendBadge}>
                              <Text style={styles.trendEmoji}>{trendIcon}</Text>
                              <Text style={[styles.trendText, { color: trendColor }]}>{trendText}</Text>
                            </View>
                          );
                        })()}
                      </View>
                    )}
                  </View>
                </View>
              </View>
              
              {/* X-axis date labels */}
              <View style={styles.xAxisLabels}>
                {(() => {
                  const recentEntries = [...filteredEntries].slice(0, 7).reverse();
                  return recentEntries.map((entry, index) => (
                    <Text key={entry.id} style={styles.xAxisLabel}>
                      {new Date(entry.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).split(' ')[0]}
                    </Text>
                  ));
                })()}
              </View>
            </View>

            {/* History Toggle */}
            <TouchableOpacity
              style={styles.historyToggle}
              onPress={() => setShowHistory(!showHistory)}
            >
              <Text style={styles.historyToggleText}>
                {showHistory ? 'Hide History' : 'View History'}
              </Text>
              <Ionicons 
                name={showHistory ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            {/* History List */}
            {showHistory && (
              <View style={styles.historySection}>
                {filteredEntries.slice(0, 20).map((entry) => (
                  <View key={entry.id} style={styles.historyItem}>
                    <Text style={styles.historyEmoji}>{entry.mood}</Text>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDate}>{formatDate(entry.timestamp)}</Text>
                      <Text style={styles.historyTime}>{formatTime(entry.timestamp)}</Text>
                    </View>
                    <Text style={styles.historyLabel}>{entry.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Empty State */}
        {entries.length === 0 && hasCheckedInToday === false && (
          <View style={styles.emptyHint}>
            <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
            <Text style={styles.emptyHintText}>
              Check in daily to track your mood over time
            </Text>
          </View>
        )}
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
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
  },
  checkinSection: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkinTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  checkinSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  moodCard: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceHover,
    borderWidth: 2,
    minWidth: 80,
  },
  moodEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  checkedInSection: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkedInIcon: {
    marginBottom: 16,
  },
  checkedInTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  checkedInSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  todayMood: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  todayMoodEmoji: {
    fontSize: 32,
  },
  todayMoodLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  distributionSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  distributionBars: {
    gap: 12,
  },
  distributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distributionEmoji: {
    fontSize: 20,
    width: 28,
  },
  barContainer: {
    flex: 1,
    height: 12,
    backgroundColor: colors.surfaceHover,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 6,
  },
  distributionCount: {
    fontSize: 14,
    color: colors.textMuted,
    width: 24,
    textAlign: 'right',
  },
  timelineSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  graphContainer: {
    flexDirection: 'row',
    height: 160,
    marginBottom: 8,
  },
  yAxisLabels: {
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  yAxisLabel: {
    fontSize: 16,
  },
  graphArea: {
    flex: 1,
    position: 'relative',
    marginLeft: 8,
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  dataPoints: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dataPoint: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  dataPointEmoji: {
    fontSize: 18,
  },
  trendIndicator: {
    position: 'absolute',
    top: -8,
    right: 0,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendEmoji: {
    fontSize: 12,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 38,
    paddingRight: 8,
  },
  xAxisLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  historyToggleText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  historySection: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyEmoji: {
    fontSize: 24,
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  historyTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  emptyHintText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
