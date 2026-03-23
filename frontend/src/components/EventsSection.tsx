/**
 * EventsSection - Shows upcoming community events on the home page
 * 
 * Displays virtual coffee mornings and other community video events.
 * Users can see upcoming events, join live events, or set reminders.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';
import AgoraMeetComponent from './AgoraMeetComponent';

interface Event {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  duration_minutes: number;
  max_participants?: number;
  host_name: string;
  status: string;
  jitsi_room_name: string;
  participant_count: number;
  event_type?: 'in-person' | 'virtual' | 'hybrid';
  location?: string;
}

interface JoinDetails {
  event_id: string;
  jitsi_room_name: string;
  display_name: string;
  is_moderator: boolean;
}

export default function EventsSection() {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = createStyles(colors, isDark);

  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Join event modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  
  // Agora video call state
  const [showAgora, setShowAgora] = useState(false);
  const [joinDetails, setJoinDetails] = useState<JoinDetails | null>(null);
  
  // Reminders
  const [remindedEvents, setRemindedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/events/upcoming`);
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Unable to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinClick = (event: Event) => {
    setSelectedEvent(event);
    setShowJoinModal(true);
  };

  const handleJoinEvent = async () => {
    if (!selectedEvent || !displayName.trim()) return;
    
    setIsJoining(true);
    try {
      const response = await fetch(
        `${API_URL}/api/events/${selectedEvent.id}/join?display_name=${encodeURIComponent(displayName)}`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Unable to join event');
      }
      
      const data: JoinDetails = await response.json();
      setJoinDetails(data);
      setShowJoinModal(false);
      setShowAgora(true);
    } catch (err: any) {
      alert(err.message || 'Failed to join event');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSetReminder = async (eventId: string) => {
    try {
      await fetch(`${API_URL}/api/events/${eventId}/remind?user_id=anonymous`, {
        method: 'POST'
      });
      setRemindedEvents(prev => new Set(prev).add(eventId));
    } catch (err) {
      console.error('Error setting reminder:', err);
    }
  };

  const handleCloseAgora = async () => {
    if (joinDetails) {
      try {
        await fetch(`${API_URL}/api/events/${joinDetails.event_id}/leave`, {
          method: 'POST'
        });
      } catch (err) {
        console.error('Error logging leave:', err);
      }
    }
    setShowAgora(false);
    setJoinDetails(null);
    fetchEvents();
  };

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 0 && diffMins > -120) {
      return 'Live now';
    } else if (diffMins >= 0 && diffMins < 60) {
      return `Starts in ${diffMins} min`;
    } else if (diffHours < 24) {
      return `Today at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-GB', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const isEventLive = (event: Event) => {
    const now = new Date();
    const eventStart = new Date(event.event_date);
    const eventEnd = new Date(eventStart.getTime() + event.duration_minutes * 60000);
    return now >= new Date(eventStart.getTime() - 10 * 60000) && now <= eventEnd;
  };

  const isEventJoinable = (event: Event) => {
    // All events have Jitsi rooms - allow joining any live or upcoming event
    // (regardless of event_type - the event_type is informational only)
    return event.status !== 'cancelled' && event.status !== 'ended' && event.jitsi_room_name;
  };

  // Check if event is in-person only (for showing location prominently)
  const isInPersonOnly = (event: Event) => {
    const eventType = event.event_type || 'in-person';
    return eventType === 'in-person';
  };
  
  // Check if event supports virtual attendance
  const isVirtualEvent = (event: Event) => {
    const eventType = event.event_type || 'in-person';
    return eventType === 'virtual' || eventType === 'hybrid';
  };

  // Don't render if no events and not loading
  if (!isLoading && events.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.container}>
        {/* Section Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="videocam" size={20} color="#8b5cf6" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Community Events</Text>
            <Text style={styles.subtitle}>Virtual coffee mornings & meetups</Text>
          </View>
        </View>

        {/* Events List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventsList}>
            {events.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                {/* Live Badge */}
                {isEventLive(event) && (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                )}
                
                {/* Event Type Badge */}
                <View style={[
                  styles.eventTypeBadge,
                  event.event_type === 'virtual' && styles.virtualBadge,
                  event.event_type === 'hybrid' && styles.hybridBadge,
                  (!event.event_type || event.event_type === 'in-person') && styles.inPersonBadge,
                ]}>
                  <Ionicons 
                    name={event.event_type === 'virtual' || event.event_type === 'hybrid' ? 'videocam' : 'location'} 
                    size={10} 
                    color="#fff" 
                  />
                  <Text style={styles.eventTypeBadgeText}>
                    {event.event_type === 'virtual' ? 'Virtual' : 
                     event.event_type === 'hybrid' ? 'Hybrid' : 'In-Person'}
                  </Text>
                </View>
                
                {/* Event Info */}
                <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                <Text style={styles.eventTime}>{formatEventTime(event.event_date)}</Text>
                
                {/* Location for in-person/hybrid events */}
                {event.location && (event.event_type === 'in-person' || event.event_type === 'hybrid') && (
                  <View style={styles.eventMeta}>
                    <Ionicons name="location" size={14} color={colors.textMuted} />
                    <Text style={styles.eventHost} numberOfLines={1}>{event.location}</Text>
                  </View>
                )}
                
                <View style={styles.eventMeta}>
                  <Ionicons name="person" size={14} color={colors.textMuted} />
                  <Text style={styles.eventHost}>{event.host_name}</Text>
                </View>
                
                {event.participant_count > 0 && (
                  <View style={styles.eventMeta}>
                    <Ionicons name="people" size={14} color={colors.textMuted} />
                    <Text style={styles.eventParticipants}>
                      {event.participant_count} joined
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                {isEventJoinable(event) ? (
                  <TouchableOpacity
                    style={styles.joinButton}
                    onPress={() => handleJoinClick(event)}
                  >
                    <Ionicons name="videocam" size={16} color="#fff" />
                    <Text style={styles.joinButtonText}>
                      {isEventLive(event) ? 'Join Now' : 'Join Event'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.remindButton,
                      remindedEvents.has(event.id) && styles.remindedButton
                    ]}
                    onPress={() => handleSetReminder(event.id)}
                    disabled={remindedEvents.has(event.id)}
                  >
                    <Ionicons 
                      name={remindedEvents.has(event.id) ? "checkmark" : "notifications-outline"} 
                      size={16} 
                      color={remindedEvents.has(event.id) ? "#22c55e" : colors.primary} 
                    />
                    <Text style={[
                      styles.remindButtonText,
                      remindedEvents.has(event.id) && styles.remindedText
                    ]}>
                      {remindedEvents.has(event.id) ? 'Reminded' : 'Remind Me'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Join Event Modal */}
      <Modal visible={showJoinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="videocam" size={32} color="#8b5cf6" />
              <Text style={styles.modalTitle}>Join Event</Text>
            </View>
            
            {selectedEvent && (
              <>
                <Text style={styles.modalEventTitle}>{selectedEvent.title}</Text>
                <Text style={styles.modalEventHost}>Hosted by {selectedEvent.host_name}</Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Your Display Name</Text>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Enter your name"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowJoinModal(false)}
                    data-testid="event-join-cancel-btn"
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.confirmButton, !displayName.trim() && styles.disabledButton]}
                    onPress={handleJoinEvent}
                    disabled={!displayName.trim() || isJoining}
                    data-testid="event-join-confirm-btn"
                  >
                    {isJoining ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="videocam" size={18} color="#fff" />
                        <Text style={styles.confirmButtonText}>Join</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Agora Video Call Modal */}
      <Modal visible={showAgora} animationType="slide">
        {joinDetails && (
          <AgoraMeetComponent
            roomName={`event_${joinDetails.event_id}`}
            displayName={joinDetails.display_name}
            eventTitle={selectedEvent?.title}
            onClose={handleCloseAgora}
          />
        )}
      </Modal>
    </>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    padding: 10,
  },
  eventsList: {
    marginHorizontal: -8,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 6,
    width: 200,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 4,
  },
  liveText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  eventTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  virtualBadge: {
    backgroundColor: '#8b5cf6',
  },
  hybridBadge: {
    backgroundColor: '#6366f1',
  },
  inPersonBadge: {
    backgroundColor: '#64748b',
  },
  eventTypeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 13,
    color: '#8b5cf6',
    fontWeight: '500',
    marginBottom: 8,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  eventHost: {
    fontSize: 12,
    color: colors.textMuted,
  },
  eventParticipants: {
    fontSize: 12,
    color: colors.textMuted,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  remindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  remindedButton: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  remindButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  remindedText: {
    color: '#22c55e',
  },
  inPersonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  inPersonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  modalEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalEventHost: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: isDark ? colors.background : '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
