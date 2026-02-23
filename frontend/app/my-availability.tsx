import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../src/config/api';

interface Shift {
  id: string;
  staff_id: string;
  staff_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

interface DayData {
  date: Date;
  dateString: string;
  shifts: Shift[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

export default function MyAvailabilityScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newShiftStart, setNewShiftStart] = useState('09:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    loadUserAndShifts();
  }, [currentMonth]);

  const loadUserAndShifts = async () => {
    try {
      // Load user info from auth_user (stored as JSON by AuthContext)
      const storedUser = await AsyncStorage.getItem('auth_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserId(user.id);
        setUserName(user.name || 'Volunteer');
      }
      await fetchShifts();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const fetchShifts = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const response = await fetch(
        `${API_URL}/api/shifts?date_from=${startDate.toISOString().split('T')[0]}&date_to=${endDate.toISOString().split('T')[0]}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setShifts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCalendarDays = (): DayData[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const days: DayData[] = [];
    
    // Add padding days from previous month
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = startPadding; i > 0; i--) {
      const date = new Date(year, month, 1 - i);
      days.push({
        date,
        dateString: date.toISOString().split('T')[0],
        shifts: [],
        isToday: false,
        isCurrentMonth: false,
      });
    }
    
    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      const dayShifts = shifts.filter(s => s.date === dateString);
      
      days.push({
        date,
        dateString,
        shifts: dayShifts,
        isToday: date.getTime() === today.getTime(),
        isCurrentMonth: true,
      });
    }
    
    // Add padding days from next month
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        dateString: date.toISOString().split('T')[0],
        shifts: [],
        isToday: false,
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const handleAddShift = async () => {
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date first');
      return;
    }

    // Get auth token (stored as 'auth_token' by AuthContext)
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      Alert.alert('Login Required', 'You need to be logged in as a peer supporter to add shifts.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/login') }
      ]);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/shifts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: selectedDate,
          start_time: newShiftStart,
          end_time: newShiftEnd,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Shift added successfully');
        setShowAddModal(false);
        fetchShifts();
      } else {
        const error = await response.json();
        if (response.status === 403) {
          Alert.alert('Access Denied', 'You need to be registered as a peer supporter to add shifts.');
        } else {
          Alert.alert('Error', error.detail || 'Failed to add shift');
        }
      }
    } catch (error) {
      console.error('Error adding shift:', error);
      Alert.alert('Error', 'Failed to add shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    Alert.alert(
      'Delete Shift',
      'Are you sure you want to remove this availability?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              const response = await fetch(`${API_URL}/api/shifts/${shiftId}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              });
              if (response.ok) {
                fetchShifts();
              }
            } catch (error) {
              console.error('Error deleting shift:', error);
            }
          },
        },
      ]
    );
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const calendarDays = getCalendarDays();
  const selectedDayData = calendarDays.find(d => d.dateString === selectedDate);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Availability</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <FontAwesome5 name="info-circle" size={18} color="#3b82f6" />
          <Text style={styles.infoText}>
            Log your availability so other volunteers and the team know when you're free to help.
          </Text>
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{formatMonthYear(currentMonth)}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Calendar */}
        <View style={styles.calendar}>
          {/* Day headers */}
          <View style={styles.weekHeader}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <Text key={day} style={styles.weekDay}>{day}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <View style={styles.daysGrid}>
              {calendarDays.map((day, index) => {
                const hasMyShift = day.shifts.some(s => s.staff_id === userId);
                const hasOtherShifts = day.shifts.some(s => s.staff_id !== userId);
                const isSelected = day.dateString === selectedDate;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      !day.isCurrentMonth && styles.dayOutside,
                      day.isToday && styles.dayToday,
                      isSelected && styles.daySelected,
                    ]}
                    onPress={() => day.isCurrentMonth && setSelectedDate(day.dateString)}
                    disabled={!day.isCurrentMonth}
                  >
                    <Text style={[
                      styles.dayText,
                      !day.isCurrentMonth && styles.dayTextOutside,
                      day.isToday && styles.dayTextToday,
                      isSelected && styles.dayTextSelected,
                    ]}>
                      {day.date.getDate()}
                    </Text>
                    {(hasMyShift || hasOtherShifts) && (
                      <View style={styles.shiftIndicators}>
                        {hasMyShift && <View style={[styles.shiftDot, styles.myShiftDot]} />}
                        {hasOtherShifts && <View style={[styles.shiftDot, styles.otherShiftDot]} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.myShiftDot]} />
            <Text style={styles.legendText}>Your shifts</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.otherShiftDot]} />
            <Text style={styles.legendText}>Other volunteers</Text>
          </View>
        </View>

        {/* Selected Day Details */}
        {selectedDate && selectedDayData && (
          <View style={styles.selectedDay}>
            <Text style={styles.selectedDayTitle}>
              {new Date(selectedDate).toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </Text>

            {selectedDayData.shifts.length > 0 ? (
              selectedDayData.shifts.map(shift => (
                <View key={shift.id} style={styles.shiftCard}>
                  <View style={styles.shiftInfo}>
                    <FontAwesome5 
                      name="user-clock" 
                      size={16} 
                      color={shift.staff_id === userId ? '#10b981' : '#94a3b8'} 
                    />
                    <View style={styles.shiftDetails}>
                      <Text style={styles.shiftName}>
                        {shift.staff_id === userId ? 'You' : (shift.staff_name || 'Volunteer')}
                      </Text>
                      <Text style={styles.shiftTime}>{shift.start_time} - {shift.end_time}</Text>
                    </View>
                  </View>
                  {shift.staff_id === userId && (
                    <TouchableOpacity 
                      onPress={() => handleDeleteShift(shift.id)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.noShiftsText}>No shifts scheduled for this day</Text>
            )}

            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add My Availability</Text>
            </TouchableOpacity>
          </View>
        )}

        {!selectedDate && (
          <View style={styles.selectPrompt}>
            <Ionicons name="calendar-outline" size={48} color="#64748b" />
            <Text style={styles.selectPromptText}>Select a date to view or add shifts</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Shift Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setShowAddModal(false)}
            >
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>

            <FontAwesome5 name="calendar-plus" size={40} color="#10b981" />
            <Text style={styles.modalTitle}>Add Availability</Text>
            <Text style={styles.modalSubtitle}>
              {selectedDate && new Date(selectedDate).toLocaleDateString('en-GB', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </Text>

            <View style={styles.timeInputs}>
              <View style={styles.timeInput}>
                <Text style={styles.timeLabel}>Start Time</Text>
                <TextInput
                  style={styles.timeField}
                  value={newShiftStart}
                  onChangeText={setNewShiftStart}
                  placeholder="09:00"
                  placeholderTextColor="#64748b"
                />
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.timeLabel}>End Time</Text>
                <TextInput
                  style={styles.timeField}
                  value={newShiftEnd}
                  onChangeText={setNewShiftEnd}
                  placeholder="17:00"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleAddShift}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Add Shift</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e3a5f',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#93c5fd',
    lineHeight: 20,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  calendar: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    paddingVertical: 8,
  },
  loadingContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  dayOutside: {
    opacity: 0.3,
  },
  dayToday: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
  },
  daySelected: {
    backgroundColor: '#10b981',
    borderRadius: 20,
  },
  dayText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  dayTextOutside: {
    color: '#475569',
  },
  dayTextToday: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  shiftIndicators: {
    flexDirection: 'row',
    marginTop: 2,
    gap: 2,
  },
  shiftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  myShiftDot: {
    backgroundColor: '#10b981',
  },
  otherShiftDot: {
    backgroundColor: '#f59e0b',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  selectedDay: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  selectedDayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  shiftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shiftDetails: {
    gap: 2,
  },
  shiftName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  shiftTime: {
    fontSize: 13,
    color: '#94a3b8',
  },
  deleteBtn: {
    padding: 8,
  },
  noShiftsText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  selectPrompt: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  selectPromptText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 24,
  },
  timeInputs: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    marginBottom: 24,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  timeField: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#475569',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
