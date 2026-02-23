import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Toast } from '../src/components/Toast';
import { API_URL } from '../src/config/api';

interface Counsellor {
  id: string;
  name: string;
  specialization: string;
  status: string;
  phone: string;
  sms?: string;
  whatsapp?: string;
}

interface PeerSupporter {
  id: string;
  firstName: string;
  area: string;
  background: string;
  yearsServed: string;
  status: string;
  phone: string;
  sms?: string;
  whatsapp?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  description: string;
  phone: string;
  sms?: string;
  whatsapp?: string;
}

interface Resource {
  id: string;
  title: string;
  description?: string;
  category: string;
  content?: string;
  link?: string;
  image_url?: string;
}

interface SIPAssignment {
  id: string;
  name: string;
  type: 'counsellor' | 'peer';
  sip_extension?: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'counsellors' | 'peers' | 'orgs' | 'resources' | 'users' | 'content' | 'metrics' | 'callbacks' | 'alerts' | 'shifts'>('counsellors');
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [peers, setPeers] = useState<PeerSupporter[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [content, setContent] = useState<Record<string, Record<string, string>>>({});
  const [callMetrics, setCallMetrics] = useState<any>(null);
  const [callbacks, setCallbacks] = useState<any[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<any[]>([]);
  const [sipAssignments, setSipAssignments] = useState<SIPAssignment[]>([]);
  const [showSipModal, setShowSipModal] = useState(false);
  const [selectedSipTarget, setSelectedSipTarget] = useState<SIPAssignment | null>(null);
  const [sipFormData, setSipFormData] = useState({ extension: '', password: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<{ type: 'counsellor' | 'peer'; id: string; name: string; currentStatus: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingContent, setEditingContent] = useState({ page: '', section: '', value: '' });
  const { user, token, logout } = useAuth();
  const router = useRouter();

  // Enhanced CMS State
  const [cmsPages, setCmsPages] = useState<any[]>([]);
  const [cmsSections, setCmsSections] = useState<any[]>([]);
  const [cmsCards, setCmsCards] = useState<any[]>([]);
  const [selectedCmsPage, setSelectedCmsPage] = useState<string | null>(null);
  const [selectedCmsSection, setSelectedCmsSection] = useState<string | null>(null);
  const [showCmsPageModal, setShowCmsPageModal] = useState(false);
  const [showCmsSectionModal, setShowCmsSectionModal] = useState(false);
  const [showCmsCardModal, setShowCmsCardModal] = useState(false);
  const [cmsEditMode, setCmsEditMode] = useState<'add' | 'edit'>('add');
  const [cmsEditItem, setCmsEditItem] = useState<any>(null);

  // Toast state
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  };

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    phone: '',
    sms: '',
    whatsapp: '',
    firstName: '',
    area: '',
    background: '',
    yearsServed: '',
    // User account fields
    createAccount: false,
    email: '',
    password: '',
    // Organization fields
    description: '',
  });

  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'counsellor',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [resetPassword, setResetPassword] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    
    if (!user || user.role !== 'admin') {
      // Use setTimeout to ensure navigation happens after Root Layout mounts
      const timeout = setTimeout(() => {
        router.replace('/login');
      }, 100);
      return () => clearTimeout(timeout);
    }
    fetchData();
  }, [user, isMounted]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const authHeaders = { 'Authorization': `Bearer ${token}` };
      const [counsellorsRes, peersRes, orgsRes, resourcesRes, usersRes, contentRes, metricsRes, callbacksRes, alertsRes, sipRes, cmsPagesRes] = await Promise.all([
        fetch(`${API_URL}/api/counsellors`, { headers: authHeaders }),
        fetch(`${API_URL}/api/peer-supporters`, { headers: authHeaders }),
        fetch(`${API_URL}/api/organizations`),
        fetch(`${API_URL}/api/resources`),
        fetch(`${API_URL}/api/auth/users`, { headers: authHeaders }),
        fetch(`${API_URL}/api/content`),
        fetch(`${API_URL}/api/call-logs`, { headers: authHeaders }),
        fetch(`${API_URL}/api/callbacks`, { headers: authHeaders }),
        fetch(`${API_URL}/api/panic-alerts`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/sip-extensions`, { headers: authHeaders }),
        fetch(`${API_URL}/api/cms/pages/all`, { headers: authHeaders }),
      ]);
      
      if (counsellorsRes.ok) setCounsellors(await counsellorsRes.json());
      if (peersRes.ok) setPeers(await peersRes.json());
      if (orgsRes.ok) setOrganizations(await orgsRes.json());
      if (resourcesRes.ok) setResources(await resourcesRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (contentRes.ok) setContent(await contentRes.json());
      if (metricsRes.ok) setCallMetrics(await metricsRes.json());
      if (callbacksRes.ok) setCallbacks(await callbacksRes.json());
      if (alertsRes.ok) setPanicAlerts(await alertsRes.json());
      if (sipRes.ok) {
        const sipData = await sipRes.json();
        setSipAssignments(sipData.assignments || []);
      }
      if (cmsPagesRes.ok) setCmsPages(await cmsPagesRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // CMS Functions
  const fetchCmsSections = async (pageSlug: string) => {
    try {
      const response = await fetch(`${API_URL}/api/cms/sections/${pageSlug}`);
      if (response.ok) {
        setCmsSections(await response.json());
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  const fetchCmsCards = async (sectionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/cms/cards/${sectionId}`);
      if (response.ok) {
        setCmsCards(await response.json());
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const handleSeedCmsData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/cms/seed`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        showToast('CMS data seeded successfully', 'success');
        fetchData();
      } else {
        showToast('Failed to seed CMS data', 'error');
      }
    } catch (error) {
      showToast('Failed to seed CMS data', 'error');
    }
  };

  const handleDeleteCmsPage = async (slug: string) => {
    Alert.alert('Delete Page', 'Are you sure? This will delete all sections and cards.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_URL}/api/cms/pages/${slug}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });
            showToast('Page deleted', 'success');
            fetchData();
          } catch (error) {
            showToast('Failed to delete page', 'error');
          }
        },
      },
    ]);
  };

  const handleDeleteCmsSection = async (sectionId: string) => {
    try {
      await fetch(`${API_URL}/api/cms/sections/${sectionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      showToast('Section deleted', 'success');
      if (selectedCmsPage) fetchCmsSections(selectedCmsPage);
    } catch (error) {
      showToast('Failed to delete section', 'error');
    }
  };

  const handleDeleteCmsCard = async (cardId: string) => {
    try {
      await fetch(`${API_URL}/api/cms/cards/${cardId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      showToast('Card deleted', 'success');
      if (selectedCmsSection) fetchCmsCards(selectedCmsSection);
    } catch (error) {
      showToast('Failed to delete card', 'error');
    }
  };

  const handleAddCounsellor = async () => {
    try {
      // First create user account if requested
      let userId = null;
      if (formData.createAccount && formData.email && formData.password) {
        const userResponse = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: 'counsellor',
          }),
        });

        if (!userResponse.ok) {
          const error = await userResponse.json();
          Alert.alert('Error', error.detail || 'Failed to create user account');
          return;
        }
        const userData = await userResponse.json();
        userId = userData.id;
      }

      // Then create counsellor profile
      const response = await fetch(`${API_URL}/api/counsellors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          specialization: formData.specialization,
          phone: formData.phone,
          sms: formData.sms || null,
          whatsapp: formData.whatsapp || null,
          user_id: userId,
        }),
      });

      if (response.ok) {
        showToast(formData.createAccount 
          ? 'Counsellor added with login account' 
          : 'Counsellor added successfully', 'success');
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to add counsellor', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleAddPeer = async () => {
    try {
      // First create user account if requested
      let userId = null;
      if (formData.createAccount && formData.email && formData.password) {
        const userResponse = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.firstName,
            role: 'peer',
          }),
        });

