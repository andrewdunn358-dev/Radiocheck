import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { API_URL } from '../src/config/api';

interface PeerSupporter {
  id: string;
  firstName: string;
  area: string;
  background: string;
  yearsServed: string;
  status: string;
  phone: string;
}

interface CallbackRequest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  message: string;
  request_type: string;
  status: string;
  assigned_to?: string;
  assigned_name?: string;
  created_at: string;
}

export default function PeerPortal() {
  const [peer, setPeer] = useState<PeerSupporter | null>(null);
  const [callbacks, setCallbacks] = useState<CallbackRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicSubmitting, setPanicSubmitting] = useState(false);
  const [panicMessage, setPanicMessage] = useState('');
  const { user, token, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || user.role !== 'peer') {
      router.replace('/login');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch peer profile - requires auth now
      const peersResponse = await fetch(`${API_URL}/api/peer-supporters`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (peersResponse.ok) {
        const peers = await peersResponse.json();
        const myPeer = peers.find((p: any) => p.user_id === user?.id);
        if (myPeer) {
          setPeer(myPeer);
        }
      }
      
      // Fetch callback requests assigned to peer
      const callbacksResponse = await fetch(`${API_URL}/api/callbacks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (callbacksResponse.ok) {
        const data = await callbacksResponse.json();
        setCallbacks(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!peer) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/peer-supporters/${peer.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setPeer({ ...peer, status: newStatus });
        Alert.alert('Success', `Status updated to ${newStatus}`);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to update status');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    } finally {
      setIsUpdating(false);
    }
  };

  const takeCallback = async (callbackId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/callbacks/${callbackId}/take`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        Alert.alert('Success', 'Callback assigned to you');
        fetchData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to take callback');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  const releaseCallback = async (callbackId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/callbacks/${callbackId}/release`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        Alert.alert('Success', 'Callback released');
        fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  const completeCallback = async (callbackId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/callbacks/${callbackId}/complete`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        Alert.alert('Success', 'Callback marked as complete');
        fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    }
  };

  const submitPanicAlert = async () => {
    setPanicSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/panic-alert`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_name: user?.name || peer?.firstName,
          user_phone: peer?.phone,
          message: panicMessage || 'Peer supporter needs immediate counsellor assistance',
        }),
      });

      if (response.ok) {
        setShowPanicModal(false);
        setPanicMessage('');
        Alert.alert(
          'Alert Sent',
          'A counsellor has been notified and will assist you shortly.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Could not send alert. Please try again or call directly.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please call a counsellor directly.');
    } finally {
      setPanicSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#22c55e';
      case 'limited': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  const getCallbackStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'in_progress': return '#4a90d9';
      case 'completed': return '#22c55e';
      default: return '#8899a6';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </SafeAreaView>
    );
  }

  const pendingCallbacks = callbacks.filter(c => c.status === 'pending');
  const myCallbacks = callbacks.filter(c => c.assigned_to === user?.id && c.status === 'in_progress');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Peer Support Portal</Text>
          <Text style={styles.subtitle}>Welcome, {user?.name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* PANIC BUTTON - Always visible */}
        <TouchableOpacity 
          style={styles.panicButton}
          onPress={() => setShowPanicModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="warning" size={28} color="#ffffff" />
          <View style={styles.panicTextContainer}>
            <Text style={styles.panicButtonText}>NEED COUNSELLOR HELP</Text>
            <Text style={styles.panicButtonSubtext}>Alert a counsellor for assistance</Text>
          </View>
        </TouchableOpacity>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Ionicons name="people-circle" size={60} color="#22c55e" />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{peer?.firstName || user?.name}</Text>
            <Text style={styles.profileDetail}>
              {peer ? `${peer.background}` : 'Peer Supporter'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(peer?.status || 'unavailable') }]}>
            <Text style={styles.statusText}>{peer?.status || 'Not Set'}</Text>
          </View>
        </View>

        {/* Status Update Buttons */}
        <Text style={styles.sectionTitle}>Your Status</Text>
        <View style={styles.statusButtonsRow}>
          <TouchableOpacity
            style={[styles.statusButtonSmall, peer?.status === 'available' && styles.statusButtonActive, { backgroundColor: '#22c55e' }]}
            onPress={() => updateStatus('available')}
            disabled={isUpdating}
          >
            <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            <Text style={styles.statusButtonSmallText}>Available</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusButtonSmall, peer?.status === 'limited' && styles.statusButtonActive, { backgroundColor: '#f59e0b' }]}
            onPress={() => updateStatus('limited')}
            disabled={isUpdating}
          >
            <Ionicons name="time" size={20} color="#ffffff" />
            <Text style={styles.statusButtonSmallText}>Limited</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusButtonSmall, peer?.status === 'unavailable' && styles.statusButtonActive, { backgroundColor: '#ef4444' }]}
            onPress={() => updateStatus('unavailable')}
            disabled={isUpdating}
          >
            <Ionicons name="close-circle" size={20} color="#ffffff" />
            <Text style={styles.statusButtonSmallText}>Unavailable</Text>
          </TouchableOpacity>
        </View>

        {/* My Availability Calendar */}
        <TouchableOpacity 
          style={styles.calendarCard}
          onPress={() => router.push('/my-availability')}
          activeOpacity={0.8}
        >
          <View style={styles.calendarIconContainer}>
            <Ionicons name="calendar" size={28} color="#10b981" />
          </View>
          <View style={styles.calendarContent}>
            <Text style={styles.calendarTitle}>My Availability</Text>
            <Text style={styles.calendarSubtitle}>Log your shifts and availability</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>

        {/* My Active Callbacks */}
        {myCallbacks.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your Active Callbacks</Text>
            {myCallbacks.map((callback) => (
              <View key={callback.id} style={styles.callbackCard}>
                <View style={styles.callbackHeader}>
                  <Text style={styles.callbackName}>{callback.name}</Text>
                  <View style={[styles.callbackStatusBadge, { backgroundColor: getCallbackStatusColor(callback.status) }]}>
                    <Text style={styles.callbackStatusText}>{callback.status.replace('_', ' ')}</Text>
                  </View>
                </View>
                <Text style={styles.callbackPhone}>{callback.phone}</Text>
                <Text style={styles.callbackMessage} numberOfLines={2}>{callback.message}</Text>
                <View style={styles.callbackActions}>
                  <TouchableOpacity 
                    style={styles.callbackActionButton}
                    onPress={() => completeCallback(callback.id)}
                  >
                    <Ionicons name="checkmark" size={18} color="#22c55e" />
                    <Text style={[styles.callbackActionText, { color: '#22c55e' }]}>Complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.callbackActionButton}
                    onPress={() => releaseCallback(callback.id)}
                  >
                    <Ionicons name="arrow-undo" size={18} color="#f59e0b" />
                    <Text style={[styles.callbackActionText, { color: '#f59e0b' }]}>Release</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Pending Callbacks */}
        <Text style={styles.sectionTitle}>
          Pending Callbacks {pendingCallbacks.length > 0 && `(${pendingCallbacks.length})`}
        </Text>
        {pendingCallbacks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
            <Text style={styles.emptyStateText}>No pending callbacks</Text>
          </View>
        ) : (
          pendingCallbacks.map((callback) => (
            <View key={callback.id} style={styles.callbackCard}>
              <View style={styles.callbackHeader}>
                <Text style={styles.callbackName}>{callback.name}</Text>
                <View style={[styles.callbackStatusBadge, { backgroundColor: getCallbackStatusColor(callback.status) }]}>
                  <Text style={styles.callbackStatusText}>Pending</Text>
                </View>
              </View>
              <Text style={styles.callbackPhone}>{callback.phone}</Text>
              <Text style={styles.callbackMessage} numberOfLines={2}>{callback.message}</Text>
              <Text style={styles.callbackTime}>
                {new Date(callback.created_at).toLocaleString()}
              </Text>
              <TouchableOpacity 
                style={styles.takeCallbackButton}
                onPress={() => takeCallback(callback.id)}
              >
                <Ionicons name="hand-left" size={18} color="#ffffff" />
                <Text style={styles.takeCallbackText}>Take This Callback</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {isUpdating && (
          <View style={styles.updatingOverlay}>
            <ActivityIndicator color="#4a90d9" />
            <Text style={styles.updatingText}>Updating...</Text>
          </View>
        )}
      </ScrollView>

      {/* Panic Modal */}
      <Modal visible={showPanicModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={32} color="#ef4444" />
              <Text style={styles.modalTitle}>Alert Counsellor</Text>
            </View>
            
            <Text style={styles.modalSubtext}>
              A counsellor will be notified immediately to assist you with your current call.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="What do you need help with? (optional)"
              placeholderTextColor="#8899a6"
              value={panicMessage}
              onChangeText={setPanicMessage}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowPanicModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalSendButton}
                onPress={submitPanicAlert}
                disabled={panicSubmitting}
              >
                {panicSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#ffffff" />
                    <Text style={styles.modalSendText}>Send Alert</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2332',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#243447',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#8899a6',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  panicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: '#fca5a5',
  },
  panicTextContainer: {
    flex: 1,
  },
  panicButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  panicButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: '#243447',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  profileDetail: {
    fontSize: 14,
    color: '#8899a6',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    marginTop: 8,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statusButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  statusButtonActive: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusButtonSmallText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243447',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  calendarIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#064e3b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  calendarContent: {
    flex: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  calendarSubtitle: {
    fontSize: 13,
    color: '#8899a6',
    marginTop: 2,
  },
  callbackCard: {
    backgroundColor: '#243447',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  callbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callbackName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  callbackStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  callbackStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  callbackPhone: {
    fontSize: 14,
    color: '#4a90d9',
    marginBottom: 6,
  },
  callbackMessage: {
    fontSize: 14,
    color: '#8899a6',
    lineHeight: 20,
  },
  callbackTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  callbackActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  callbackActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callbackActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  takeCallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a90d9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  takeCallbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyState: {
    backgroundColor: '#243447',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8899a6',
    marginTop: 8,
  },
  updatingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 12,
  },
  updatingText: {
    color: '#8899a6',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a2634',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ef4444',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#b0c4de',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#0d1b2a',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d3e50',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2d3e50',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b0c4de',
  },
  modalSendButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    gap: 8,
  },
  modalSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