        if (!userResponse.ok) {
          const error = await userResponse.json();
          Alert.alert('Error', error.detail || 'Failed to create user account');
          return;
        }
        const userData = await userResponse.json();
        userId = userData.id;
      }

      // Then create peer supporter profile
      const response = await fetch(`${API_URL}/api/peer-supporters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          area: formData.area,
          background: formData.background,
          yearsServed: formData.yearsServed,
          phone: formData.phone,
          sms: formData.sms || null,
          whatsapp: formData.whatsapp || null,
          user_id: userId,
        }),
      });

      if (response.ok) {
        showToast(formData.createAccount 
          ? 'Peer supporter added with login account' 
          : 'Peer supporter added successfully', 'success');
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to add peer supporter', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleAddOrganization = async () => {
    try {
      const response = await fetch(`${API_URL}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          phone: formData.phone,
          sms: formData.sms || null,
          whatsapp: formData.whatsapp || null,
        }),
      });

      if (response.ok) {
        showToast('Organization added successfully', 'success');
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to add organization', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleSeedOrganizations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/organizations/seed`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        showToast(data.message, 'success');
        fetchData();
      } else {
        showToast('Failed to seed organizations', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleAddResource = async () => {
    try {
      const response = await fetch(`${API_URL}/api/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.name,
          description: formData.description,
          category: formData.specialization || 'General',
          link: formData.whatsapp || null,
        }),
      });

      if (response.ok) {
        showToast('Resource added successfully', 'success');
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to add resource', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleSeedResources = async () => {
    try {
      const response = await fetch(`${API_URL}/api/resources/seed`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        showToast(data.message, 'success');
        fetchData();
      } else {
        showToast('Failed to seed resources', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleCreateUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(userFormData),
      });

      if (response.ok) {
        showToast(`User account created for ${userFormData.email}`, 'success');
        setShowUserModal(false);
        setUserFormData({ email: '', password: '', name: '', role: 'counsellor' });
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to create user', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        showToast('Password changed successfully', 'success');
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to change password', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleResetUserPassword = async () => {
    if (!selectedUser || !resetPassword) return;

    try {
      const response = await fetch(`${API_URL}/api/auth/admin-reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          new_password: resetPassword,
        }),
      });

      if (response.ok) {
        showToast(`Password reset for ${selectedUser.email}`, 'success');
        setShowResetModal(false);
        setSelectedUser(null);
        setResetPassword('');
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to reset password', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleUpdateContent = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/content/${editingContent.page}/${editingContent.section}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ content: editingContent.value }),
        }
      );

      if (response.ok) {
        showToast('Content updated successfully', 'success');
        setShowContentModal(false);
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to update content', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleSeedContent = async () => {
    try {
      const response = await fetch(`${API_URL}/api/content/seed`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showToast('Default content created', 'success');
        fetchData();
      }
    } catch (error) {
      showToast('Failed to seed content', 'error');
    }
  };

  // Admin Status Management
  const handleUpdateStaffStatus = async (newStatus: string) => {
    if (!selectedStaff) return;
    
    try {
      const endpoint = selectedStaff.type === 'counsellor' 
        ? `admin/counsellors/${selectedStaff.id}/status`
        : `admin/peer-supporters/${selectedStaff.id}/status`;
      
      const response = await fetch(`${API_URL}/api/${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        showToast(`${selectedStaff.name}'s status updated to ${newStatus}`, 'success');
        setShowStatusModal(false);
        setSelectedStaff(null);
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to update status', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  // Callback Management
  const handleTakeCallback = async (callbackId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/callbacks/${callbackId}/take`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showToast('Callback assigned to you', 'success');
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to take callback', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleReleaseCallback = async (callbackId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/callbacks/${callbackId}/release`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showToast('Callback released', 'success');
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to release callback', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleCompleteCallback = async (callbackId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/callbacks/${callbackId}/complete`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showToast('Callback completed', 'success');
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to complete callback', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  // Panic Alert Management
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/panic-alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showToast('Alert acknowledged', 'success');
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to acknowledge alert', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/panic-alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        showToast('Alert resolved', 'success');
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to resolve alert', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  // SIP Extension Management
  const handleAssignSip = async () => {
    if (!selectedSipTarget || !sipFormData.extension || !sipFormData.password) {
      showToast('Please fill in extension and password', 'error');
      return;
    }

    try {
      const endpoint = selectedSipTarget.type === 'counsellor'
        ? `admin/counsellors/${selectedSipTarget.id}/sip`
        : `admin/peer-supporters/${selectedSipTarget.id}/sip`;

      const response = await fetch(`${API_URL}/api/${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sip_extension: sipFormData.extension,
          sip_password: sipFormData.password,
        }),
      });

      if (response.ok) {
        showToast(`SIP extension ${sipFormData.extension} assigned to ${selectedSipTarget.name}`, 'success');
        setShowSipModal(false);
        setSipFormData({ extension: '', password: '' });
        setSelectedSipTarget(null);
        fetchData();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Failed to assign SIP extension', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleRemoveSip = async (staffId: string, staffType: 'counsellor' | 'peer', staffName: string) => {
    Alert.alert(
      'Remove SIP Extension',
      `Remove SIP extension from ${staffName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const endpoint = staffType === 'counsellor'
                ? `admin/counsellors/${staffId}/sip`
                : `admin/peer-supporters/${staffId}/sip`;

              const response = await fetch(`${API_URL}/api/${endpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (response.ok) {
                showToast(`SIP extension removed from ${staffName}`, 'success');
                fetchData();
              } else {
                const error = await response.json();
                showToast(error.detail || 'Failed to remove SIP extension', 'error');
              }
            } catch (error) {
              showToast('Network error', 'error');
            }
          },
        },
      ]
    );
  };

  const getAllStaffForSip = (): SIPAssignment[] => {
    const counsellorList = counsellors.map(c => ({
      id: c.id,
      name: c.name,
      type: 'counsellor' as const,
      sip_extension: (c as any).sip_extension,
    }));
    const peerList = peers.map(p => ({
      id: p.id,
      name: p.firstName,
      type: 'peer' as const,
      sip_extension: (p as any).sip_extension,
    }));
    return [...counsellorList, ...peerList];
  };

  const handleDelete = async (type: 'counsellor' | 'peer' | 'org' | 'resource' | 'user', id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              let endpoint = '';
              if (type === 'counsellor') endpoint = `counsellors/${id}`;
              else if (type === 'peer') endpoint = `peer-supporters/${id}`;
              else if (type === 'org') endpoint = `organizations/${id}`;
              else if (type === 'resource') endpoint = `resources/${id}`;
              else endpoint = `auth/users/${id}`;

              const response = await fetch(`${API_URL}/api/${endpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (response.ok) {
                showToast('Deleted successfully', 'success');
                fetchData();
              }
            } catch (error) {
              showToast('Failed to delete', 'error');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      specialization: '',
      phone: '',
      sms: '',
      whatsapp: '',
      firstName: '',
      area: '',
      background: '',
      yearsServed: '',
      createAccount: false,
      email: '',
      password: '',
      description: '',
    });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#22c55e';
      case 'busy': case 'limited': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  const pageNames: Record<string, string> = {
    'home': 'Home Page',
    'crisis-support': 'Crisis Support',
    'peer-support': 'Peer Support',
    'historical-investigations': 'Historical Investigations',
    'organizations': 'Organizations',
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Toast Notification */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Welcome, {user?.name}</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => setShowPasswordModal(true)} style={styles.headerButton}>
            <Ionicons name="key-outline" size={20} color="#4a90d9" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <View style={styles.tabs}>
          {(['counsellors', 'peers', 'shifts', 'callbacks', 'alerts', 'orgs', 'resources', 'users', 'content', 'metrics'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              data-testid={`admin-tab-${tab}`}
              style={[styles.tab, activeTab === tab && styles.activeTab, (tab === 'alerts' && panicAlerts.filter(a => a.status === 'active').length > 0) && styles.alertTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'content' ? 'CMS' : tab === 'metrics' ? 'Calls' : tab === 'orgs' ? 'Orgs' : tab === 'resources' ? 'Resources' : tab === 'callbacks' ? 'Callbacks' : tab === 'shifts' ? 'Rota' : tab === 'alerts' ? `Alerts${panicAlerts.filter(a => a.status === 'active').length > 0 ? ` (${panicAlerts.filter(a => a.status === 'active').length})` : ''}` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {activeTab !== 'content' && activeTab !== 'metrics' && activeTab !== 'resources' && activeTab !== 'callbacks' && activeTab !== 'alerts' && activeTab !== 'sip' && activeTab !== 'shifts' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>
              Add New {activeTab === 'counsellors' ? 'Counsellor' : activeTab === 'peers' ? 'Peer Supporter' : activeTab === 'orgs' ? 'Organization' : 'User'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'shifts' && (
        <View style={styles.shiftsContainer}>
          <View style={styles.shiftsHeader}>
            <Ionicons name="calendar" size={32} color="#10b981" />
            <Text style={styles.shiftsTitle}>Staff Rota & Availability</Text>
          </View>
          <Text style={styles.shiftsDesc}>
            View and manage peer supporter shift schedules. Volunteers can log their availability from their portal.
          </Text>
          <TouchableOpacity 
            style={styles.viewRotaButton}
            onPress={() => router.push('/my-availability')}
          >
            <Ionicons name="calendar-outline" size={20} color="#ffffff" />
            <Text style={styles.viewRotaButtonText}>View Full Calendar</Text>
          </TouchableOpacity>
        </View>
      )}

      {(activeTab === 'callbacks' || activeTab === 'alerts') && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.seedButton} onPress={fetchData}>
            <Ionicons name="refresh" size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'resources' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>Add New Resource</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.seedButton, { marginLeft: 8 }]} onPress={handleSeedResources}>
            <Ionicons name="cloud-download" size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>Load Defaults</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'orgs' && (
        <View style={[styles.actions, { marginTop: -8 }]}>
          <TouchableOpacity style={styles.seedButton} onPress={handleSeedOrganizations}>
            <Ionicons name="cloud-download" size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>Load UK Support Orgs</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'content' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.seedButton} onPress={handleSeedContent}>
            <Ionicons name="refresh" size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>Load Default Content</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'metrics' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.seedButton} onPress={fetchData}>
            <Ionicons name="refresh" size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>Refresh Data</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#4a90d9" />
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {activeTab === 'counsellors' && (
            counsellors.length === 0 ? (
              <Text style={styles.emptyText}>No counsellors added yet</Text>
            ) : (
              counsellors.map((c) => (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{c.name}</Text>
                    <TouchableOpacity 
                      style={[styles.statusBadge, { backgroundColor: getStatusColor(c.status) }]}
                      onPress={() => {
                        setSelectedStaff({ type: 'counsellor', id: c.id, name: c.name, currentStatus: c.status });
                        setShowStatusModal(true);
                      }}
                    >
                      <Text style={styles.statusText}>{c.status}</Text>
                      <Ionicons name="pencil" size={12} color="#ffffff" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardDetail}>{c.specialization}</Text>
                  <Text style={styles.cardDetail}>{c.phone}</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete('counsellor', c.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )
          )}

          {activeTab === 'peers' && (
            peers.length === 0 ? (
              <Text style={styles.emptyText}>No peer supporters added yet</Text>
            ) : (
              peers.map((p) => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{p.firstName}</Text>
                    <TouchableOpacity 
                      style={[styles.statusBadge, { backgroundColor: getStatusColor(p.status) }]}
                      onPress={() => {
                        setSelectedStaff({ type: 'peer', id: p.id, name: p.firstName, currentStatus: p.status });
                        setShowStatusModal(true);
                      }}
                    >
                      <Text style={styles.statusText}>{p.status}</Text>
                      <Ionicons name="pencil" size={12} color="#ffffff" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardDetail}>{p.area} - {p.background}</Text>
                  <Text style={styles.cardDetail}>{p.yearsServed} years served</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete('peer', p.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )
          )}

          {/* Callbacks Tab */}
          {activeTab === 'callbacks' && (
            callbacks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="call" size={48} color="#7c9cbf" />
                <Text style={styles.emptyText}>No callback requests</Text>
                <Text style={styles.emptySubtext}>When veterans request callbacks, they'll appear here</Text>
              </View>
            ) : (
              callbacks.map((cb) => (
                <View key={cb.id} style={[styles.card, cb.status === 'pending' && styles.urgentCard, cb.is_urgent && styles.safeguardingCard]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {cb.is_urgent && (
                        <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>URGENT</Text>
                        </View>
                      )}
                      {cb.safeguarding_alert_id && (
                        <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>SAFEGUARDING</Text>
                        </View>
                      )}
                      <Text style={styles.cardName}>{cb.name}</Text>
                    </View>
                    <View style={[styles.statusBadge, { 
                      backgroundColor: cb.status === 'pending' ? '#f59e0b' : 
                                       cb.status === 'in_progress' ? '#3b82f6' : '#22c55e' 
                    }]}>
                      <Text style={styles.statusText}>{cb.status.replace('_', ' ')}</Text>
                    </View>
                  </View>
                  <View style={styles.callbackMeta}>
                    <Ionicons name={cb.request_type === 'counsellor' ? 'medkit' : 'people'} size={14} color="#7c9cbf" />
                    <Text style={styles.cardDetailSmall}>{cb.request_type === 'counsellor' ? 'Counsellor' : 'Peer'} request</Text>
                  </View>
                  <Text style={styles.cardDetail}>Phone: {cb.phone}</Text>
                  {cb.email && <Text style={styles.cardDetailSmall}>Email: {cb.email}</Text>}
                  <Text style={styles.callbackMessage}>"{cb.message}"</Text>
                  <Text style={styles.cardDetailSmall}>
                    {new Date(cb.created_at).toLocaleString()}
                  </Text>
                  {cb.assigned_name && (
                    <Text style={styles.cardDetailSmall}>Assigned to: {cb.assigned_name}</Text>
                  )}
                  
                  <View style={styles.callbackActions}>
                    {cb.status === 'pending' && (
                      <TouchableOpacity 
                        style={styles.takeControlButton}
                        onPress={() => handleTakeCallback(cb.id)}
                      >
                        <Ionicons name="hand-left" size={16} color="#ffffff" />
                        <Text style={styles.actionButtonText}>Take Control</Text>
                      </TouchableOpacity>
                    )}
                    {cb.status === 'in_progress' && (
                      <>
                        <TouchableOpacity 
                          style={styles.completeButton}
                          onPress={() => handleCompleteCallback(cb.id)}
                        >
                          <Ionicons name="checkmark" size={16} color="#ffffff" />
                          <Text style={styles.actionButtonText}>Complete</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.releaseButton}
                          onPress={() => handleReleaseCallback(cb.id)}
                        >
                          <Ionicons name="arrow-undo" size={16} color="#ffffff" />
                          <Text style={styles.actionButtonText}>Release</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))
            )
          )}

          {/* Panic Alerts Tab */}
          {activeTab === 'alerts' && (
            panicAlerts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
                <Text style={styles.emptyText}>No panic alerts</Text>
                <Text style={styles.emptySubtext}>Great news - no emergency alerts at this time</Text>
              </View>
            ) : (
              panicAlerts.map((alert) => (
                <View key={alert.id} style={[styles.card, alert.status === 'active' && styles.panicCard]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.alertTitleRow}>
                      {alert.status === 'active' && <Ionicons name="warning" size={20} color="#ef4444" />}
                      <Text style={styles.cardName}>{alert.user_name || 'Anonymous'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { 
                      backgroundColor: alert.status === 'active' ? '#ef4444' : 
                                       alert.status === 'acknowledged' ? '#f59e0b' : '#22c55e' 
                    }]}>
                      <Text style={styles.statusText}>{alert.status}</Text>
                    </View>
                  </View>
                  {alert.user_phone && <Text style={styles.cardDetail}>Phone: {alert.user_phone}</Text>}
                  {alert.message && <Text style={styles.callbackMessage}>"{alert.message}"</Text>}
                  <Text style={styles.cardDetailSmall}>
                    {new Date(alert.created_at).toLocaleString()}
                  </Text>
                  {alert.acknowledged_by && (
                    <Text style={styles.cardDetailSmall}>Acknowledged by: {alert.acknowledged_by}</Text>
                  )}
                  {alert.resolved_by && (
                    <Text style={styles.cardDetailSmall}>Resolved by: {alert.resolved_by}</Text>
                  )}
                  
                  <View style={styles.callbackActions}>
                    {alert.status === 'active' && (
                      <TouchableOpacity 
                        style={styles.acknowledgeButton}
                        onPress={() => handleAcknowledgeAlert(alert.id)}
                      >
                        <Ionicons name="eye" size={16} color="#ffffff" />
                        <Text style={styles.actionButtonText}>Acknowledge</Text>
                      </TouchableOpacity>
                    )}
                    {(alert.status === 'active' || alert.status === 'acknowledged') && (
                      <TouchableOpacity 
                        style={styles.resolveButton}
                        onPress={() => handleResolveAlert(alert.id)}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                        <Text style={styles.actionButtonText}>Resolve</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )
          )}

          {activeTab === 'orgs' && (
            organizations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="business" size={48} color="#7c9cbf" />
                <Text style={styles.emptyText}>No organizations added yet</Text>
                <Text style={styles.emptySubtext}>Click "Load UK Veteran Resources" to add default organizations</Text>
              </View>
            ) : (
              organizations.map((org) => (
                <View key={org.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{org.name}</Text>
                    <Ionicons name="shield-checkmark" size={20} color="#7c9cbf" />
                  </View>
                  <Text style={styles.cardDetail} numberOfLines={2}>{org.description}</Text>
                  <Text style={styles.cardDetail}>{org.phone}</Text>
                  {org.sms && <Text style={styles.cardDetailSmall}>SMS: {org.sms}</Text>}
                  {org.whatsapp && <Text style={styles.cardDetailSmall}>WhatsApp: {org.whatsapp}</Text>}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete('org', org.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )
          )}

          {activeTab === 'resources' && (
            resources.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="library" size={48} color="#7c9cbf" />
                <Text style={styles.emptyText}>No resources added yet</Text>
                <Text style={styles.emptySubtext}>Click "Load Defaults" to add starter resources</Text>
              </View>
            ) : (
              resources.map((res) => (
                <View key={res.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{res.title}</Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{res.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDetail} numberOfLines={2}>{res.description}</Text>
                  {res.link && <Text style={styles.cardDetailSmall}>Link: {res.link}</Text>}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete('resource', res.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )
          )}

          {activeTab === 'users' && (
            users.length === 0 ? (
              <Text style={styles.emptyText}>No users found</Text>
            ) : (
              users.map((u) => (
                <View key={u.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{u.name}</Text>
                    <View style={[styles.roleBadge, u.role === 'admin' && styles.adminBadge]}>
                      <Text style={styles.roleText}>{u.role}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDetail}>{u.email}</Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.resetButton}
                      onPress={() => {
                        setSelectedUser(u);
                        setShowResetModal(true);
                      }}
                    >
                      <Ionicons name="key-outline" size={16} color="#4a90d9" />
                      <Text style={styles.resetButtonText}>Reset Password</Text>
                    </TouchableOpacity>
                    {u.role !== 'admin' && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete('user', u.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )
          )}

          {activeTab === 'content' && (
            <View style={styles.cmsContainer}>
              {/* CMS Header Actions */}
              <View style={styles.cmsActions}>
                <TouchableOpacity style={styles.seedButton} onPress={handleSeedCmsData}>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <Text style={styles.seedButtonText}>Initialize CMS</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.addCmsButton}
                  onPress={() => {
                    setCmsEditMode('add');
                    setCmsEditItem(null);
                    setShowCmsPageModal(true);
                  }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addCmsButtonText}>Add Page</Text>
                </TouchableOpacity>
              </View>

              {/* Pages List */}
              <Text style={styles.cmsHeading}>Pages</Text>
              {cmsPages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-outline" size={48} color="#64748b" />
                  <Text style={styles.emptyText}>No CMS pages found</Text>
                  <Text style={styles.emptySubtext}>Click "Initialize CMS" to create default pages</Text>
                </View>
              ) : (
                cmsPages.map((page) => (
                  <TouchableOpacity
                    key={page.slug}
                    style={[styles.cmsPageCard, selectedCmsPage === page.slug && styles.cmsPageCardSelected]}
                    onPress={() => {
                      setSelectedCmsPage(page.slug);
                      setSelectedCmsSection(null);
                      fetchCmsSections(page.slug);
                    }}
                  >
                    <View style={styles.cmsPageInfo}>
                      <Ionicons name={(page.icon || 'document') as any} size={24} color={selectedCmsPage === page.slug ? '#fff' : '#4a90d9'} />
                      <View style={styles.cmsPageText}>
                        <Text style={[styles.cmsPageTitle, selectedCmsPage === page.slug && styles.cmsPageTitleSelected]}>{page.title}</Text>
                        <Text style={[styles.cmsPageSlug, selectedCmsPage === page.slug && styles.cmsPageSlugSelected]}>/{page.slug}</Text>
                      </View>
                    </View>
                    <View style={styles.cmsPageActions}>
                      <TouchableOpacity
                        style={styles.cmsEditBtn}
                        onPress={() => {
                          setCmsEditMode('edit');
                          setCmsEditItem(page);
                          setShowCmsPageModal(true);
                        }}
                      >
                        <Ionicons name="pencil" size={16} color="#4a90d9" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cmsDeleteBtn}
                        onPress={() => handleDeleteCmsPage(page.slug)}
                      >
                        <Ionicons name="trash" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {/* Sections for Selected Page */}
              {selectedCmsPage && (
                <>
                  <View style={styles.cmsSectionHeader}>
                    <Text style={styles.cmsHeading}>Sections in "{cmsPages.find(p => p.slug === selectedCmsPage)?.title}"</Text>
                    <TouchableOpacity
                      style={styles.addSmallBtn}
                      onPress={() => {
                        setCmsEditMode('add');
                        setCmsEditItem({ page_slug: selectedCmsPage });
                        setShowCmsSectionModal(true);
                      }}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {cmsSections.length === 0 ? (
                    <Text style={styles.emptySubtext}>No sections. Add one above.</Text>
                  ) : (
                    cmsSections.map((section) => (
                      <TouchableOpacity
                        key={section.id}
                        style={[styles.cmsSectionCard, selectedCmsSection === section.id && styles.cmsSectionCardSelected]}
                        onPress={() => {
                          setSelectedCmsSection(section.id);
                          fetchCmsCards(section.id);
                        }}
                      >
                        <View style={styles.cmsSectionInfo}>
                          <Text style={styles.cmsSectionType}>{section.section_type}</Text>
                          <Text style={styles.cmsSectionTitle}>{section.title || '(No title)'}</Text>
                          <Text style={styles.cmsSectionOrder}>Order: {section.order}</Text>
                        </View>
                        <View style={styles.cmsPageActions}>
                          <TouchableOpacity
                            style={styles.cmsEditBtn}
                            onPress={() => {
                              setCmsEditMode('edit');
                              setCmsEditItem(section);
                              setShowCmsSectionModal(true);
                            }}
                          >
                            <Ionicons name="pencil" size={16} color="#4a90d9" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cmsDeleteBtn}
                            onPress={() => handleDeleteCmsSection(section.id)}
                          >
                            <Ionicons name="trash" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </>
              )}

              {/* Cards for Selected Section */}
              {selectedCmsSection && (
                <>
                  <View style={styles.cmsSectionHeader}>
                    <Text style={styles.cmsHeading}>Cards in Section</Text>
                    <TouchableOpacity
                      style={styles.addSmallBtn}
                      onPress={() => {
                        setCmsEditMode('add');
                        setCmsEditItem({ section_id: selectedCmsSection });
                        setShowCmsCardModal(true);
                      }}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {cmsCards.length === 0 ? (
                    <Text style={styles.emptySubtext}>No cards. Add one above.</Text>
                  ) : (
                    cmsCards.map((card) => (
                      <View key={card.id} style={styles.cmsCardItem}>
                        <View style={styles.cmsCardInfo}>
                          {card.icon && <Ionicons name={card.icon as any} size={20} color={card.color || '#4a90d9'} />}
                          {card.image_url && <Text style={styles.cmsCardImageIcon}>🖼</Text>}
                          <View style={styles.cmsCardText}>
                            <Text style={styles.cmsCardTitle}>{card.title}</Text>
                            <Text style={styles.cmsCardDesc}>{card.description || card.route}</Text>
                          </View>
                        </View>
                        <View style={styles.cmsPageActions}>
                          <TouchableOpacity
                            style={styles.cmsEditBtn}
                            onPress={() => {
                              setCmsEditMode('edit');
                              setCmsEditItem(card);
                              setShowCmsCardModal(true);
                            }}
                          >
                            <Ionicons name="pencil" size={16} color="#4a90d9" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cmsDeleteBtn}
                            onPress={() => handleDeleteCmsCard(card.id)}
                          >
                            <Ionicons name="trash" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}

              {/* Legacy Content Section */}
              <Text style={[styles.cmsHeading, { marginTop: 24 }]}>Legacy Text Content</Text>
              {Object.keys(content).length === 0 ? (
                <Text style={styles.emptySubtext}>No legacy content</Text>
              ) : (
                Object.entries(content).map(([pageName, sections]) => (
                  <View key={pageName} style={styles.contentCard}>
                    <Text style={styles.contentPageTitle}>{pageNames[pageName] || pageName}</Text>
                    {Object.entries(sections).map(([section, value]) => (
                      <TouchableOpacity
                        key={section}
                        style={styles.contentItem}
                        onPress={() => {
                          setEditingContent({ page: pageName, section, value });
                          setShowContentModal(true);
                        }}
                      >
                        <Text style={styles.contentSection}>{section.replace(/_/g, ' ')}</Text>
                        <Text style={styles.contentValue} numberOfLines={2}>{value}</Text>
                        <Ionicons name="pencil" size={16} color="#4a90d9" style={styles.editIcon} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </View>
          )}

          {/* Call Metrics Tab */}
          {activeTab === 'metrics' && (
            callMetrics ? (
              <>
                {/* Summary Cards */}
                <View style={styles.metricsContainer}>
                  <View style={styles.metricCard}>
                    <Ionicons name="call" size={28} color="#22c55e" />
                    <Text style={styles.metricValue}>{callMetrics.total_calls}</Text>
                    <Text style={styles.metricLabel}>Total Calls (30 days)</Text>
                  </View>
                </View>

                {/* Calls by Type */}
                <View style={styles.contentCard}>
                  <Text style={styles.contentPageTitle}>Calls by Contact Type</Text>
                  {Object.entries(callMetrics.calls_by_type || {}).map(([type, count]) => (
                    <View key={type} style={styles.metricRow}>
                      <View style={styles.metricRowLeft}>
                        <Ionicons 
                          name={type === 'counsellor' ? 'medkit' : type === 'peer' ? 'people' : 'call'} 
                          size={18} 
                          color="#7c9cbf" 
                        />
                        <Text style={styles.metricRowLabel}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                      </View>
                      <Text style={styles.metricRowValue}>{count as number}</Text>
                    </View>
                  ))}
                </View>

                {/* Calls by Method */}
                <View style={styles.contentCard}>
                  <Text style={styles.contentPageTitle}>Calls by Method</Text>
                  {Object.entries(callMetrics.calls_by_method || {}).map(([method, count]) => (
                    <View key={method} style={styles.metricRow}>
                      <View style={styles.metricRowLeft}>
                        <Ionicons 
                          name={method === 'phone' ? 'call' : method === 'sms' ? 'chatbubble' : 'logo-whatsapp'} 
                          size={18} 
                          color="#7c9cbf" 
                        />
                        <Text style={styles.metricRowLabel}>{method.charAt(0).toUpperCase() + method.slice(1)}</Text>
                      </View>
                      <Text style={styles.metricRowValue}>{count as number}</Text>
                    </View>
                  ))}
                </View>

                {/* Recent Activity */}
                <View style={styles.contentCard}>
                  <Text style={styles.contentPageTitle}>Recent Activity</Text>
                  {(callMetrics.recent_logs || []).slice(0, 10).map((log: any, index: number) => (
                    <View key={index} style={styles.logItem}>
                      <View style={styles.logIcon}>
                        <Ionicons 
                          name={log.call_method === 'phone' ? 'call' : log.call_method === 'sms' ? 'chatbubble' : 'logo-whatsapp'} 
                          size={16} 
                          color="#4a90d9" 
                        />
                      </View>
                      <View style={styles.logDetails}>
                        <Text style={styles.logName}>{log.contact_name}</Text>
                        <Text style={styles.logMeta}>
                          {log.contact_type} • {new Date(log.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {(callMetrics.recent_logs || []).length === 0 && (
                    <Text style={styles.emptySubtext}>No call activity yet</Text>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="analytics" size={48} color="#7c9cbf" />
                <Text style={styles.emptyText}>No call data available</Text>
                <Text style={styles.emptySubtext}>Call metrics will appear here once users start making calls</Text>
              </View>
            )
          )}

          {/* SIP Extension Management Tab */}
          {activeTab === 'sip' && (
            <>
              <View style={styles.sipHeader}>
                <View style={styles.sipHeaderInfo}>
                  <Ionicons name="call" size={24} color="#8b5cf6" />
                  <View>
                    <Text style={styles.sipHeaderTitle}>VoIP Extension Management</Text>
                    <Text style={styles.sipHeaderSubtitle}>Assign SIP extensions to staff for in-app calling</Text>
                  </View>
                </View>
              </View>

              {/* Available Extensions Info */}
              <View style={styles.sipInfoCard}>
                <View style={styles.sipInfoHeader}>
                  <Ionicons name="information-circle" size={20} color="#4a90d9" />
                  <Text style={styles.sipInfoTitle}>Available Extensions</Text>
                </View>
                <Text style={styles.sipInfoText}>
                  Extensions 1000-1003 are configured on your FusionPBX server at radiocheck.voip.synthesis-it.co.uk
                </Text>
              </View>

              {/* Staff List */}
              {getAllStaffForSip().length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people" size={48} color="#7c9cbf" />
                  <Text style={styles.emptyText}>No staff members found</Text>
                  <Text style={styles.emptySubtext}>Add counsellors or peer supporters first</Text>
                </View>
              ) : (
                getAllStaffForSip().map((staff) => (
                  <View key={`${staff.type}-${staff.id}`} style={[styles.card, staff.sip_extension && styles.sipAssignedCard]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.sipStaffInfo}>
                        <Ionicons 
                          name={staff.type === 'counsellor' ? 'medkit' : 'people'} 
                          size={18} 
                          color={staff.type === 'counsellor' ? '#22c55e' : '#3b82f6'} 
                        />
                        <Text style={styles.cardName}>{staff.name}</Text>
                        <View style={[styles.sipTypeBadge, { backgroundColor: staff.type === 'counsellor' ? '#22c55e' : '#3b82f6' }]}>
                          <Text style={styles.sipTypeBadgeText}>{staff.type}</Text>
                        </View>
                      </View>
                      {staff.sip_extension ? (
                        <View style={styles.sipExtBadge}>
                          <Ionicons name="call" size={14} color="#ffffff" />
                          <Text style={styles.sipExtBadgeText}>Ext. {staff.sip_extension}</Text>
                        </View>
                      ) : (
                        <View style={styles.sipNoExtBadge}>
                          <Text style={styles.sipNoExtText}>No Extension</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.callbackActions}>
                      {staff.sip_extension ? (
                        <TouchableOpacity 
                          style={styles.sipRemoveButton}
                          onPress={() => handleRemoveSip(staff.id, staff.type, staff.name)}
                          data-testid={`sip-remove-${staff.id}`}
                        >
                          <Ionicons name="close-circle" size={16} color="#ffffff" />
                          <Text style={styles.actionButtonText}>Remove SIP</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          style={styles.sipAssignButton}
                          onPress={() => {
                            setSelectedSipTarget(staff);
                            setSipFormData({ extension: '', password: '' });
                            setShowSipModal(true);
                          }}
                          data-testid={`sip-assign-${staff.id}`}
                        >
                          <Ionicons name="add-circle" size={16} color="#ffffff" />
                          <Text style={styles.actionButtonText}>Assign Extension</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Add Counsellor/Peer Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Add {activeTab === 'counsellors' ? 'Counsellor' : activeTab === 'peers' ? 'Peer Supporter' : activeTab === 'orgs' ? 'Organization' : activeTab === 'resources' ? 'Resource' : 'User'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {activeTab === 'counsellors' ? (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Name"
                    placeholderTextColor="#8899a6"
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Specialization (e.g., PTSD Support)"
                    placeholderTextColor="#8899a6"
                    value={formData.specialization}
                    onChangeText={(text) => setFormData({ ...formData, specialization: text })}
                  />
                </>
              ) : activeTab === 'peers' ? (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="First Name"
                    placeholderTextColor="#8899a6"
                    value={formData.firstName}
                    onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Area (e.g., London)"
                    placeholderTextColor="#8899a6"
                    value={formData.area}
                    onChangeText={(text) => setFormData({ ...formData, area: text })}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Background (e.g., Royal Marines)"
                    placeholderTextColor="#8899a6"
                    value={formData.background}
                    onChangeText={(text) => setFormData({ ...formData, background: text })}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Years Served"
                    placeholderTextColor="#8899a6"
                    value={formData.yearsServed}
                    onChangeText={(text) => setFormData({ ...formData, yearsServed: text })}
                  />
                </>
              ) : activeTab === 'orgs' ? (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Organization Name"
                    placeholderTextColor="#8899a6"
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                  />
                  <TextInput
                    style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    placeholder="Description"
                    placeholderTextColor="#8899a6"
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    multiline
                    numberOfLines={3}
                  />
                </>
              ) : activeTab === 'resources' ? (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Title"
                    placeholderTextColor="#8899a6"
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Category (e.g., Mental Health, Housing, Employment)"
                    placeholderTextColor="#8899a6"
                    value={formData.specialization}
                    onChangeText={(text) => setFormData({ ...formData, specialization: text })}
                  />
                  <TextInput
                    style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    placeholder="Description"
                    placeholderTextColor="#8899a6"
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    multiline
                    numberOfLines={3}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="External Link (optional)"
                    placeholderTextColor="#8899a6"
                    value={formData.whatsapp}
                    onChangeText={(text) => setFormData({ ...formData, whatsapp: text })}
                  />
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Name"
                    placeholderTextColor="#8899a6"
                    value={userFormData.name}
                    onChangeText={(text) => setUserFormData({ ...userFormData, name: text })}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Email"
                    placeholderTextColor="#8899a6"
                    value={userFormData.email}
                    onChangeText={(text) => setUserFormData({ ...userFormData, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Password"
                    placeholderTextColor="#8899a6"
                    value={userFormData.password}
                    onChangeText={(text) => setUserFormData({ ...userFormData, password: text })}
                    secureTextEntry
                  />
                  <View style={styles.roleSelector}>
                    <Text style={styles.roleLabel}>Role:</Text>
                    {['counsellor', 'peer', 'admin'].map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[styles.roleButton, userFormData.role === role && styles.roleButtonActive]}
                        onPress={() => setUserFormData({ ...userFormData, role })}
                      >
                        <Text style={styles.roleButtonText}>{role}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              
              {(activeTab === 'counsellors' || activeTab === 'peers' || activeTab === 'orgs') && (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Phone Number"
                    placeholderTextColor="#8899a6"
                    value={formData.phone}
                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="SMS Number (optional)"
                    placeholderTextColor="#8899a6"
                    value={formData.sms}
                    onChangeText={(text) => setFormData({ ...formData, sms: text })}
                  />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="WhatsApp Number (optional)"
                    placeholderTextColor="#8899a6"
                    value={formData.whatsapp}
                    onChangeText={(text) => setFormData({ ...formData, whatsapp: text })}
                  />

                  {/* Create Login Account Section - Only for counsellors and peers */}
                  {(activeTab === 'counsellors' || activeTab === 'peers') && (
                  <View style={styles.accountSection}>
                    <TouchableOpacity 
                      style={styles.checkboxRow}
                      onPress={() => setFormData({ ...formData, createAccount: !formData.createAccount })}
                    >
                      <View style={[styles.checkbox, formData.createAccount && styles.checkboxChecked]}>
                        {formData.createAccount && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                      </View>
                      <Text style={styles.checkboxLabel}>Create login account for this person</Text>
                    </TouchableOpacity>

                    {formData.createAccount && (
                      <>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="Email for login"
                          placeholderTextColor="#8899a6"
                          value={formData.email}
                          onChangeText={(text) => setFormData({ ...formData, email: text })}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                        <TextInput
                          style={styles.modalInput}
                          placeholder="Password"
                          placeholderTextColor="#8899a6"
                          value={formData.password}
                          onChangeText={(text) => setFormData({ ...formData, password: text })}
                          secureTextEntry
                        />
                      </>
                    )}
                  </View>
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                if (activeTab === 'counsellors') {
                  handleAddCounsellor();
                } else if (activeTab === 'peers') {
                  handleAddPeer();
                } else if (activeTab === 'orgs') {
                  handleAddOrganization();
                } else if (activeTab === 'resources') {
                  handleAddResource();
                } else if (activeTab === 'users') {
                  handleCreateUser();
                }
              }}
            >
              <Text style={styles.saveButtonText}>
                {activeTab === 'users' ? 'Create User' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create User Modal */}
      <Modal visible={showUserModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Login Account</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <TextInput
                style={styles.modalInput}
                placeholder="Name"
                placeholderTextColor="#8899a6"
                value={userFormData.name}
                onChangeText={(text) => setUserFormData({ ...userFormData, name: text })}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Email"
                placeholderTextColor="#8899a6"
                value={userFormData.email}
                onChangeText={(text) => setUserFormData({ ...userFormData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Password"
                placeholderTextColor="#8899a6"
                value={userFormData.password}
                onChangeText={(text) => setUserFormData({ ...userFormData, password: text })}
                secureTextEntry
              />
              <View style={styles.roleSelector}>
                <Text style={styles.roleLabel}>Role:</Text>
                {['counsellor', 'peer', 'admin'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleButton, userFormData.role === role && styles.roleButtonActive]}
                    onPress={() => setUserFormData({ ...userFormData, role })}
                  >
                    <Text style={styles.roleButtonText}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveButton} onPress={handleCreateUser}>
              <Text style={styles.saveButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Your Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <TextInput
                style={styles.modalInput}
                placeholder="Current Password"
                placeholderTextColor="#8899a6"
                value={passwordData.currentPassword}
                onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
                secureTextEntry
              />
              <TextInput
                style={styles.modalInput}
                placeholder="New Password"
                placeholderTextColor="#8899a6"
                value={passwordData.newPassword}
                onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                secureTextEntry
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Confirm New Password"
                placeholderTextColor="#8899a6"
                value={passwordData.confirmPassword}
                onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                secureTextEntry
              />
            </ScrollView>

            <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword}>
              <Text style={styles.saveButtonText}>Change Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reset User Password Modal */}
      <Modal visible={showResetModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowResetModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.resetUserInfo}>
              Resetting password for: {selectedUser?.email}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="New Password"
              placeholderTextColor="#8899a6"
              value={resetPassword}
              onChangeText={setResetPassword}
              secureTextEntry
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleResetUserPassword}>
              <Text style={styles.saveButtonText}>Reset Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Content Modal */}
      <Modal visible={showContentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Content</Text>
              <TouchableOpacity onPress={() => setShowContentModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.contentEditLabel}>
              {pageNames[editingContent.page] || editingContent.page} - {editingContent.section.replace(/_/g, ' ')}
            </Text>

            <TextInput
              style={[styles.modalInput, styles.contentTextArea]}
              placeholder="Content"
              placeholderTextColor="#8899a6"
              value={editingContent.value}
              onChangeText={(text) => setEditingContent({ ...editingContent, value: text })}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleUpdateContent}>
              <Text style={styles.saveButtonText}>Save Content</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Staff Status Change Modal */}
      <Modal visible={showStatusModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Status</Text>
              <TouchableOpacity onPress={() => { setShowStatusModal(false); setSelectedStaff(null); }}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {selectedStaff && (
              <>
                <Text style={styles.resetUserInfo}>
                  Updating status for: {selectedStaff.name}
                </Text>
                <Text style={styles.cardDetailSmall}>
                  Current status: {selectedStaff.currentStatus}
                </Text>

                <View style={styles.statusOptions}>
                  {selectedStaff.type === 'counsellor' ? (
                    <>
                      <TouchableOpacity 
                        style={[styles.statusOptionButton, { backgroundColor: '#22c55e' }]}
                        onPress={() => handleUpdateStaffStatus('available')}
                      >
                        <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                        <Text style={styles.statusOptionText}>Available</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.statusOptionButton, { backgroundColor: '#f59e0b' }]}
                        onPress={() => handleUpdateStaffStatus('busy')}
                      >
                        <Ionicons name="time" size={24} color="#ffffff" />
                        <Text style={styles.statusOptionText}>Busy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.statusOptionButton, { backgroundColor: '#ef4444' }]}
                        onPress={() => handleUpdateStaffStatus('off')}
                      >
                        <Ionicons name="moon" size={24} color="#ffffff" />
                        <Text style={styles.statusOptionText}>Off Duty</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity 
                        style={[styles.statusOptionButton, { backgroundColor: '#22c55e' }]}
                        onPress={() => handleUpdateStaffStatus('available')}
                      >
                        <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                        <Text style={styles.statusOptionText}>Available</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.statusOptionButton, { backgroundColor: '#f59e0b' }]}
                        onPress={() => handleUpdateStaffStatus('limited')}
                      >
                        <Ionicons name="time" size={24} color="#ffffff" />
                        <Text style={styles.statusOptionText}>Limited</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.statusOptionButton, { backgroundColor: '#ef4444' }]}
                        onPress={() => handleUpdateStaffStatus('unavailable')}
                      >
                        <Ionicons name="close-circle" size={24} color="#ffffff" />
                        <Text style={styles.statusOptionText}>Unavailable</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* SIP Extension Assignment Modal */}
      <Modal visible={showSipModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign SIP Extension</Text>
              <TouchableOpacity onPress={() => setShowSipModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {selectedSipTarget && (
              <View style={styles.sipModalInfo}>
                <Text style={styles.sipModalLabel}>Assigning extension to:</Text>
                <Text style={styles.sipModalName}>{selectedSipTarget.name}</Text>
                <Text style={styles.sipModalType}>({selectedSipTarget.type})</Text>
              </View>
            )}

            <ScrollView style={styles.modalForm}>
              <Text style={styles.sipInputLabel}>Extension Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., 1000"
                placeholderTextColor="#8899a6"
                value={sipFormData.extension}
                onChangeText={(text) => setSipFormData({ ...sipFormData, extension: text })}
                keyboardType="number-pad"
                data-testid="sip-extension-input"
              />

              <Text style={styles.sipInputLabel}>SIP Password</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter the SIP password"
                placeholderTextColor="#8899a6"
                value={sipFormData.password}
                onChangeText={(text) => setSipFormData({ ...sipFormData, password: text })}
                secureTextEntry
                data-testid="sip-password-input"
              />

              <View style={styles.sipHelpBox}>
                <Ionicons name="information-circle" size={16} color="#f59e0b" />
                <Text style={styles.sipHelpText}>
                  Get the extension and password from your FusionPBX admin panel. 
                  The password will be encrypted before storing.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={handleAssignSip}
              data-testid="sip-save-button"
            >
              <Text style={styles.saveButtonText}>Assign Extension</Text>
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
    backgroundColor: '#1a2332',
  },
  shiftsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  shiftsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  shiftsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  shiftsDesc: {
    fontSize: 14,
    color: '#8899a6',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  viewRotaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 10,
  },
  viewRotaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#243447',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#8899a6',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    backgroundColor: '#243447',
    borderRadius: 8,
  },
  tabsContainer: {
    maxHeight: 60,
  },
  tabs: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#243447',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#4a90d9',
  },
  tabText: {
    color: '#8899a6',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  userButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  seedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: '#8899a6',
    textAlign: 'center',
    marginTop: 40,
  },
  emptySubtext: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 12,
  },
  card: {
    backgroundColor: '#243447',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#4a90d9',
  },
  adminBadge: {
    backgroundColor: '#8b5cf6',
  },
  roleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#22c55e',
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardDetail: {
    color: '#8899a6',
    marginBottom: 4,
  },
  cardDetailSmall: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    backgroundColor: '#1a2332',
    borderRadius: 6,
  },
  resetButtonText: {
    color: '#4a90d9',
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  contentCard: {
    backgroundColor: '#243447',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  contentPageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    paddingBottom: 8,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  contentSection: {
    width: 120,
    color: '#8899a6',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  contentValue: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  editIcon: {
    marginLeft: 8,
  },
  accountSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#3d4f5f',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#7c9cbf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4a90e2',
    borderColor: '#4a90e2',
  },
  checkboxLabel: {
    color: '#ffffff',
    fontSize: 14,
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
    flexWrap: 'wrap',
  },
  roleLabel: {
    color: '#b0c4de',
    fontSize: 14,
    marginRight: 8,
  },
  roleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#3d4f5f',
  },
  roleButtonActive: {
    backgroundColor: '#4a90e2',
  },
  roleButtonText: {
    color: '#ffffff',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a2332',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalForm: {
    maxHeight: 400,
  },
  modalInput: {
    backgroundColor: '#243447',
    borderRadius: 8,
    padding: 14,
    color: '#ffffff',
    marginBottom: 12,
  },
  contentTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  contentEditLabel: {
    color: '#8899a6',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  resetUserInfo: {
    color: '#8899a6',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#4a90d9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Metrics Tab Styles
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#243447',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#8899a6',
    marginTop: 4,
    textAlign: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3f55',
  },
  metricRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricRowLabel: {
    fontSize: 14,
    color: '#ffffff',
  },
  metricRowValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a90d9',
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3f55',
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 144, 217, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logDetails: {
    flex: 1,
  },
  logName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  logMeta: {
    fontSize: 12,
    color: '#8899a6',
    marginTop: 2,
  },
  // New styles for callbacks, alerts, and status management
  alertTab: {
    backgroundColor: '#ef4444',
  },
  urgentCard: {
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  safeguardingCard: {
    borderWidth: 2,
    borderColor: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  panicCard: {
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  callbackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  callbackMessage: {
    color: '#b0c4de',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#4a90d9',
  },
  callbackActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  takeControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  releaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  acknowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusOptions: {
    marginTop: 16,
    gap: 12,
  },
  statusOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  statusOptionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // SIP Extension Management Styles
  sipTab: {
    backgroundColor: '#8b5cf6',
  },
  sipHeader: {
    backgroundColor: '#243447',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  sipHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sipHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  sipHeaderSubtitle: {
    color: '#8899a6',
    fontSize: 12,
    marginTop: 2,
  },
  sipInfoCard: {
    backgroundColor: 'rgba(74, 144, 217, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 217, 0.3)',
  },
  sipInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sipInfoTitle: {
    color: '#4a90d9',
    fontWeight: '600',
  },
  sipInfoText: {
    color: '#b0c4de',
    fontSize: 13,
    lineHeight: 18,
  },
  sipAssignedCard: {
    borderWidth: 2,
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  sipStaffInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sipTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sipTypeBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sipExtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  sipExtBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  sipNoExtBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sipNoExtText: {
    color: '#8899a6',
    fontSize: 12,
  },
  sipAssignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  sipRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  sipModalInfo: {
    backgroundColor: '#243447',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  sipModalLabel: {
    color: '#8899a6',
    fontSize: 12,
  },
  sipModalName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  sipModalType: {
    color: '#8b5cf6',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  sipInputLabel: {
    color: '#b0c4de',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 8,
  },
  sipHelpBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  sipHelpText: {
    color: '#f59e0b',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  // CMS Styles
  cmsContainer: {
    padding: 16,
  },
  cmsActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  seedButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addCmsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addCmsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cmsHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  cmsPageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#243447',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  cmsPageCardSelected: {
    backgroundColor: '#4a90d9',
  },
  cmsPageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cmsPageText: {
    gap: 2,
  },
  cmsPageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cmsPageTitleSelected: {
    color: '#fff',
  },
  cmsPageSlug: {
    fontSize: 12,
    color: '#8899a6',
  },
  cmsPageSlugSelected: {
    color: '#bfdbfe',
  },
  cmsPageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cmsEditBtn: {
    padding: 6,
    backgroundColor: 'rgba(74, 144, 217, 0.2)',
    borderRadius: 6,
  },
  cmsDeleteBtn: {
    padding: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 6,
  },
  cmsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
  },
  addSmallBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 6,
    padding: 6,
  },
  cmsSectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e2d3d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4a90d9',
  },
  cmsSectionCardSelected: {
    borderLeftColor: '#22c55e',
    backgroundColor: '#243447',
  },
  cmsSectionInfo: {
    gap: 4,
  },
  cmsSectionType: {
    fontSize: 11,
    color: '#4a90d9',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  cmsSectionTitle: {
    fontSize: 14,
    color: '#fff',
  },
  cmsSectionOrder: {
    fontSize: 11,
    color: '#64748b',
  },
  cmsCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a2332',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    marginLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#64748b',
  },
  cmsCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cmsCardImageIcon: {
    fontSize: 20,
  },
  cmsCardText: {
    flex: 1,
    gap: 2,
  },
  cmsCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  cmsCardDesc: {
    fontSize: 12,
    color: '#8899a6',
  },
});
